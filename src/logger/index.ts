/**
 * index.ts — 日志系统入口
 *
 * 导出 Logger 类和预配置的全局实例
 * 其他文件直接 import logger 就能用：
 *
 *   import { logger } from "./logger/index.js";
 *   logger.info("agent", "处理用户输入");
 *
 * 如果你需要在启动时自定义配置，可以：
 *
 *   import { Logger } from "./logger/index.js";
 *   const myLogger = new Logger({ ... });
 */

export { Logger } from "./logger.js";
export { LogLevel } from "./types.js";
export type { LoggerConfig } from "./types.js";

import { Logger } from "./logger.js";
import { LogLevel } from "./types.js";

/** 
 * 全局默认 Logger 实例
 * 配置：
 *   - 最低级别：DEBUG（所有级别的日志都输出）
 *   - 单文件上限：5MB
 *   - 存放目录：项目根目录下的 logs/
 */
export const logger = new Logger({
  minLevel: LogLevel.DEBUG,
  maxFileSize: 5 * 1024 * 1024, // 5MB，单位是字节
  logDir: "./logs",
});
