/**
 * tools/read_file.ts — 读取文件工具
 *
 * 每个工具文件都遵循相同的接口约定：
 *   1. 导出 toolDefinition（给 AI 看的说明书）
 *   2. 导出 execute（实际执行的函数）
 */

import * as fs from "node:fs";
import type { ToolDefinition, ToolImplementation } from "../types.js";

/** 工具定义 —— 告诉 AI 这个工具有什么用、怎么调用 */
export const toolDefinition: ToolDefinition = {
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
};

/** 工具实现 —— 实际干活的代码 */
export const execute: ToolImplementation = (args) => {
  try {
    return fs.readFileSync(args.path, "utf-8");
  } catch (error: any) {
    return `读取文件失败: ${error.message}`;
  }
};
