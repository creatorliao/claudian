# C03 解决方案：MCP 存储对齐 Claude Code 官方格式

**项目**：Claudian（Obsidian 插件）  
**日期**：2026-04-29  
**关联问题**：C02_问题报告_MCP配置无法在设置页展示  
**状态**：已定稿，待实施

---

## 一、目标与约束

### 目标

1. **以 Claude Code 官方格式为标准**：存储文件、字段结构与 CC CLI 完全兼容，Claude Code 用户无需任何转换即可在 Claudian 和 CC 之间共用 MCP 配置。
2. **不再有自创字段**：主配置文件中不出现 `_claudian` 等非官方 key，保持文件可被 CC 原生读取。
3. **新增 MCP 也写官方格式**：Claudian 新增/编辑服务器时，写出的 JSON 与 `claude mcp add` 完全等价。
4. **保留 Claudian 独有功能**：`enabled`、`contextSaving`、`disabledTools`、`description` 这些 Claudian 专用元数据继续可用，只是存到独立的元数据文件。

5. **全局与项目 MCP 合并展示**：设置页使用统一列表，同时显示来自 `~/.claude.json`（全局/本地）和 `.mcp.json`（项目）的所有 MCP，每条附来源角标（`项目` / `全局` / `本地`），运行时也同步合并加载，确保对话中可用。

### 不做的事

- 不修改 `~/.claude.json`（全局用户级 CC 配置为只读，Claudian 只读取、不写入）
- **不写迁移代码**：无需后向兼容，旧路径 `.claude/mcp.json` 直接废弃（当前无存量数据）
- 不破坏已有的 MCP 测试、工具调用、会话恢复逻辑

### 技术决策（已锁定）

| 决策点 | 结论 | 原因 |
|--------|------|------|
| Claudian 元数据（enabled/contextSaving 等） | 存 `.claude/mcp-meta.json`，不进入 `.mcp.json` | `.mcp.json` 保持纯 CC 格式 |
| Stdio 服务器的 `type` 字段 | 写出时**省略**（CC 默认即 stdio） | 更简洁，与 `claude mcp add` 输出一致 |
| 旧 `.claude/mcp.json` 处理 | **直接废弃，不写迁移代码** | 无需后向兼容；当前无存量数据 |

---

## 二、Claude Code 官方格式速查

### 2.1 文件体系（2026 官方当前版本）

| 作用域 | 路径 | 谁管理 | 是否提交 git |
|--------|------|--------|-------------|
| **Project** | `{项目根}/.mcp.json` | 团队/项目 | ✅ 建议提交 |
| **User（全局）** | `~/.claude.json` → `mcpServers` | 用户个人 | ❌ |
| **Local（本地覆盖）** | `~/.claude.json` → `projects[路径].mcpServers` | 用户个人 | ❌ |

### 2.2 `.mcp.json` 文件结构（纯官方格式）

```json
{
  "mcpServers": {
    "context7": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "@upstash/context7-mcp"],
      "env": {}
    },
    "remote-server": {
      "type": "http",
      "url": "https://mcp.example.com/mcp"
    }
  }
}
```

**字段规则**（严格对齐官方）：

- Stdio 服务器：`command`（必填）、`args`（可选数组）、`env`（可选对象）、`type` 可省略（默认 stdio）
- HTTP/SSE 服务器：`type: "http"` 或 `type: "sse"`、`url`（必填）、`headers`（可选对象）

---

## 三、新架构设计

### 3.1 文件分工

```
{vault}/
├── .mcp.json                  ← [主配置] CC 官方格式，mcpServers，无自创字段
│                                  Claude Code CLI 直接读，可 git commit
└── .claude/
    ├── mcp-meta.json          ← [元数据] Claudian 专用，不被 CC 读取
    │                              enabled / contextSaving / disabledTools / description
    ├── settings.json          ← [不变] CC 设置（已有）
    └── ...
```

> `.claude/mcp.json`（旧路径）不再读写，直接废弃。

### 3.2 数据合并策略（统一列表）

设置页与运行时均合并三个来源，优先级与 CC CLI 一致：

```
Local (~/.claude.json 项目条目) > Project (.mcp.json) > User (~/.claude.json 全局)
```

**同名服务器处理规则**：取最高优先级来源的配置，低优先级的同名条目不再单独显示（避免重复）。来源角标标注最终生效的那一层级。

**作用域角标定义**：

| 角标 | 来源 | 说明 |
|------|------|------|
| `项目` | `.mcp.json` | 当前项目配置，可 CRUD |
| `本地` | `~/.claude.json` → `projects[path]` | 用户对本项目的私有覆盖，只读 |
| `全局` | `~/.claude.json` → `mcpServers` | 用户全局配置，只读 |

