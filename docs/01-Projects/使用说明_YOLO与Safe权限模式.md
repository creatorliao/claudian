# 使用说明：YOLO 与 Safe（权限模式）

本文说明 Claudian **聊天输入区工具栏**里 **Safe / YOLO** 开关的含义。它们对应设置里的 **`permissionMode`**（权限模式），用来控制 **AI 调用工具（读写文件、执行命令等）时，要不要经常停下来请你确认**。

---

## 一句话区分

| 显示     | 内部值   | 含义（直观理解）                                                                                                      |
| -------- | -------- | --------------------------------------------------------------------------------------------------------------------- |
| **YOLO** | `yolo`   | **高自动、少打断**：尽量**不**逐项要你批准工具操作（等价于「放手让模型干」）。                                        |
| **Safe** | `normal` | **按安全策略走**：工具调用会按 **Claude / Codex 各自的规则** 处理，**该确认时会提示你**（具体细节在各自设置里可调）。 |

界面上点一下开关，就是在 **`normal`（Safe）** 和 **`yolo`（YOLO）** 之间切换。  
（若当前会话进入 **计划模式**，工具栏可能显示 **PLAN**，那是第三种模式 `plan`，见文末「补充：PLAN」一节。）

---

## 常见误解：YOLO / Safe 不是「编辑 vs 计划」

**结论：不是。** 工具栏上的 **YOLO** 与 **Safe** **并不**对应「编辑模式」和「计划模式」这两种工作方式。

在代码里，权限模式是 **`yolo` | `plan` | `normal`** 三种（见 `PermissionMode`），和「只编辑 / 只计划」不是同一套二分法：

| 界面上常见显示 | 内部值   | 和「编辑 / 计划」的关系                                                                                                                                                          |
| -------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **YOLO**       | `yolo`   | 表示**权限上尽量少拦**（如 Claude 的 `bypassPermissions`），**不是**「编辑模式」的专门名称。在 YOLO 或 Safe 下，模型都可能改文件、跑工具，差别在于**要不要经常停下来请你批准**。 |
| **Safe**       | `normal` | 表示**按各提供商的安全规则**走，**不是**「计划模式」。                                                                                                                           |
| **PLAN**       | `plan`   | **计划模式**单独一档（例如 `/plan` 等进入时），与 **Safe（`normal`）** 是不同状态；见下文「补充：PLAN」。                                                                        |

因此：

- **Safe** ↔ **`normal`**（偏受控、该确认时会确认）。
- **YOLO** ↔ **`yolo`**（偏放权、少打断）。
- **Plan** ↔ **`plan`**（先计划再推进的那条链路）。

若你所说的「编辑」是指「改文件、执行工具」，在 **Safe** 和 **YOLO** 下**都可能发生**；差别是**审批与沙箱策略**，而不是「一个只管编辑、一个只管计划」。

---

## 在 Claudian 里指哪里

- **位置**：Claudian 聊天窗口**输入框上方工具栏**里的 **Safe / YOLO** 文案（带一个小开关样式）。
- **与设置的关系**：该开关与 **设置 → Claudian 全局** 中的权限模式联动保存；不是「只影响当前窗口一次」的临时选项。

---

## Claude 提供商下分别会怎样

代码里把工具栏模式映射到 Claude Agent SDK 的权限模式（见 `ClaudeQueryOptionsBuilder.resolveClaudeSdkPermissionMode`）：

- **YOLO（`yolo`）**

  - 使用 SDK 的 **`bypassPermissions`**。
  - **含义**：在 Claudian 已允许的前提下，**绕过常规的逐项权限询问**，工具更容易直接执行。
  - **风险**：对库内文件、终端命令等操作的**人工把关更少**，仅在你完全信任当前会话与模型时使用。

