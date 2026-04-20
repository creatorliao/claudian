# Changelog

本文档记录 Claudian（Obsidian 插件）的版本变更；格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，版本号遵循语义化版本意图（主版本.次版本.修订号）。

## [2.1.0] - 2026-04-20

### 功能

- **工作空间（Vault 内子目录）**：文件树中 **文件夹** 右键 **「设为工作空间」**，将持久化路径写入存储并在 **Ribbon** 提示中展示简短目录名；非法路径给出 Notice。
- **重置工作空间**：命令 **`Reset workspace`**（及视图内对应操作）清空持久化工作空间，各 Tab 副标题与后续新建 Tab 回到 **Vault 根** 语义。
- **Tab 与有效工作目录**：每个 Tab 持有 **`workspace` 快照**；新建 Tab **继承**当前持久化工作空间；向 Claude / Codex 运行时传入 **`effectiveCwd`**，**Bang Bash** 与外部工具路径按解析后的目录执行。
- **路径工具**：新增 **`resolveWorkspacePath`**、**`formatWorkspaceDisplayShort`**、**`absoluteWorkspaceToVaultRelative`**、**`isFileInWorkspaceVaultRelative`** 等，统一 Vault 相对/绝对路径与安全校验；**`getVaultPath`** 对 `app.vault` 做空值防护。

### 国际化

- 新增 **`contextMenu.*`**（设为工作空间、路径无效等）、**`commands.resetWorkspace`**（`en` / `zh-CN`）。

### 测试

- 更新 **TabManager**、**BangBashService**、**QueryOptionsBuilder**、**main** 集成桩等与工作空间行为相关的单测/集成测试。

### 修复

- **Claudian 视图布局**：为叠层状态栏主题增加底部避让（**`--claudian-view-bottom-safe`**，综合 `--status-bar-scroll-padding`、可选 `--status-bar-height`、桌面 **28px** 兜底与 **`safe-area-inset-bottom`**）。状态栏已流内占位的主题若嫌底部空白过大，可在用户 CSS 中将该变量覆盖为 **`0`**。

---

## [2.0.18] - 2026-04-20

### 工程

- **构建与产物路径**：`scripts/lib/read-plugin-id.mjs` 从 `manifest.json` 读取插件 id，统一 **`dist/{id}/`** 与相关脚本（`build.mjs`、`build-css.mjs`、`esbuild.config.mjs`、`postinstall.mjs`）；与 **`S02`** 约定一致。
- **版本同步**：`scripts/sync-version.js` 迁移为 **`scripts/sync-version.mjs`**（`npm version` 生命周期仍同步 `manifest.json`）。
- **npm 脚本**：新增 **`report:upstream-signals`**（上游/社区信号采集）、**`copy:obsidian`** / **`build:try`**（可选将构建产物同步到上层 Obsidian 库）、**`sync:claude`**（将 `.cursor` 下命令/技能/规则同步到 `.claude/`）。
- **ESLint**：为 **`scripts/**/*.mjs`** 声明 Node 全局（如 `process`），消除脚本误报；与 **`no-useless-assignment`** 规则对齐的 **`upstream-signal-report.mjs`** 小调整。

### 智能体与工作流（本仓库）

- 纳入 **`.cursor/rules`**（含 **`S00`～`S03`**）：工作区上下文、文档存放、构建系统、版本发布；**`S00`** 含 **Windows / macOS 跨平台约束**与**告警/质量门禁**约定。
- 纳入 **`.cursor/commands`**（**`C01`～`C08`**）与 **`.cursor/skills`**（如 **`dev-workflow`**、**`obsidian-plugin-dev-build-system`**、**`upstream-community-signal-report`**），便于 AI 辅助需求—发版流程与构建说明对齐。

### 文档

- **`docs/02-Areas/`**：更新 fork 与上游信号筛选最佳实践；新增 **构建产物同步到上层 Obsidian 库** 实践说明。
- **`docs/04-Archives/`**：归档上游社区信号采集与调查报告样例（**2026-04-20**）。
- **`AGENTS.md` / `CLAUDE.md`**：补充跨平台说明并指向 **`S00`**。

### 仓库

- **`.claude/`**：纳入版本控制（与 **`.cursor`** 通过 **`npm run sync:claude`** 保持同步的副本，便于克隆即用 Claude Code CLI）；**`.codex/`** 仍由 **`.gitignore`** 忽略。

---

## [2.0.17] - 2026-04-20

### 修复

