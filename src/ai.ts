/**
 * ai.ts — AI API 通信层
 *
 * 职责只有一件事：把 messages 发给 AI，拿回回复
 * 不关心 messages 里有什么，不关心工具怎么执行
 *
 * 对应 Pi 的 packages/ai/
 */

import type { Message, ToolDefinition } from "./types.js";

/** DeepSeek API 地址（OpenAI 兼容格式） */
const API_URL = "https://api.deepseek.com/v1/chat/completions";

/** 从环境变量读取 API 密钥 */
const API_KEY = process.env.DEEPSEEK_API_KEY;

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
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages,
      tools,
      tool_choice: "auto", // 让 AI 自己决定是否调工具
    }),
  });

  const data = await response.json();
  return data.choices?.[0]?.message;
}

/**
 * 检查 API 密钥是否已配置
 * 在程序启动时调用，失败则退出
 */
export function checkApiKey(): void {
  if (!API_KEY) {
    console.error("错误：没有找到 DEEPSEEK_API_KEY 环境变量");
    console.error("请先设置：");
    console.error("  Windows CMD:      set DEEPSEEK_API_KEY=sk-你的密钥");
    console.error("  PowerShell:       $env:DEEPSEEK_API_KEY=\"sk-你的密钥\"");
    process.exit(1);
  }
}
