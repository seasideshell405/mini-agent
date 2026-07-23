/**
 * tasks/test_every_minute.ts — 测试任务：每分钟执行一次
 *
 * 验证调度系统是否正常工作。
 * 任务返回本地时间，注入 session 让 AI 看到。
 */

import type { TaskDefinition } from "../scheduler/types.js";

export const task: TaskDefinition = {
  name: "分钟测试",
  description: "每分钟执行一次，验证调度系统",
  schedule: "* * * * *", // 每分钟（本地时间的每一分钟都匹配）

  async execute(context) {
    // context.now 是 UTC 时间
    // 返回给用户看的是本地时间
    const localTime = context.now.toLocaleTimeString("zh-CN", { hour12: false });
    return `我是分钟测试任务，当前本地时间是 ${localTime}。我每分钟都在执行。`;
  },
};