- **选区上下文（独立窗口 / 单独标签）**：当 Claudian 位于 **独立窗口** 或 **单独标签页** 时，点击 Claudian 面板后仍 **保留** 笔记中已选文字的对话上下文，不再因 Markdown 编辑视图失焦、`document.activeElement` 落在 `<body>` 等原因被轮询逻辑误清。实现上为 `SelectionController` 的焦点守卫增加 **当前活动 leaf 的视图类型** 校验（传入 `ownViewType`，与 Claudian 视图一致时视为仍处「本插件焦点语境」）；合并自上游 [YishenTu/claudian#478](https://github.com/YishenTu/claudian/pull/478)（关联 issue #399）。

### 测试

- **单测**：`SelectionController` 增补独立窗口 / 非 Markdown 活动 leaf 等场景的回归用例。

---

## [2.0.16] - 2026-04-20

### 修复

- **Claude CLI 路径解析**：合并「设置中的 PATH + `getExtraBinaryPaths()` + 进程 PATH」后再探测，与 GUI 下查找 Node 的策略对齐；Unix/macOS 在 PATH 上除 `claude` 可执行文件外，增加与 Windows 一致的 **`cli.js` 推导**；补充 Homebrew Node 的 `cli.js` 路径及 **pnpm 全局目录**（`~/Library/pnpm/global` 等）动态枚举。
- **Windows**：仍 **优先** 扫描约定的原生 `claude.exe` 安装位，再合并 PATH，避免 Roaming/npm 下的 `cli.js` 覆盖本机安装包。

### 变更

- **Claudian 视图壳层与聊天布局**：新增内置样式模块 **`src/style/features/obsidian-layout-claudian-view.css`**（由 `index.css` 打入 **`styles.css`**）。仅作用于 **`[data-type="claudian-view"]`** 窗格：修正主题下 **`.view-content` 底对齐与左右留白**；消息区、状态条与底部输入区 **同宽居中**（`--claudian-view-chat-column-max` 等变量）；底部输入区 **组合器卡片**（圆角、边框、轻阴影）及顶栏紧凑间距；**无需再单独安装**此前文档中的 Obsidian CSS 代码片段。项目文档 `docs/01-Projects/R20260420-01-优化底部输入框的对齐问题/` 中旧片段文件已改为迁移说明。

### 工程

- **`getExtraBinaryPaths`**：从 `env` 模块导出，供 CLI 探测与 PATH 增强共用。
- **单测**：Windows 场景对齐 `HOME` / `USERPROFILE` 与 `path.win32.join`；pnpm 目录枚举对非数组 `readdir` 桩做防护。

### 文档

- **`docs/01-Projects/R20260420-02-Claude-CLI路径智能解析/修复报告_Claude_CLI路径智能解析.md`**：问题、根因、方案与修改记录。
- **项目文档索引**：`docs/01-Projects/README.md`；方案与使用说明等已按主题分入 **`RYYYYMMDD-序号-主题`** 子文件夹，各主题含 **`溯源_版本与分支.md`**（提交、分支、版本对照）。含 `R20260420-01-优化底部输入框的对齐问题/` 等。

---

## [2.0.15] - 2026-04-19

### 变更

- **聊天顶栏操作**：新建标签、新对话、聊天历史三个按钮的 **`aria-label` 与 `title`（悬停提示）** 改为 **`chat.header.*`**（`en` / `zh-CN`），不再硬编码英文。

---

## [2.0.14] - 2026-04-19

### 修复

- **路径工具**：`normalizePathForComparison` 在 Windows 上将 `path.win32.normalize("A:")` 得到的 `A:.` 规范为 `A:`，避免 MSYS 风格 `/a` 与嵌套路径冲突检测在单测/边界场景下误判。
- **`path` / `env`**：非 Windows 逻辑使用 `path.posix` 与运行时 `process.platform` 判断，避免在 Windows 开发机跑 Jest（mock 为 darwin/linux）时出现错误分隔符或反斜杠路径片段。
- **`findClaudeCLIPath`**：按逻辑平台使用 `path.posix.join` / `path.win32.join`，与 `process.platform` mock 一致，便于跨平台单测。

### 测试与工程

- **Jest**：新增 `tests/jest-setup.ts`，默认 `setLocale('en')`，避免默认 `zh-CN` 导致大量英文 UI 断言失败。
- **单测**：修正 `sdkSession`、`path`、`utils`、`Codex`、`MessageRenderer` 等在 Windows 下的路径与 i18n 期望值；`sdkSession` 侧车路径匹配统一归一化斜杠。

---

## [2.0.13] - 2026-04-19

### 变更

- **空会话欢迎语国际化**：`ConversationController.getGreeting()` 随机问候语改为 **`chat.welcome.*`**（`en` / `zh-CN`），不再在中文界面下出现 *You are absolutely right!* 等硬编码英文。

### 文档

- **`docs/01-Projects/R20260419-01-国际化与配置扫描/方案_国际化仅中英与智能体输入占位符.md`**：新增 **§8.6**（欢迎语池 i18n）追溯说明。

---

## [2.0.12] - 2026-04-19

### 变更

- **国际化精简**：界面语言仅保留 **English** 与 **简体中文**（`en.json` / `zh-CN.json`）；`Locale` 类型与设置页下拉同步。**默认 `locale` 为 `zh-CN`**；加载时通过 **`normalizeClaudianLocale`** 将历史配置中的已移除语言代码规范为 `zh-CN` 并 **持久化**。当前语言包缺键时仍 **回退英文词条**。
- **标签页上限提示**：达到 `maxTabs` 时的 `Notice` 使用 **`chat.tabs.maxAllowedNotice`**（`t()`），不再硬编码英文（对齐差异清单 S4）。
- **主输入框**：主聊天 `textarea` **不设 `placeholder`**，不再显示 *How can I help you today?* 等寒暄式提示（见 `docs/01-Projects/R20260419-01-国际化与配置扫描/方案_国际化仅中英与智能体输入占位符.md` §8.5 与 `docs/01-Projects/R20260419-02-智能体显示名称/方案_智能体名称配置与左上角展示.md` 关联节）。

### 文档

- **`docs/01-Projects/R20260419-01-国际化与配置扫描/方案_国际化仅中英与智能体输入占位符.md`**：语言精简、默认语言、R1 无占位符等 **已执行决策** 与追溯。
- **`docs/01-Projects/R20260419-02-智能体显示名称/方案_智能体名称配置与左上角展示.md`**：`agentName` 与主输入框占位符 **关联决策** 补充。
- **`docs/01-Projects/R20260419-01-国际化与配置扫描/差异清单_国际化与配置扫描.md`**：R1 / 语言范围等条目与实现对齐。

---

## [2.0.11] - 2026-04-19

### 变更

- **智能体显示名称**：设置 → **内容** 新增 **智能体名称**（`agentName`），与「如何称呼你」同为文本偏好；持久化至 `.claudian/claudian-settings.json`。
- **聊天界面左上角**：Logo 旁标题使用配置名称；**留空** 时仍显示 **Claudian**；保存后即时刷新已打开的聊天视图；`ItemView.getDisplayText()` 与标题一致。
- **国际化**：十种界面语言新增 `settings.agentName.*` 文案。

### 文档

- **`docs/01-Projects/R20260419-02-智能体显示名称/方案_智能体名称配置与左上角展示.md`**：需求、字段与实现要点。

---

## [2.0.10] - 2026-04-18

### 说明

- **`main` 分支** 已合入 `feat/ribbon-toggle-chat-panel`。本版本用于 **主分支发布标记**；实现与文档以 **[2.0.9]**、**[2.0.8]** 条目为准（Ribbon / `toggle-view` 侧栏收起-展开、主区换焦、不 `detach`、i18n、**`docs/01-Projects/R20260418-05-Ribbon切换聊天面板/报告_Ribbon切换聊天面板需求与方案.md`**、测试与 JSDoc 审计）。

---

## [2.0.9] - 2026-04-18

### 变更

- **Ribbon / `toggle-view` 语义调整**：由 **`detachLeavesOfType`（关标签）** 改为 **收起 / 再展开**——**尚无**聊天视图时仍 **`activateView()` 创建**；**在侧栏** 时通过 **`WorkspaceSidedock` / `WorkspaceMobileDrawer` 的 `collapse` / `expand`** 让出或恢复宽度，展开时 **`await revealLeaf`**；**在主编辑区**（`openInMainTab`）时，若正看着聊天则 **`setActiveLeaf` 切到主区其它叶子**（若有），否则 **`revealLeaf`** 回到聊天。
- **不中断运行**：toggle 路径 **不** `detach` 叶子，**不** 触发 **`ClaudianView.onClose()`**（避免 `tabManager.destroy()`），流式与后台任务应在收起后 **继续执行**；仅折叠侧栏或切换主区活动叶。
- **边界**：主区 **只有** 聊天一叶、无其它根区叶子时，「收起」无法切换焦点，行为为 **静默跳过**（侧栏模式不受影响）。

### 文档

- **`docs/01-Projects/R20260418-05-Ribbon切换聊天面板/报告_Ribbon切换聊天面板需求与方案.md`**：收起/展开、边界表、**§1.3 运行时与任务连续性**；**§6 方案↔代码对照审计**；主区仅聊天一叶时 **不** `revealLeaf` 的表述与代码一致；左/右侧栏与 `open-view`/`revealLeaf` 澄清。

---

## [2.0.8] - 2026-04-18

### 变更

- **Ribbon 切换聊天面板**：左侧功能区 Claudian 图标改为 **开关整块聊天工作区**——当前 **没有** `claudian-view` 叶子时 **打开**（行为与原先一致，仍受「在主编辑器区域打开」设置约束）；**已有** 任意数量该类型叶子时 **一次性关闭**（`Workspace.detachLeavesOfType`，等同用户手工关掉工作区标签）。
- **命令**：保留 **`open-view`**（仅打开或聚焦聊天视图）；新增 **`toggle-view`**（切换开关），便于绑定热键。
- **`activateView`**：对 **`workspace.revealLeaf`** 使用 **`await`**，与官方建议一致（侧栏会正确展开、deferred 叶子加载更可靠）。
- **国际化**：新增 `commands.openChatView`、`commands.toggleChatView`、`ribbon.toggleClaudian`（`en` / `zh-CN`）。

### 文档

- **`docs/01-Projects/R20260418-05-Ribbon切换聊天面板/报告_Ribbon切换聊天面板需求与方案.md`**：记录需求、Obsidian API 校准与实现说明。

---

## [2.0.7] - 2026-04-18

### 变更

- **品牌图标统一**：功能区 Ribbon、`ItemView.getIcon()`（工作区页签与窗格顶栏）均使用 **Claude 星芒** 自定义图标（`addIcon` + `CLAUDIAN_APP_ICON_ID`），替代 Lucide `bot`；path 与 Provider `getProviderIcon` 共用 **`src/shared/claudeBrandMark.ts`**。
- **壳层图标颜色**：新增 **`src/style/features/obsidian-chrome.css`**，对 Ribbon、`.workspace-tab-header[data-type="claudian-view"]`、`.workspace-leaf-content[data-type="claudian-view"] .view-header-icon` 使用品牌色 **#d97757**（与 `--claudian-brand` 一致），避免主题图标灰；`addIcon` 内 path 为 **`fill="#D97757"`** 并配合 `!important` 兜底。

### 文档

- **`docs/01-Projects/R20260418-06-统一Claude品牌图标/方案_统一功能区与侧栏Claude品牌图标.md`**：记录根因、Obsidian Icons 要点、实现清单与壳层三处 DOM 说明。

---

## [2.0.6] - 2026-04-18

### 变更

- **输入工具栏布局**：`Safe` / `YOLO` 权限开关（`PermissionToggle`）移至**最左侧**（模型选择器左侧）；**拨杆在左、文案在右**；进入 **PLAN** 时为容器增加徽章样式类 `claudian-permission-toggle--plan`。
- **输入工具栏与发送按钮**：工具栏 `width: 100%`；发送/停止按钮容器使用 `margin-left: auto` **靠右对齐**；按钮尺寸 **24×24px**，与外部上下文 / MCP **文件夹图标** hit 区高度一致，纵轴与工具栏 `align-items: center` **中线对齐**。
- **权限块样式**：移除原 `margin-left: auto`（避免整块贴右）；改为左侧 `margin-right` 等与模型区隔。

### 修复

- **`createInputToolbar`**：`McpServerSelector` 构造调用仅传入 `parentEl`，与类构造函数一致（此前多余参数会导致类型检查失败）。

### 文档

- 使用说明类 Markdown 表格排版微调（YOLO/Safe、发送/停止按钮）。
- 新增本 **`CHANGELOG.md`**；方案文档 **`docs/01-Projects/R20260418-03-权限开关工具栏置左/方案_输入工具栏权限开关置左.md`** 状态随发布更新。

---

## 更早版本

**2.0.4** 及以前的重要变更（如 `dist/claudian` 构建方式、PR #523 发送/停止按钮、PR #384 拖拽上下文等）见仓库 **`git log`**；本文件自 **2.0.6** 起持续维护。
