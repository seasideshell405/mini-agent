/**
 * scheduler/scheduler.ts — 调度引擎
 *
 * 职责：
 *   1. 定时检查所有任务（每 60 秒）
 *   2. 判断哪些任务该执行了
 *   3. 执行任务，处理返回值
 *
 * 设计决策：
 *   - 使用 setTimeout 而非 setInterval，避免任务执行时间过长导致重叠
 *   - 每次 tick 重新加载任务列表，支持热添加（不用重启）
 *   - schedule 表达式使用**本地时间**评估（"0 9 * * *" = 本地 9 点）
 *   - lastRunMinute 使用**UTC 分钟时间戳**记录（数据无歧义）
 */

import { loadTasks } from "./loader.js";
import type { LoadedTask, TaskContext } from "./types.js";

/** 检查间隔：60 秒 */
const TICK_INTERVAL_MS = 60_000;

/**
 * 解析 schedule 字符串，判断它是不是 interval 格式
 *
 * "every N" → interval，每 N 分钟
 * 其他 → cron 风格，只检查分钟和小时字段
 */
function isIntervalSchedule(schedule: string): boolean {
  return /^every\s+\d+$/i.test(schedule.trim());
}

/**
 * 从 "every N" 中提取间隔分钟数
 *
 * "every 5" → 5
 * "every 30" → 30
 */
function parseIntervalMinutes(schedule: string): number {
  const match = schedule.trim().match(/^every\s+(\d+)$/i);
  if (!match) return 1; // 兜底：每分钟
  return parseInt(match[1], 10);
}

/**
 * 解析 cron 风格的 schedule 表达式
 *
 * 格式： "分 时 * * *"
 *   - 分：0-59 或 *（每分钟）
 *   - 时：0-23 或 *（每小时）
 *   - 后面三个字段暂时忽略，保留扩展
 *
 * 返回 { minute, hour }，-1 表示"匹配任意"
 */
function parseCronSchedule(schedule: string): { minute: number; hour: number } {
  const parts = schedule.trim().split(/\s+/).filter(Boolean);

  // 标准 cron 有 5 个字段，我们只取前两个
  // 如果用户只写了两个字段 "9 0"，自动补全
  const minuteStr = parts[0] || "*";
  const hourStr = parts[1] || "*";

  const minute = minuteStr === "*" ? -1 : parseInt(minuteStr, 10);
  const hour = hourStr === "*" ? -1 : parseInt(hourStr, 10);

  // 校验数值范围
  if (minute !== -1 && (minute < 0 || minute > 59)) {
    console.warn(`[调度器] 警告: schedule "${schedule}" 的分钟值 ${minute} 超出范围，视为 *`);
    return { minute: -1, hour };
  }
  if (hour !== -1 && (hour < 0 || hour > 23)) {
    console.warn(`[调度器] 警告: schedule "${schedule}" 的小时值 ${hour} 超出范围，视为 *`);
    return { minute, hour: -1 };
  }

  return { minute, hour };
}

/**
 * 判断一个 cron 任务是否应该在当前本地时间执行
 *
 * 规则：
 *   - 分钟匹配（或分钟为 *）
 *   - 小时匹配（或小时为 *）
 */
function shouldRunCron(schedule: string, localMinute: number, localHour: number): boolean {
  const { minute, hour } = parseCronSchedule(schedule);
  const minuteMatch = minute === -1 || minute === localMinute;
  const hourMatch = hour === -1 || hour === localHour;
  return minuteMatch && hourMatch;
}

/**
 * 判断一个 interval 任务是否应该执行
 *
 * 规则：当前 UTC 分钟 - 上次运行分钟 >= 间隔
 *
 * @param intervalMinutes - 间隔分钟数
 * @param lastRunMinute - 上次运行的 UTC 分钟时间戳
 * @param currentUtcMinute - 当前的 UTC 分钟时间戳
 */
function shouldRunInterval(
  intervalMinutes: number,
  lastRunMinute: number,
  currentUtcMinute: number
): boolean {
  return currentUtcMinute - lastRunMinute >= intervalMinutes;
}

/** 获取当前 UTC 分钟时间戳（从 epoch 开始的分钟数） */
function getUtcMinute(): number {
  return Math.floor(Date.now() / 60_000);
}

/**
 * Scheduler 类
 *
 * 使用方式：
 *   const scheduler = new Scheduler({
 *     onTaskMessage: (taskName, message) => { ... }
 *   });
 *   scheduler.start();
 */
