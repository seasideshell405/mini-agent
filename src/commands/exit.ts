/**
 * commands/exit.ts — /exit 指令
 *
 * 退出程序
 */

/** 指令定义 */
export const commandDefinition = {
  name: "/exit",
  description: "退出程序",
  usage: "/exit",
};

/** 指令执行函数 */
export async function execute(): Promise<{ shouldExit: boolean; newAgent?: any }> {
  console.log("再见！");
  return { shouldExit: true };
}
