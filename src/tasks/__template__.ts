// tasks/__template__.ts — 定时任务模板
//
// 想加新定时任务？复制这个文件，重命名（去掉 __），然后按以下步骤修改：
//
// 1. 改 name（任务名称，用于日志显示）
// 2. 改 schedule（调度表达式）
// 3. 改 execute 函数体（实际干活的代码）
//
// schedule 支持两种格式：
//   "every N"    → 每 N 分钟执行一次，如 "every 5"
//   "M H * * *"  → cron 风格，只检查分钟和小时
//                   例："0 9 * * *" = 每天本地时间 09:00
//                   例："0,30 * * * *" = 每小时 00 分和 30 分（不写成 */30 避免注释歧义）
//
// execute 返回 string → 注入到当前 session，走 AI 处理（用到 API）
// execute 返回 void   → 直接做事，不打扰会话
//
// 文件名以 __ 开头，不会被 loader.ts 自动加载（只是模板）
// 去掉 __ 前缀才会被加载

import type { TaskDefinition } from "../scheduler/types.js";

export const task: TaskDefinition = {
  // 【改这里】任务名称
  name: "示例任务",

  // 【改这里】调度表达式
  // schedule: "every 5",      // 每5分钟
  // schedule: "0 * * * *",    // 每整点（每小时 00 分）
  // schedule: "0 9 * * *",    // 每天 9:00
  // schedule: "30 14 * * *",  // 每天 14:30
  schedule: "every 5",

  // 【改这里】实际干活的代码
  async execute(context) {
    // context.now 是触发时的 UTC 时间

    // ── 写法 A：直接做事，不打扰 session ──
    // 比如清理临时文件、备份日志等
    // 不 return 或 return undefined → 只做事，不打扰
    // return;

    // ── 写法 B：返回消息，注入当前 session（走 AI） ──
    // AI 会在下一次用户输入时看到这条消息
    return `示例任务在 ${context.now.toISOString()} 触发了`;
  },
};
