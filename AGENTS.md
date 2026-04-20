## Agents

阅读仓库根目录 **`CLAUDE.md`** 获取架构、命令与开发约定。

Cursor 工作区规则见 **`.cursor/rules/`**（其中 **`S00-Claudian-工作区上下文.mdc`** 为全局上下文，含 **Windows / macOS 跨平台与智能体约束**）；需求到发版的命令见 **`.cursor/commands/C01`～`C08`**，可由 skill **`dev-workflow`** 调度。

与 Claude Code 对齐：修改上述内容后执行 **`npm run sync:claude`**，将 **`.cursor/commands`、`.cursor/skills`、`.cursor/rules`** 复制到 **`.claude/`** 下对应目录（详见 **`.claude/README-SYNC.md`**）。
