/**
 * commands/load.ts — /load 指令
 *
 * 热加载所有配置（提示词、工具、指令），不需要重启程序。
 *
 * 使用场景：
 *   1. 新增/修改了 prompts/ 下的 .md 文件
 *   2. 新增/删除了 tools/ 下的工具文件
 *   3. 新增/删除了 commands/ 下的指令文件
 * 执行 /load 即可生效。
 *
 * ⚠️ 注意：reload 函数通过 context 传入，而不是直接 import
 *   因为 /load 自己也是个指令，直接在模块顶层 import 会导致
 *   循环依赖。
 */

export const commandDefinition = {
  name: "/load",
  description: "热加载提示词、工具和指令（增删文件后无需重启）",
  usage: "/load",
};

export async function execute(
  args: string[],
  context: {
    reloadTools: () => Promise<void>;
    reloadCommands: () => Promise<void>;
    reloadPrompts: () => void;
  }
): Promise<{ shouldExit: boolean; newAgent?: any }> {
  console.log("--- 热加载开始 ---\n");

  // 按依赖顺序：提示词 → 工具 → 指令
  context.reloadPrompts();
  await context.reloadTools();
  await context.reloadCommands();

  console.log("--- 热加载完成 ---\n");
  return { shouldExit: false };
}
