/**
 * agent.ts — 智能体核心
 *
 * 这是整个项目的"大脑"，对应 Pi 的 packages/agent/src/agent-loop.ts
 *
 * 职责：
 *   1. 管理对话历史（messages 数组）
 *   2. 执行 inner loop（反复问 AI → 调工具 → 再问 AI → ...）
 *   3. 协调 ai.ts 和 tools.ts 之间的数据流动
 *
 * 核心流程（一次用户输入）：
 *
 *   processMessage("计算 2+2")
 *     │
 *     ├─→ askAI(messages, tools)
 *     │     ↓
 *     │   AI 返回 tool_calls: eval("2+2")
 *     │     ↓
 *     ├─→ executeTool("eval", {expression: "2+2"}) → "4"
 *     │     ↓
 *     │   把工具结果加入 messages
 *     │     ↓
 *     ├─→ askAI(messages, tools)   ← 再问一次
 *     │     ↓
 *     │   AI 返回 content: "结果是 4"
 *     │     ↓
 *     └─→ 返回给用户
 */

import { askAI } from "./ai.js";
import { executeTool } from "./tools.js";
import type { Message, ToolDefinition } from "./types.js";

/**
 * Agent 类封装了整个智能体的状态和行为
 *
 * 为什么要用类（class）？
 *   → messages 是智能体的"记忆"，必须持久存在
 *   → 每次 processMessage 调用都会修改 messages
 *   → 用类可以把数据（messages）和操作（processMessage）绑在一起
 *
 * 在 Pi 项目里，这部分逻辑在 agent-loop.ts 中
 */
export class Agent {
  /** 对话历史（包含 system prompt） */
  private messages: Message[];
  /** 工具定义列表 */
  private tools: ToolDefinition[];

  /**
   * @param systemPrompt - 系统提示词，放在对话最前面
   * @param tools - 工具定义列表
   */
  constructor(systemPrompt: string, tools: ToolDefinition[]) {
    this.messages = [{ role: "system", content: systemPrompt }];
    this.tools = tools;
  }

  /**
   * 处理一条用户输入
   *
   * 这是 agent 的"入口"，也是 inner loop 的实现
   *
   * @param userInput - 用户输入的文字
   * @returns AI 最终的回复文字
   */
  async processMessage(userInput: string): Promise<string> {
    // 1. 把用户消息加入对话历史
    this.messages.push({ role: "user", content: userInput });

    // 2. inner loop：反复问 AI 直到它直接回复文字
    while (true) {
      const aiMessage = await askAI(this.messages, this.tools);

      // 情况 A：AI 要调用工具
      if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
        // 把 AI 的"工具调用意图"记入对话历史
        this.messages.push({
          role: "assistant",
          content: null,
          tool_calls: aiMessage.tool_calls,
        });

        // 逐个执行工具
        for (const toolCall of aiMessage.tool_calls) {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments);

          // 执行工具
          const result = executeTool(toolName, toolArgs);

          // 把工具结果记入对话历史
          this.messages.push({
            role: "tool",
            content: result,
            tool_call_id: toolCall.id,
            name: toolName,
          });
        }

        // 继续 inner loop，让 AI 处理工具结果
        continue;
      }

      // 情况 B：AI 直接回复文字 → inner loop 结束
      if (aiMessage.content) {
        this.messages.push({ role: "assistant", content: aiMessage.content });
        return aiMessage.content;
      }

      // 情况 C：既没有 tool_calls 也没有 content（极端情况）
      return "（AI 返回了空回复）";
    }
  }
}
