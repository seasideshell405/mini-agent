/**
 * config.ts — 配置管理
 *
 * 职责：统一管理 API Key 等配置的读取和保存
 * 不用依赖环境变量，重启不丢失
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_FILE = path.resolve(__dirname, "../.env");

/**
 * 获取 API Key
 *
 * 查找顺序：环境变量 → .env 文件 → null
 * 这样即使你同时设了环境变量和 .env 文件，环境变量优先
 */
export function getApiKey(): string | null {
  // 1. 优先读环境变量（临时覆盖用）
  const envKey = process.env.DEEPSEEK_API_KEY;
  if (envKey) return envKey;

  // 2. 读 .env 文件（持久保存）
  try {
    const content = fs.readFileSync(ENV_FILE, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      // 格式: DEEPSEEK_API_KEY=sk-xxx
      if (trimmed.startsWith("DEEPSEEK_API_KEY=")) {
        return trimmed.slice("DEEPSEEK_API_KEY=".length);
      }
    }
  } catch {
    // 文件不存在就忽略
  }

  return null;
}

/**
 * 保存 API Key 到 .env 文件
 *
 * @param key - API Key
 */
export function saveApiKey(key: string): void {
  fs.writeFileSync(ENV_FILE, `DEEPSEEK_API_KEY=${key}\n`, "utf-8");
}
