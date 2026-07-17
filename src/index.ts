/**
 * 第 1 步：调用 DeepSeek API，让 AI 回复一句话
 * 
 * 核心流程：
 *   我们程序 → 发 HTTP 请求给 DeepSeek → 拿到回复 → 打印出来
 * 
 * 学完这步你要理解：
 *   1. async/await 是咋工作的
 *   2. 怎么用 fetch 发 HTTP 请求
 *   3. JSON 序列化（JSON.stringify）和反序列化（response.json()）
 *   4. 环境变量是干嘛的
 */

// DeepSeek 的 API 地址（兼容 OpenAI 格式）
// fetch 是 Node.js 18+ 内置的，不需要 import
const API_URL = "https://api.deepseek.com/v1/chat/completions";

// process.env 是 Node.js 提供的环境变量对象
// 你的 API 密钥从这里读取，不要硬编码在代码里！
const API_KEY = process.env.DEEPSEEK_API_KEY;

// 如果密钥没设置，直接报错退出
if (!API_KEY) {
  console.error("错误：没有找到 DEEPSEEK_API_KEY 环境变量");
  console.error("请先设置：");
  console.error("  Windows CMD:      set DEEPSEEK_API_KEY=sk-你的密钥");
  console.error("  PowerShell:       $env:DEEPSEEK_API_KEY=\"sk-你的密钥\"");
  console.error("  Git Bash/Mac:     export DEEPSEEK_API_KEY=\"sk-你的密钥\"");
  process.exit(1);  // 非零退出码表示出错了
}

/**
 * main 是程序的主函数
 * 
 * async 关键字是什么意思？
 *   → 这个函数是"异步"的，里面可以用 await
 *   → async 函数永远返回一个 Promise 对象
 * 
 * await 关键字是什么意思？
 *   → "等着"——程序执行到 await 时会暂停，等网络请求完成后再继续
 *   → 没有 await 的话，程序不会等网络响应，直接往下跑，那就拿不到结果了
 */
async function main() {
  // ============ 第 1 步：构造请求体 ============
  // 这是要发给 DeepSeek 的 JSON 数据
  const requestBody = {
    model: "deepseek-chat",        // 模型名称，DeepSeek 最新的对话模型
    messages: [                     // 消息列表（目前只有一条，后面多轮对话会加多条）
      {
        role: "user",              // 角色：user = 用户, assistant = AI
        content: "你好，请用一句话简单介绍你自己",
      },
    ],
    // 可选的参数：
    // temperature: 0.7,           // 控制回复的随机性（0=严谨，1=有创意）
    // max_tokens: 1024,           // 最大回复长度
  };

  // ============ 第 2 步：发送 HTTP 请求 ============
  // fetch 是浏览器/Node.js 内置的发 HTTP 请求的函数
  // 第一个参数：URL
  // 第二个参数：请求配置（方法、请求头、请求体）
  console.log("正在发送请求到 DeepSeek...");

  const response = await fetch(API_URL, {
    method: "POST",                          // HTTP 方法：POST = 提交数据
    headers: {
      "Content-Type": "application/json",     // 告诉服务器我们发的是 JSON
      "Authorization": `Bearer ${API_KEY}`,   // Bearer 认证，标准的 API 鉴权方式
    },
    // JSON.stringify：把 JS 对象转成 JSON 字符串
    // 比如：{ name: "test" } → '{"name":"test"}'
    body: JSON.stringify(requestBody),
  });

  // ============ 第 3 步：解析返回结果 ============
  // response.json() 也是异步的，因为从网络读取数据需要时间
  // 它会把 JSON 字符串转回 JS 对象（反序列化）
  const responseData = await response.json();

  // ============ 第 4 步：提取 AI 回复内容 ============
  // DeepSeek/OpenAI 的返回格式：
  // {
  //   choices: [
  //     {
  //       message: {
  //         content: "我是 DeepSeek，一个 AI 助手..."
  //       }
  //     }
  //   ]
  // }
  //
  // ?. 是"可选链"操作符（optional chaining）
  // 如果 choices 是 undefined，不会报错，而是返回 undefined
  // 这是一种安全的属性访问方式
  const reply = responseData.choices?.[0]?.message?.content;

  // 如果 AI 成功回复了，打印出来
  if (reply) {
    console.log("\n========== AI 回复 ==========");
    console.log(reply);
    console.log("=============================\n");
  } else {
    // 如果没拿到回复，打印整个返回结果方便调试
    console.error("没有拿到 AI 回复，服务器返回：");
    console.error(JSON.stringify(responseData, null, 2));
  }
}

// 调用 main 函数
// main() 返回的是一个 Promise（因为 async 函数总是返回 Promise）
// 如果 main 内部抛异常，会触发 .catch
main().catch((error) => {
  console.error("程序运行出错：", error);
});
