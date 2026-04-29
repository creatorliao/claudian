# C02 问题报告：Claude Code MCP 配置无法在 Claudian 设置页展示

**项目**：Claudian（Obsidian 插件）  
**日期**：2026-04-29  
**状态**：已定位根因，待修复

---

## 一、问题描述

用户通过 `claude mcp add --scope user` 为 Claude Code CLI 配置了 MCP 服务器（如 `context7`），该 MCP 在 Claude Code 中可以正常工作，但在 Claudian 插件的设置页面（MCP 服务 区块）中完全看不到任何条目，界面显示「尚未配置 MCP 服务。点击「添加」进行配置。」

**截图复现**：见 assets 目录（设置页 MCP 区块显示空列表）。

---

## 二、调用链路分析

### 2.1 Claudian 的 MCP 配置读取链路

```
插件启动
  └─ main.ts → onload()
       └─ ProviderWorkspaceRegistry.initializeAll()
            └─ createClaudeWorkspaceServices()  [ClaudeWorkspaceServices.ts]
                 └─ new McpStorage(adapter)      [McpStorage.ts]
                 └─ new McpServerManager(mcpStorage)
                      └─ mcpManager.loadServers()
                           └─ mcpStorage.load()
                                └─ 读取: {vault}/.claude/mcp.json
                                     ↓
                                   解析 mcpServers + _claudian 元数据
                                     ↓
                                   返回 ManagedMcpServer[]

设置页打开
  └─ ClaudeSettingsTab.ts → renderMcpSection()
       └─ new McpSettingsManager(container, { mcpStorage })
            └─ loadAndRender()
                 └─ mcpStorage.load()  ← 同上，仅读 {vault}/.claude/mcp.json
                      ↓
                    servers.length === 0 → 渲染"空列表"提示
```

### 2.2 Claude Code CLI 的 MCP 配置链路

Claude Code CLI 使用完全不同的文件体系（官方文档 2026，已核实）：

| 作用域 | 存储位置 | 说明 |
|--------|----------|------|
| **User（全局）** | `~/.claude.json` → 顶层 `mcpServers` | 用户级，所有项目共享 |
| **Project（项目）** | `{项目根}/.mcp.json` → `mcpServers` | 提交至 git，团队共享 |
| **Local（本地覆盖）** | `~/.claude.json` → `projects[路径].mcpServers` | 私有，仅当前项目 |

### 2.3 当前环境实测

```
# ~/.claude.json 中已有全局 MCP：
mcpServers:
  context7: { type: stdio, command: cmd, args: [/c, npx, -y, @upstash/context7-mcp] }

# {vault}/.claude/mcp.json：不存在
# {vault}/.mcp.json：不存在
```

---

## 三、根本原因

**Claudian 的 `McpStorage` 硬编码只读 `{vault}/.claude/mcp.json`，而 Claude Code 的实际配置文件为 `~/.claude.json`（全局）和 `{项目根}/.mcp.json`（项目级）。两套文件体系完全独立，互不感知。**

具体路径常量（`src/providers/claude/storage/McpStorage.ts` 第 9 行）：

```typescript
export const MCP_CONFIG_PATH = '.claude/mcp.json';
```

该路径是 Claudian 自己发明的存储路径，不是 Claude Code CLI 使用的路径。

### 历史背景与混淆来源

- 旧版 Claude Code（早期）曾有人引用 `~/.claude/mcp.json` 或 `~/.claude-code/mcp/global.json`，但官方**从未正式支持**这些路径（见 GitHub Issue #515）。
- 当前官方路径是 `~/.claude.json`（全局）和 `.mcp.json`（项目根），与 Claudian 的 `.claude/mcp.json` 均不重叠。
- Claudian 的 `.claude/mcp.json` 与 Claude Code 的 `.claude/settings.json` 同在 `.claude/` 目录，容易产生「格式兼容」的误判，但实际上是两个独立文件。

---

## 四、影响范围

| 影响 | 说明 |
|------|------|
| 设置页 MCP 列表为空 | `~/.claude.json` 和 `.mcp.json` 中的 MCP 不显示 |
| 对话工具栏也感知不到 | `McpServerManager` 启动时同样只加载 Claudian 自己的文件 |
| 实际调用不受影响 | Claude Code CLI 本身用自己的配置运行，Claudian 调用 SDK 时 CC 仍能读到 `~/.claude.json` |
| 无数据丢失 | 两套存储独立，Claudian 的 `.claude/mcp.json` 是新建文件，不覆盖 CC 配置 |

---

## 五、修复方案建议

### 方案 A（推荐）：在设置页新增「从 Claude Code 导入」能力

**改动范围小，不影响现有存储逻辑。**

1. 新增 `ClaudeCodeMcpReader` 工具类，读取：
   - `~/.claude.json` → `mcpServers`（全局）
   - `{vault}/.mcp.json` → `mcpServers`（项目级）
   - `~/.claude.json` → `projects[vaultPath].mcpServers`（本地项目级）
2. 在 `McpSettingsManager` 的「添加」下拉菜单中增加「从 Claude Code 导入」选项。
3. 读取后经过去重，调用现有 `importServers()` 方法写入 Claudian 自己的 `.claude/mcp.json`。

**优点**：一次导入，后续由 Claudian 自己管理，不需要持续同步逻辑。  
**缺点**：导入后与 CC 原始配置脱钩（用户需手动重新导入以同步新增服务器）。

### 方案 B：在设置页额外展示 Claude Code 原生 MCP（只读区块）

在现有 Claudian 托管列表下方，增加一个「Claude Code 原生 MCP（只读）」区块，实时读取 CC 配置文件并展示，提供「纳入 Claudian 管理」按钮。

**优点**：实时反映 CC 配置，用户感知清晰。  
**缺点**：需要持续读取本地文件，UI 逻辑更复杂。

### 方案 C（激进）：统一存储到 `.mcp.json`

将 Claudian 的主存储迁移到 `{vault}/.mcp.json`（与 CC 项目格式一致），`_claudian` 元数据迁移到 `.claude/mcp-meta.json`。

**优点**：与 CC 项目配置完全互通。  
**缺点**：破坏现有存储格式，需迁移脚本，改动范围最大。

---

## 六、推荐执行路径

优先实施**方案 A**：

1. 新建 `src/core/mcp/ClaudeCodeMcpReader.ts`，封装读取 `~/.claude.json` 和 `.mcp.json` 的逻辑（处理文件不存在、JSON 格式错误等边界）。
2. 在 `McpSettingsManager.ts` 的 `importFromClipboard` 旁边，增加 `importFromClaudeCode()` 方法。
3. UI 下拉菜单新增「从 Claude Code 导入」条目，调用该方法。
4. 导入完成后，已有 `importServers()` 逻辑负责去重与写盘，无需额外改动。

估计改动量：约 100–150 行新增代码，无破坏性变更。

---

## 七、参考资料

- 官方文档：https://code.claude.com/docs/en/configuration（2026-04-29 核实）
- GitHub Issue #515（全局 JSON 路径混淆讨论）：https://github.com/anthropics/claude-code/issues/515
- `src/providers/claude/storage/McpStorage.ts`（Claudian 存储实现）
- `src/features/settings/ui/McpSettingsManager.ts`（设置页 MCP 管理器）
- `src/core/mcp/McpConfigParser.ts`（剪贴板导入解析器，可复用于 CC 导入）
