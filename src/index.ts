/**
 * index.ts — 程序入口
 *
 * 现在指令和工具都拆成了独立文件，由各自的 index.ts 自动发现加载：
 *   - src/tools/  目录 — 每个 AI 工具一个文件
 *   - src/commands/ 目录 — 每个 /指令 一个文件
 */

import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { getApiKey, saveApiKey } from "./config.js";
import { getToolDefinitions } from "./tools/index.js";
import { getPrompt } from "./prompts/index.js";
import { Agent } from "./agent.js";
import { SessionManager } from "./session-manager.js";
import { executeCommand, getCommandHelp, reloadCommands } from "./commands/index.js";
import { reloadTools } from "./tools/index.js";
import { summarizeMessages } from "./ai.js";

const rl = readline.createInterface({ input, output });

async function setupApiKey(): Promise<void> {
  const existingKey = getApiKey();
  if (existingKey) return;

  console.log("[配置] 首次运行！需要配置 API Key 才能使用。");
  console.log("（Key 会保存在项目目录的 .env 文件中，下次启动不再询问）\n");

  const key = await rl.question("请输入你的 DeepSeek API Key: ");
  if (!key.trim()) {
    console.error("错误：API Key 不能为空");
    process.exit(1);
  }

  saveApiKey(key.trim());
  console.log("[完成] 已保存！开始使用吧\n");
}

async function main() {
  await setupApiKey();

  const sessionDir = "./sessions";
  const sessionManager = new SessionManager(process.cwd(), sessionDir);

  console.log(`[会话] ID: ${sessionManager.getSessionId()}`);
  console.log(`[会话] 文件: ${sessionManager.getSessionFile()}\n`);

  let agent = new Agent(getPrompt("system"), getToolDefinitions(), sessionManager);

  // 启动时动态打印所有可用的指令
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
        getToolDefinitions,
        summarizeMessages,
        reloadTools,
        reloadCommands,
        sessionDir,
      });
      if (result.newAgent) agent = result.newAgent;
      if (result.shouldExit) break;
      continue;
    }

    // 否则走 AI 对话
    console.log("AI > 思考中...");
    try {
      const reply = await agent.processMessage(userInput);
      console.log(`AI > ${reply}\n`);
    } catch (error) {
      console.error("错误:", error);
    }
  }

  rl.close();
}

main().catch((error) => {
  console.error("程序出错：", error);
  rl.close();
});
