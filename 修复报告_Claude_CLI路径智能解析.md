# 修复报告：Claude Code CLI 路径智能解析

## 1. 背景与问题描述

### 1.1 现象与诉求

用户反馈：**识别 Claude Code（`claude`）可执行路径在逻辑上不够可靠**，希望本程序能够同时兼容：

- 本机安装的**原生二进制**（如 `~/.local/bin/claude`）；
- **npm** 全局安装的 CLI（含 `cli.js` 布局）；
- **pnpm** 全局安装的 CLI（全局目录与 npm 不同）；
- 并在 Obsidian 等 **GUI 环境**下尽量与终端行为一致，实现「一套逻辑、自动择优」的解析，而非依赖用户反复手动配置。

### 1.2 本机环境核实（修复时采样）

在开发机上执行 `which claude` 得到：

- 路径：`/Users/creatorliao/.local/bin/claude`
- 类型：**Mach-O 64-bit executable arm64**（原生二进制，非 Node 脚本）

说明：该路径已在历史代码的「常见路径」列表中，但 **GUI 进程 PATH 过短**、以及 **仅依赖硬编码列表 / 仅 `process.env.PATH`** 时，仍可能出现与终端不一致或漏掉 npm/pnpm 布局的情况。

---

## 2. 根因分析

### 2.1 与「增强 PATH」策略不一致

运行时通过 `getEnhancedPath`、`findNodeDirectory` 等会使用 **`getExtraBinaryPaths()`** 为 Obsidian 等 GUI 应用补足常见二进制目录（如 `~/.local/bin`、`/opt/homebrew/bin`、NVM/Volta 等）。

而 **`findClaudeCLIPath` 原先**主要依赖：

- 设置中解析出的 `PATH`；
- 一组固定「常见路径」；
- 最后才使用 **`process.env.PATH`**（Electron 内往往很短）。

未将 **`getExtraBinaryPaths()`** 纳入 CLI 探测的合并 PATH，导致 **同一应用在「找 node」与「找 claude」时使用两套环境假设**，在 GUI 下容易偏离终端。

### 2.2 Unix 与 Windows 在 PATH 上行为不对称

在 **Windows** 上，`resolveClaudeFromPathEntries` 会在 PATH 目录上尝试 **`claude.exe` / `claude`**，失败后再沿目录推导 **`cli.js`**。

在 **Unix / macOS** 上，原先 PATH 解析 **仅查找名为 `claude` 的可执行文件**，未对 PATH 中的目录做 **`cli.js` 推导**，对 npm/pnpm 某些安装布局不够友好。

### 2.3 固定 `cli.js` 列表遗漏常见安装位

- **Homebrew Node（Apple Silicon）**：`/opt/homebrew/lib/node_modules/@anthropic-ai/claude-code/cli.js` 等未系统覆盖；
- **pnpm 全局**：目录形如 `~/Library/pnpm/global/<版本号>/node_modules/...`（及 Linux 下 `~/.local/share/pnpm/global/...`），版本目录名随 pnpm 变化，**仅靠固定字符串无法穷举**。

### 2.4 Windows 优先级回归风险（实现时需注意）

若将「合并 PATH」整体提前到与 **固定 `.exe` 安装位** 同等或更前处理，可能出现：**`AppData\Roaming\npm` 下的 `cli.js` 先于 `~\.claude\local\claude.exe` 命中**，与既有产品语义及单测预期不符。修复中已通过 **Windows 上先扫固定 `.exe` 位、再合并 PATH** 保留正确优先级。

### 2.5 环境变量与 `os.homedir()` 不一致（单测暴露）

`getExtraBinaryPaths()` 在 Windows 分支使用 **`HOME` / `USERPROFILE`**（`getHomeDir()`），而部分逻辑与单测使用 **`os.homedir()`**。在跨平台单测（在 macOS 上模拟 `win32`）时若未对齐，会导致合并 PATH 中的用户目录错误。已在 Windows 相关单测中统一设置 `HOME` / `USERPROFILE` 并使用 `path.win32.join` 构造期望路径。

---

## 3. 解决方案概述

