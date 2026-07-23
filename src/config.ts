/**
 * config.ts — 配置管理
 *
 * 职责：统一管理 .env 文件的读写，持久化 API Key、当前人格等配置。
 *
 * 每次写入都是读-改-写模式（不是覆盖整个文件），
 * 所以 API Key 和 人格 不会互相覆盖。
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_FILE = path.resolve(__dirname, "../.env");
const LOG_PREFIX = "[config]";

// ===================== 内部：.env 文件的解析和写入 =====================

/**
 * 解析 .env 文件为键值对
 *
 * 每一行格式：KEY=VALUE
 * 跳过空行和注释行（以 # 开头）
 *
 * @returns 解析后的键值对，文件不存在或读取失败时返回空对象
 */
function parseEnvFile(): Record<string, string> {
  let content: string;
  try {
    content = fs.readFileSync(ENV_FILE, "utf-8");
  } catch {
    // 文件不存在或读不了 → 当空的处理，不报错
    return {};
  }

  const env: Record<string, string> = {};

  for (const line of content.split("\n")) {
    const trimmed = line.trim();

    // 跳过空行和注释
    if (!trimmed || trimmed.startsWith("#")) continue;

    // 格式必须是 KEY=VALUE，且 KEY 不能为空
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue; // 没有 = 或者 = 在开头，跳过

    const key = trimmed.slice(0, eqIndex);
    const value = trimmed.slice(eqIndex + 1);
    env[key] = value;
  }

  return env;
}

/**
 * 把键值对写回 .env 文件
 *
 * 如果写入失败，只打日志不抛异常，不阻塞程序运行。
 *
 * @param env - 要写入的键值对
 */
function writeEnvFile(env: Record<string, string>): void {
  try {
    const content = Object.entries(env)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n") + "\n";

    fs.writeFileSync(ENV_FILE, content, "utf-8");
  } catch (err) {
    console.error(`${LOG_PREFIX} 写入 .env 文件失败:`, err);
  }
}

// ===================== API Key =====================

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
  const env = parseEnvFile();
  return env.DEEPSEEK_API_KEY ?? null;
}

/**
 * 保存 API Key 到 .env 文件
 *
 * 读-改-写模式：保留 .env 中已有的其他配置（如 CURRENT_PERSONA）。
 *
 * @param key - API Key
 */
export function saveApiKey(key: string): void {
  const env = parseEnvFile();
  env.DEEPSEEK_API_KEY = key;
  writeEnvFile(env);
}

// ===================== 人格持久化 =====================

/**
 * 获取上次保存的人格名称
 *
 * 读取 .env 中的 CURRENT_PERSONA 字段。
 * 如果文件不存在、字段不存在或值为空，返回 null（由调用方决定默认值）。
 *
 * @returns 人格名称，如 "teacher"，无记录时返回 null
 */
export function getActivePersona(): string | null {
  const env = parseEnvFile();
  const persona = env.CURRENT_PERSONA;

  // 值为空字符串也视为无记录
  if (!persona) return null;

  return persona;
}

/**
 * 保存当前人格名称到 .env 文件
 *
 * 切换人格时调用，确保下次启动时恢复同一个人格。
 * 写入失败不会影响当前会话，只在终端打印一条警告。
 *
 * @param persona - 人格名称，如 "teacher"
 */
export function saveActivePersona(persona: string): void {
  if (!persona || typeof persona !== "string") {
    console.warn(`${LOG_PREFIX} 保存人格失败：人格名称无效 (${persona})`);
    return;
  }

  const env = parseEnvFile();
  env.CURRENT_PERSONA = persona;
  writeEnvFile(env);
}