### 3.3 读写权限

| 来源 | Claudian 可读 | Claudian 可写 | 列表操作 |
|------|:---:|:---:|---------|
| `.mcp.json`（项目级） | ✅ | ✅ | 完整 CRUD（测试、启用/禁用、编辑、删除） |
| `~/.claude.json`（全局/本地） | ✅ | ❌ | 只读，显示角标，提供「加入项目」快捷键写入 `.mcp.json` |
| `.claude/mcp-meta.json` | ✅ | ✅ | 透明（内部读写，仅作用于项目级服务器） |

> **「加入项目」行为**：将该服务器的 config 复制写入 `.mcp.json`，角标从 `全局`/`本地` 变为 `项目`，后续可完整编辑。不修改 `~/.claude.json`。

---

## 四、变更文件清单

### 4.1 修改

| 文件 | 变更内容 |
|------|---------|
| `src/providers/claude/storage/McpStorage.ts` | 主存储路径改为 `.mcp.json`；读写时不含 `_claudian` 字段；新增 meta 读写方法（`.claude/mcp-meta.json`）；**删除迁移逻辑** |
| `src/core/mcp/McpServerManager.ts` | 构造函数新增 `globalReader: ClaudeCodeGlobalMcpReader` 参数；`loadServers()` 合并加载：项目级 + 全局/本地，按优先级去重 |
| `src/core/types/mcp.ts` | 删除 `ManagedMcpConfigFile`（含 `_claudian`）；新增 `McpMetaFile`、`McpServerSource`（`'project'｜'local'｜'user'`）；`ManagedMcpServer` 新增可选字段 `source` |
| `src/features/settings/ui/McpSettingsManager.ts` | 依赖从 `mcpStorage` 改为 `mcpManager`（`McpServerManager`）；渲染统一列表，每条显示来源角标；全局/本地服务器只显示「加入项目」按钮 |
| `src/providers/claude/app/ClaudeWorkspaceServices.ts` | 构造 `McpServerManager` 时传入 `ClaudeCodeGlobalMcpReader`（`vaultPath` 已有，来自 `getVaultPath(plugin.app)`）；`McpSettingsManager` 改用 `mcpManager` |
| `src/providers/claude/CLAUDE.md` | 更新「MCP Dual-Namespace」说明，改为描述新三文件架构 |
| `src/i18n/locales/en.json` / `zh-CN.json` | 新增来源角标文案（`project`/`local`/`user`）；新增「加入项目」按钮文案 |

### 4.2 新增

| 文件 | 说明 |
|------|------|
| `src/core/mcp/ClaudeCodeGlobalMcpReader.ts` | 读取 `~/.claude.json`（全局 `mcpServers` + 本地项目 `projects[path].mcpServers`），跨平台路径（Windows/macOS/Linux），只读，返回带 `source` 标记的列表 |

### 4.3 废弃（不删除代码，直接停止使用）

| 路径 | 处理方式 |
|------|---------|
| `{vault}/.claude/mcp.json` | 代码中移除对该路径的引用；文件若存在则忽略（不读、不写、不删） |
| `ManagedMcpConfigFile`（含 `_claudian` 的类型） | 从 `mcp.ts` 删除，不再使用 |

---

## 五、关键实现细节

### 5.1 McpStorage 新逻辑（伪代码）

```typescript
// 文件路径常量（旧路径 .claude/mcp.json 已废弃，不再引用）
const MCP_CONFIG_PATH = '.mcp.json';           // CC 官方格式，主配置
const MCP_META_PATH = '.claude/mcp-meta.json'; // Claudian 元数据（独立文件）

class McpStorage {
  // 只负责项目级 MCP 的读写（.mcp.json + .claude/mcp-meta.json）
  async load(): Promise<ManagedMcpServer[]> {
    const configs = await this.loadConfigFile();   // 读 .mcp.json → mcpServers
    const meta    = await this.loadMetaFile();     // 读 mcp-meta.json → servers
    return mergeConfigAndMeta(configs, meta);      // 合并为 ManagedMcpServer[]（source = 'project'）
  }

  async save(servers: ManagedMcpServer[]): Promise<void> {
    // 只保存 source === 'project' 的服务器；全局/本地来源只读，不写回
    const projectServers = servers.filter(s => !s.source || s.source === 'project');

    const configFile = { mcpServers: toOfficialConfigs(projectServers) }; // 纯官方字段
    const metaFile   = { servers: extractMeta(projectServers) };          // Claudian 专用

    await this.adapter.write(MCP_CONFIG_PATH, JSON.stringify(configFile, null, 2));
    await this.adapter.write(MCP_META_PATH,   JSON.stringify(metaFile, null, 2));
  }
  // 不需要迁移逻辑：旧 .claude/mcp.json 直接废弃
}
```

