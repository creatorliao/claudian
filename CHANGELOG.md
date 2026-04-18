# Changelog

本文档记录 Claudian（Obsidian 插件）的版本变更；格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，版本号遵循语义化版本意图（主版本.次版本.修订号）。

## [2.0.8] - 2026-04-18

### 变更

- **Ribbon 切换聊天面板**：左侧功能区 Claudian 图标改为 **开关整块聊天工作区**——当前 **没有** `claudian-view` 叶子时 **打开**（行为与原先一致，仍受「在主编辑器区域打开」设置约束）；**已有** 任意数量该类型叶子时 **一次性关闭**（`Workspace.detachLeavesOfType`，等同用户手工关掉工作区标签）。
- **命令**：保留 **`open-view`**（仅打开或聚焦聊天视图）；新增 **`toggle-view`**（切换开关），便于绑定热键。
- **`activateView`**：对 **`workspace.revealLeaf`** 使用 **`await`**，与官方建议一致（侧栏会正确展开、deferred 叶子加载更可靠）。
- **国际化**：新增 `commands.openChatView`、`commands.toggleChatView`、`ribbon.toggleClaudian`（十种界面语言）。

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
