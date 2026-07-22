/**
 * agent.ts — 智能体核心
 *
 * 这是整个项目的"大脑"，对应 Pi 的 packages/agent/src/agent-loop.ts
 *
 * 职责：
 *   1. 管理对话历史（通过 SessionManager，支持树结构和持久化）
 *   2. 执行 inner loop（反复问 AI → 调工具 → 再问 AI → ...）
 *   3. 协调 ai.ts 和 tools.ts 之间的数据流动
 *
 * 核心流程（一次用户输入）：
 *
 *   processMessage("计算 2+2")
 *     │
 *     ├─→ sessionManager.appendMessage(user)   ← 存到会话树
 *     │
 *     ├─→ sessionManager.buildSessionContext()  ← 从 leaf 走到 root
 *     │     ↓
 *     │   返回 Message[]（不含 system prompt）
 *     │     ↓
 *     ├─→ 拼接 system prompt，调 askAI()
 *     │     ↓
 *     │   AI 返回 tool_calls: eval("2+2")
 *     │     ↓
 *     ├─→ sessionManager.appendMessage(assistant)  ← 存 AI 消息
 *     ├─→ executeTool("eval", {expression: "2+2"}) → "4"
 *     ├─→ sessionManager.appendMessage(toolResult) ← 存工具结果
 *     │     ↓
 *     ├─→ 再拼接 system prompt + 上下文中，调 askAI()
 *     │     ↓
 *     │   AI 返回 content: "结果是 4"
 *     │     ↓
 *     ├─→ sessionManager.appendMessage(assistant)  ← 存 AI 回复
 *     └─→ 返回给用户
 */

import { askAI } from "./ai.js";
import { executeTool } from "./tools/index.js";
import { SessionManager } from "./session-manager.js";
import type { Message, ToolDefinition } from "./types.js";

/**
 * Agent 类封装了整个智能体的状态和行为
 *
 * 和之前版本的区别：
 *   - 不再持有 this.messages 数组
 *   - 改用 SessionManager 管理消息（树结构 + 持久化）
 *   - system prompt 是运行时配置，不存入会话文件
 */
export class Agent {
  /** 系统提示词，每次调 AI 时拼在最前面 */
  private systemPrompt: string;
  /** 工具定义列表 */
  private tools: ToolDefinition[];
  /** 会话管理器（树结构 + 文件持久化） */
  private sessionManager: SessionManager;

  /**
   * @param systemPrompt - 系统提示词
   * @param tools - 工具定义列表
   * @param sessionManager - 会话管理器
   */
  constructor(systemPrompt: string, tools: ToolDefinition[], sessionManager: SessionManager) {
    this.systemPrompt = systemPrompt;
    this.tools = tools;
    this.sessionManager = sessionManager;
  }

  /**
   * 获取 SessionManager 引用（用于分支操作等）
   */
  getSessionManager(): SessionManager {
    return this.sessionManager;
  }

  /**
   * 处理一条用户输入
   *
   * @param userInput - 用户输入的文字
   * @returns AI 最终的回复文字
   */
  async processMessage(userInput: string): Promise<string> {
    // 1. 把用户消息存入会话树
    this.sessionManager.appendMessage({ role: "user", content: userInput });

    // 2. inner loop：反复问 AI 直到它直接回复文字
    while (true) {
      // 3. 从会话树构建上下文（不含 system prompt）
      const { messages } = this.sessionManager.buildSessionContext();

      // 4. 拼接 system prompt，调 AI
      const fullMessages: Message[] = [
        { role: "system", content: this.systemPrompt },
        ...messages,
      ];

      const aiMessage = await askAI(fullMessages, this.tools);

      // 情况 A：AI 要调用工具
      if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
        // 把 AI 的"工具调用意图"存入会话树
        this.sessionManager.appendMessage({
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

          // 把工具结果存入会话树
          this.sessionManager.appendMessage({
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
        this.sessionManager.appendMessage({ role: "assistant", content: aiMessage.content });
        return aiMessage.content;
      }

      // 情况 C：既没有 tool_calls 也没有 content（极端情况）
      return "（AI 返回了空回复）";
    }
  }
}
