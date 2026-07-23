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
import { getPrompt } from "./prompts/index.js";
import { logger } from "./logger/index.js";

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
  signal?: AbortSignal,
): Promise<Message> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API Key 未配置，请先运行程序并输入 API Key");
  }

  // 记录请求概况（不记 API Key 和完整 messages，避免日志里泄露敏感信息）
  const lastUserMsg = messages.filter(m => m.role === "user").at(-1);
  logger.debug("ai", `请求 API，messages=${messages.length}条，tools=${tools.length}个，最后用户消息: ${lastUserMsg?.content?.slice(0, 80) || "(无)"}`);

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
    signal,  // 传 AbortSignal，上层可以取消这个请求
  });

  const data = await response.json();

  // 检查 API 是否返回了错误
  if (!response.ok) {
    const errorMsg = data.error?.message || JSON.stringify(data);
    logger.error("ai", `API 请求失败`, { status: response.status, error: errorMsg });
    throw new Error(`API 请求失败 (${response.status}): ${errorMsg}`);
  }

  const message = data.choices?.[0]?.message;
  if (!message) {
    logger.error("ai", "API 返回了空响应");
    throw new Error("AI 返回了空响应，可能是对话格式有问题");
  }

  // 记录返回的概况：是直接回复还是调工具
  if (message.tool_calls && message.tool_calls.length > 0) {
    const toolNames = message.tool_calls.map((t: { function: { name: string } }) => t.function.name).join(", ");
    logger.debug("ai", `API 返回工具调用: ${toolNames}`);
  } else {
    logger.debug("ai", `API 返回文本回复，长度: ${message.content?.length || 0} 字`);
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
    logger.error("ai", "摘要失败：API Key 未配置");
    throw new Error("API Key 未配置");
  }

  logger.debug("ai", `请求摘要，${messages.length} 条消息`);

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
            systemPrompt || getPrompt("compaction"),
        },
        ...messages,
      ],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    logger.warn("ai", `摘要 API 请求失败`, { status: response.status });
    return "(摘要生成失败)";
  }

  const summary = data.choices?.[0]?.message?.content || "(摘要生成失败)";
  logger.debug("ai", `摘要生成完成，长度: ${summary.length} 字`);
  return summary;
}