### 5.2 McpServerManager 合并加载（修改）

**注意**：`ClaudeWorkspaceServices.ts` 中已有 `vaultPath = getVaultPath(plugin.app)`，直接传入构造函数即可。`HomeFileAdapter` 已存在于项目中，可参考其读 home 目录的方式。

```typescript
class McpServerManager {
  constructor(
    storage: McpStorageAdapter,
    private globalReader: ClaudeCodeGlobalMcpReader,  // 新增依赖
  ) { ... }

  async loadServers(): Promise<void> {
    // 1. 项目级（可编辑，source = 'project'）
    const projectServers = await this.storage.load();

    // 2. 全局/本地级（只读，source = 'local' | 'user'）
    const externalServers = await this.globalReader.read();

    // 3. 合并去重：优先级 local > project > user，同名取最高优先级的那条
    this.servers = mergeByPriority([...externalServers, ...projectServers]);
    //   mergeByPriority：遍历时，local 先放入 map，project 不覆盖 local，user 只填空位
  }

  // 对外（工具栏、SDK 传参、会话工具栏）调用不感知 source，仍按 enabled 过滤
  getActiveServers(...) { ... }  // 不变
}
```

**McpSettingsManager 依赖变更**：

当前 `McpSettingsManager` 接收 `mcpStorage` 并直接调用 `.load()` / `.save()`。新版改为接收 `mcpManager: McpServerManager`：

```typescript
// 加载：改为从 manager 取已合并的列表
this.servers = mcpManager.getServers();   // 已包含全局+项目，带 source 字段

// 保存（新增/编辑/删除）：新服务器强制 source = 'project'，只写项目级
await mcpManager.saveProjectServers(projectOnlyServers);
//   内部调用 mcpStorage.save()，过滤掉非 project 来源
```

`McpSettingsManager` 的构造依赖从：
```typescript
// 旧
{ app, mcpStorage, broadcastMcpReload }
// 新
{ app, mcpManager, broadcastMcpReload }
```

调用方 `ClaudeSettingsTab.ts → renderMcpSection()` 传 `claudeWorkspace.mcpManager`（已有）。

### 5.3 ClaudeCodeGlobalMcpReader（新文件）

`ClaudeCodeGlobalMcpReader` 接收 `vaultPath: string`（来自 `getVaultPath(plugin.app)`，`ClaudeWorkspaceServices.ts` 第 54 行已有），用于匹配 `~/.claude.json` 中的 `projects[vaultPath]`。

```typescript
// 跨平台获取 ~/.claude.json 路径（参考已有的 HomeFileAdapter 实现方式）
function getClaudeJsonPath(): string {
  const home = process.env.USERPROFILE   // Windows
            ?? process.env.HOME;         // macOS / Linux
  if (!home) throw new Error('Cannot determine home directory');
  return path.join(home, '.claude.json');
}

// 返回全局/本地 MCP，按优先级排列（local 排前面）
export async function readClaudeCodeGlobalMcps(vaultPath: string): Promise<ManagedMcpServer[]> {
  const filePath = getClaudeJsonPath();
  const raw = await fs.readFile(filePath, 'utf-8').catch(() => null);
  if (!raw) return [];

  const json = JSON.parse(raw);
  const result: ManagedMcpServer[] = [];

  // Local scope: projects[vaultPath].mcpServers（优先级最高，排前）
  const localServers = json.projects?.[vaultPath]?.mcpServers ?? {};
  for (const [name, config] of Object.entries(localServers)) {
    if (isValidMcpServerConfig(config)) {
      result.push({ name, config, enabled: true, contextSaving: true, source: 'local' });
    }
  }

  // User scope: 顶层 mcpServers（全局，优先级低于 local）
  const userServers = json.mcpServers ?? {};
  for (const [name, config] of Object.entries(userServers)) {
    if (isValidMcpServerConfig(config) && !result.find(s => s.name === name)) {
      result.push({ name, config, enabled: true, contextSaving: true, source: 'user' });
    }
  }

  return result;
}
```

### 5.4 .mcp.json 写出格式保证

`save()` 写出时只保留有效字段，不附加任何非官方 key（如 `_claudian`）。

