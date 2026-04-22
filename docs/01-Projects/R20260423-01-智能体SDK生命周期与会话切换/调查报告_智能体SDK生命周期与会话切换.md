# 调查报告：智能体 / SDK 生命周期与会话、模型切换行为

**调查日期**：2026-04-23  
**范围**：Claudian 插件源码中与「每 Tab 的 `ChatRuntime`」「Claude 持久查询 / Codex 进程」「会话与模型切换」相关的实现。  
**结论摘要**：运行时按 **Tab** 持有；多数场景 **不会** 在用户每次操作时销毁整个 `ChatRuntime` 实例。Claude 侧在 **会话 ID 变化** 时会关闭持久查询（相当于断开并重连 CLI 会话链路）；**同一会话内换模型** 优先走 SDK 的 **动态 `setModel`**，而非整进程重启。切换历史会话会刷新 UI 与 `syncConversationState`，**不会**把别的 Tab 里的对话自动切走。

---

## 1. 架构前提（读代码前应先知道的事）

| 概念 | 实现要点 |
|------|----------|
| 运行时实例 | 每个聊天 **Tab** 拥有独立的 `tab.service: ChatRuntime \| null`，在 `initializeTabService` 中创建，见 `Tab.ts` 注释「**唯一**创建 runtime 的入口」。 |
| 懒启动 | `syncConversationState` 只做 **被动同步**（会话元数据、外部路径等）；**真正拉起 CLI / 子进程** 一般在发送路径里 `query()` → `ensureReady()`。 |
| 子代理（Task 工具） | `SubagentManager` 管理 UI 与异步子任务状态；**切换会话 / 新建会话** 时会 `orphanAllActive()`，把未完成的异步子代理标为已中断。 |

---

## 2. 何时会销毁 / 关闭「智能体 / SDK」相关资源？

### 2.1 整段 `ChatRuntime` 被 `cleanup()`（Tab 级）

以下路径会调用 `tab.service.cleanup()` 并置空 `tab.service`（或等价效果）：

1. **`cleanupTabRuntime(tab)`**（`Tab.ts`）  
   - 空白 Tab 在 **换模型且已存在 service** 时（例如曾初始化过又回到 blank 的边界情况）、或空白 Tab **换模型导致需丢弃旧 runtime** 时。  
2. **`initializeTabService`**（`Tab.ts`）  
   - 在创建新 runtime 前 **总是** 对 `previousService` 调用 `cleanup()`。触发条件包括：`serviceInitialized` 为假、或 **目标 `providerId` 与当前 `tab.service.providerId` 不一致**。  
3. **`destroyTab`**（关闭 Tab）  
   - `tab.service?.cleanup()`，并清理子代理、UI 等。  
4. **插件卸载**  
   - 主流程会对各 Tab / 视图做销毁（与 `destroyTab` 同类逻辑）。

**含义**：「销毁智能体 SDK 封装对象」主要指 **`ChatRuntime.cleanup()`**；Claude 与 Codex 内部还会各自关掉子进程 / 持久查询（见下）。

### 2.2 Claude：`closePersistentQuery`（持久会话链路）

`ClaudianService.setSessionId` 在 **会话 ID 变化** 时会 **同步** 调用 `closePersistentQuery('session switch')`，然后更新 `SessionManager`（见 `ClaudeChatRuntime.ts`）。  
此外，**强制重启**、**配置变更需重启**、**stdin 错误**、**session invalidated**、**resetSession**、**插件 cleanup** 等也会关闭持久查询。

**含义**：用户 **从历史选中另一条会话**、且持久化里的 `sessionId` 与当前不同时，Claude 侧会 **关掉当前持久 query**，下次发送再 `ensureReady` 时按新会话拉起。

### 2.3 Claude：**换模型** ≠ 默认关持久查询

`QueryOptionsBuilder.needsRestart` **不** 把 `model` 列为必须重启项；模型、thinking、effort 等由 `applyClaudeDynamicUpdates` 在持久 query 存活时通过 **`persistentQuery.setModel` / `setMaxThinkingTokens` / `applyFlagSettings`** 等更新（`ClaudeDynamicUpdates.ts`）。

