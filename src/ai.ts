/**
 * ai.ts — AI API 通信层
 *
 * 职责只有一件事：把 messages 发给 AI，拿回回复
 * 不关心 messages 里有什么，不关心工具怎么执行
 *
 * 对应 Pi 的 packages/ai/
 */

import type { Message, ToolDefinition } from "./types.js";
import { getApiKey } from "./config.js";

/** DeepSeek API 地址（OpenAI 兼容格式） */
const API_URL = "https://api.deepseek.com/v1/chat/completions";

/**
 * 发送请求给 AI 并返回完整回复
 *
 * 注意：API Key 不是在模块加载时读取的，而是每次调用 askAI 时
 * 通过 getApiKey() 获取。这样用户首次输入 key 后才能生效。
 *
 * @param messages - 对话历史（包含 system prompt 和所有历史对话）
 * @param tools - 可用工具列表
 * @returns AI 返回的 message 对象（可能含 tool_calls）
 */
export async function askAI(
  messages: Message[],
  tools: ToolDefinition[],
): Promise<Message> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API Key 未配置，请先运行程序并输入 API Key");
  }

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages,
      tools,
      tool_choice: "auto",
    }),
  });

  const data = await response.json();
  return data.choices?.[0]?.message;
}
