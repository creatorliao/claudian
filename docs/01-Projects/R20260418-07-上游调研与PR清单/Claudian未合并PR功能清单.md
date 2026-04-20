# Claudian 未合并 PR 功能清单（待确认）

> **数据来源**：`origin` 远程仓库 [YishenTu/claudian](https://github.com/YishenTu/claudian) 上当前 **Open** 状态的 Pull Request（截至查询时）。  
> **说明**：以下为根据各 PR 标题与描述整理的功能要点、价值与解决的问题，供你决策是否跟进或 cherry-pick；**最终以各 PR 实际 diff 与维护者评审为准**。

---

## 状态总览

| PR | 标题（简要） | 类型 |
|----|----------------|------|
| [#523](https://github.com/YishenTu/claudian/pull/523) | 输入工具栏发送/停止按钮 | feat |
| [#516](https://github.com/YishenTu/claudian/pull/516) | AskUserQuestion 默认显示自由文本输入 | fix |
| [#484](https://github.com/YishenTu/claudian/pull/484) | 新增 Cursor Agent 为第三聊天提供商 | feat |
| [#478](https://github.com/YishenTu/claudian/pull/478) | 独立窗口/独立标签页下保留编辑器选区 | fix |
| [#456](https://github.com/YishenTu/claudian/pull/456) | OpenCode 提供商（ACP 协议） | feat |
| [#424](https://github.com/YishenTu/claudian/pull/424) | 内置兼容 Anthropic API 的服务商预设 | feat |
| [#390](https://github.com/YishenTu/claudian/pull/390) | Skill Runs 页面：并行后台执行 Skill | feat |
| [#384](https://github.com/YishenTu/claudian/pull/384) | 从文件栏拖拽文件到会话上下文 | feat |
| [#380](https://github.com/YishenTu/claudian/pull/380) | 动态识别任意 `ANTHROPIC_DEFAULT_*_MODEL` 环境变量 | feat |
| [#371](https://github.com/YishenTu/claudian/pull/371) | OAuth/401 等鉴权失败的可操作提示 | fix |

---

## 逐条说明（功能 · 价值 · 解决的问题）

### PR [#523](https://github.com/YishenTu/claudian/pull/523) — feat: add send/stop button to input toolbar

- **功能**：在输入区工具栏增加可见的「发送 / 停止」按钮；空闲时显示发送（arrow-up），流式输出时切换为停止（square）；样式与 `--claudian-brand` 一致；通过现有 `onStreamingStateChanged` 与 `TabManager` 接线，不改运行时与流逻辑核心。
- **价值**：降低对键盘 Esc 的依赖，触控/不熟悉快捷键的用户也能明确中断生成；发送动作与停止动作在同一控件语义上统一，减少误操作困惑。
- **解决的问题**：此前中断可能主要依赖 Esc，**可发现性弱**；本 PR 把「停止流式输出」做成**显式 UI**。

---

### PR [#516](https://github.com/YishenTu/claudian/pull/516) — fix: show free-text input in AskUserQuestion by default

- **功能**：去掉 `canShowCustomInputForQuestion()` 中对 `isOther` 的门控，使在默认开启 `showCustomInput` 时，「Other」自由文本行会显示；与 Claude Code CLI 行为对齐。关联 issue [#487](https://github.com/YishenTu/claudian/issues/487)。
- **价值**：问答式交互里用户可直接输入自定义答案，**不必先选到特定选项**才能出现输入框。
- **解决的问题**：默认场景下自由文本输入**被错误隐藏**，与 CLI 不一致导致的体验落差。

---

### PR [#484](https://github.com/YishenTu/claudian/pull/484) — feat: add Cursor Agent as third chat provider

- **功能**：将 **Cursor Agent** 注册为第三种聊天提供商；通过子进程调用 Cursor CLI（`agent -p`、`stream-json`）；支持 `--resume` 恢复会话；工作区按 vault 路径（md5）区分；在可用时从 `~/.cursor/chats` 的 SQLite  hydrate 历史；增加设置页、环境协调、标题/润色/内联等辅助运行器；模型预设与当前 Cursor CLI 对齐（含 `composer-1` → `auto` 映射）；测试与 `.cursor/` 忽略等配套。
- **价值**：在 Obsidian 内**统一使用 Cursor 的对话能力**，并与本地 Cursor 聊天记录、恢复会话衔接（在环境支持时）。
- **解决的问题**：仅 Claude/Codex 等路径无法满足「**已在 Cursor 生态投入**」的用户；需要**第三提供商**与 CLI 集成。

---

### PR [#478](https://github.com/YishenTu/claudian/pull/478) — fix(selection): preserve selection when Claudian is in detached window or own tab

- **功能**：修复 #399：Claudian 在**独立窗口**或**独立标签**中时，点击 Claudian 会导致 Markdown 编辑页失焦、`document.activeElement` 落在 `body` 上，原焦点守卫误判为「不在侧栏」从而清空选区。通过让侧栏焦点判断**同时识别当前活动 leaf 是否为 Claudian 视图**等方式保留选区；`SelectionController` 增加 `ownViewType` 并补测试；为 #431 的替代实现。
- **价值**：**编辑器选中文本作为聊天上下文**的流程在分离窗口布局下仍然可靠。
- **解决的问题**：分离窗口/标签下**选区被周期轮询误清**，导致上下文指示消失或不可用。

---

### PR [#456](https://github.com/YishenTu/claudian/pull/456) — feat: add OpenCode provider integration via ACP protocol

- **功能**（仅能从标题推断，**PR 正文为空**）：集成 **OpenCode** 提供商，通过 **ACP（Agent Client Protocol）** 协议对接。
- **价值**：若落地完整，可扩展 Claudian 的模型/Agent 后端，对接 OpenCode 生态。
- **解决的问题**：单一或少数提供商无法覆盖的用户需求；**需以 PR diff 与手动试用为准**补充细节。

---

### PR [#424](https://github.com/YishenTu/claudian/pull/424) — feat: add built-in provider presets for Anthropic API-compatible services

- **功能**：在 **设置 → 环境** 中增加一键 **服务商预设**（MiniMax、OpenRouter、DeepSeek、Kimi/Moonshot、GLM/智谱等），自动填充 `ANTHROPIC_BASE_URL`、`ANTHROPIC_API_KEY`、`ANTHROPIC_MODEL` 等；README 增加「自定义模型服务商」参考表；`providerPresets.ts`、样式、i18n、单测/集成测。
- **价值**：**降低接第三方兼容 API 的配置成本**，减少抄错 Base URL/模型名的摩擦。
- **解决的问题**：手动配环境变量**步骤多、易错**；文档分散时难以快速对齐官方/兼容端点。

---

### PR [#390](https://github.com/YishenTu/claudian/pull/390) — feat: add Skill Runs page for parallel background skill execution

- **功能**：新增 **Skill Runs** 页：后台启动 Skill 会话、列表监控；每 run 独立 `ClaudianService` 与可配置工作目录；vault 路径自动补全、Skill 使用次数持久化排序；工具审批 / AskUserQuestion / ExitPlanMode 时自动取消并标记 `needs_attention`；日志弹窗、复跑、与对话删除联动；修复 vault 限制下 bash 校验误拒 `/dev/null` 等问题。
- **价值**：**批量、并行跑 Skill** 而不用开一堆标签手动盯；适合重复任务与自动化工作流。
- **解决的问题**：单次聊天模型难以管理**多路后台任务**；路径校验边缘情况导致合法 shell 重定向失败。

---

### PR [#384](https://github.com/YishenTu/claudian/pull/384) — feat: 从文件栏拖拽文件到会话上下文

- **功能**：从 Obsidian **左侧文件列表拖拽**到聊天输入区，自动附加为上下文；发送时以 `<context_files>` 注入；修复 `dragEnterCount` 可能为负；改进外部 URL/书签拖拽误判；用 `vault.getFiles()` 替代低效递归搜文件夹。
- **价值**：**比手动 @ 或复制路径更快**地把笔记文件纳入对话。
- **解决的问题**：选文件进上下文的交互路径长；拖拽状态与外部拖拽**误判**；大库下递归扫描性能差。

---

### PR [#380](https://github.com/YishenTu/claudian/pull/380) — feat: support arbitrary ANTHROPIC_DEFAULT_*_MODEL env keys

- **功能**：用正则扫描环境变量，动态发现所有 `ANTHROPIC_DEFAULT_<任意>_MODEL`，替代原先仅硬编码少数 key；模型选择器自动展示用户自定义 tier；`computeEnvHash()` 纳入动态 key 以正确触发会话失效。
- **价值**：与 **自建分层模型命名**（如 `ANTHROPIC_DEFAULT_MIMO_MODEL`）的工作流兼容，无需改插件代码。
- **解决的问题**：**扩展环境变量命名**后模型列表不更新、会话缓存不刷新等与硬编码列表不一致的问题。

---

### PR [#371](https://github.com/YishenTu/claudian/pull/371) — fix: detect OAuth token expiry and show actionable error message

- **功能**：增加 `isAuthenticationError()`，识别 OAuth 过期、非法 API Key、401 等；在 `ClaudianService` 中在会话重试逻辑之前拦截（避免对过期 token 无意义重试）；展示明确提示（如建议执行 `claude auth login`）；Obsidian `Notice` 约 10 秒展示。
- **价值**：用户遇到鉴权问题时**知道下一步做什么**，而不是面对一大段原始 JSON。
- **解决的问题**：401 / `authentication_error` 未与 session expired 区分，落入通用错误路径，**提示混乱且无指引**。

---

## 请你确认的事项

1. **仓库范围**：以上列表基于 **`git@github.com:YishenTu/claudian.git`**（`origin`）。若你实际以 **`binison/claudian`** fork 为主，需否对 fork 再跑一次 `gh pr list` 对比，我可以按你确认后补充一版。
2. **PR #456**：描述为空，若你需要，可在确认后让我**仅针对该 PR** 拉取 files diff 摘要再补一节「代码层面变更要点」。
3. **文档定稿**：你确认本清单无误或提出修改意见后，可指定文件名/存放位置是否需要调整，或是否合并进现有的《最近半月更新报告》类文档。

---

*（本文档为待你确认的草稿；合并与否以 GitHub 仓库实时状态为准，可在本地执行 `gh pr list --repo YishenTu/claudian --state open` 复核。）*
