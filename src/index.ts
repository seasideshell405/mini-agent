/**
 * 第 3 步：工具调用 —— 让 AI 能真正"做事"
 *
 * 相比第 2 步的变化：
 *   1. 多了 tools 定义 —— 告诉 AI 它有哪些工具可用
 *   2. 多了 inner loop —— AI 可以连续调多个工具，最后才给你回复
 *   3. 多了 tool_calls 处理 —— 解析 AI 返回的"工具调用指令"并执行
 *
 * 核心流程（一次对话回合）：
 *
 *   你提问
 *     ↓
 *   程序发消息 + 工具列表给 AI
 *     ↓
 *   AI 返回 ──┬── 有 tool_calls ──→ 执行工具 → 结果发回给 AI → 继续
 *             │                           ↑_________________________↓
 *             └── 直接回复文字 ──→ 打印出来，本轮结束
 *
 *   Pi 项目里的 agent-loop.ts 做的就是完全一样的事！
 */

import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import * as fs from "node:fs";

const API_URL = "https://api.deepseek.com/v1/chat/completions";
const API_KEY = process.env.DEEPSEEK_API_KEY;

if (!API_KEY) {
  console.error("错误：没有找到 DEEPSEEK_API_KEY 环境变量");
  process.exit(1);
}

const rl = readline.createInterface({ input, output });

// ===================== 第 1 步：定义工具 =====================
//
// tools 是给 AI 看的"工具说明书"
// AI 读了之后就知道："哦，我有这些工具可以用，每个工具要传什么参数"
//
// 这个格式是 OpenAI 定义的（DeepSeek 兼容同格式）
// Pi 项目里也是这样定义工具的
//
const tools = [
  {
    type: "function",
    function: {
      name: "eval",                                          // 工具名
      description: "执行一个 JavaScript 表达式并返回计算结果",  // 描述：AI 根据这个决定何时用
      parameters: {
        type: "object",
        properties: {
          expression: {
            type: "string",
            description: "要计算的表达式，如 '2 + 2' 或 'Math.sqrt(16)'",
          },
        },
        required: ["expression"],  // 必填参数
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "读取指定文件的内容",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "文件路径（相对路径或绝对路径）",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "把内容写入指定文件（覆盖写入）",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "文件路径" },
          content: { type: "string", description: "要写入的内容" },
        },
        required: ["path", "content"],
      },
    },
  },
];

// ===================== 第 2 步：实现工具函数 =====================
//
// 这里的 key 是工具名，value 是实际执行的函数
// AI 说"调用 eval"，程序就在这里找到 eval 函数来执行
//
// 每个工具函数接收参数对象，返回字符串结果
//
const toolImplementations: Record<string, (args: any) => string> = {
  eval: (args) => {
    try {
      // eval() 是 JS 内置函数，把字符串当代码执行 —— 有安全风险，仅用于学习！
      const result = eval(args.expression);
      return String(result);
    } catch (error: any) {
      return `执行出错: ${error.message}`;
    }
  },

  read_file: (args) => {
    try {
      // fs 已经在文件顶部 import 了，直接使用
      return fs.readFileSync(args.path, "utf-8");
    } catch (error: any) {
      return `读取文件失败: ${error.message}`;
    }
  },

  write_file: (args) => {
    try {
      fs.writeFileSync(args.path, args.content, "utf-8");
      return `文件 ${args.path} 写入成功`;
    } catch (error: any) {
      return `写入文件失败: ${error.message}`;
    }
  },
};

