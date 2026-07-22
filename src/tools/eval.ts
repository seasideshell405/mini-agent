/**
 * tools/eval.ts — 计算器工具
 *
 * 每个工具文件都遵循相同的接口约定：
 *   1. 导出 toolDefinition（给 AI 看的说明书）
 *   2. 导出 execute（实际执行的函数）
 *
 * 新增工具就复制这个文件，改内容即可
 */

import type { ToolDefinition, ToolImplementation } from "../types.js";

/** 工具定义 —— 告诉 AI 这个工具有什么用、怎么调用 */
export const toolDefinition: ToolDefinition = {
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
};

/** 工具实现 —— 实际干活的代码 */
export const execute: ToolImplementation = (args) => {
  try {
    const result = eval(args.expression);
    return String(result);
  } catch (error: any) {
    return `执行出错: ${error.message}`;
  }
};
