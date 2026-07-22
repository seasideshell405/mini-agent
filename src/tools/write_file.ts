/**
 * tools/write_file.ts — 写入文件工具
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
};

/** 工具实现 —— 实际干活的代码 */
export const execute: ToolImplementation = (args) => {
  try {
    fs.writeFileSync(args.path, args.content, "utf-8");
    return `文件 ${args.path} 写入成功`;
  } catch (error: any) {
    return `写入文件失败: ${error.message}`;
  }
};
