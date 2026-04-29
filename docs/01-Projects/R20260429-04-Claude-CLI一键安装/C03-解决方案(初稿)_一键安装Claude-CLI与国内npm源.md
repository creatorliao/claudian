# C03 解决方案（初稿）：一键安装 Claude CLI（npm + 国内源）与可用性校验

> **范围**：联网调研 Claude Code 的安装逻辑，给出 Claudian 侧「一键安装」的产品与技术方案。**本文档不包含代码修改**，仅供评审与后续实施引用。

## 1. 调研结论：官方定义的 Claude Code / `claude` 安装逻辑

依据 Anthropic《Advanced setup——Install with npm》及同页前后文（[docs.claude.com / claude-code setup](https://docs.anthropic.com/en/docs/claude-code/setup)），要点如下。

### 1.1 安装渠道概览（官方优先级表述）

官方列出多种方式，其中 **Native Install（curl / PowerShell / install.cmd）标为推荐**：安装后自带后台更新等行为说明；**npm 为并列的高级选项之一**，面向「已具备 Node 工具链」的场景。

与本需求直接相关的是 **npm 全局安装**：

```bash
npm install -g @anthropic-ai/claude-code
```

前置条件：**Node.js 18 或更高版本**。

### 1.2 npm 包实际装了什么（为何「装了 Node」仍合理）

文档明确说明：

- 全局包 **`@anthropic-ai/claude-code`** 会通过 **按平台的 optional dependency**（例如 `@anthropic-ai/claude-code-darwin-arm64` 等）拉取**原生二进制**，并在 **postinstall** 中链接到位；
- **安装后的 `claude` 可执行文件本身不通过 Node 调用**（运行时不是「每次 `node cli.js`」那种模式）。

支持的平台包括：`darwin-arm64`、`darwin-x64`、`linux-x64`、`linux-arm64`、`linux-x64-musl`、`linux-arm64-musl`、`win32-x64`、`win32-arm64`。

**必须允许安装 optional dependencies**；若安装后缺少二进制，官方文档指向 troubleshooting「native binary not found after npm install」。

### 1.3 其他官方渠道（可作为方案备选，本文主路径仍以 npm 为准）

| 方式 | 命令 / 说明 |
|------|----------------|
| Native（推荐） | macOS/Linux/WSL: `curl -fsSL https://claude.ai/install.sh \| bash`；Windows PowerShell: `irm https://claude.ai/install.ps1 \| iex` 等 |
| WinGet | `winget install Anthropic.ClaudeCode` |
| Homebrew | `brew install --cask claude-code` |

用户诉求是 **「已装 Node、一键走 npm + 国内源」**，因此方案正文以 **npm 全局安装** 为主线；若未来要减少可选依赖失败率，可增加「改用 Native 脚本安装」的兜底（需额外评估 Obsidian 内嵌执行 PowerShell/curl 的安全与 UX）。

### 1.4 安装后如何确认「命令行可用」

官方建议：

1. `claude --version` —— 快速确认可执行文件在 PATH 上且能启动；
2. `claude doctor` —— 更完整的安装与配置检查。

登录与账号能力不在「CLI 是否安装成功」的最低门槛内，但可在文案中提示：首次使用仍需按官方流程完成认证（见文档 Authentication 章节）。

### 1.5 权限与安全提示（需在 UI 文案中体现）

文档强调：**不要使用 `sudo npm install -g`**，以免权限与安全问题；若遇权限错误，应遵循官方 troubleshooting（例如改用用户级 prefix、修正目录权限等）。

---

## 2. 国内 npm 源：与一键安装的衔接方式

### 2.1 常用镜像

国内开发者常用 **npmmirror**（原淘宝镜像），registry 示例：

`https://registry.npmmirror.com`

说明：该镜像同步 npm 官方 registry 的包元数据与 tarball；**scoped 包** `@anthropic-ai/claude-code` 同样通过 npm 客户端从配置的 registry 拉取（需使用支持 scoped 的 npm/cli）。

### 2.2 「切换国内源」的两种策略（推荐其一写进产品）

| 策略 | 做法 | 优点 | 缺点 |
|------|------|------|------|
| **A. 单次安装指定 registry（推荐默认）** | `npm install -g @anthropic-ai/claude-code --registry=https://registry.npmmirror.com` | 不改用户全局 npm 配置，副作用小 | 仅本次安装走镜像 |
| **B. 修改用户全局 registry** | `npm config set registry https://registry.npmmirror.com` | 后续所有 npm 默认走镜像 | 可能影响用户其它项目的预期源；需恢复说明 |

**建议**：按钮引导文案写清楚——默认执行 **策略 A**；若产品坚持「一键切换到国内源」，可单独提供「将全局 registry 设为 npmmirror」的高级选项，并提示如何恢复官方源。

可选：`npm config get registry` 在安装前后展示，便于排障。

---

## 3. Claudian 侧「一键安装」解决方案（设计层）

### 3.1 目标用户体验

1. 用户在 Claudian 设置（或引导向导）中看到 **「安装 / 更新 Claude 命令行工具」** 按钮（文案可再斟酌）。
2. 前置假设：**本机已安装 Node.js 且可在 PATH 中找到 `npm`**（或插件能通过现有 `findNodeExecutable` / 增强 PATH 找到 npm）。
3. 点击后：
   - （可选）展示将要执行的命令摘要；
   - 使用 **国内镜像单次安装**（策略 A）执行全局安装；
   - 捕获 stdout/stderr，结束时给出成功或失败原因；
   - 成功后调用 **校验步骤**（见下）。
4. 成功后：**触发或提示刷新 CLI 路径**——调用现有 `findClaudeCLIPath` / `ClaudeCliResolver` 逻辑重新解析；必要时提示用户在「高级 → Claude CLI 路径」中确认（Windows 下有时需指向 `cli.js` 或 `.exe`，与现有 README 一致）。

### 3.2 建议的技术步骤（实施阶段再定稿）

1. **定位 npm**：与现有运行时一致，在 Electron GUI 环境下优先解析完整路径（已有「增强 PATH」与 Node 探测相关逻辑可参考）。
2. **执行安装**：`spawn` / `execFile` 调用 npm，参数示例：  
   `['install', '-g', '@anthropic-ai/claude-code', '--registry=https://registry.npmmirror.com']`  
   可考虑附加 `--foreground-scripts` 或关闭 audit 等以减少交互（以 npm 文档与实际表现为准）。
3. **校验**：
   - 优先在同一环境下执行 `claude --version`（需合并 PATH，包含 npm 全局 bin，与现有 `getEnhancedPath` 思路一致）；
   - 可选再运行 `claude doctor`（耗时更长，可作为「高级检查」）。
4. **失败处理**：常见错误写入可读提示——网络超时、optional deps 被禁用、权限不足、Node 版本低于 18。

### 3.3 与现有 Claudian 实现的衔接（不写代码，仅列依赖）

- **路径解析**：安装成功后，全局 `claude` 通常出现在用户 npm 全局 bin 或文档已说明的 Windows 路径；现有 `findClaudeCLIPath`、`README` 中的「Claude CLI not found」排查路径仍适用。
- **不推荐**：假设安装完成后相对路径即可用；仍应以解析到的**绝对路径**为准（参见既有调查报告）。

### 3.4 权限与平台注意事项（方案必须正视）

- **Windows**：无需管理员即可安装到用户目录的场景较常见；若用户全局 npm prefix 在系统目录，可能失败——文案指向官方权限文档。
- **macOS / Linux**：同样避免引导使用 `sudo`；失败时提示检查 prefix。
- **Electron 安全**：若未来执行外部脚本（Native 安装），需单独安全评审；**纯 npm 子进程**相对可控，但仍应注意参数注入与输出展示。

---

## 4. 风险与开放问题

| 项目 | 说明 |
|------|------|
| 镜像延迟 | npmmirror 同步偶有滞后，极端情况下「最新版」可能与官方不完全同步；可接受或提供「使用默认 registry」勾选 |
| 企业网络 | 代理 / MITM 可能导致 TLS 或 registry 访问失败，需在错误信息中提示检查代理 |
| 法律与账号 | CLI 安装 ≠ API 使用授权；认证与订阅仍以 Anthropic 政策为准 |
| 替代安装方式 | 若 npm optional deps 在特定环境反复失败，可考虑文档内引导 Native / WinGet，不作为一键按钮默认路径 |

---

## 5. 验收建议（实施后）

- [ ] 在「仅预装 Node、未预装 claude」的机器上，点击一键安装后，`claude --version` 可运行（或通过 Claudian 探测到 CLI）。
- [ ] 安装过程未强制永久修改用户 npm registry（若默认采用策略 A）。
- [ ] 失败路径有明确可读提示（网络、Node 版本、权限、optional deps）。
- [ ] Windows / macOS 至少各做过一轮手动验证（与仓库跨平台目标一致）。

---

## 6. 参考链接（调研来源）

- Claude Code Setup（含 npm 小节）：https://docs.anthropic.com/en/docs/claude-code/setup  
- npm 包：`@anthropic-ai/claude-code`（版本与 peer 要求以 npm 页面为准）  
- npmmirror：https://npmmirror.com  

---

*文档版本：初稿；日期：2026-04-29；不涉及代码变更。*
