## Agents

阅读仓库根目录 **`CLAUDE.md`** 获取架构、命令与开发约定。

Cursor 工作区规则见 **`.cursor/rules/`**（其中 **`S00-Claudian-工作区上下文.mdc`** 为全局上下文，含 **Windows / macOS 跨平台与智能体约束**）；需求到发版的命令见 **`.cursor/commands/C01`～`C08`**，可由 skill **`dev-workflow`** 调度。

与 Claude Code 对齐：**`.claude/`** 已纳入本仓库（与 **`.cursor`** 同步的副本）；仍以 **`.cursor`** 为单一维护源，修改后执行 **`npm run sync:claude`** 更新 **`.claude/`**（详见 **`.claude/README-SYNC.md`**）。
