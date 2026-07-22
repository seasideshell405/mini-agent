/**
 * commands/index.ts — 指令加载器
 *
 * 和 tools/index.ts 同样的自动发现模式：
 *   - 扫描 commands/ 目录下所有 .ts 文件
 *   - 跳过自身 (index.ts) 和 __ 开头的文件（模板）
 *   - 动态加载，统一暴露 executeCommand() 和 getCommandHelp()
 *
 * 新增指令只需两步：
 *   1. 在 commands/ 下创建一个 .ts 文件（参考 __template__.ts）
 *   2. 确保文件导出了 commandDefinition 和 execute
 * 删除指令：直接删除对应的 .ts 文件即可
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** 拿到当前文件所在目录的绝对路径 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 指令模块的内部结构 */
type CommandModule = {
  commandDefinition: { name: string; description: string; usage: string };
  execute: (args: string[], context: any) => Promise<{ shouldExit: boolean; newAgent?: any }>;
};

/** 按指令名（如 "/tree"）存储加载好的模块 */
let commands = new Map<string, CommandModule>();

/**
 * 扫描 commands/ 目录，动态加载所有指令文件
 *
 * @param bustCache - 是否跳过模块缓存（用于热加载时的重新 import）
 */
async function init(bustCache = false) {
  commands = new Map();

  const files = fs.readdirSync(__dirname);

  for (const file of files) {
    if (!file.endsWith(".ts")) continue;
    if (file === "index.ts" || file === "index.js") continue;
    if (file.startsWith("__")) continue;

    try {
      const cacheBuster = bustCache ? `?t=${Date.now()}` : "";
      const mod = await import(`./${file}${cacheBuster}`) as CommandModule;

      if (mod.commandDefinition && mod.execute) {
        const name = mod.commandDefinition.name;
        commands.set(name, mod);
        console.log(`[指令] 已加载: ${name} (${file})`);
      }
    } catch (error: any) {
      console.error(`[指令] 加载失败: ${file} — ${error.message}`);
    }
  }
}

await init();

/**
 * 热加载 —— 重新扫描 commands/ 目录并重新 import 所有指令
 */
export async function reloadCommands(): Promise<void> {
  console.log("[指令] 重新加载中...");
  await init(true);
  console.log("[指令] 重新加载完成\n");
}

/**
 * 执行指定名称的指令
 *
 * @param input - 用户输入的完整指令字符串，如 "/branch abc123 --summary"
 * @param context - 上下文对象，传给每个指令的 execute
 * @returns 指令执行结果
 */
export async function executeCommand(
  input: string,
  context: any
): Promise<{ shouldExit: boolean; newAgent?: any }> {
  const parts = input.trim().split(/\s+/);
  const commandName = parts[0].toLowerCase();
  const args = parts.slice(1);

  const cmd = commands.get(commandName);
  if (!cmd) {
    console.log(`未知命令: ${commandName}\n`);
    return { shouldExit: false };
  }

  return cmd.execute(args, context);
}

/**
 * 获取所有已加载指令的帮助文本
 * 用于在程序启动时打印可用指令列表
 */
export function getCommandHelp(): string[] {
  const lines: string[] = [];
  for (const [, cmd] of commands) {
    lines.push(`  ${cmd.commandDefinition.usage} — ${cmd.commandDefinition.description}`);
  }
  return lines;
}