**含义**：在 **同一 Claude 会话** 内，用户改模型后 **下一次发送** 会尝试 **热更新** 模型；只有在 **needsRestart** 为真的配置变化（如系统提示词 key、CLI 路径、`effectiveCwd`、外部目录集合等）才会 `ensureReady({ force: true })` 整段重启。

### 2.4 Codex：`cleanup` 与进程重建

- **`CodexChatRuntime.cleanup()`**：`cancel()` + `teardownState()`（含 `shutdownProcess()`、session reset、transport 清理等）。  
- **`ensureReady()`**：若进程不存在、配置 key 变化（含系统提示、启动参数等）、或 `force`，会 `shutdownProcess` 后 `startAppServer`。  
- **`syncConversationState(null)`**：重置会话与 thread 相关状态；**非 null** 时设置 `session.setThread(...)`，**不** 等同于立刻杀进程。

---

## 3. 切换模型时：旧对话会不会被「切换走」？

分 **Tab 生命周期状态**：

### 3.1 空白 Tab（`lifecycleState === 'blank'`）

- 改模型会更新 `draftModel`、推导 `providerId`；若已有 `tab.service` 会先 `cleanupTabRuntime`。  
- **对话尚未绑定**：不存在「旧对话被切走」，只有「草稿模型 / 提供商」变化。

### 3.2 已绑定 Tab（已有 `conversationId`）

- **不允许跨提供商换模型**：若所选模型属于另一提供商，会 `Notice` 提示并恢复选择器显示（`Tab.ts` `onModelChange`）。  
- **同一提供商内换模型**：只更新该 Tab 的提供商设置（`updateTabProviderSettings`），**不** 调用 `cleanupTabRuntime`。  
- **对话记录**：`state.messages` 与磁盘上的会话条目 **不会因改模型而被清空**；模型是 **后续轮次** 的默认模型。

### 3.3 与「旧对话上继续聊」的关系

- 在同一 Tab、同一会话里继续发送：使用 **当前 Tab 工具栏所对应的提供商设置中的模型**；Claude 在持久会话上 **动态 setModel**（见上）。  
- **另一个 Tab** 里改模型，**不会** 自动替换本 Tab 已打开会话的界面或消息列表；各 Tab 有独立的 `tab.service` 与当前 `conversationId`。

---

## 4. 「切换智能体」在代码里对应什么？

可能指三类，行为不同：

| 用户说法 | 代码对应 | 行为 |
|----------|----------|------|
| 换 **提供商**（如 Claude ↔ Codex） | 空白 Tab 下由模型推导 `providerId`；已绑定会话 **`providerId` 不可变**（`main.ts` `updateConversation` 剥离对 `providerId` 的修改） | 已绑定会话不能通过改模型跨提供商；新开空白会话可选另一提供商。 |
| 换 **历史会话** | `ConversationController.switchTo` | 见第 5 节。 |
| **子代理**（Task 异步） | `SubagentManager` | 切换会话 / 新建会话时 **orphan** 运行中的异步子代理。 |

---

## 5. 切换会话（历史里点另一条对话）

`ConversationController.switchTo` 主要顺序：

1. 若正在流式输出则 **直接 return**（不能切）。  
2. `save()` 当前会话。  
3. `subagentManager.orphanAllActive()` + `clear()`。  
4. `plugin.switchConversation(id)`（加载元数据 + `hydrateConversationHistory`）。  
5. `ensureServiceForConversation(conversation)`：对齐 `tab.providerId`、必要时 `syncTabProviderServices`；若 **当前 `tab.service` 与目标提供商一致** 则 `syncConversationState`。**若不一致，此处不会创建新 runtime**（见 5.1）。  
6. `restoreConversation`：刷新消息列表、MCP、外部上下文等，并再次 `getAgentService()?.syncConversationState(conversation, ...)`。

### 5.1 跨提供商切换同一会话列表中的两条记录

当 `tab.service` 仍为 **提供商 A**，但选中的会话属于 **提供商 B** 时：`ensureServiceForConversation` **不会** 对 B 调用 `initializeTabService`，`restoreConversation` 仍可能对 **当前的 A 运行时** 调用 `syncConversationState(B)`。  
**下一次用户发送** 时，`ensureServiceInitialized` → `initializeTabService` 会因 `providerId` 不一致而 `cleanup` 旧 runtime 并创建 B 的运行时，状态才会一致。  
**调查备注**：若产品在 UI 上允许无过滤的跨提供商历史切换，这一中间态值得单独做缺陷或加固评审；若历史列表已按提供商过滤，则风险较低。