1. **合并探测用 PATH**：`设置中的 PATH` → **`getExtraBinaryPaths()`** → **`process.env.PATH`**，去重后统一交给 PATH 解析逻辑，与 GUI 下找 Node 的策略对齐。
2. **Unix PATH 与 Windows 对齐**：在合并后的 PATH 目录上，先找 **`claude` 可执行文件**，再尝试沿 PATH 推导 **`cli.js`**。
3. **扩展 `cli.js` 候选**：增加 Homebrew 路径；增加 **pnpm 全局目录动态枚举**（`readdir` + 安全兜底，避免单测桩返回非数组时崩溃）。
4. **导出 `getExtraBinaryPaths`**：与 PATH 增强、Node 探测共用同一数据源，避免今后再次分叉。
5. **Windows 顺序**：**先**扫描约定的原生 **`claude.exe` 安装路径**，**再**做合并 PATH 与固定 `cli.js` 列表，避免 npm `cli.js` 覆盖本机包。

---

## 4. 修改记录（文件级）

| 文件 | 变更摘要 |
|------|----------|
| `src/utils/env.ts` | 将 `getExtraBinaryPaths` **导出**；补充中文说明：GUI PATH 与终端不一致、与 `getEnhancedPath` / `findNodeDirectory` 共用。 |
| `src/providers/claude/cli/findClaudeCLIPath.ts` | 新增 `buildMergedDiscoveryPathEntries`、`collectPnpmGlobalClaudeCliJsPaths`；`resolveClaudeFromPathEntries` 在 Unix 上增加 `cli.js` 推导；`getNpmCliJsPaths` 增加 Homebrew 与 pnpm 全局枚举；`findClaudeCLIPath` 调整 **Windows `.exe` 优先** 与合并 PATH 顺序；`readdirSync` 结果 **Array.isArray** 防护。 |
| `tests/unit/utils/utils.test.ts` | Windows 用例：`beforeEach` 设置 `HOME` / `USERPROFILE`；期望路径改用 **`path.win32.join`**，与实现一致。 |

---

## 5. 核心逻辑说明（便于代码审阅）

### 5.1 合并 PATH 顺序（`buildMergedDiscoveryPathEntries`）

1. `parsePathEntries(pathValue)` — 来自设置中的运行时环境（含共享 + Provider 的 `PATH`）；
2. `getExtraBinaryPaths()` — 与「找 Node」一致的 GUI 补全目录；
3. `parsePathEntries(process.env.PATH)` — 进程继承的 PATH。

去重后用于 **`resolveClaudeFromPathEntries`**。

### 5.2 Windows 与 Unix 在 `findClaudeCLIPath` 中的顺序

- **Windows**：**固定 `.exe` 列表** → **合并 PATH 解析**（`claude.exe` / `claude` / PATH 上 `cli.js`）→ **`getNpmCliJsPaths()` 固定列表** → 后续与非 Windows 共用的 `commonPaths` 等。
- **非 Windows**：**合并 PATH 解析**（`claude` → PATH 上 `cli.js`）→ `commonPaths` → **`getNpmCliJsPaths()`**（含 Homebrew、pnpm 枚举等）。

### 5.3 pnpm 全局 `cli.js`（`collectPnpmGlobalClaudeCliJsPaths`）

扫描根目录（非 Windows）：

- `~/Library/pnpm/global`
- `~/.local/share/pnpm/global`

对每个子目录 `name` 构造：

`<root>/<name>/node_modules/@anthropic-ai/claude-code/cli.js`

若 `readdirSync` 被桩为非数组，则视为无子项，**不抛错**。

---

## 6. 验证情况

- **单元 / 集成测试**：全量 `npm test` 通过（含原 `findClaudeCLIPath`、Windows 分支、`ClaudianService` 集成等）。
- **静态检查**：`npm run typecheck`、`npm run lint` 通过。

---

## 7. 使用与后续建议

- **一般用户**：升级后无需改配置即可在多数环境下同时识别原生二进制与 npm/pnpm；若仍使用自定义安装路径，可在设置中保留 **按主机名的 CLI 路径**（优先级高于自动探测，见 `ClaudeCliResolver.resolveClaudeCliPath`）。
- **维护者**：今后若新增「GUI 常见二进制目录」，应优先在 **`getExtraBinaryPaths`** 中扩展，以便 Node 与 Claude CLI 探测自动同步受益。

---

## 8. 版本信息说明

本报告对应仓库内一次连贯修改；发布版本号以 `package.json` / `manifest.json` 及 CHANGELOG 为准。若需对外发布，建议在 `CHANGELOG.md` 中增加一条简要说明指向本报告或上述要点。

---

*文档生成说明：本报告由开发过程中的修复任务整理而成，涵盖问题、根因、方案、文件级修改记录与验证方式，便于评审与归档。*