- **Safe（`normal`）**
  - **不会**使用 `bypassPermissions`，而是使用你在 **设置 → Claude → 安全 → Safe mode** 里选的 **`acceptEdits`** 或 **`default`**。
  - **含义**：与 Claude Code 的**标准权限模型**一致，**需要用户确认的场景会按 SDK 行为提示**（`acceptEdits` / `default` 的细微差别以 Claude Code / SDK 文档为准；二者都属于「非 YOLO」的受控路径）。

**注意**：若开启 **「加载用户 Claude 设置」**，用户目录下的 Claude Code 权限规则也可能影响实际行为；设置页对此有说明。

---

## Codex 提供商下分别会怎样

代码里由 `resolveCodexSandboxConfig` 把 `permissionMode` 转成 Codex 的 **审批策略 + 沙箱**：

- **YOLO（`yolo`）**

  - **`approvalPolicy: 'never'`**：**不**按常规流程逐项要你批准。
  - **`sandbox: 'danger-full-access'`**：沙箱为**高权限 / 完全访问**类配置（名称表示风险更高）。
  - **风险**：自动化程度最高，**对本机与工作区的约束最弱**，请仅在可信环境与明确需求下使用。

- **Safe（`normal`）**
  - **`approvalPolicy: 'on-request'`**：需要时**仍会向你请求批准**（按 Codex 交互）。
  - **`sandbox`**：使用你在 **设置 → Codex → 安全 → Safe mode** 中的选项：
    - **`workspace-write`**：一般可在工作区内写入；
    - **`read-only`**：更偏只读，写入类能力更受限制。

---

## 和设置里「Safe mode」下拉框是什么关系？

- 工具栏的 **Safe** = **`permissionMode === 'normal'`**。
- 此时 **Claude / Codex** 各自设置页里的 **Safe mode** 下拉框才会决定「**有多 Safe**」（`acceptEdits` / `default`，或 `workspace-write` / `read-only`）。

工具栏 **YOLO** 打开时，**会覆盖成「最放开」的那一档**（Claude 的 `bypassPermissions`、Codex 的 `never` + `danger-full-access`），**不再使用**你在 Safe mode 下拉框里为「Safe」准备的那套细粒度组合。

可以理解为：

- **YOLO**：全局「别拦我」档。
- **Safe**：「按我在各提供商里配的安全档位来」。

---

## 使用建议（怎么选）

- **默认更稳妥**：日常改笔记、跑可能写文件的 Agent 时，用 **Safe**，并在 Codex 里按需选 **`read-only`** 或 **`workspace-write`**。
- **YOLO 适合**：本地测试、可控仓库、且你明确接受「减少确认、提高速度」带来的风险。
- **切换后**：新模式通常作用于**后续**工具调用；若会话已在跑，以当前运行时与提供商行为为准。

---

## 补充：PLAN（计划模式）

当 **`permissionMode === 'plan'`**（例如通过 `/plan` 等进入计划模式）时，工具栏可能显示 **PLAN** 而不是 Safe/YOLO 开关样式：

- **Claude**：SDK 使用 **`plan`** 权限模式（先计划、再按计划推进，与 YOLO 的「全程 bypass」不同）。
- **Codex**：使用 **`on-request`** 审批 + **`workspace-write`** 沙箱（与 YOLO 的 `never` + `danger-full-access` 不同）。

从 PLAN 退出后，一般会回到你之前的 Safe/YOLO 状态（具体以当前版本行为为准）。

---

## 功能来源（供对照代码）

- 权限类型定义：`src/core/types/settings.ts` 中的 `PermissionMode`。
- Claude 映射：`src/providers/claude/runtime/ClaudeQueryOptionsBuilder.ts`。
- Codex 映射：`src/providers/codex/runtime/CodexChatRuntime.ts` 中的 `resolveCodexSandboxConfig`。
- 工具栏标签：**Safe / YOLO** 来自各提供商的 `ProviderPermissionModeToggleConfig`（如 `ClaudeChatUIConfig.ts`、`CodexChatUIConfig.ts`）。

若上游 SDK 或 Codex 协议后续调整枚举含义，**以发行说明与官方文档为准**；本文描述的是当前 Claudian 代码中的接线方式。
