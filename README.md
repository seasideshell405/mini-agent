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
├── logger/              ← 日志系统（文件输出 + 按大小切割）
│   ├── index.ts               导出 Logger 类和全局实例
│   ├── types.ts               LogLevel 枚举、LoggerConfig 类型
│   └── logger.ts              Logger 实现
│
├── scheduler/            ← 定时任务系统（自动发现 + 每分钟 tick）
│   ├── index.ts               统一导出
│   ├── types.ts               任务类型定义
│   ├── loader.ts              自发现加载器
│   └── scheduler.ts           调度引擎
│
├── tasks/                ← 定时任务存放处（每个 .ts 文件一个任务）
│   └── __template__.ts        模板
│
├── config.ts             → 配置管理（API Key）
├── types.ts              → 类型定义
├── ai.ts                 → AI 通信
├── session-manager.ts    → 会话管理（树结构 + 文件持久化）
├── agent.ts              → 智能体核心（inner loop）
└── index.ts              → 入口（纯入口，不含业务逻辑）
```

四个子系统四种管理方式：

| 目录 | 管理方式 | 增删文件 |
|---|---|---|
| `prompts/` | 有 `.md` 文件 → 覆盖默认值；没有 → 用硬编码默认值 | 建文件覆盖，删文件恢复默认 |
| `tools/` | 自动发现所有 `.ts` 文件 | 建文件加工具，删文件去工具，然后 `/load` |
| `commands/` | 自动发现所有 `.ts` 文件 | 建文件加指令，删文件去指令，然后 `/load` |
| `tasks/` | 自动发现所有 `.ts` 文件 | 建文件加任务，删文件去任务，重启生效 |

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

### 日志系统

支持按文件大小自动切割的日志系统，记录所有幕后过程：

- **文件输出**：所有技术细节（工具调用、API 请求、内部循环等）写入 `logs/` 目录
- **命名格式**：`2026-07-22T06-30-21Z.log`（ISO 8601 UTC 标准）
- **自动切割**：单个文件超过 5MB 时自动新建文件
- **级别过滤**：DEBUG < INFO < WARN < ERROR，低于最低级别的日志不输出
- **终端分离**：用户直接看到的内容走 `console.log`，技术细节走 `logger.*`，互不干扰

```bash
# 日志文件示例：logs/2026-07-22T06-30-21Z.log
[2026-07-22T06:30:21.001Z] [INFO] [system] 会话 ID: abc123
[2026-07-22T06:30:21.123Z] [DEBUG] [agent] 构建上下文，共 3 条消息
[2026-07-22T06:30:22.456Z] [INFO] [agent] AI 请求调用工具: get_weather
```

| 位置 | 终端 | 日志文件 |
|------|------|----------|
| 用户输入 / AI 回复 | ✅ 显示 | ✅ 记录 |
| 会话信息 / 程序状态 | ✅ 显示 | ✅ 记录 |
| 错误信息 | ✅ 显示 | ✅ 记录 |
| 工具调用 / API 详情 | ❌ 不显示 | ✅ 记录 |

结构：

```
src/logger/
├── index.ts    ← 导出 Logger 类和全局实例
├── types.ts    ← LogLevel 枚举、LoggerConfig 类型
└── logger.ts   ← Logger 实现（文件输出 + 按大小切割）
```

### 定时任务系统

支持在后台每分钟检查并执行定时任务。每个任务一个 `.ts` 文件，自动发现加载。

#### 两种任务模式

| 模式 | 做法 | 适用场景 |
|---|---|---|
| **直接执行** | execute 函数不 return / return void | 清理日志、文件操作、调外部 API 等不需要 AI 参与的事 |
| **注入会话** | execute 返回 string | 消息会以 `system` 角色追加到当前 session，下次用户输入时 AI 会看到并处理 |

#### 调度表达式

| 格式 | 例子 | 含义 |
|---|---|---|
| `"every N"` | `"every 30"` | 每 N 分钟执行一次 |
| `"M H * * *"` | `"0 9 * * *"` | 每天本地时间 09:00 执行 |
| `"* * * * *"` | — | 每分钟执行（测试用） |

> 展示给用户的时间用系统本地时间，数据记录（`context.now`、`lastRunMinute`）用 UTC 无歧义。

#### 使用

新建任务：复制 `tasks/__template__.ts` → 改 `name`、`schedule`、`execute` → 重启或 `/load`。
删除任务：直接删文件，下次 tick 自动忽略。

### 会话系统

对话以树结构组织，支持分支（branching）：

- 每一条消息是一个树节点
- 分支可以在历史节点上重新开始，保留被放弃路径的完整记录
- 所有会话以 `.jsonl` 格式持久化在 `sessions/` 目录
- 每个新会话生成独立的文件，历史文件可随时用 `/resume` 恢复
