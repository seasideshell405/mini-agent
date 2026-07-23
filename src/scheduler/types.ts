/**
 * scheduler/types.ts — 定时任务系统类型定义
 *
 * 一个定时任务定义为一个 .ts 文件，导出 TaskDefinition 对象。
 * 调度引擎根据 schedule 字段决定何时执行 execute 函数。
 */

/** 任务 execute 的上下文 —— 传入当前时间等运行时的信息 */
export type TaskContext = {
  /** 任务触发时的当前时间（UTC，给机器用的） */
  now: Date;
};

/**
 * 定时任务定义 —— 每个任务文件必须导出这个
 *
 * schedule 字段支持两种格式：
 *   - "every N"    → 每 N 分钟执行一次，如 "every 5"
 *   - "M H * * *"  → cron 风格，只检查分钟和小时，如 "0 9 * * *"（每天 9:00）
 *
 * execute 返回 void → 只做事，不打扰会话
 * execute 返回 string → 注入到当前 session（走 AI 处理）
 */
export type TaskDefinition = {
  /** 任务名称，用于日志和标识 */
  name: string;
  /** 任务描述（可选） */
  description?: string;
  /** 调度表达式 */
  schedule: string;
  /**
   * 执行函数
   *
   * @param context - 执行上下文（当前时间等）
   * @returns void（直接做事）或 string（注入 session 让 AI 处理）
   */
  execute: (context: TaskContext) => Promise<string | void>;
};

/**
 * 内部使用的"已加载任务"类型
 *
 * 比 TaskDefinition 多了一个 file 字段，记录来源文件路径，
 * 用于日志和排查问题。
 */
export type LoadedTask = {
  /** 任务来源文件路径（相对于 tasks/ 目录） */
  file: string;
  /** 任务定义（从文件导出） */
  definition: TaskDefinition;
  /** 上次执行时间的 UTC 分钟时间戳（用于 interval 判断） */
  lastRunMinute: number;
};