// ===================== 第 3 步：调用 AI =====================
//
// messages 的类型现在更复杂了，因为工具调用的消息有特殊结构
// 我们定义一个类型来标注
//
type Message = {
  role: "user" | "assistant" | "tool";
  content: string | null;       // tool_calls 时 content 为 null
  tool_calls?: Array<{           // assistant 消息可能带工具调用指令
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;         // tool 消息需要关联到哪个工具调用
  name?: string;                 // tool 消息的工具名
};

const messages: Message[] = [];

/**
 * 向 AI 发送请求并返回完整响应
 *
 * 跟第 2 步的区别：
 *   1. 请求体里多了 tools 字段
 *   2. 返回的是整个 message 对象（可能带 tool_calls），不只是文本
 */
async function askAI(): Promise<Message> {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages,
      tools,                           // ← 新增：告诉 AI 有哪些工具可用
      tool_choice: "auto",             // ← 新增：让 AI 自己决定是否调工具
    }),
  });

  const data = await response.json();
  return data.choices?.[0]?.message;
}

// ===================== 第 4 步：主循环 =====================

async function main() {
  console.log("🤖 迷你 AI Agent (支持工具调用！输入 exit 退出)\n");

  while (true) {
    const userInput = await rl.question("你 > ");
    if (userInput.trim().toLowerCase() === "exit") {
      console.log("再见！");
      break;
    }

    // 1. 把你说的加入对话历史
    messages.push({ role: "user", content: userInput });

    // ================= 关键：inner loop（内部循环） =================
    //
    // 一次"你问 → AI 最终回答"可能需要多轮 AI 交互：
    //
    //   你: "计算 2+2 并保存到 result.txt"
    //    → AI 决定调 eval("2+2")  → 返回 4
    //    → AI 决定调 write_file("result.txt", "4")  → 返回成功
    //    → AI 最终回复 "已经计算并保存好了"
    //
    // 每次工具调用结果都要"喂"回给 AI，让 AI 决定下一步
    // 直到 AI 觉得"够了，我直接回答"为止
    //
    // 这正是 Pi 的 agent-loop.ts 的核心逻辑！
    //
    let aiMessage: Message;

    while (true) {
      console.log("AI > 思考中...");
      aiMessage = await askAI();

      // 情况 A：AI 返回了工具调用指令
      // tool_calls 是一个数组，AI 可能一次想调多个工具
      if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
        // 先把 AI 的"工具调用意图"加入对话历史
        // 注意：content 是 null，因为 AI 没说话，它在调用工具
        messages.push({
          role: "assistant",
          content: null,
          tool_calls: aiMessage.tool_calls,
        });

        // 逐个执行工具
        for (const toolCall of aiMessage.tool_calls) {
          const toolName = toolCall.function.name;
          // arguments 是 JSON 字符串，需要 parse 成对象
          const toolArgs = JSON.parse(toolCall.function.arguments);

          console.log(`  → 调用工具: ${toolName}(${JSON.stringify(toolArgs)})`);

          // 在 toolImplementations 里找到对应的函数并执行
          const toolFn = toolImplementations[toolName];
          let result: string;

          if (toolFn) {
            result = toolFn(toolArgs);
          } else {
            result = `错误: 未知工具 "${toolName}"`;
          }

          console.log(`  → 工具返回: ${result.slice(0, 100)}${result.length > 100 ? "..." : ""}`);

          // 把工具执行结果加入对话历史
          // role 是 "tool"，tool_call_id 关联到对应的工具调用
          messages.push({
            role: "tool",
            content: result,
            tool_call_id: toolCall.id,
            name: toolName,
          });
        }

        // 工具结果已经加入 messages 了，继续 inner loop
        // AI 会看到工具返回的结果，决定下一步
        continue;
      }

      // 情况 B：AI 直接回复了文字（没有工具调用）
      // 这时可以跳出 inner loop，把回复展示给用户
      break;
    }

    // ================= inner loop 结束 =================

    // AI 最终回复的文字（所有工具都调完了，AI 给了总结）
    if (aiMessage.content) {
      messages.push({ role: "assistant", content: aiMessage.content });
      console.log(`AI > ${aiMessage.content}\n`);
    }
  }

  rl.close();
}

main().catch((error) => {
  console.error("程序出错：", error);
  rl.close();
});
