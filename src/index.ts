/**
 * index.ts — 程序入口
 *
 * 支持命令：
 *   /tree           — 查看会话树
 *   /branch <id>    — 分支到历史节点
 *   /branch <id> --summary — 分支并带 AI 生成的摘要
 *   /session        — 显示会话信息
 */

import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { getApiKey, saveApiKey } from "./config.js";
import { getToolDefinitions } from "./tools.js";
import { getPrompt } from "./prompt-manager.js";
import { Agent } from "./agent.js";
import { SessionManager } from "./session-manager.js";
import { summarizeMessages } from "./ai.js";
import type { SessionTreeNode } from "./types.js";

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

  const agent = new Agent(getPrompt("system"), getToolDefinitions(), sessionManager);

  console.log("[Mini Agent] 输入 exit 退出");
  console.log("[Mini Agent] /tree — 查看会话树");
  console.log("[Mini Agent] /branch <id> — 分支");
  console.log("[Mini Agent] /branch <id> --summary — 分支并自动生成摘要\n");

  while (true) {
    const userInput = await rl.question("你 > ");
    if (userInput.trim().toLowerCase() === "exit") {
      console.log("再见！");
      break;
    }

    if (userInput.startsWith("/")) {
      await handleCommand(userInput, agent);
      continue;
    }

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

async function handleCommand(input: string, agent: Agent): Promise<void> {
  const parts = input.trim().split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);
  const sm = agent.getSessionManager();

  switch (command) {
    case "/tree": {
      const tree = sm.getTree();
      if (tree.length === 0) {
        console.log("（空会话）\n");
        return;
      }
      printTree(tree, sm.getLeafId());
      break;
    }

    case "/branch": {
      if (args.length === 0) {
        console.log("用法: /branch <节点id> [--summary]\n");
        return;
      }

      const targetId = args[0];
      const withSummary = args.includes("--summary");

      try {
        if (withSummary) {
          // 获取被放弃的 entry
          const abandoned = sm.getAbandonedEntries(targetId);
          if (abandoned.length > 0) {
            console.log("[摘要] 正在生成分支摘要...");

            // 提取消息，过滤掉 tool 消息（对摘要无意义）
            const msgs = abandoned
              .filter(e => e.type === "message" && e.message.role !== "tool")
              .map(e => e.message);

            if (msgs.length > 0) {
              const summary = await summarizeMessages(msgs);
              sm.branchWithSummary(targetId, summary);
              console.log(`[摘要] ${summary.slice(0, 60)}...\n`);
            } else {
              sm.branch(targetId);
            }
          } else {
            console.log("[摘要] 没有找到需要摘要的路径，直接分支\n");
            sm.branch(targetId);
          }
        } else {
          sm.branch(targetId);
        }

        console.log(`[分支] 已切换到节点 ${targetId}\n`);
      } catch (error: any) {
        console.log(`[错误] ${error.message}\n`);
      }
      break;
    }

    case "/session": {
      console.log(`  ID:   ${sm.getSessionId()}`);
      console.log(`  文件: ${sm.getSessionFile()}`);
      console.log(`  节点: ${sm.getEntries().length} 个`);
      const leaf = sm.getLeafEntry();
      console.log(`  Leaf: ${leaf ? leaf.id : "null"}\n`);
      break;
    }

    default:
      console.log(`未知命令: ${command}\n`);
  }
}

function printTree(nodes: SessionTreeNode[], leafId: string | null, indent = ""): void {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const isLast = i === nodes.length - 1;
    const connector = isLast ? "└─ " : "├─ ";
    const isLeaf = node.entry.id === leafId;

    let label = "";
    if (node.entry.type === "message") {
      const msg = node.entry.message;
      if (msg.role === "user") {
        const text = msg.content ? msg.content.slice(0, 40) + (msg.content.length > 40 ? "..." : "") : "";
        label = `[用户] ${text}`;
      } else if (msg.role === "assistant") {
        const text = msg.content ? msg.content.slice(0, 40) + (msg.content.length > 40 ? "..." : "") : "(工具调用)";
        label = `[AI] ${text}`;
      } else if (msg.role === "tool") {
        label = `[工具] ${msg.name || ""}`;
      }
    } else if (node.entry.type === "branch_summary") {
      label = `[分支摘要] ${node.entry.summary.slice(0, 30)}...`;
    }

    const leafMark = isLeaf ? " ← leaf" : "";

    console.log(`${indent}${connector}${node.entry.id} ${label}${leafMark}`);

    const childIndent = indent + (isLast ? "   " : "│  ");
    printTree(node.children, leafId, childIndent);
  }
}

main().catch((error) => {
  console.error("程序出错：", error);
  rl.close();
});
