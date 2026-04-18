# 报告：Ribbon 图标切换聊天面板显示（需求记录与方案）

> **状态**：方案已定稿；**已在 v2.0.8 / 分支 `feat/ribbon-toggle-chat-panel` 落地**（`toggleClaudianView`、`detachLeavesOfType`、新命令 `toggle-view`、Ribbon 与 i18n）。合并或发版前建议在 Obsidian 内手测。

---

## 1. 需求与背景

### 1.1 要解决的使用痛点

- 当前 **关闭侧边栏里的聊天**、或 **关掉占满主编辑区的聊天标签** 的路径不够顺手，希望通过 **Ribbon 一键** 在「显示对话」与「让出屏幕给笔记编辑」之间切换。
- 目标交互：**点一下开、再点一下关**；关闭在用户观感上接近 **手工关掉工作区标签**（收起/关闭面板），实现上 **尽量简单、避免过度设计**。

### 1.2 功能期望

1. **Ribbon**：若当前 **没有** `claudian-view` 工作区叶子 → **打开**；若 **已有**（侧栏或主编辑区）→ **全部关闭**。
2. **侧栏 / 主编辑区**：由既有 `openInMainTab` 控制打开位置；关闭时对 **所有** `claudian-view` 叶子 `detach`。
3. **多工作区实例**：**一次性关闭全部** `claudian-view` 叶子（`detachLeavesOfType`）。

---

## 2. 官方 API 校准（摘要）

| API | 说明 |
|-----|------|
| `getLeavesOfType` | 返回该类型的所有叶子（`obsidian.d.ts`，@since 0.9.7） |
| `detachLeavesOfType` | 移除该类型的 **全部** 叶子（*Remove all leaves of the given type*） |
| `revealLeaf` | 前台显示叶子；侧栏时会展开侧栏；宜 **`await`**（[官方文档](https://docs.obsidian.md/Reference/TypeScript+API/Workspace/revealLeaf)，@since 1.7.2） |
| `WorkspaceLeaf.detach` | 关闭单叶；本方案优先用 `detachLeavesOfType` 一次关全 |

---

## 3. 已确认的产品决策

| 序号 | 主题 | 结论 |
|------|------|------|
| 1 | Toggle 规则 | 无 `claudian-view` 叶子 → 打开；有 → **全部** `detachLeavesOfType`。 |
| 2 | 多实例 | 与上相同，一次关全。 |
| 3 | 命令与 Ribbon | **Ribbon** → `toggleClaudianView`；**保留** `open-view` 仅打开/聚焦；**新增** `toggle-view`。 |
| 4 | 关闭语义 | 等同手工关标签；**不**做「只折叠侧栏」等额外逻辑。 |

---

## 4. §6 残余问题（已接受，无变更）

以下语义已与产品方确认 **无问题**，实施时 **不** 单独处理：

1. **侧栏折叠但标签仍在**：`getLeavesOfType` 仍非空，再点 Ribbon **会 detach（真关掉）**，不会只做 `revealLeaf`。
2. **Modal / Notice 等**：不在 `detachLeavesOfType` 范围内；若需另管弹层，单独立项。
3. **Hover Editor 等第三方容器**：以真机验证为准。

---

## 5. 实现说明（与代码同步）

| 项 | 说明 |
|----|------|
| 分支 | `feat/ribbon-toggle-chat-panel` |
| 核心 | `src/main.ts`：`toggleClaudianView()`；`activateView()` 内 `await revealLeaf` |
| Ribbon | `addRibbonIcon` → `t('ribbon.toggleClaudian')` + `toggleClaudianView` |
| 命令 | `open-view`：`t('commands.openChatView')`；新增 `toggle-view`：`t('commands.toggleChatView')` |
| i18n | `commands.*`、`ribbon.toggleClaudian` 已写入各 `locales/*.json` 与 `types.ts` |
| 测试 | `tests/integration/main.test.ts`：Ribbon / open / toggle；`tests/__mocks__/obsidian.ts`：`detachLeavesOfType`、`revealLeaf` Promise |

---

## 6. 小结

- Ribbon 与 **`toggle-view`**：**开关整块** Claudian 工作区视图。
- **`open-view`**：仍为 **只开不关**（聚焦已有或新建），便于与热键「强制打开」区分。

---

*文档修订：残余问题已关闭；补充实现分支与文件清单。*
