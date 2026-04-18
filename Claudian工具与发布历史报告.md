# Claudian 工具理解与发布历史报告

> 数据来源：仓库 [README](https://raw.githubusercontent.com/YishenTu/claudian/main/README.md) 与 [GitHub Releases](https://github.com/YishenTu/claudian/releases)（API 抓取）。  
> 说明：GitHub 上当前约有 **16 个独立 Release**；更早版本（约 **1.3.3～1.3.58**）的变更被合并写在 **1.3.59** 这一条 Release 说明中。

---

## 1. 工具是什么

**Claudian** 是 Obsidian 的**桌面端插件**（[YishenTu/claudian](https://github.com/YishenTu/claudian)），在笔记库里**内嵌 AI 编程智能体**（文档写明支持 **Claude Code**、**Codex**，并写「more to come」）。

**核心价值**：把**整个 Vault 当作智能体的工作目录**，读写笔记、搜索、类 Bash 流程、多步任务等与「在仓库里用 Claude Code / Codex」类似，但发生在 Obsidian 界面内。

### 1.1 典型能力（README 摘要）

| 能力 | 说明 |
|------|------|
| 侧栏对话 | 从 Ribbon 或命令面板打开聊天 |
| 行内编辑 | 选中文本 + 快捷键，在笔记里直接改，带词级 diff |
| `/` 与 `$` | 斜杠命令与 Skills（用户级 / 库级） |
| `@mention` | 引用库内文件、子智能体、MCP、外部目录等 |
| Plan Mode | `Shift+Tab`，先探索再出方案供确认 |
| Instruction Mode `#` | 在对话里追加细化指令 |
| MCP | stdio / SSE / HTTP；Claude 侧可在应用内管 Vault MCP，Codex 走 CLI 配置 |
| 多标签与会话 | 多 Tab、历史、分叉、恢复、压缩对话等 |

### 1.2 环境与隐私（README）

- **环境**：Obsidian **v1.4.5+**，仅桌面（Windows / macOS / Linux）；需安装 **Claude Code CLI**（及订阅/API 等）；可选 **Codex CLI**。
- **隐私**：输入、附件、工具输出会发往所配置的 API；本地有 `vault/.claudian/` 等；README 写明**无额外遥测**。

---

## 2. 架构与路线（README）

- 代码按 **多 Provider** 组织：`providers/claude`（Claude Agent SDK）、`providers/codex` 等；`core` 为与 Provider 无关的运行时与类型。
- **Roadmap** 中已勾选：1M Opus/Sonnet、Codex 集成；并写「More to come」。

---

## 3. 发布历史：里程碑与功能主题

以下为 **独立 GitHub Release** 的归纳；**1.3.59** 内含从约 **1.3.3 到 1.3.58** 的累积变更（官方用一条长 changelog 呈现）。

### 3.1 2.x（2026-04）

| 版本 | 要点 |
|------|------|
| **2.0.0** | **多 Provider 架构** + **Codex 运行时**支持（与 README「Codex provider」一致）。 |
| **2.0.1** | 设置页：**Tab 分组与排序**调整，使结构更一致。 |

### 3.2 1.3.69～1.3.72（2026-03）

- **1M 上下文**：Opus/Sonnet 的 1M 窗口；修复自定义环境模型被 1M 开关误过滤等问题。
- **自适应思考（Adaptive thinking）**：Claude 模型上带 **effort 级别**的思考控制（1.3.70）。
- **Electron / SDK**：`setMaxListeners`、自定义 `spawn` 传给 SDK、避免向 `spawn` 传 `AbortSignal` 等兼容性修复。
- **子智能体**：用 SDK 原生 Stop 钩子保证子智能体结果回收；工具结果解析与分支检测改进。
- **体验**：侧栏聚焦不清除编辑器选区；聊天区继承 Obsidian 正文字体；写文件/编辑后**刷新文件树**；Reading 模式下可选中文本；`Escape` 在主编区打开插件时不乱切 Tab；**允许外部访问**以绕过仅 Vault 限制（设置项）。
- **MCP 测试**：HTTP 服务端校验时补 **Content-Length** 等。

### 3.3 1.3.66～1.3.68（2026-02～03）

- **@mention**：库内文件列表展示修复；大库性能优化；**文件夹 @mention** 与缓存（更早版本延续）。
- **浏览器 / 选择上下文**：浏览器选区上下文、安全与视图类型匹配；**ToolSearch** 工具渲染与图标。
- **CLI 检测**：nvm 等安装的 Claude 在 GUI（Obsidian）中可被解析。
- **SDK** 升级到较新版本并采用原生类型。

### 3.4 1.3.60～1.3.65（2026-02）

- **Canvas**：节点选中作为上下文（1.3.62）。
- **聊天 UI**：全宽表格样式、导航侧栏与滚动按钮、bash 模式下输入框等宽字体等。
- **会话命令**：`/fork`、`/resume`（含会话选择）、`!` 执行 bash、`/compact`、**Plan 模式**（Enter/ExitPlanMode）、**SDK 级 rewind** 与文件检查点等（多版本迭代叠加）。
- **子智能体 / 工具**：子智能体设置面板、异步子智能体展示与状态、**AskUserQuestion**、内联审批替代部分弹窗等。

### 3.5 1.3.59 及更早（合并记录在 1.3.59 正文）

这一条 Release 的 body 覆盖了 **1.3.3 → 1.3.58** 的大量条目，主题包括：

- **多 Tab 会话**、智能滚动、消息区「回到底部」按钮、响应计时与状态面板。
- **SDK 原生会话存储**、Windows 路径编码、删除会话文件、外部上下文路径与权限。
- **MCP**：接入方式从自定义协议迁到 `@modelcontextprotocol/sdk`、按会话记住 MCP、禁用单个 MCP 工具等。
- **Skills / 插件 / 子智能体**：Claude Code 插件、自定义子智能体 `@`、技能与命令体系演进。
- **国际化**、设置项（Tab 栏位置、自动隐藏面板、自动滚动开关等）、**wikilink 点击**、图片在聊天中展示等早期体验打磨。

---

## 4. 如何阅读官方「完整历史」

1. **结构化 Release**：打开 [Releases 列表](https://github.com/YishenTu/claudian/releases)，从 **2.0.1** 往回看到 **1.3.59**。
2. **1.3.59 以前**：细节主要在 **1.3.59** 的「What's Changed」长文中，并指向 compare：`1.3.3...1.3.59`。
3. 每个 Release 文末的 **Full Changelog** 链接可到 GitHub 对比两个 tag 的 commits。

---

## 5. 简要结论

- **Claudian** = 在 Obsidian 里用 **Claude Code / Codex 类智能体**管理整个知识库，并配套 **MCP、Plan、行内编辑、@ 引用、多会话** 等一整套工作流。
- **近期最大结构变化**是 **2.0.0** 的 **多 Provider + Codex 运行时**；之后 **2.0.1** 主要是设置页整理。
- **2026-03** 一批版本侧重 **1M 上下文、Electron/SDK 稳定性、子智能体与工具链、阅读/MCP/安全** 等。
- 更早历史请重点阅读 **1.3.59** 的合并说明，再对照其后各独立 Release 即可拼出完整演进。

---

*文档生成说明：若以后需要「写报告」，将默认产出为独立文件（如本例 `.md`），除非你指定其他路径或格式。*
