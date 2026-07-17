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
import { checkApiKey } from "./ai.js";
import { getToolDefinitions } from "./tools.js";
import { getPrompt } from "./prompt-manager.js";
import { Agent } from "./agent.js";

// ===================== 启动检查 =====================

checkApiKey();

// ===================== 初始化 =====================

// 从 prompts.json 读取系统提示词，不再硬编码
const agent = new Agent(getPrompt("system"), getToolDefinitions());

const rl = readline.createInterface({ input, output });

// ===================== 主循环 =====================

async function main() {
  console.log("🤖 迷你 AI Agent (模块化重构版！输入 exit 退出)\n");

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
