/**
 * prompt-manager.ts — 提示词管理器
 *
 * 职责：统一管理所有提示词，从 prompts.json 读取
 * 以后想加新的提示词，只需要在 prompts.json 里加，不用改代码
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// 获取当前文件所在目录（兼容各种 Node 版本）
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// prompts.json 的路径（相对于项目根目录）
const PROMPTS_FILE = path.resolve(__dirname, "../prompts.json");

// 缓存，避免每次请求都读文件
let cache: Record<string, string> | null = null;

/**
 * 读取 prompts.json 并缓存
 */
function loadPrompts(): Record<string, string> {
  if (!cache) {
    const content = fs.readFileSync(PROMPTS_FILE, "utf-8");
    cache = JSON.parse(content);
  }
  return cache;
}

/**
 * 根据 key 获取对应的提示词
 *
 * @param key - 提示词名称，如 "system"、"compaction"
 * @returns 提示词文本
 */
export function getPrompt(key: string): string {
  const prompts = loadPrompts();
  const prompt = prompts[key];
  if (!prompt) {
    throw new Error(`未找到提示词: "${key}"，请在 prompts.json 中添加`);
  }
  return prompt;
}
