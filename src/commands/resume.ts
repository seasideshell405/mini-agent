/**
 * commands/resume.ts — /resume 指令
 *
 * 恢复历史会话：列出所有 .jsonl 文件，按序号加载
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { Agent } from "../agent.js";
import { SessionManager } from "../session-manager.js";

/** 指令定义 */
export const commandDefinition = {
  name: "/resume",
  description: "恢复历史会话（列出或加载指定会话）",
  usage: "/resume [序号]",
};

/** 指令执行函数 */
export async function execute(
  args: string[],
  context: { getPrompt: () => string; getToolDefinitions: () => any[] }
): Promise<{ shouldExit: boolean; newAgent?: any }> {
  const sessionDir = "./sessions";

  // 列出所有 .jsonl 会话文件，按文件名倒序（最新的在前面）
  let files: string[] = [];
  try {
    files = fs.readdirSync(sessionDir)
      .filter(f => f.endsWith(".jsonl"))
      .sort()
      .reverse();
  } catch {
    console.log(`[错误] 无法读取会话目录: ${sessionDir}\n`);
    return { shouldExit: false };
  }

  if (files.length === 0) {
    console.log("[提示] 没有找到历史会话\n");
    return { shouldExit: false };
  }

  // 无参 → 列出所有会话
  if (args.length === 0) {
    console.log("可用的历史会话：");
    files.forEach((f, i) => {
      // 文件名格式: 时间戳_会话ID.jsonl
      // 例: 2026-07-18T18-52-38-703Z_6105f768-mrqq519r.jsonl
      const ts = f.split("_")[0].replace(/-/g, ":").replace(/T/, " ").slice(0, 19);
      const id = f.replace(".jsonl", "").split("_").slice(1).join("_");
      console.log(`  [${i}] ${ts}  ${id}`);
    });
    console.log("用法: /resume <序号>\n");
    return { shouldExit: false };
  }

  // 有参 → 按序号加载
  const index = parseInt(args[0], 10);
  if (isNaN(index) || index < 0 || index >= files.length) {
    console.log(`[错误] 无效序号: ${args[0]}，可用范围 0-${files.length - 1}\n`);
    return { shouldExit: false };
  }

  const filePath = path.resolve(sessionDir, files[index]);
  const sm = SessionManager.load(filePath);
  if (!sm) {
    console.log(`[错误] 无法加载会话: ${files[index]}\n`);
    return { shouldExit: false };
  }

  const newAgent = new Agent(context.getPrompt("system"), context.getToolDefinitions(), sm);
  console.log(`[完成] 已切换到历史会话 ${sm.getSessionId()}\n`);
  return { shouldExit: false, newAgent };
}
