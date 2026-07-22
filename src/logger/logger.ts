/**
 * logger.ts — Logger 类的实现
 *
 * 职责：
 *   1. 把消息按统一格式拼好
 *   2. 控制台输出（带颜色，一眼区分级别）
 *   3. 文件输出（按大小自动切割）
 *
 * 使用方式不在这里，在 index.ts 里导出实例
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { LogLevel, type LoggerConfig } from "./types.js";

/** 每个日志级别对应的标签文字 */
const LEVEL_LABELS: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: "DEBUG",
  [LogLevel.INFO]: "INFO",
  [LogLevel.WARN]: "WARN",
  [LogLevel.ERROR]: "ERROR",
};

// ===================== Logger 类 =====================

export class Logger {
  private config: LoggerConfig;
  /** 当前正在写入的日志文件路径 */
  private currentFilePath: string;
  /** 当前日志文件的字节大小（精确追踪，不用 stat 省一次系统调用） */
  private currentFileSize: number;
  /** 是否已经写入过至少一条日志 */
  private hasWritten: boolean;

  constructor(config: LoggerConfig) {
    this.config = config;
    this.hasWritten = false;

    // 确保日志目录存在
    if (!fs.existsSync(config.logDir)) {
      fs.mkdirSync(config.logDir, { recursive: true });
    }

    // 创建第一个日志文件
    this.currentFilePath = this.generateFilePath();
    this.currentFileSize = 0;
  }

  // ===================== 内部方法 =====================

  /**
   * 生成日志文件名，格式：2026-07-22T06-30-21Z.log
   * ISO 8601 UTC 标准，冒号替换为横杠（Windows 文件名不允许冒号）
   */
  private generateFilePath(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const timestamp = [
      now.getUTCFullYear(),
      pad(now.getUTCMonth() + 1),
      pad(now.getUTCDate()),
    ].join("-") + "T" + [
      pad(now.getUTCHours()),
      pad(now.getUTCMinutes()),
      pad(now.getUTCSeconds()),
    ].join("-") + "Z";

    return path.join(this.config.logDir, `${timestamp}.log`);
  }

  /**
   * 格式化一条日志，生成纯文本
   * 格式：[2026-07-22T14:30:21.123Z] [INFO] [system] 消息内容
   *
   * 注意：这里不用颜色，颜色只在控制台输出时加
   */
  private formatMessage(
    level: LogLevel,
    category: string,
    message: string,
    data?: unknown,
  ): string {
    const timestamp = new Date().toISOString();
    const label = LEVEL_LABELS[level];
    const dataStr = data !== undefined ? " " + JSON.stringify(data) : "";
    return `[${timestamp}] [${label}] [${category}] ${message}${dataStr}`;
  }

  /**
   * 写入文件，如果当前文件超过大小限制则自动切割
   */
  private writeToFile(text: string): void {
    const textBytes = Buffer.byteLength(text, "utf-8");

    // 检查是否需要切割：当前文件已经 >= 最大限制
    // 注意：在写入之前检查，所以大消息会写到新文件里
    if (this.hasWritten && this.currentFileSize >= this.config.maxFileSize) {
      this.currentFilePath = this.generateFilePath();
      this.currentFileSize = 0;
    }

    try {
      fs.appendFileSync(this.currentFilePath, text, "utf-8");
      this.currentFileSize += textBytes;
      this.hasWritten = true;
    } catch (err) {
      // Logger 自身出错时回退到控制台输出，确保用户知道
      console.error(`[LOGGER] 写入日志文件失败: ${err}`);
    }
  }

  /**
   * 核心日志方法，所有便捷方法（info/warn/error 等）最终都调这里
   *
   * Logger 只写文件，不在控制台输出。
   * 用户需要看到的提示信息，由各模块直接用 console.log 输出。
   *
   * @param level - 日志级别
   * @param category - 来源标签，比如 "agent"、"tool"、"ai"
   * @param message - 日志文本
   * @param data - 可选的结构化数据，自动转 JSON 拼在消息后面
   */
  private log(level: LogLevel, category: string, message: string, data?: unknown): void {
    // 级别过滤：低于 minLevel 的日志直接丢弃
    if (level < this.config.minLevel) return;

    const formatted = this.formatMessage(level, category, message, data);

    // 只写文件，不输出到控制台
    this.writeToFile(formatted + "\n");
  }

  // ===================== 对外便捷方法 =====================

  debug(category: string, message: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, category, message, data);
  }

  info(category: string, message: string, data?: unknown): void {
    this.log(LogLevel.INFO, category, message, data);
  }

  warn(category: string, message: string, data?: unknown): void {
    this.log(LogLevel.WARN, category, message, data);
  }

  error(category: string, message: string, data?: unknown): void {
    this.log(LogLevel.ERROR, category, message, data);
  }
}
