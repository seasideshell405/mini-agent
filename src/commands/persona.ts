/**
 * commands/persona.ts — /persona 指令
 *
 * 切换 AI 人格。人格文件放在 src/prompts/persona/ 下，
 * 行为规范统一用 src/prompts/rules.md，切换时自动拼装。
 *
 * 用法：
 *   /persona              → 列出可用人格
 *   /persona teacher      → 切换到 teacher 人格
 *   /persona default      → 恢复默认人格
 *
 * 新增人格：
 *   在 src/prompts/persona/ 下创建 {name}.md 文件即可
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 人格文件存放目录 */
const PERSONA_DIR = path.resolve(__dirname, "..", "prompts", "persona");

/**
 * 扫描 persona 目录，列出所有 .md 文件
 */
function listPersonaFiles(): string[] {
  if (!fs.existsSync(PERSONA_DIR)) return [];

  return fs
    .readdirSync(PERSONA_DIR)
    .filter((f: string) => f.endsWith(".md"))
    .map((f: string) => f.slice(0, -3)) // 去掉 .md
    .sort();
}

export const commandDefinition = {
  name: "/persona",
  description: "切换 AI 人格（/persona 列出，/persona <name> 切换）",
  usage: "/persona [人格名称]",
};

export async function execute(
  args: string[],
  context: {
    agent: { setSystemPrompt: (prompt: string) => void };
    buildSystemPrompt: (key: string) => string;
  },
): Promise<{ shouldExit: boolean; newAgent?: any }> {
  // 没有参数 → 列出可用人格
  if (args.length === 0) {
    const personas = listPersonaFiles();

    if (personas.length === 0) {
      console.log("（没有找到人格文件，请在 src/prompts/persona/ 下创建 .md 文件）");
    } else {
      console.log("可用人格：");
      for (const name of personas) {
        console.log(`  ${name}`);
      }
    }
    console.log("\n用法: /persona <人格名称>  切换到指定人格");
    console.log("      /persona default     恢复默认人格");
    return { shouldExit: false };
  }

  const personaName = args[0].toLowerCase();

  try {
    // buildSystemPrompt 负责读人格文件 + 规则文件并拼装
    const fullPrompt = context.buildSystemPrompt(personaName);
    context.agent.setSystemPrompt(fullPrompt);
    console.log(`✅ 已切换人格为: ${personaName}`);
  } catch {
    console.log(`❌ 未找到人格 "${personaName}"`);
    console.log("可用人格列表：");
    for (const name of listPersonaFiles()) {
      console.log(`  ${name}`);
    }
  }

  return { shouldExit: false };
}
