/**
 * commands/session.ts — /session 指令
 *
 * 显示当前会话信息：ID、文件路径、节点数、leaf 位置
 */

/** 指令定义 */
export const commandDefinition = {
  name: "/session",
  description: "显示会话信息",
  usage: "/session",
};

/** 指令执行函数 */
export async function execute(args: string[], context: { agent: any }): Promise<{ shouldExit: boolean; newAgent?: any }> {
  const sm = context.agent.getSessionManager();

  console.log(`  ID:   ${sm.getSessionId()}`);
  console.log(`  文件: ${sm.getSessionFile()}`);
  console.log(`  节点: ${sm.getEntries().length} 个`);
  const leaf = sm.getLeafEntry();
  console.log(`  Leaf: ${leaf ? leaf.id : "null"}\n`);

  return { shouldExit: false };
}
