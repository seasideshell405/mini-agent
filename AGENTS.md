# Mini Agent 开发守则

## 代码风格

- 代码和注释中不使用 emoji
- 日志输出使用 `[标签]` 格式代替 emoji，如 `[完成]`、`[配置]`、`[错误]`
- 保持注释简洁、技术性
- 每行代码都要有注释说明为什么

## 提交规范

- 每次 commit 前检查 README.md 是否需要同步更新
  README 里包含：项目结构、用法、命令列表
  改了这些就要同步改 README
- commit message 按 Conventional Commits 标准：
  feat / fix / refactor / docs / chore / style / test
  如：`feat: 新增 /load 热加载指令`
