# Claudian：「清空当前标签」与「新建标签」的差异与调用链

本文说明 Claudian 侧栏聊天视图中两个并列操作在**产品语义**与**代码路径**上的区别，便于排障与二次开发。

## 一句话区分

| 操作 | 作用范围 | 用户可见效果 |
|------|----------|----------------|
| **新建标签**（`chat.header.newTab`） | 在同一 Claudian **视图**里再开一个 **Tab**（并行会话槽位） | 多一个编号徽章；可保留旧 Tab 里的对话不动，在新 Tab 里独立输入 |
| **清空当前标签**（`chat.header.newConversation`，悬停提示；原「新对话」） | 仅作用于**当前激活的 Tab** | 当前面板清空为「新会话入口」；不增加 Tab 数量 |

二者**互不替代**：需要并排两处对话、互不遮挡时用「新建标签」；只想在当前这一格里**清空并重来**时用「清空当前标签」（笔形按钮）。

### 与 `/clear`、`/new` 的关系（代码层一致）

头部「清空当前标签」（`square-pen`）、命令面板 **`commands.newSession`**、输入框内建 **`/clear`** 与 **`/new`**（`/new` 为 **`/clear` 的别名**）最终都落到 **`ConversationController.createNew()`**：

- 内建斜杠：`src/core/commands/builtInCommands.ts` 中 `clear` 的 `action` 为 `'clear'`，别名为 `new`；`InputController.executeBuiltInCommand` 对 `'clear'` 调用 `conversationController.createNew()`。
- 实现上等价于「在当前 Tab 内执行一次清空并重置到入口态」，而不是「立刻新建一条已持久化的会话记录」（首条用户消息发送前通常仍为空白入口，见 `ConversationController` 注释）。

**文案说明**：产品英文仍为 “new conversation” 语义的部分（如内建 `/clear` 的英文描述）与中文「清空」口径可并存；头部悬停已与「不新增标签、等同 /clear」对齐。

**细微差异（流式中）**：命令面板 `new-session` 在 `Tab` 正在流式输出时会直接禁用；用户若在输入框发送 `/clear`，仍会调用 `createNew()`，但 **`createNew()` 在非 `force` 且正在流式时会早退不重置**，与头部按钮的「流式中不操作」效果接近，入口不同。

## 实现位置（界面）

- 文案来源：`src/i18n/locales/zh-CN.json` 中 `chat.header.newTab`、`chat.header.newConversation`、`chat.header.history`（用于头部按钮的 `aria-label`，Obsidian 以此显示悬停提示）。
- 按钮装配：`src/features/chat/ClaudianView.ts` 的 `buildNavRowContent()`：
  - **新建标签**：`square-plus` 图标，点击调用 `createNewTab()`。
  - **清空当前标签**：`square-pen` 图标，点击调用 `tabManager?.createNewConversation()`，并刷新历史下拉。

说明：`TabBar`（`src/features/chat/tabs/TabBar.ts`）当前只渲染**编号徽章**（切换/右键关闭）；`TabBarCallbacks.onNewTab` 在构造时由 `ClaudianView` 传入，但 **TabBar 内未调用该回调**，实际「+」仅来自头部工具栏。

## 调用链

### 新建标签

```text
UI：头部「+」click
  → ClaudianView.createNewTab()
    → TabManager.createTab()   // 无 conversationId：新开空白 Tab
      → createTab()（Tab.ts）  // DOM + ChatState + lifecycleState: blank 等
      → initializeTabUI / initializeTabControllers / wireTabInputEvents
      → tabs.set；必要时 switchToTab 激活新 Tab
  （若已达 maxTabs）→ Notice 提示上限
```

命令面板等价入口：`main.ts` 中 `commands.newTab` → `Plugin.openNewTab()` → 已有视图则 `ClaudianView.createNewTab()`；冷启动逻辑会避免在无恢复布局时叠出多余空白 Tab（见 `openNewTab()` 内 `restoredTabCount === 0` 分支）。

### 清空当前标签（笔形按钮）

```text
UI：头部「笔形」click
  → TabManager.createNewConversation()
    → 取当前 activeTab → ConversationController.createNew()
      → 流式中则直接返回（非 force 不重置）
      → 若有未保存的当前会话且有消息 → save()
      → 清空子代理、消息、会话 ID、用量等，回到「入口态」
      （首条消息发出前可不落库空会话，见 ConversationController 注释）
  → ClaudianView.updateHistoryDropdown()
```

命令面板等价入口：`commands.newSession` → 取当前视图 `TabManager` → **禁止在流式中执行** → `tabManager.createNewConversation()`。

## 与数据模型的关系

- **Tab**：`TabManager` 持有的 `TabData` 映射；每个 Tab 自带 `ChatState`、`conversationId`（可空）、工作区快照、`providerId` 等。新建 Tab 会从**当前激活 Tab**继承默认提供商（无绑会话时），工作区默认来自插件持久化工作区设置（见 `TabManager.createTab`）。
- **Conversation**：在**单个 Tab** 内由 `ConversationController` 与 `ClaudianPlugin` 的会话存储协作；「清空当前标签」是在**当前 Tab** 内重置会话生命周期，**不创建新 Tab**。

## 选型建议（给用户）

- 需要**同时**跟进两个主题、两段历史：用 **新建标签**（或切换已有标签）。
- 当前这条聊完了、要在**同一 Tab** 内干净开始：用 **清空当前标签**（或输入 `/clear`）。

## 相关源码索引

| 主题 | 文件与符号 |
|------|------------|
| 头部按钮 | `ClaudianView.buildNavRowContent`、`ClaudianView.createNewTab` |
| Tab 创建 | `TabManager.createTab`、`createTab`（`Tab.ts`） |
| 清空当前标签 / createNew | `TabManager.createNewConversation`、`ConversationController.createNew` |
| 内建斜杠 | `builtInCommands.ts`：`/clear`、`/new` → `InputController.executeBuiltInCommand` |
| 命令 | `main.ts`：`new-tab`、`new-session` |

---

*文档版本：基于仓库当前实现整理；若 UI 或命令行为变更，请对照上述路径更新本文。*
