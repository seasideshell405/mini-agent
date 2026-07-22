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

const definitions: ToolDefinition[] = [];
const implementations: Record<string, ToolImplementation> = {};

/**
 * 扫描 tools/ 目录，动态加载所有工具文件
 *
 * 使用异步初始化 + 顶层 await，这样在模块加载完成之前，
 * 外面 import 这个模块的代码会等待初始化结束。
 */
async function init() {
  // 读取当前目录（src/tools/）下的所有文件
  const files = fs.readdirSync(__dirname);

  for (const file of files) {
    // 只处理 .ts 文件
    if (!file.endsWith(".ts")) continue;
    // 跳过自身（index.ts）
    if (file === "index.ts" || file === "index.js") continue;
    // 跳过隐藏文件（如 __template__.ts 这种模板）
    if (file.startsWith("__")) continue;

    try {
      // 动态 import —— tsx 支持直接 import .ts 文件
      const mod = await import(`./${file}`);

      // 每个工具文件必须导出 toolDefinition 和 execute
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

// 顶层 await: 模块加载时自动初始化
// 外面 import 这个模块时会等待 init() 完成
await init();

/**
 * 获取所有工具定义列表
 * 给 Agent 用来告诉 AI 有哪些工具可用
 */
export function getToolDefinitions(): ToolDefinition[] {
  return definitions;
}

/**
 * 执行指定名称的工具
 *
 * @param name - 工具名
 * @param args - 参数字典
 * @returns 执行结果字符串
 */
export function executeTool(name: string, args: Record<string, any>): string {
  const fn = implementations[name];
  if (!fn) {
    return `错误: 未知工具 "${name}"`;
  }
  return fn(args);
}
