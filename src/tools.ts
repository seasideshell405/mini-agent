/**
 * tools.ts — 工具系统
 *
 * 职责：
 *   1. 定义工具（给 AI 看的说明）
 *   2. 实现工具（给程序执行的函数）
 *   3. 提供统一的执行入口
 *
 * 对应 Pi 项目里各个工具的定义（read、bash、edit、write、grep、find 等）
 */

import * as fs from "node:fs";
import type { ToolDefinition, ToolImplementation } from "./types.js";

/**
 * 获取工具定义列表
 *
 * 这些定义会发给 AI，告诉它有哪些工具可用
 * 每个工具的描述越清晰，AI 用对的概率越高
 */
export function getToolDefinitions(): ToolDefinition[] {
  return [
    {
      type: "function",
      function: {
        name: "eval",
        description: "执行一个 JavaScript 表达式并返回计算结果",
        parameters: {
          type: "object",
          properties: {
            expression: {
              type: "string",
              description: "要计算的表达式，如 '2 + 2' 或 'Math.sqrt(16)'",
            },
          },
          required: ["expression"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "read_file",
        description: "读取指定文件的内容",
        parameters: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "文件路径（相对路径或绝对路径）",
            },
          },
          required: ["path"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "write_file",
        description: "把内容写入指定文件（覆盖写入）",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "文件路径" },
            content: { type: "string", description: "要写入的内容" },
          },
          required: ["path", "content"],
        },
      },
    },
  ];
}

/**
 * 获取工具实现映射表
 *
 * key 是工具名，value 是实际执行的函数
 */
function getImplementations(): Record<string, ToolImplementation> {
  return {
    eval: (args) => {
      try {
        const result = eval(args.expression);
        return String(result);
      } catch (error: any) {
        return `执行出错: ${error.message}`;
      }
    },

    read_file: (args) => {
      try {
        return fs.readFileSync(args.path, "utf-8");
      } catch (error: any) {
        return `读取文件失败: ${error.message}`;
      }
    },

    write_file: (args) => {
      try {
        fs.writeFileSync(args.path, args.content, "utf-8");
        return `文件 ${args.path} 写入成功`;
      } catch (error: any) {
        return `写入文件失败: ${error.message}`;
      }
    },
  };
}

// 实例化一次，多次复用
const implementations = getImplementations();

/**
 * 执行工具
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
