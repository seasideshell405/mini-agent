/**
 * prompts/index.ts — 提示词加载器
 *
 * 和 tools/、commands/ 同样的自动发现模式，但提示词是 .md 文件：
 *   - 扫描 prompts/ 目录下所有 .md 文件
 *   - 文件名（不含扩展名）就是 key
 *   - 文件内容就是提示词文本
 *
 * 新增提示词只需两步：
 *   1. 在 prompts/ 下创建一个 .md 文件
 *   2. 代码里 getPrompt("文件名") 即可读取
 * 删除提示词：直接删除对应的 .md 文件
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** 拿到当前文件所在目录的绝对路径 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 提示词缓存：key = 文件名（不含扩展名），value = 文件内容 */
let prompts = new Map<string, string>();

/**
 * 扫描 prompts/ 目录，读取所有 .md 文件
 */
function init() {
  prompts = new Map();

  const files = fs.readdirSync(__dirname);

  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    if (file.startsWith("__")) continue;

    try {
      const key = file.slice(0, -3);
      const content = fs.readFileSync(path.join(__dirname, file), "utf-8");
      prompts.set(key, content);
      console.log(`[提示词] 已加载: ${key} (${file})`);
    } catch (error: any) {
      console.error(`[提示词] 加载失败: ${file} — ${error.message}`);
    }
  }
}

// 同步初始化，模块加载时自动扫描
init();

/**
 * 热加载 —— 重新扫描 prompts/ 目录并重新读取所有 .md 文件
 */
export function reloadPrompts(): void {
  console.log("[提示词] 重新加载中...");
  init();
  console.log("[提示词] 重新加载完成\n");
}

/**
 * 根据 key 获取对应的提示词
 *
 * @param key - 提示词名称，对应文件名（不含 .md），如 "system"
 * @returns 提示词文本
 */
export function getPrompt(key: string): string {
  const prompt = prompts.get(key);
  if (!prompt) {
    throw new Error(
      `未找到提示词: "${key}"，请在 src/prompts/ 下创建 ${key}.md 文件`,
    );
  }
  return prompt;
}