### 5.2 `syncConversationState` 对 Claude 的影响

`syncConversationState` → `setSessionId`：**sessionId 变化则 `closePersistentQuery`**。因此 **换了一条带不同 SDK session 的会话**，等价于 **断开旧持久查询**，下一轮发送再连。

---

## 6. 多 Tab：切 Tab 会不会销毁 runtime？

`activateTab` / `deactivateTab` 只切换 **显示** 与选区监听等，**不** 调用 `tab.service.cleanup()`。  
**每个 Tab 保留自己的 `ChatRuntime`**，直到 Tab 关闭或重新 `initializeTabService` / `cleanupTabRuntime`。

---

## 7. 直接回答用户关心的三个问题

1. **智能体 / SDK 什么时候会被销毁并重新连接？**  
   - **Tab 关闭**、**更换 Tab 的 ChatRuntime（提供商变化后的首次初始化）**、**Claude 会话 ID 变化触发的 `closePersistentQuery`**、**需 force 的配置重启**、**Codex 的 teardown / ensureReady 重建**、**显式 cleanup** 等。  
   - **同会话仅改模型**（Claude）：优先 **动态更新**，不是「先销毁再全量重连」。

2. **切换模型或切换「智能体」时，旧的对话会被切换吗？**  
   - **换模型**：改的是 **当前 Tab 后续请求使用的模型**；**不会** 自动把别的 Tab 或别的会话的 UI 切过来。  
   - **换历史会话**：**当前 Tab** 的消息列表会换成那条会话；**其它 Tab** 仍各自绑定自己的 `conversationId`。

3. **在旧的对话上继续聊，能「直接切换过来」吗？**  
   - 若指 **回到历史里某条会话继续聊**：可以，在该 Tab 里 `switchTo` 后 `restoreConversation` + `syncConversationState`；Claude 会在 session 变化时关持久查询，**下一则消息** 走新会话链路。  
   - 若指 **不点会话、只在输入框继续发**：始终对 **当前 Tab 当前 `currentConversationId`** 操作，**不会**  magically 跟你在设置里选的另一条会话合并。

---

## 8. 关键代码位置（便于复核）

| 主题 | 文件与要点 |
|------|------------|
| Tab 级 runtime 清理与初始化 | `src/features/chat/tabs/Tab.ts`：`cleanupTabRuntime`、`initializeTabService`、`onModelChange`、`ensureServiceForConversation`、`destroyTab`、`activateTab` |
| 会话切换 | `src/features/chat/controllers/ConversationController.ts`：`switchTo`、`restoreConversation`、`createNew` |
| 插件侧切换会话数据 | `src/main.ts`：`switchConversation`、`updateConversation`（`providerId` 不可变） |
| Claude 持久查询与 session | `src/providers/claude/runtime/ClaudeChatRuntime.ts`：`syncConversationState`、`setSessionId`、`ensureReady`、`closePersistentQuery` |
| Claude 动态模型 / 无需因 model 重启 | `src/providers/claude/runtime/ClaudeDynamicUpdates.ts`、`ClaudeQueryOptionsBuilder.ts` 的 `needsRestart` |
| Codex 生命周期 | `src/providers/codex/runtime/CodexChatRuntime.ts`：`syncConversationState`、`ensureReady`、`cleanup`、`teardownState` |
| 子代理清理 | `src/features/chat/services/SubagentManager.ts`：`orphanAllActive`、`clear` |
| 运行时接口契约 | `src/core/runtime/ChatRuntime.ts` |

---

## 9. 调查局限

- 未运行端到端手动测试；结论来自 **静态代码阅读**。  
- SDK 内部（`@anthropic-ai/claude-agent-sdk`）在 `setModel` 失败时的回退行为，需结合运行时日志与版本说明再验证。  
- 设置是全局还是按 Tab 快照：以 `getTabSettingsSnapshot` / `updateTabProviderSettings` 的调用链为准，若后续重构为「每会话独立模型」，本报告相关段落需更新。

---

*本报告依据仓库当前 `main` 工作区源码整理；若分支不同，请以实际文件为准。*
