/**
 * 第 2 步：多轮对话循环
 *
 * 相比第 1 步的变化：
 *   1. 多了 readline —— 从终端读取你的输入
 *   2. 多了 messages 数组 —— 对话历史一直在累加
 *   3. 多了 while 循环 —— 你说 exit 才退出
 *
 * 核心流程：
 *   你打字 → 加入 messages → 发给 AI → AI 回复加入 messages → 打印 → 继续
 *               ↑_____________________________________________↓
 *                     messages 越来越长，AI 的"记忆"也越来越多
 */

import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const API_URL = "https://api.deepseek.com/v1/chat/completions";
const API_KEY = process.env.DEEPSEEK_API_KEY;

if (!API_KEY) {
  console.error("错误：没有找到 DEEPSEEK_API_KEY 环境变量");
  process.exit(1);
}

/**
 * 创建一个 readline 接口
 * readline 是 Node.js 内置模块，专门用来从终端读用户输入
 * 
 * input: stdin   = 标准输入（键盘）
 * output: stdout = 标准输出（屏幕）
 */
const rl = readline.createInterface({ input, output });

/**
 * messages 数组就是"对话历史"
 * 
 * 每次你说话和 AI 回复，都追加到这个数组里
 * 发给 AI 时，把整个数组都发过去，AI 就知道之前说过什么
 * 
 * 每个元素的结构：
 *   { role: "user" | "assistant", content: "说话内容" }
 * 
 * Pi 项目里也是同样的设计！
 */
const messages: Array<{ role: string; content: string }> = [];

async function askAI(): Promise<string | undefined> {
  /**
   * 这个函数跟第 1 步的 main 函数几乎一样
   * 区别：请求体里的 messages 现在是累积的，不再只有一条
   */
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages,                          // ← 关键：把累积的对话历史全部发过去
    }),
  });

  const data = await response.json();
  return data.choices?.[0]?.message?.content;
}

async function main() {
  console.log("🤖 迷你 AI Agent (输入 exit 退出)\n");

  // while(true) 无限循环，直到内部 break 才退出
  // 这是实现"持续对话"的关键
  while (true) {
    // ============ 读你的输入 ============
    // rl.question() 会在终端显示提示文字，然后等待你打字按回车
    // 它是异步的，所以要用 await
    const userInput = await rl.question("你 > ");

    // ============ 检查退出条件 ============
    // .trim() 去掉首尾空格
    // .toLowerCase() 转小写，这样 "EXIT" "Exit" "exit" 都行
    if (userInput.trim().toLowerCase() === "exit") {
      console.log("再见！");
      break;  // break 跳出 while 循环，程序结束
    }

    // ============ 把你说的加入对话历史 ============
    messages.push({ role: "user", content: userInput });

    // ============ 发送给 AI 并获取回复 ============
    console.log("AI > 思考中...");
    const reply = await askAI();

    if (reply) {
      // ============ 把 AI 回复加入对话历史 ============
      // 这一步非常关键！如果不加，AI 下一轮就不知道它刚才说了什么
      messages.push({ role: "assistant", content: reply });
      console.log(`AI > ${reply}\n`);
    } else {
      console.error("AI 没有返回有效回复\n");
    }
  }

  // 关闭 readline 接口，程序才能正常退出
  rl.close();
}

main().catch((error) => {
  console.error("程序出错：", error);
  rl.close();
});
