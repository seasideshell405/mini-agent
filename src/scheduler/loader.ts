/**
 * scheduler/loader.ts — 定时任务自发现加载器
 *
 * 和 tools/index.ts、commands/index.ts 同样的自动发现模式：
 *   1. 扫描 tasks/ 目录下所有 .ts 文件
 *   2. 跳过自身 (index.ts) 和 __ 开头的文件（模板）
 *   3. 动态加载，统一返回 LoadedTask[] 列表
 *
 * 新增定时任务只需两步：
 *   1. 在 tasks/ 下创建一个 .ts 文件（参考 __template__.ts）
 *   2. 确保文件导出了名为 task 的 TaskDefinition
 * 删除任务：直接删除对应的 .ts 文件即可
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { TaskDefinition, LoadedTask } from "./types.js";

/** 拿到当前文件所在目录的绝对路径 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** tasks/ 目录位于 scheduler/ 的上一级 */
const TASKS_DIR = path.resolve(__dirname, "../tasks");

/** 获取当前 UTC 分钟时间戳（从 epoch 开始的分钟数） */
function getUtcMinute(): number {
  return Math.floor(Date.now() / 60_000);
}

/**
 * 扫描 tasks/ 目录，动态加载所有定时任务文件
 *
 * @param bustCache - 是否跳过模块缓存（用于热加载时的重新 import）
 * @returns 加载好的任务列表
 */
export async function loadTasks(bustCache = false): Promise<LoadedTask[]> {
  // 确保 tasks/ 目录存在（不存在就创建一个空的）
  if (!fs.existsSync(TASKS_DIR)) {
    fs.mkdirSync(TASKS_DIR, { recursive: true });
    console.log(`[调度器] tasks/ 目录已创建: ${TASKS_DIR}`);
    return [];
  }

  const files = fs.readdirSync(TASKS_DIR);
  const tasks: LoadedTask[] = [];
  const now = getUtcMinute();

  for (const file of files) {
    // 只加载 .ts 文件
    if (!file.endsWith(".ts")) continue;
    // 跳过模板和系统文件
    if (file.startsWith("__")) continue;

    try {
      // bustCache 时加时间戳绕过 Node 的模块缓存
      const cacheBuster = bustCache ? `?t=${Date.now()}` : "";
      const mod = await import(`${TASKS_DIR}/${file}${cacheBuster}`);

      // 每个任务文件必须导出名为 task 的 TaskDefinition
      if (mod.task && typeof mod.task.execute === "function") {
        const definition = mod.task as TaskDefinition;
        tasks.push({
          file,
          definition,
          // lastRunMinute 初始化为"当前 UTC 分钟"：
          // 避免 interval 任务在启动后的第一轮 tick 就误触发
          // （比如 "every 5" 需要等 5 分钟后才执行）
          lastRunMinute: now,
        });
        console.log(`[调度器] 已加载定时任务: ${definition.name} (${file})`);
      } else {
        console.warn(`[调度器] 跳过 ${file}：未找到有效的 task 导出`);
      }
    } catch (error: any) {
      console.error(`[调度器] 加载失败: ${file} — ${error.message}`);
    }
  }

  return tasks;
}
