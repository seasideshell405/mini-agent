/**
 * index.ts — 程序入口
 *
 * 现在指令和工具都拆成了独立文件，由各自的 index.ts 自动发现加载：
 *   - src/tools/  目录 — 每个 AI 工具一个文件
 *   - src/commands/ 目录 — 每个 /指令 一个文件
 */

import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { getApiKey, saveApiKey, getActivePersona, saveActivePersona } from "./config.js";
import { getToolDefinitions } from "./tools/index.js";
import { getPrompt, buildSystemPrompt } from "./prompts/index.js";
import { Agent } from "./agent.js";
import { SessionManager } from "./session-manager.js";
import { executeCommand, getCommandHelp, reloadCommands } from "./commands/index.js";
import { reloadTools } from "./tools/index.js";
import { summarizeMessages } from "./ai.js";
import { Scheduler } from "./scheduler/index.js";
import { logger } from "./logger/index.js";

const rl = readline.createInterface({ input, output });

// ===== 中止机制：监听 Escape 键 =====
// readline.createInterface 在 TTY 模式下会自动设置 raw mode 和 keypress 事件，
// 我们只需要额外监听 Escape 键，调用 agent.abort() 即可。
let currentAgent: Agent | null = null;
process.stdin.on("keypress", (_str, key) => {
  if (key?.name === "escape" && currentAgent) {
    currentAgent.abort();
  }
});

async function setupApiKey(): Promise<void> {
  const existingKey = getApiKey();
  if (existingKey) return;

  // 配置 API Key 的提示信息直接 console.log 打给用户看，不走日志系统
  console.log("[配置] 首次运行！需要配置 API Key 才能使用。");
  console.log("（Key 会保存在项目目录的 .env 文件中，下次启动不再询问）\n");

  const key = await rl.question("请输入你的 DeepSeek API Key: ");
  if (!key.trim()) {
    // 用户输入为空属于程序错误，记入日志
    logger.error("system", "API Key 为空，进程退出");
    process.exit(1);
  }

  saveApiKey(key.trim());
  console.log("[完成] 已保存！开始使用吧\n");
}

async function main() {
  await setupApiKey();

  const sessionDir = "./sessions";
  const sessionManager = new SessionManager(process.cwd(), sessionDir);

  // 用户提示走 console.log，技术细节走 logger（只写文件）
  console.log(`[会话] ID: ${sessionManager.getSessionId()}`);
  console.log(`[会话] 文件: ${sessionManager.getSessionFile()}`);
  logger.info("system", `会话 ID: ${sessionManager.getSessionId()}`);
  logger.info("system", `会话文件: ${sessionManager.getSessionFile()}`);

  // 读取上次保存的人格（没有就默认 "default"）
  const savedPersona = getActivePersona() || "default";
  console.log(`[配置] 当前人格: ${savedPersona}`);
  logger.info("system", `当前人格: ${savedPersona}`);

  let agent = new Agent(buildSystemPrompt(savedPersona), getToolDefinitions(), sessionManager);
  currentAgent = agent;

  // ===== 启动定时任务调度器 =====
  // 调度器在后台每 60 秒检查一次，执行到期的定时任务
  const scheduler = new Scheduler();
  scheduler.onTaskMessage = (taskName, message) => {
    // 把任务消息作为 system 角色注入 session，成为 AI 上下文的一部分
    // 下次用户输入时，AI 会看到这条消息
    sessionManager.appendMessage({
      role: "system",
      content: `[定时任务: ${taskName}] ${message}`,
    });
    // 同时在控制台打印通知，让用户知道
    console.log(`\n[定时任务] ${taskName}: ${message}\n`);
  };
  scheduler.start();

  // 程序退出时停止调度器
  process.on("exit", () => scheduler.stop());

  // 启动时动态打印所有可用的指令——这些是给用户看的操作指引，留在控制台不打日志
  console.log("可用指令：");
  for (const line of getCommandHelp()) {
    console.log(`  ${line}`);
  }
  console.log();

  while (true) {
    const userInput = await rl.question("你 > ");

    // 以 / 开头 → 走指令系统
    if (userInput.startsWith("/")) {
      const result = await executeCommand(userInput, {
        agent,
        getPrompt,
        buildSystemPrompt,
        saveActivePersona,
        getToolDefinitions,
        summarizeMessages,
        reloadTools,
        reloadCommands,
        sessionDir,
      });
      if (result.newAgent) {
        agent = result.newAgent;
        currentAgent = agent;
      }
      if (result.shouldExit) break;
      continue;
    }

    // 否则走 AI 对话
    console.log("AI > 思考中...");
    logger.info("system", `用户输入: ${userInput}`);
    try {
      const reply = await agent.processMessage(userInput);
      console.log(`AI > ${reply}\n`);
      logger.info("system", `AI 回复: ${reply}`);
    } catch (error) {
      // 错误信息两边都要：用户需要看到，日志需要记录
      logger.error("system", "AI 对话异常", { error: String(error) });
      console.error("错误:", error);
    }
  }

  // 停止调度器
  scheduler.stop();

  // 退出前检查：如果用户啥都没说（没有消息记录），删掉这个空会话
  if (sessionManager.isEmpty()) {
    sessionManager.deleteSessionFile();
  } else {
    logger.info("system", `会话已保存: ${sessionManager.getSessionFile()}`);
  }

  rl.close();
}

main().catch((error) => {
  // 程序崩溃的异常信息两边都要记录
  logger.error("system", "程序崩溃", { error: String(error) });
  console.error("程序出错：", error);
  rl.close();
});
