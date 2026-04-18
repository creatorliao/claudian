# Changelog

本文档记录 Claudian（Obsidian 插件）的版本变更；格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，版本号遵循语义化版本意图（主版本.次版本.修订号）。

## [2.0.16] - 2026-04-19

### 修复

- **Claude CLI 路径解析**：合并「设置中的 PATH + `getExtraBinaryPaths()` + 进程 PATH」后再探测，与 GUI 下查找 Node 的策略对齐；Unix/macOS 在 PATH 上除 `claude` 可执行文件外，增加与 Windows 一致的 **`cli.js` 推导**；补充 Homebrew Node 的 `cli.js` 路径及 **pnpm 全局目录**（`~/Library/pnpm/global` 等）动态枚举。
- **Windows**：仍 **优先** 扫描约定的原生 `claude.exe` 安装位，再合并 PATH，避免 Roaming/npm 下的 `cli.js` 覆盖本机安装包。

### 工程

- **`getExtraBinaryPaths`**：从 `env` 模块导出，供 CLI 探测与 PATH 增强共用。
- **单测**：Windows 场景对齐 `HOME` / `USERPROFILE` 与 `path.win32.join`；pnpm 目录枚举对非数组 `readdir` 桩做防护。

### 文档

- **`修复报告_Claude_CLI路径智能解析.md`**：问题、根因、方案与修改记录。

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

- **`方案_国际化仅中英与智能体输入占位符.md`**：新增 **§8.6**（欢迎语池 i18n）追溯说明。

---

## [2.0.12] - 2026-04-19

### 变更

- **国际化精简**：界面语言仅保留 **English** 与 **简体中文**（`en.json` / `zh-CN.json`）；`Locale` 类型与设置页下拉同步。**默认 `locale` 为 `zh-CN`**；加载时通过 **`normalizeClaudianLocale`** 将历史配置中的已移除语言代码规范为 `zh-CN` 并 **持久化**。当前语言包缺键时仍 **回退英文词条**。
- **标签页上限提示**：达到 `maxTabs` 时的 `Notice` 使用 **`chat.tabs.maxAllowedNotice`**（`t()`），不再硬编码英文（对齐差异清单 S4）。
- **主输入框**：主聊天 `textarea` **不设 `placeholder`**，不再显示 *How can I help you today?* 等寒暄式提示（见《方案_国际化仅中英与智能体输入占位符.md》§8.5 与《方案_智能体名称配置与左上角展示.md》关联节）。

### 文档

- **`方案_国际化仅中英与智能体输入占位符.md`**：语言精简、默认语言、R1 无占位符等 **已执行决策** 与追溯。
- **`方案_智能体名称配置与左上角展示.md`**：`agentName` 与主输入框占位符 **关联决策** 补充。
- **`差异清单_国际化与配置扫描.md`**：R1 / 语言范围等条目与实现对齐。

---

## [2.0.11] - 2026-04-19

### 变更

- **智能体显示名称**：设置 → **内容** 新增 **智能体名称**（`agentName`），与「如何称呼你」同为文本偏好；持久化至 `.claudian/claudian-settings.json`。
- **聊天界面左上角**：Logo 旁标题使用配置名称；**留空** 时仍显示 **Claudian**；保存后即时刷新已打开的聊天视图；`ItemView.getDisplayText()` 与标题一致。
- **国际化**：十种界面语言新增 `settings.agentName.*` 文案。

### 文档

- **`方案_智能体名称配置与左上角展示.md`**：需求、字段与实现要点。

---

## [2.0.10] - 2026-04-18

### 说明

- **`main` 分支** 已合入 `feat/ribbon-toggle-chat-panel`。本版本用于 **主分支发布标记**；实现与文档以 **[2.0.9]**、**[2.0.8]** 条目为准（Ribbon / `toggle-view` 侧栏收起-展开、主区换焦、不 `detach`、i18n、**`报告_Ribbon切换聊天面板需求与方案.md`**、测试与 JSDoc 审计）。

---

