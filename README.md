# mini-agent

从零复刻一个 AI Agent。

学习自 [Pi Agent Harness](https://github.com/earendil-works/pi-mono)，一个开源的 coding-agent 项目。

### 结构

```
src/
├── config.ts     → 配置管理（API Key）
├── types.ts      → 类型定义
├── ai.ts         → AI 通信
├── tools.ts      → 工具系统
├── prompt-manager.ts → 提示词管理
├── agent.ts      → 智能体核心
└── index.ts      → 入口
```

### 使用

```bash
npm install
npx tsx src/index.ts
```

首次运行会提示输入 DeepSeek API Key，保存后不再询问。
