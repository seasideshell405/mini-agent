/**
 * prompts/index.ts — 提示词管理器
 *
 * 规则：有文件读文件，没文件用代码里的默认值。
 *   - 有 prompts/system.md     → getPrompt("system") 返回文件内容
 *   - 没有 prompts/system.md   → 返回下方 hardcode 的默认值
 *
 * 这样你不需要为每个提示词都建文件，只有想覆盖默认值时才创建。
 * 删除文件 = 恢复默认值。
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** 拿到当前文件所在目录的绝对路径 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 硬编码的默认提示词 — 当对应 .md 文件不存在时用这些
 *
 * 新增提示词在这里加一行即可，可选地再建一个 .md 文件覆盖它
 */
const DEFAULTS: Record<string, string> = {
  system:
    "你是一个智能助手，运行在 my-mini-agent 框架中。\n\n" +
    "你有以下工具可用：\n" +
    "规则：\n" +
    "- 回复要简洁\n" +
    "- 操作文件时显示完整路径\n" +
    "- 当用户要求你做多个事情时，逐步完成，不要一次性跳过",

  compaction:
    "请用中文将以下对话总结成一段简短的摘要，保留关键信息和上下文。只返回摘要内容，不要加额外说明。",
};

/**
 * 根据 key 获取对应的提示词
 *
 * 查找顺序：
 *   1. 看 prompts/{key}.md 文件是否存在 → 读文件
 *   2. 没有文件 → 返回 DEFAULTS 里的默认值
 *   3. 都没有 → 抛异常
 *
 * 每次调用都会读文件，所以修改 .md 文件即时生效，不需要重启或 /load。
 *
 * @param key - 提示词名称，如 "system"
 * @returns 提示词文本
 */
export function getPrompt(key: string): string {
  const filePath = path.join(__dirname, `${key}.md`);

  // 优先读文件
  if (fs.existsSync(filePath)) {
    try {
      return fs.readFileSync(filePath, "utf-8");
    } catch (error) {
      // 读文件失败 → 回退到默认值
    }
  }

  // 没有文件 → 用硬编码默认值
  const fallback = DEFAULTS[key];
  if (fallback !== undefined) {
    return fallback;
  }

  throw new Error(
    `未找到提示词: "${key}"，请在 src/prompts/ 下创建 ${key}.md 文件，` +
    `或在 DEFAULTS 中添加默认值`,
  );
}
