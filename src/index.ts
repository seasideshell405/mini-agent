/**
 * index.ts — 程序入口
 *
 * 职责只有一件事：读用户输入 → 交给 Agent → 打印回复
 *
 * 新增：SessionManager 初始化
 *   - 每次启动创建一个新会话（存到 ./sessions/ 目录）
 *   - 支持 /tree /branch /session 命令
 */

import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { getApiKey, saveApiKey } from "./config.js";
import { getToolDefinitions } from "./tools.js";
import { getPrompt } from "./prompt-manager.js";
import { Agent } from "./agent.js";
import { SessionManager } from "./session-manager.js";
import type { SessionTreeNode } from "./types.js";

const rl = readline.createInterface({ input, output });

// ===================== 首次运行引导 =====================

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

// ===================== 主循环 =====================

async function main() {
  await setupApiKey();

  // 初始化会话管理器（树结构 + 文件持久化）
  const sessionDir = "./sessions";
  const sessionManager = new SessionManager(process.cwd(), sessionDir);

  console.log(`[会话] ID: ${sessionManager.getSessionId()}`);
  console.log(`[会话] 文件: ${sessionManager.getSessionFile()}\n`);

  const agent = new Agent(getPrompt("system"), getToolDefinitions(), sessionManager);

  console.log("[Mini Agent] 输入 exit 退出");
  console.log("[Mini Agent] 输入 /tree 查看会话树");
  console.log("[Mini Agent] 输入 /branch <节点id> 分支到历史消息\n");

  while (true) {
    const userInput = await rl.question("你 > ");
    if (userInput.trim().toLowerCase() === "exit") {
      console.log("再见！");
      break;
    }

    // 处理内部命令
    if (userInput.startsWith("/")) {
      await handleCommand(userInput, agent);
      continue;
    }

    // 普通消息 → 交给 Agent
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

/**
 * 处理内部命令
 */
async function handleCommand(input: string, agent: Agent): Promise<void> {
  const parts = input.trim().split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);
  const sm = agent.getSessionManager();

  switch (command) {
    case "/tree": {
      // 打印会话树
      const tree = sm.getTree();
      if (tree.length === 0) {
        console.log("（空会话）\n");
        return;
      }
      printTree(tree, sm.getLeafId());
      break;
    }

    case "/branch": {
      // 分支到指定节点
      if (args.length === 0) {
        console.log("用法: /branch <节点id>\n");
        return;
      }
      const targetId = args[0];
      try {
        sm.branch(targetId);
        console.log(`[分支] 已切换到节点 ${targetId}\n`);
      } catch (error: any) {
        console.log(`[错误] ${error.message}\n`);
      }
      break;
    }

    case "/session": {
      // 显示会话信息
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

/**
 * 递归打印会话树，标记当前 leaf 位置
 * 用缩进和连线表示树状结构
 */
function printTree(nodes: SessionTreeNode[], leafId: string | null, indent = ""): void {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const isLast = i === nodes.length - 1;
    const connector = isLast ? "└─ " : "├─ ";
    const isLeaf = node.entry.id === leafId;

    // 构造标签
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

    // 标记 leaf
    const leafMark = isLeaf ? " ← leaf" : "";

    console.log(`${indent}${connector}${node.entry.id} ${label}${leafMark}`);

    // 递归子节点
    const childIndent = indent + (isLast ? "   " : "│  ");
    printTree(node.children, leafId, childIndent);
  }
}

main().catch((error) => {
  console.error("程序出错：", error);
  rl.close();
});
