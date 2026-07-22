/**
 * commands/new.ts — /new 指令
 *
 * 创建一个全新的会话（清空历史，重新开始）
 */

import { Agent } from "../agent.js";
import { SessionManager } from "../session-manager.js";

/** 指令定义 */
export const commandDefinition = {
  name: "/new",
  description: "创建新会话",
  usage: "/new",
};

/** 指令执行函数 */
export async function execute(
  args: string[],
  context: { getPrompt: () => string; getToolDefinitions: () => any[] }
): Promise<{ shouldExit: boolean; newAgent?: any }> {
  const sm = new SessionManager(process.cwd(), "./sessions");
  const newAgent = new Agent(context.getPrompt("system"), context.getToolDefinitions(), sm);
  console.log(`[完成] 已切换到新会话 ${sm.getSessionId()}\n`);
  return { shouldExit: false, newAgent };
}
