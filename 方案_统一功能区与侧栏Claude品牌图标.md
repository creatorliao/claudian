# 方案：统一功能区（Ribbon）与侧栏页签为 Claude 品牌图标

> **状态**：已落地。功能区按钮、工作区侧栏/页签图标与视图内标题旁 Logo 使用同一套 Claude 星芒 path；通过 Obsidian `addIcon` 注册自定义图标 id，替代原 Lucide `bot`。

---

## 0. 背景与问题

| 位置 | 修改前 | 期望 |
|------|--------|------|
| 视图内标题左侧 Logo | `ClaudeChatUIConfig` 中的星芒 SVG（`getProviderIcon`） | 保持 |
| 左侧功能区（Ribbon）打开 Claudian | Lucide **`bot`**（机器人） | 与标题一致：**Claude 星芒** |
| 侧栏 / 工作区标签图标 | `ClaudianView.getIcon()` 返回 **`bot`** | 同上 |
| **窗格顶栏**左侧视图图标（与页签不同 DOM） | 同上，继承主题图标色 | 同上 **陶土橙** |

**根因**：Ribbon 在 `main.ts` 中写死 `'bot'`；侧栏图标由 `ItemView.getIcon()` 返回 `'bot'`；而头部 Logo 单独走 Provider 配置，未共用同一注册入口。壳层图标即使用星芒 + `currentColor`，也会呈深灰，需在 **`obsidian-chrome.css`** 中分别覆盖 **Ribbon、`.workspace-tab-header[data-type="claudian-view"]`、`.workspace-leaf-content[data-type="claudian-view"] .view-header-icon`** 三处。

---

## 1. Obsidian 插件图标规范要点（校准依据）

以下与官方 **Icons** 文档一致，用于自定义 Ribbon / `getIcon`：

- **`addIcon(id, svgContent)`**：注册自定义图标；`svgContent` 为 **SVG 内部片段**，**不要**包含外层 `<svg>...</svg>`。
- **壳层颜色**：Ribbon / 页签 / 窗格顶栏不在 `.claudian-container` 内，**`currentColor` 会等于主题图标灰**；`addIcon` 内 path 使用 **`fill="#D97757"`**，并由 **`src/style/features/obsidian-chrome.css`** 对上述三处 DOM 做 **`fill` / `color` + `!important`**，防止主题覆盖。视图内 `.claudian-logo` 仍用 **`var(--claudian-brand)`**。
- **坐标系**：文档建议图标内容适配约 **100×100** 的逻辑范围，与内置 Lucide 图标在 Ribbon 中的显示习惯一致；若原始 path 的 viewBox 较小（本方案中宽度约 39.5），应对 **`<g transform="scale(...)">`** 等方式整体缩放，避免图标过小或观感异常。

**参考**：[Icons - Developer Documentation](https://docs.obsidian.md/Plugins/User+interface/Icons)

---

## 2. 解决思路

1. **单一数据源**：将 Claude 星芒的 `viewBox` + `path` 抽到共享模块，供  
   - `addIcon` 的字符串、  
   - `ClaudeChatUIConfig.getProviderIcon()`（头部与模型下拉等）、  
   共用，避免两处 path 分叉。
2. **稳定 id**：定义常量 **`claudian-claude-mark`**（代码中为 `CLAUDIAN_APP_ICON_ID`），在 `onload` 时 `addIcon` 一次，随后：  
   - `addRibbonIcon(CLAUDIAN_APP_ICON_ID, ...)`  
   - `ClaudianView.getIcon()` 返回同一 id  
3. **注册时机**：在 `Plugin.onload` 内、用户可能点击 Ribbon 之前完成 `addIcon`，保证图标已存在。

---

## 3. 实现清单

| 文件 | 变更摘要 |
|------|----------|
| `src/shared/claudeBrandMark.ts` | **新增**。导出 `CLAUDE_BRAND_MARK`、`CLAUDIAN_APP_ICON_ID`、`getClaudeBrandMarkAddIconInnerHtml()`（含 scale，适配 Ribbon 画布）。 |
| `src/main.ts` | `import { addIcon }`；`onload` 中 `addIcon(CLAUDIAN_APP_ICON_ID, getClaudeBrandMarkAddIconInnerHtml())`；`addRibbonIcon` 第一个参数改为 `CLAUDIAN_APP_ICON_ID`。 |
| `src/features/chat/ClaudianView.ts` | `getIcon()` 改为返回 `CLAUDIAN_APP_ICON_ID`。 |
| `src/providers/claude/ui/ClaudeChatUIConfig.ts` | 删除本地重复的 `CLAUDE_ICON` 常量；`getProviderIcon()` 改为返回共享的 `CLAUDE_BRAND_MARK`。 |
| `tests/__mocks__/obsidian.ts` | 增加 `addIcon` 的 jest mock。 |
| `tests/integration/main.test.ts` | 断言 `addIcon` 被调用且 ribbon 使用 `CLAUDIAN_APP_ICON_ID`。 |
| `src/style/features/obsidian-chrome.css` | 壳层三处品牌色：Ribbon、`workspace-tab-header`、`view-header-icon`。 |
| `src/style/index.css` | `@import "./features/obsidian-chrome.css"`。 |

---

## 4. 测试与验证

- 运行类型检查：`npm run typecheck`
- 集成用例：`tests/integration/main.test.ts`（含 Ribbon / `addIcon` 相关断言）
- 手动：在 Obsidian 中重载插件，确认左侧 Ribbon 与侧栏 Claudian 页签均为星芒，且随主题色变化正常。

---

## 5. 范围说明（未改部分）

- **工具调用 / 子代理等 UI** 中仍可能使用 Lucide **`bot`** 表示「智能体/任务」语义，与 **应用壳层品牌**（Ribbon、侧栏页签）分离；若需全局替换为星芒，需另开需求逐屏评估可读性。
- **`manifest.json`** 未增加 `icon` 字段；本方案仅覆盖应用内 Ribbon 与视图类型图标。

---

## 6. 版本记录

- 与 **2.0.6** 前后批次一并提交时可于 `CHANGELOG.md` 增加一条：统一 Ribbon / 侧栏图标为 Claude 品牌星芒（`addIcon` + 共享 `claudeBrandMark`）。
