/**
 * prompts/index.ts — 提示词管理器
 *
 * 管理三类内容：
 *   - prompts/ 根目录：system.md 已被移除，保留 compaction.md 供分支摘要用
 *   - prompts/rules.md：行为规范（所有人格共享）
 *   - prompts/persona/：人格文件（每个 .md 一个角色）
 *
 * 核心逻辑：getPrompt() 读 prompts/ 根目录的文件，遵循旧规则；
 * buildSystemPrompt() 组合人格 + 规则，生成最终的 system prompt。
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** 拿到当前文件所在目录的绝对路径 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 人格文件目录 */
const PERSONA_DIR = path.join(__dirname, "persona");

/**
 * 硬编码的默认值 — 当对应 .md 文件不存在时用这些
 */
const DEFAULTS: Record<string, string> = {
  compaction:
    "请用中文将以下对话总结成一段简短的摘要，保留关键信息和上下文。" +
    "只返回摘要内容，不要加额外说明。",
};

// ===================== 原有：读取 prompts/根目录 的文件 =====================

/**
 * 根据 key 获取对应的提示词
 *
 * 查找顺序：
 *   1. 看 prompts/{key}.md 文件是否存在 → 读文件
 *   2. 没有文件 → 返回 DEFAULTS 里的默认值
 *   3. 都没有 → 抛异常
 *
 * @param key - 提示词名称，如 "compaction"
 * @returns 提示词文本
 */
export function getPrompt(key: string): string {
  const filePath = path.join(__dirname, `${key}.md`);

  if (fs.existsSync(filePath)) {
    try {
      return fs.readFileSync(filePath, "utf-8");
    } catch (error) {
      // 读文件失败 → 回退到默认值
    }
  }

  const fallback = DEFAULTS[key];
  if (fallback !== undefined) {
    return fallback;
  }

  throw new Error(
    `未找到提示词: "${key}"，请在 src/prompts/ 下创建 ${key}.md 文件，` +
    `或在 DEFAULTS 中添加默认值`,
  );
}

// ===================== 新增：人格 + 规则拼装 =====================

/**
 * 读取人格文件内容
 *
 * @param key - 人格名称（对应 prompts/persona/{key}.md）
 * @returns 人格文本
 */
export function getPersona(key: string): string {
  const filePath = path.join(PERSONA_DIR, `${key}.md`);

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `未找到人格: "${key}"，请在 src/prompts/persona/ 下创建 ${key}.md 文件`,
    );
  }

  return fs.readFileSync(filePath, "utf-8");
}

/**
 * 读取行为规范文件（prompts/rules.md）
 * 如果文件不存在，返回一组合理的默认规则
 *
 * @returns 规则文本
 */
export function getRules(): string {
  const filePath = path.join(__dirname, "rules.md");

  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, "utf-8");
  }

  // 文件不存在时返回默认规则
  return [
    "规则：",
    "- 回复要简洁",
    "- 操作文件时显示完整路径",
    "- 当用户要求你做多个事情时，逐步完成，不要一次性跳过",
  ].join("\n");
}

/**
 * 构建完整的 system prompt
 *
 * 人格 + 规则，两部分之间用空行分隔。
 * 如果人格内容末尾没有空行，自动补一个。
 *
 * @param personaKey - 人格名称（"default" 或其他）
 * @returns 拼装好的完整 system prompt
 */
export function buildSystemPrompt(personaKey: string): string {
  const persona = getPersona(personaKey);
  const rules = getRules();

  // 人格内容末尾加一个空行，再拼规则
  const trimmedPersona = persona.endsWith("\n") ? persona : persona + "\n";
  return `${trimmedPersona}\n${rules}`;
}
