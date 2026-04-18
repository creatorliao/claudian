# 报告：Ribbon 图标切换聊天面板显示（需求记录与方案）

> **状态**：已定稿并在代码中维护。**切换语义为「收起 / 展开」视图，不 `detach` 工作区标签**（v2.0.9 起）。合并或发版前建议在 Obsidian 内手测（侧栏模式 +「在主编辑器区域打开」）。

---

## 1. 需求与背景

### 1.1 要解决的使用痛点

- 希望 **一键腾出屏幕** 做别的事，再一键 **回到与 AI 的对话**，且 **不要** 等同于关掉标签（避免会话/状态被当成「关闭」）。
- **第一次**：若还没有聊天面板 → **创建并打开**（与设置中侧栏/主区一致）。
- **已有面板**：第一次点击 → **收起**（侧栏则折叠 dock，主区则把焦点让给其它根区标签）；再点 → **重新展示**（展开侧栏并聚焦聊天，或 `revealLeaf` / 切回聊天）。

### 1.2 功能期望（与实现对齐）

1. **尚无** `claudian-view` 叶子：`activateView()`（新建 + `revealLeaf`）。
2. **在左/右侧栏**（祖先链上出现 `workspace.leftSplit` / `workspace.rightSplit`，或移动端的 `WorkspaceMobileDrawer` 链路）：dock **未折叠** → `collapse()`；**已折叠** → `expand()` + `await revealLeaf(主叶子)`。
3. **在主编辑区**（祖先链上 **没有** 上述 sidedock）：当前活动视图是 `ClaudianView` → 在 `iterateRootLeaves` 范围内选 **最后** 一个非 `claudian-view` 的叶子 `setActiveLeaf(..., { focus: true })`（若有）；否则 → `revealLeaf` 聚焦已有聊天。

### 1.3 运行时与任务连续性（硬性要求）

- **收起面板 ≠ 结束程序**：用户期望在「收起来」之后，**对话、流式输出、CLI/智能体相关执行** 等仍能在后台继续，**不应** 因点 Ribbon / `toggle-view` 而被意外终止。
- **实现保证**（`src/main.ts` 的 `toggleClaudianView`）：
  - **禁止** 使用 `Workspace.detachLeavesOfType`、`WorkspaceLeaf.detach()` 或任何会 **移除** `claudian-view` 叶子的操作。
  - 因此 **不会** 触发 `ClaudianView.onClose()`（见 `src/features/chat/ClaudianView.ts`：其中会 `tabManager?.destroy()`、解除 vault 监听等，属于 **视图真正关闭** 时的清理）。
  - **仅** 使用：`WorkspaceSidedock` / `WorkspaceMobileDrawer` 的 **`collapse` / `expand`**、`revealLeaf`、`setActiveLeaf`，以及无叶子时的 **`activateView()`**（新建叶子）。这些 API 只改变 **侧栏折叠状态** 或 **工作区活动叶子**，**不** 销毁 `ItemView` 实例。
- **与内部多标签的区别**：`TabManager` 里的 `deactivateTab`（隐藏内容、停部分选择类控制器）仅在 **Claudian 视图内部** 切换 Tab 时调用（`switchToTab`），**与** Ribbon 收起侧栏、主区切到笔记 **无关**；收起外层面板 **不会** 走这一套内部 deactivate。
- **说明**：若用户在工作区上 **手动关闭** Claudian 标签页，仍会走 Obsidian 的关叶逻辑并触发 `onClose`，属预期；与本 Ribbon 行为无关。

---

## 2. 官方 API 校准（摘要）

| API | 说明 |
|-----|------|
| `getLeavesOfType` | 判断聊天是否「已存在」 |
| `WorkspaceSidedock` / `WorkspaceMobileDrawer` | `collapsed`、`collapse()`、`expand()`（收起/展开整条侧栏抽屉） |
| `revealLeaf` | 展开侧栏并聚焦叶子；宜 **`await`**（[官方文档](https://docs.obsidian.md/Reference/TypeScript+API/Workspace/revealLeaf)） |
| `iterateRootLeaves` | 仅在 **主区** 叶子中枚举，用于主编辑区「让给其它标签」 |
| `setActiveLeaf` | 主区切换活动标签 |

**说明**：若需 **真正关闭** 聊天标签，用户仍可在工作区上手动关标签；本 Ribbon / `toggle-view` **不** 调用 `detachLeavesOfType`。

---

## 3. 边界条件（实现约定）

| 场景 | 行为 |
|------|------|
| 首次安装后第一次点 Ribbon | 无叶子 → `activateView()` 创建 |
| 侧栏已展开、聊天在右栏 | 点一下 → `rightSplit.collapse()`；再点 → `expand` + `revealLeaf` |
| 侧栏已被用户折叠 | 再点 → `expand` + `revealLeaf`（视为「展示」） |
| `openInMainTab`、聊天在中央且 **正看着聊天** | 点一下 → 切到主区 **另一** 叶子（若有）；**仅有聊天一叶** → 静默不切换（无法让出主区焦点） |
| 主区有聊天但 **当前在看笔记** | 点一下 → `revealLeaf` 回到聊天 |
| 浮动窗口 / 特殊布局 | 祖先链上可能无 sidedock，走主区分支；极端单叶布局同上 |

---

## 4. 命令分工

| 入口 | 行为 |
|------|------|
| Ribbon / `toggle-view` | 上述 **toggleClaudianView**（收起/展开，**不** detach） |
| `open-view` | 仅 **打开或聚焦**（`activateView`），不折叠侧栏 |

---

## 5. 实现与测试

| 项 | 说明 |
|----|------|
| 核心 | `src/main.ts`：`toggleClaudianView`、`findParentSidedock`、`findLastNonClaudianRootLeaf` |
| 生命周期 | 销毁路径仅在 `ClaudianView.onClose`（关标签 / 关库等），**非** toggle 路径 |
| 测试 | `tests/integration/main.test.ts`：侧栏收起/展开、主区 reveal、主区切换活动叶 |

---

## 6. 小结

- **收起 ≠ 关闭标签**：侧栏用 **折叠**，主区用 **换焦点**；**不** `detach`，故 **不** 触发 `onClose` / `tabManager.destroy`，**任务应在后台继续**（除非用户手动关叶或 Obsidian 另有全局卸载策略）。
- 再次点击 **恢复可见与焦点**（侧栏由 `expand` + `revealLeaf` 保证）。

---

*文档修订：补充 §1.3 运行时与任务连续性，与代码 JSDoc 及 v2.0.9 行为一致。*
