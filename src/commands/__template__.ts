/**
 * commands/__template__.ts — 指令模板
 *
 * 想加新指令？复制这个文件，重命名，然后按以下步骤修改：
 *
 * 1. 改 commandDefinition.name（指令名，以 / 开头）
 * 2. 改 commandDefinition.description（指令说明）
 * 3. 改 commandDefinition.usage（用法示例）
 * 4. 改 execute 函数体（执行逻辑）
 *
 * 可选：如果你的指令需要用到 summarizeMessages 或其他功能，
 *       在 context 类型中加入对应的字段，调用时传入即可。
 *
 * ⚠️ 文件名以 __ 开头，不会被 index.ts 自动加载
 *    这只是个模板，不是真正的指令
 */

/** 指令定义 */
export const commandDefinition = {
  name: "/your_command",
  description: "描述这个指令是干什么的",
  usage: "/your_command [参数]",
};

/**
 * 指令执行函数
 *
 * @param args - 指令参数数组（去掉 / 命令名之后的参数）
 * @param context - 上下文对象，包含 agent 和其他依赖
 * @returns { shouldExit, newAgent }
 *   shouldExit: true 时程序退出
 *   newAgent: 如果指令创建了新 Agent，返回它
 */
export async function execute(
  args: string[],
  context: { agent: any }
): Promise<{ shouldExit: boolean; newAgent?: any }> {
  // 这里写你的指令逻辑
  console.log(`执行了 ${commandDefinition.name}，参数:`, args);
  return { shouldExit: false };
}
