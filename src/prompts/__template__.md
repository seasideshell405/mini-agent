创建这个文件会覆盖代码里写死的默认提示词。

规则：
- 文件名去掉 .md 就是 key，如 system.md → getPrompt("system")
- 有文件 → 读文件内容
- 没文件 → 用 DEFAULTS 里的默认值
- 修改文件即时生效，不需要重启或 /load
- 删除文件 = 恢复默认值

默认值定义在 src/prompts/index.ts 的 DEFAULTS 里。
