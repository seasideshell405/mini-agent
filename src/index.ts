/**
 * index.ts — 程序入口
 *
 * 职责只有一件事：读用户输入 → 交给 Agent → 打印回复
 * 像餐厅的前台：收单子 → 交给后厨 → 上菜
 *
 * 对应 Pi 的 packages/coding-agent/
 */

import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { getApiKey, saveApiKey } from "./config.js";
import { getToolDefinitions } from "./tools.js";
import { getPrompt } from "./prompt-manager.js";
import { Agent } from "./agent.js";

const rl = readline.createInterface({ input, output });

// ===================== 首次运行引导 =====================

async function setupApiKey(): Promise<void> {
  const existingKey = getApiKey();
  if (existingKey) return; // 已经有 key 了，跳过

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

// ===================== 主循环 =====================

async function main() {
  // 先配置 API Key，再启动 agent
  await setupApiKey();

  const agent = new Agent(getPrompt("system"), getToolDefinitions());

  console.log("[Mini Agent] 输入 exit 退出\n");

  while (true) {
    const userInput = await rl.question("你 > ");
    if (userInput.trim().toLowerCase() === "exit") {
      console.log("再见！");
      break;
    }

    console.log("AI > 思考中...");
    const reply = await agent.processMessage(userInput);
    console.log(`AI > ${reply}\n`);
  }

  rl.close();
}

main().catch((error) => {
  console.error("程序出错：", error);
  rl.close();
});