对 URL 类型服务器，**原样保留原始 `type` 字段**：CC 官方值是 `http`/`sse`，但第三方服务器可能写 `streamablehttp` 等非标准值，CC 运行时对此宽松处理（schema 可能报错，实际连接仍走 HTTP）。Claudian 不改写 `type` 字段，避免破坏用户现有配置。

```typescript
function toOfficialConfig(config: McpServerConfig): Record<string, unknown> {
  if ('command' in config) {
    // Stdio：省略 type（CC 默认即 stdio）
    const out: Record<string, unknown> = { command: config.command };
    if (config.args?.length) out.args = config.args;
    if (config.env && Object.keys(config.env).length) out.env = config.env;
    return out;
  } else {
    // HTTP / SSE / 其他 URL 类型：原样保留 type，不强制覆盖
    const raw = config as Record<string, unknown>;
    const out: Record<string, unknown> = { url: config.url };
    if (raw.type) out.type = raw.type;                          // 原样透传，包括 streamablehttp 等非标准值
    if (config.headers && Object.keys(config.headers).length) out.headers = config.headers;
    return out;
  }
}
```

**UI 编辑说明**：若 `type` 值不在已知列表（`http`/`sse`）内，编辑弹窗中类型字段显示原始值并锁定为只读，只允许编辑 `url`/`headers`，避免覆盖第三方非标准类型。

### 5.5 设置页统一列表 UI

```
[ MCP 服务 ]
  [刷新] [添加▼]
  ┌───────────────────────────────────────────────────────┐
  │  ● context7    stdio  [项目]  [@]   [⚡] [▶] [✏] [🗑]  │  ← .mcp.json，完整操作
  │  ● filesystem  stdio  [项目]  [@]   [⚡] [▶] [✏] [🗑]  │
  │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
  │  ○ notion      http   [全局]        [⚡] [加入项目]      │  ← ~/.claude.json 只读
  │  ○ linear      stdio  [本地]        [⚡] [加入项目]      │
  └───────────────────────────────────────────────────────┘
```

**说明**：
- `项目` 来源：状态点可点击切换、可编辑、可删除，元数据（`contextSaving`/`disabledTools`）可配置
- `全局`/`本地` 来源：状态点固定（始终启用）、编辑/删除按钮不显示，提供 `[加入项目]` 按钮将配置复制到 `.mcp.json`
- 同名服务器存在于多个来源时，只显示优先级最高的那条（与 CC CLI 行为一致）

---

## 六、旧路径处理

无迁移代码。旧文件 `.claude/mcp.json` 若存在，程序直接忽略，不读、不写、不删。用户如需继续使用其中的 MCP，通过设置页「添加」手动录入一次即可（数量通常极少）。

---

## 七、验收标准

1. `{vault}/.mcp.json` 文件内容与 `claude mcp list --format json` 输出 100% 兼容，无 `_claudian` key
2. 在 Claudian 设置页新增/编辑/删除 MCP 后，Claude Code CLI 无需额外操作即可识别新配置
3. 设置页统一列表中同时显示 `.mcp.json`（项目）和 `~/.claude.json`（全局/本地）的所有服务器
4. 每条服务器正确显示来源角标（`项目` / `全局` / `本地`）
5. 全局/本地来源服务器：测试按钮可用，编辑/删除按钮不显示，「加入项目」按钮可用
6. 点击「加入项目」后该服务器写入 `.mcp.json`，角标变为 `项目`，操作按钮全部出现
7. 同名服务器跨来源时只显示最高优先级的那条，不重复
8. 运行时（对话工具栏 / SDK 传参）也能使用全局/本地 MCP，不只限于项目级
9. 旧 `.claude/mcp.json` 存在时程序正常启动，不读不写不报错，不影响新功能
10. 全量测试（`npm run test`）通过，typecheck 通过

---

## 八、估计工作量

去掉迁移代码后，净改动进一步减少：

| 任务 | 估计行数 |
|------|---------|
| `McpStorage.ts` 重构（新路径 + meta 分离，去掉迁移逻辑） | ~100 行（净改动） |
| `McpServerManager.ts` 合并加载逻辑 | ~40 行 |
| `mcp.ts` 类型修改（新增 `source`、`McpMetaFile`，删除旧类型） | ~25 行 |
| `ClaudeCodeGlobalMcpReader.ts`（新文件） | ~90 行 |
| `McpSettingsManager.ts`（统一列表 + 角标 + 加入项目） | ~80 行 |
| i18n 新增文案（角标 + 按钮） | ~12 key |
| 测试更新 | ~100 行 |
| **合计** | **约 435 行净改动** |
