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

  // 检查 API 是否返回了错误
  if (!response.ok) {
    const errorMsg = data.error?.message || JSON.stringify(data);
    throw new Error(`API 请求失败 (${response.status}): ${errorMsg}`);
  }

  const message = data.choices?.[0]?.message;
  if (!message) {
    throw new Error("AI 返回了空响应，可能是对话格式有问题");
  }

  return message;
}

/**
 * 调用 AI 对一段对话生成摘要
 * 用于分支时自动总结被放弃的路径
 *
 * @param messages - 需要摘要的对话消息
 * @param systemPrompt - 摘要的 system prompt（可选）
 * @returns 摘要文本
 */
export async function summarizeMessages(
  messages: Message[],
  systemPrompt?: string,
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API Key 未配置");
  }

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content:
            systemPrompt ||
            "请用中文将以下对话总结成一段简短的摘要，保留关键信息和上下文。只返回摘要内容，不要加额外说明。",
        },
        ...messages,
      ],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    return "(摘要生成失败)";
  }

  return data.choices?.[0]?.message?.content || "(摘要生成失败)";
}
