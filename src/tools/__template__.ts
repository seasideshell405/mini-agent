/**
 * tools/__template__.ts — 工具模板
 *
 * 想加新工具？复制这个文件，重命名，然后按以下步骤修改：
 *
 * 1. 改 name（工具名，AI 靠这个名字调用你）
 * 2. 改 description（描述越清晰，AI 用对的概率越高）
 * 3. 改 parameters（定义 AI 需要传什么参数）
 * 4. 改 execute 函数体（实际干活的代码）
 *
 * ⚠️ 文件名以 __ 开头，不会被 index.ts 自动加载
 *    这只是个模板，不是真正的工具
 */

import type { ToolDefinition, ToolImplementation } from "../types.js";

/** 工具定义 —— 告诉 AI 这个工具有什么用、怎么调用 */
export const toolDefinition: ToolDefinition = {
  type: "function",
  function: {
    // 【改这里】工具名称 —— AI 通过这个名字来调用
    name: "your_tool_name",
    // 【改这里】工具描述 —— 描述越清楚，AI 越会用对
    description: "描述这个工具是干什么的",
    // 【改这里】参数定义 —— AI 需要传哪些参数
    parameters: {
      type: "object",
      properties: {
        param1: {
          type: "string",
          description: "参数1的说明",
        },
      },
      // 哪些参数是必填的
      required: ["param1"],
    },
  },
};

/** 工具实现 —— 【改这里】实际干活的代码 */
export const execute: ToolImplementation = (args) => {
  try {
    // 在这里写你的业务逻辑
    // args.param1 拿 AI 传的参数
    return `执行结果: ${args.param1}`;
  } catch (error: any) {
    return `执行出错: ${error.message}`;
  }
};