## [2.0.9] - 2026-04-18

### 变更

- **Ribbon / `toggle-view` 语义调整**：由 **`detachLeavesOfType`（关标签）** 改为 **收起 / 再展开**——**尚无**聊天视图时仍 **`activateView()` 创建**；**在侧栏** 时通过 **`WorkspaceSidedock` / `WorkspaceMobileDrawer` 的 `collapse` / `expand`** 让出或恢复宽度，展开时 **`await revealLeaf`**；**在主编辑区**（`openInMainTab`）时，若正看着聊天则 **`setActiveLeaf` 切到主区其它叶子**（若有），否则 **`revealLeaf`** 回到聊天。
- **不中断运行**：toggle 路径 **不** `detach` 叶子，**不** 触发 **`ClaudianView.onClose()`**（避免 `tabManager.destroy()`），流式与后台任务应在收起后 **继续执行**；仅折叠侧栏或切换主区活动叶。
- **边界**：主区 **只有** 聊天一叶、无其它根区叶子时，「收起」无法切换焦点，行为为 **静默跳过**（侧栏模式不受影响）。

### 文档

- **`报告_Ribbon切换聊天面板需求与方案.md`**：收起/展开、边界表、**§1.3 运行时与任务连续性**；**§6 方案↔代码对照审计**；主区仅聊天一叶时 **不** `revealLeaf` 的表述与代码一致；左/右侧栏与 `open-view`/`revealLeaf` 澄清。

---

## [2.0.8] - 2026-04-18

### 变更

- **Ribbon 切换聊天面板**：左侧功能区 Claudian 图标改为 **开关整块聊天工作区**——当前 **没有** `claudian-view` 叶子时 **打开**（行为与原先一致，仍受「在主编辑器区域打开」设置约束）；**已有** 任意数量该类型叶子时 **一次性关闭**（`Workspace.detachLeavesOfType`，等同用户手工关掉工作区标签）。
- **命令**：保留 **`open-view`**（仅打开或聚焦聊天视图）；新增 **`toggle-view`**（切换开关），便于绑定热键。
- **`activateView`**：对 **`workspace.revealLeaf`** 使用 **`await`**，与官方建议一致（侧栏会正确展开、deferred 叶子加载更可靠）。
- **国际化**：新增 `commands.openChatView`、`commands.toggleChatView`、`ribbon.toggleClaudian`（`en` / `zh-CN`）。

### 文档

- **`报告_Ribbon切换聊天面板需求与方案.md`**：记录需求、Obsidian API 校准与实现说明。

---

## [2.0.7] - 2026-04-18

### 变更

- **品牌图标统一**：功能区 Ribbon、`ItemView.getIcon()`（工作区页签与窗格顶栏）均使用 **Claude 星芒** 自定义图标（`addIcon` + `CLAUDIAN_APP_ICON_ID`），替代 Lucide `bot`；path 与 Provider `getProviderIcon` 共用 **`src/shared/claudeBrandMark.ts`**。
- **壳层图标颜色**：新增 **`src/style/features/obsidian-chrome.css`**，对 Ribbon、`.workspace-tab-header[data-type="claudian-view"]`、`.workspace-leaf-content[data-type="claudian-view"] .view-header-icon` 使用品牌色 **#d97757**（与 `--claudian-brand` 一致），避免主题图标灰；`addIcon` 内 path 为 **`fill="#D97757"`** 并配合 `!important` 兜底。

### 文档

- **`方案_统一功能区与侧栏Claude品牌图标.md`**：记录根因、Obsidian Icons 要点、实现清单与壳层三处 DOM 说明。

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
- 新增本 **`CHANGELOG.md`**；方案文档 **`方案_输入工具栏权限开关置左.md`** 状态随发布更新。

---

## 更早版本

**2.0.4** 及以前的重要变更（如 `dist/claudian` 构建方式、PR #523 发送/停止按钮、PR #384 拖拽上下文等）见仓库 **`git log`**；本文件自 **2.0.6** 起持续维护。
