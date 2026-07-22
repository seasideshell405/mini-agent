/**
 * types.ts — 日志系统的类型定义
 *
 * 把日志相关的类型集中在这里，其他地方通过 import 引用
 */

/** 日志级别，数字越大越严重 */
export enum LogLevel {
  DEBUG = 0, // 调试信息，开发时看内部状态
  INFO = 1,  // 正常流程信息，比如"工具 xxx 执行成功"
  WARN = 2,  // 异常但不影响运行，比如"配置未找到，使用默认值"
  ERROR = 3, // 出错了但程序还能继续，比如"API 请求失败，重试中"
}

/** Logger 配置项 */
export type LoggerConfig = {
  /** 最低输出级别，低于这个级别的消息不输出（比如设 INFO 则不输出 DEBUG） */
  minLevel: LogLevel;
  /** 单个日志文件的最大字节数，超过后自动新建文件 */
  maxFileSize: number;
  /** 日志文件的存放目录，相对于项目根目录 */
  logDir: string;
};
