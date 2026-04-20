# 与 .cursor 同步说明

以下目录由脚本从 `.cursor` **复制**而来，请勿在本仓库中单独维护两套文案：

- `commands/`  ← `.cursor/commands/`
- `skills/`    ← `.cursor/skills/*/`（各子目录整夹复制）
- `rules/`     ← `.cursor/rules/`

更新流程：修改 `.cursor` 下对应文件后执行：

```bash
npm run sync:claude
```

其它 `.claude/*`（如 `settings.json`、`mcp.json`、`agents/`）不由本脚本覆盖。
