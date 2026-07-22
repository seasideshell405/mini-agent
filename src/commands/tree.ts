/**
 * commands/tree.ts — /tree 指令
 *
 * 展示会话树结构，让用户看到会话分支历史
 */

import type { SessionTreeNode } from "../types.js";

/** 指令定义 */
export const commandDefinition = {
  name: "/tree",
  description: "查看会话树",
  usage: "/tree",
};

/** 指令执行函数 */
export async function execute(args: string[], context: { agent: any }): Promise<{ shouldExit: boolean; newAgent?: any }> {
  const sm = context.agent.getSessionManager();
  const tree = sm.getTree();

  if (tree.length === 0) {
    console.log("（空会话）\n");
    return { shouldExit: false };
  }

  printTree(tree, sm.getLeafId());
  return { shouldExit: false };
}

/**
 * 递归打印会话树
 * 用 ├─ └─ │ 等字符画出树形结构
 */
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
