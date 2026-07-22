/**
 * tools/index.ts — 工具加载器
 *
 * 这个文件会自动扫描 tools/ 目录下除了自身和 __ 开头的所有 .ts 文件，
 * 动态加载它们，暴露出统一的 getToolDefinitions() 和 executeTool()。
 *
 * 新增工具只需两步：
 *   1. 在 tools/ 下创建一个 .ts 文件（参考 __template__.ts）
 *   2. 确保文件导出了 toolDefinition 和 execute
 * 删除工具：直接删除对应的 .ts 文件即可
 *
 * 不需要手动注册！一切自动完成。
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ToolDefinition, ToolImplementation } from "../types.js";

/** 拿到当前文件所在目录的绝对路径 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let definitions: ToolDefinition[] = [];
let implementations: Record<string, ToolImplementation> = {};

/**
 * 扫描 tools/ 目录，动态加载所有工具文件
 *
 * @param bustCache - 是否跳过模块缓存（用于热加载时的重新 import）
 */
async function init(bustCache = false) {
  // 清空旧数据
  definitions = [];
  implementations = {};

  const files = fs.readdirSync(__dirname);

  for (const file of files) {
    if (!file.endsWith(".ts")) continue;
    if (file === "index.ts" || file === "index.js") continue;
    if (file.startsWith("__")) continue;

    try {
      // bustCache 时加时间戳绕过 Node 的模块缓存
      const cacheBuster = bustCache ? `?t=${Date.now()}` : "";
      const mod = await import(`./${file}${cacheBuster}`);

      if (mod.toolDefinition && mod.execute) {
        const name = mod.toolDefinition.function.name;
        definitions.push(mod.toolDefinition);
        implementations[name] = mod.execute;
        console.log(`[工具] 已加载: ${name} (${file})`);
      }
    } catch (error: any) {
      console.error(`[工具] 加载失败: ${file} — ${error.message}`);
    }
  }
}

// 模块加载时的首次初始化
await init();

/**
 * 热加载 —— 重新扫描 tools/ 目录并重新 import 所有工具
 */
export async function reloadTools(): Promise<void> {
  console.log("[工具] 重新加载中...");
  await init(true);
  console.log("[工具] 重新加载完成\n");
}

export function getToolDefinitions(): ToolDefinition[] {
  return definitions;
}

export function executeTool(name: string, args: Record<string, any>): string {
  const fn = implementations[name];
  if (!fn) {
    return `错误: 未知工具 "${name}"`;
  }
  return fn(args);
}