export class Scheduler {
  /** 已加载的任务列表，每次 tick 重新加载 */
  private tasks: LoadedTask[] = [];
  /** 用于取消的定时器句柄 */
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** 是否已启动 */
  private running = false;
  /** tick 是否正在进行中（防止并发） */
  private ticking = false;

  /**
   * 当定时任务返回 string 时调用的回调
   *
   * 由上层（index.ts）注入：
   *   onTaskMessage(name, msg) → 追加到 session + 打印通知
   */
  public onTaskMessage: ((taskName: string, message: string) => void) | null = null;

  /**
   * 启动调度器
   *
   * 首次启动会立即执行一次 tick，然后每 60 秒检查一次。
   * 多次调用 start() 安全（不会启动多个循环）。
   */
  start(): void {
    if (this.running) {
      console.log("[调度器] 已经在运行中");
      return;
    }

    this.running = true;
    console.log("[调度器] 已启动，每 60 秒检查一次定时任务");

    // 立即执行第一次 tick
    this.tick();
  }

  /**
   * 停止调度器
   *
   * 取消定时器，不再执行新的 tick。
   * 正在执行的 tick 不受影响（等它自然完成）。
   */
  stop(): void {
    this.running = false;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    console.log("[调度器] 已停止");
  }

  /**
   * 一次 tick — 检查并执行到期的任务
   *
   * 流程：
   *   1. 重新扫描 tasks/ 目录（支持热添加）
   *   2. 对每个任务判断是否该执行
   *   3. 执行到期的任务
   *   4. 如果是 interval 任务，更新 lastRunMinute
   *   5. 如果任务返回 string，调 onTaskMessage
   *   6. 安排下一次 tick
   */
  private async tick(): Promise<void> {
    // 防止并发 tick
    if (this.ticking) return;
    this.ticking = true;

    try {
      // 步骤 1：重新加载所有任务（自发现，每次都扫一遍）
      this.tasks = await loadTasks();

      if (this.tasks.length === 0) {
        console.log("[调度器] 当前没有定时任务");
        return;
      }

      // 步骤 2：获取当前时间
      const now = new Date();                              // UTC，给机器用
      const currentUtcMinute = getUtcMinute();              // UTC 分钟时间戳
      const localHour = now.getHours();                     // 本地小时（用于 cron 匹配）
      const localMinute = now.getMinutes();                  // 本地分钟（用于 cron 匹配）

      // 遍历所有任务，检查哪些该执行了
      for (const task of this.tasks) {
        const schedule = task.definition.schedule.trim().toLowerCase();
        let shouldRun = false;

        if (isIntervalSchedule(schedule)) {
          // ---- interval 模式 ----
          const intervalMinutes = parseIntervalMinutes(schedule);
          shouldRun = shouldRunInterval(intervalMinutes, task.lastRunMinute, currentUtcMinute);
        } else {
          // ---- cron 模式 ----
          shouldRun = shouldRunCron(schedule, localMinute, localHour);
        }

        if (!shouldRun) continue;

        // 步骤 3：执行任务
        console.log(`[调度器] 执行定时任务: ${task.definition.name}`);
        try {
          const context: TaskContext = { now };
          const result = await task.definition.execute(context);

          // 更新 lastRunMinute（用 UTC 时间戳记录，数据无歧义）
          task.lastRunMinute = currentUtcMinute;

          // 步骤 5：任务返回 string → 通过回调注入 session
          if (result && typeof result === "string") {
            console.log(`[调度器] 任务 "${task.definition.name}" 产生消息: ${result.slice(0, 80)}`);
            this.onTaskMessage?.(task.definition.name, result);
          } else {
            console.log(`[调度器] 任务 "${task.definition.name}" 执行完成（无消息注入）`);
          }
        } catch (error: any) {
          console.error(`[调度器] 任务 "${task.definition.name}" 执行出错: ${error.message}`);
        }
      }
    } finally {
      this.ticking = false;

      // 步骤 6：安排下一次 tick（如果还在运行状态）
      if (this.running) {
        this.timer = setTimeout(() => this.tick(), TICK_INTERVAL_MS);
        // unref 让这个 timer 不阻止进程退出
        // 如果用了 /exit 或 Ctrl+C，进程可以正常关闭
        this.timer.unref();
      }
    }
  }
}
