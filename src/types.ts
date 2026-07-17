/**
 * types.ts — 所有类型定义
 *
 * 把类型集中在一个文件里，其他地方 import 引用
 * 这样改类型时只需要改一处
 */

/** AI 的消息结构 —— 对话历史的基本单位 */
export type Message = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  /** assistant 消息可能带工具调用指令 */
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  /** tool 消息关联到哪个工具调用 */
  tool_call_id?: string;
  name?: string;
};

/** 工具定义 —— 给 AI 看的说明书 */
export type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, { type: string; description: string }>;
      required: string[];
    };
  };
};

/** 工具实现 —— 给程序用的函数签名 */
export type ToolImplementation = (args: Record<string, any>) => string;
