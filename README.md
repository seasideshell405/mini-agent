# mini-agent 🚧

从零复刻一个 AI Agent。持续学习迭代 ing...

学习自 [Pi Agent Harness](https://github.com/earendil-works/pi-mono)，一个开源的 coding-agent 项目。

### 结构

```
src/
├── prompts/              ← 提示词（每个 .md 文件可覆盖一个提示词）
│   ├── index.ts               有文件读文件，没有用硬编码默认值
│   ├── system.md              覆盖 system 提示词
│   ├── compaction.md          覆盖分支摘要提示词
│   └── __template__.md        模板
│
├── tools/                ← AI 工具（每个 .ts 文件一个工具）
│   ├── index.ts               自动发现加载器
│   ├── eval.ts
│   ├── read_file.ts
│   ├── write_file.ts
│   └── __template__.ts        模板
│
├── commands/             ← /指令（每个 .ts 文件一个指令）
│   ├── index.ts               自动发现加载器
│   ├── tree.ts
│   ├── branch.ts
│   ├── session.ts
│   ├── new.ts
│   ├── resume.ts
│   ├── load.ts
│   ├── exit.ts
│   └── __template__.ts        模板
│
├── config.ts             → 配置管理（API Key）
├── types.ts              → 类型定义
├── ai.ts                 → AI 通信
├── session-manager.ts    → 会话管理（树结构 + 文件持久化）
├── agent.ts              → 智能体核心（inner loop）
└── index.ts              → 入口（纯入口，不含业务逻辑）
```

三个子系统三种管理方式：

| 目录 | 管理方式 | 增删文件 |
|---|---|---|
| `prompts/` | 有 `.md` 文件 → 覆盖默认值；没有 → 用硬编码默认值 | 建文件覆盖，删文件恢复默认 |
| `tools/` | 自动发现所有 `.ts` 文件 | 建文件加工具，删文件去工具，然后 `/load` |
| `commands/` | 自动发现所有 `.ts` 文件 | 建文件加指令，删文件去指令，然后 `/load` |

### 使用

```bash
npm install
npx tsx src/index.ts
```

首次运行会提示输入 DeepSeek API Key，保存后不再询问。

### 命令

所有命令都以 `/` 开头，启动时会自动列出所有已加载的指令：

| 命令 | 说明 |
|---|---|
| `/tree` | 查看当前会话的树状结构，`← leaf` 标记当前节点 |
| `/branch <id>` | 切换到历史节点开始新分支 |
| `/branch <id> --summary` | 分支并自动为被放弃的路径生成摘要 |
| `/session` | 查看当前会话信息（ID、文件、节点数） |
| `/new` | 创建全新的会话（旧会话文件保留在 sessions/ 目录） |
| `/resume` | 列出所有历史会话 |
| `/resume <序号>` | 恢复指定历史会话 |
| `/load` | 热加载工具和指令（增删文件后无需重启） |
| `/exit` | 退出程序 |

### 会话系统

对话以树结构组织，支持分支（branching）：

- 每一条消息是一个树节点
- 分支可以在历史节点上重新开始，保留被放弃路径的完整记录
- 所有会话以 `.jsonl` 格式持久化在 `sessions/` 目录
- 每个新会话生成独立的文件，历史文件可随时用 `/resume` 恢复
