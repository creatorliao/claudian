# Changelog

本文档记录 Claudian（Obsidian 插件）的版本变更；格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，版本号遵循语义化版本意图（主版本.次版本.修订号）。

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
