/**
 * commands/branch.ts — /branch 指令
 *
 * 分支到历史节点，支持 --summary 自动生成分支摘要
 */

/** 指令定义 */
export const commandDefinition = {
  name: "/branch",
  description: "分支到历史节点（回到指定节点开始新路径）",
  usage: "/branch <节点id> [--summary]",
};

/**
 * 指令执行函数
 * 用函数引用传参，避免在模块顶层引入循环依赖
 */
export async function execute(
  args: string[],
  context: { agent: any; summarizeMessages: any }
): Promise<{ shouldExit: boolean; newAgent?: any }> {
  if (args.length === 0) {
    console.log("用法: /branch <节点id> [--summary]\n");
    return { shouldExit: false };
  }

  const sm = context.agent.getSessionManager();
  const targetId = args[0];
  const withSummary = args.includes("--summary");

  try {
    if (withSummary) {
      const abandoned = sm.getAbandonedEntries(targetId);
      if (abandoned.length > 0) {
        console.log("[摘要] 正在生成分支摘要...");

        const msgs = abandoned
          .filter((e: any) => e.type === "message" && e.message.role !== "tool")
          .map((e: any) => e.message);

        if (msgs.length > 0) {
          const summary = await context.summarizeMessages(msgs);
          sm.branchWithSummary(targetId, summary);
          console.log(`[摘要] ${summary.slice(0, 60)}...\n`);
        } else {
          sm.branch(targetId);
        }
      } else {
        console.log("[摘要] 没有找到需要摘要的路径，直接分支\n");
        sm.branch(targetId);
      }
    } else {
      sm.branch(targetId);
    }

    console.log(`[分支] 已切换到节点 ${targetId}\n`);
  } catch (error: any) {
    console.log(`[错误] ${error.message}\n`);
  }

  return { shouldExit: false };
}
