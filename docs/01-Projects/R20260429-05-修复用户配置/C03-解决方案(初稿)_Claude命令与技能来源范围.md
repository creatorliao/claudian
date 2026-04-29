# 解决方案（初稿）：Claude 命令与技能来源范围

## 1. 目标

在**仅讨论 Claude 提供商**的前提下，让用户能稳定区分两类场景：

1. **工作区 + 用户目录**：当前库下的 `.claude/commands`、`.claude/skills` **与** 用户主目录下 `~/.claude/commands`、`~/.claude/skills` 一并参与展示（并在运行时由 Claude Code / SDK 按官方规则加载）。
2. **仅工作区**：只使用当前库内上述路径；不把用户主目录下的命令/技能纳入列表，运行时也不合并用户侧配置来源（与「仅项目」一致）。

当前「加载用户 Claude 设置」只作用于 **`~/.claude/settings.json`** 与 SDK 的 `settingSources`，**不**驱动设置页对 `~/.claude/skills` 的列举，容易造成误解。本方案用**一个清晰的范围选项**把「列表里看到什么」和「运行时是否合并 user」对齐。

## 2. 配置项设计（推荐）

### 2.1 字段与取值

在 **`providerConfigs.claude`** 中新增（或迁移后唯一保留）一项，例如：

| 建议键名 | 类型 | 取值 |
|----------|------|------|
| `slashAssetScope`（或 `commandsAndSkillsScope`） | `string`（枚举） | `vault-only` \| `vault-and-user-home` |

**默认值（本期诉求 · 待你方确认）**：**`vault-and-user-home`**（即默认等价于「当前库 + 用户目录」一并加载），与多数用户已习惯「Claude Code 会用到全局配置」的体验一致。纯新装或缺省字段时按此默认；仅当用户显式选择「仅当前库」或历史配置为关闭用户加载时，才落在 `vault-only`。

**含义：**

| 取值 | 设置页「命令与技能」列表 | 用户主目录 `~/.claude/settings.json`（权限等） | SDK `settingSources` |
|------|--------------------------|-----------------------------------------------|----------------------|
| `vault-only` | 仅扫描当前库 `.claude/commands`、`/.claude/skills` | 不合并用户级设置文件 | `['project']` |
| `vault-and-user-home` | 合并库内路径 + `~/.claude/commands`、`~/.claude/skills`（用户目录项只读，见 4.2） | 合并用户级设置（与现有「加载用户设置」语义一致） | `['user', 'project']` |

这样：**打开「含用户目录」时，列表与运行时对「用户侧命令/技能/设置」的态度一致**，符合「如果开了全局，就把工作区和全局的都算进来」的直觉。

### 2.2 与现有 `loadUserClaudeSettings` 的关系

**推荐（初稿）**：以 `slashAssetScope` 为**主开关**，从行为上**派生**是否加载用户 `settings.json` 与 `settingSources`，避免两个开关互相矛盾。

- **迁移**：读配置时若尚无 `slashAssetScope`：  
  - 若存在 `loadUserClaudeSettings === false` → 视为 `vault-only`  
  - 若 `loadUserClaudeSettings === true` 或**字段缺失**（未定过）→ 视为 **`vault-and-user-home`**（与**默认**一致）  
- **写回**：保存 Claude 提供商配置时写入 `slashAssetScope`；可保留 `loadUserClaudeSettings` 与之一致（兼容旧键）或逐步只写新键（由实施阶段定夺）。

若短期内必须**保留两个独立 UI 控件**（例如合规要求「可单独关闭 user settings.json」），则需在文档与界面上写清：**用户目录下的命令/技能是否出现在列表** 由 `slashAssetScope` 决定；**是否合并 settings.json** 可再单独布尔——但会带来「列表里有全局技能、却不加载 user settings」等组合，需单独定义运行时行为，**复杂度高**，初稿不建议。

## 3. 界面与文案（Claude 设置页）

- **控件形态**：下拉框（两档即可扫读），放在 **「命令与技能」小节标题附近** 或 **「安全」与「命令与技能」之间**，避免与模型等高级项混杂。
- **中文标签建议**：
  - `vault-only`：**仅当前库**
  - `vault-and-user-home`：**当前库与用户目录**（副标题或说明里点出：`~/.claude/commands`、`~/.claude/skills`，并与 `settings.json` 联动说明一句即可）

- **与现有「加载用户 Claude 设置」**：若实施采用「单字段派生」方案，应**移除或合并**该开关，改为上述下拉；说明文字中保留安全提示（用户权限规则、安全模式等），避免用户以为「只多加载一个 json、不包含技能」。

### 3.1 主列表仅展示少量条目，其余用弹窗「查看全部」（本期诉求 · 待你方确认）

合并**工作区 + 用户目录**后，命令与技能数量可能很多，若在设置页主界面一次性全部展开，容易造成页面过长、滚动与排版压力增大，**主观体验上接近「配置页被撑坏」**。

**交互约定：**

| 项目 | 建议 |
|------|------|
| 主界面可见条数 | 固定展示**约 5 条**（实施时可取常量，如 `5`，必要时 4～6 条内可调，但以「一屏内可见、不 dominating 整页」为准） |
| 排序 | 与实现一致即可（例如：库内优先于用户目录；同来源按名称排序），便于用户预判前 5 条是谁 |
| 超出部分 | 在主列表下方（或标题行右侧）提供 **「更多…」/「查看全部（N）」** 类入口，`N` 为总条数可选 |
| 弹窗内容 | 点击后在 **Modal 弹窗** 内**完整、可滚动**列出全部命令与技能；每条可保留与主列表一致的摘要信息（名称、类型、来源 vault/home、描述一行等）；**编辑/删除**仅在符合 4.2 策略的条目上可用（库内可改，用户目录只读） |
| 空状态 | 总数 ≤ 主界面限额时，不强制出现「更多」；总数为 0 时保持现有空状态文案 |

**原则**：主设置页保持**短、稳**；**全量浏览与管理**在弹窗内完成，避免单次渲染与 DOM 规模过大。

## 4. 列表与编辑策略

### 4.1 合并与去重

- 从库内与用户目录分别扫描与现有 **SkillStorage / SlashCommandStorage** 相同的相对路径布局（`.claude/skills/<name>/SKILL.md`、commands 下 md 约定不变）。
- **同名冲突**：以 **工作区优先**（vault 覆盖 home 的展示与执行解析顺序与 Claude Code 官方规则对齐更佳；若官方为 user+project 有明确优先级，实施时以 SDK/文档为准并在本页注明）。

### 4.2 编辑 / 删除（建议）

- **库内条目**：与现有一致，可增删改。
- **用户目录条目**：在列表中展示为 **只读**（或可「在资源管理器中打开」）；**禁止**在插件内直接写入/删除 `~/.claude/*`，避免误伤用户全局环境（与 Codex 侧 `provenance: 'home'` 的思路一致）。

`ProviderCommandEntry` 或列表模型中可增加 `provenance: 'vault' | 'user-home'`（或复用已有 `scope` 字段并扩展取值），供 UI 隐藏编辑/删除按钮。

## 5. 实现落点（供开发拆分）

1. **`getClaudeProviderSettings`**：读取 `slashAssetScope`，默认 **`vault-and-user-home`**；兼容旧 `loadUserClaudeSettings`（见 2.2 迁移规则）。
2. **构建 `HomeFileAdapter`**：`~/.claude` 下的相对路径与 `SkillStorage`/`SlashCommandStorage` 共用同一相对路径常量（`.claude/commands`、`.claude/skills`）。
3. **`ClaudeCommandCatalog.listVaultEntries`**（或重命名为 `listManagedEntries`）：按 scope 合并 vault + 可选 home 扫描结果；`saveVaultEntry` / `deleteVaultEntry` 遇到 `user-home` 来源时拒绝或引导外部编辑。
4. **`SlashCommandSettings`（及同类 UI）**：继续调用 catalog 的「列举」API；依赖合并后的列表与 `provenance` 控制按钮。**主区域仅渲染前 ~5 条**；「查看全部」打开独立 Modal，内嵌完整列表与滚动容器（见 3.1）。
5. **运行时**：所有组装 `settingSources` 处（如 `probeRuntimeCommands`、会话 query 构建）统一使用 `slashAssetScope` 映射到 `['project']` 或 `['user', 'project']`，与列表一致。
6. **`listDropdownEntries`**：在冷启动/无 runtime 缓存时，与「文件合并结果」或 SDK 探测策略统一，避免出现「下拉里有一套、设置页只有库内」的长期分裂（具体以「优先 runtime SDK、缺省回落合并文件」的现有逻辑上**增加** home 扫描为准）。

## 6. 验收要点（评价线索）

- **默认**：新用户或未写 `slashAssetScope` 时（且无「明确关闭用户加载」 legacy）应为 **`vault-and-user-home`**，与 SDK `['user', 'project']` 一致。
- `vault-only`：设置页列表仅有库内条目；无活动会话时探测命令也不应依赖 user 目录（与 `settingSources` 一致）。
- `vault-and-user-home`：列表数据含 `~/.claude` 下合法技能/命令；用户目录项不可在插件内删除；`settings.json` 行为与当前「加载用户设置」预期一致。
- **展示**：总条数明显大于主界面限额（如 >5）时，主区域**仅显示约 5 条**，且存在「更多/查看全部」入口；弹窗内可浏览**完整列表**且滚动流畅，主设置页**不因条数过多而布局失控**。
- 配置迁移：旧用户 `loadUserClaudeSettings === false` 仍落在 `vault-only`；为 `true` 或缺省时与默认「工作区 + 用户目录」一致。

## 7. 暂不纳入（本初稿范围外）

- Codex 提供商（你方要求暂时只关注 Claude）。
- 子智能体、插件市场等其它 Slash 来源是否与「范围」联动（可后续单独立项）。

---

**文档位置**：`docs/01-Projects/R20260429-05-修复用户配置/`

**状态**：初稿（已纳入「默认工作区+全局」「主列表约 5 条 + 弹窗全部」诉求），**待你方确认**后进入审查与实施（C04/C06）。

**产品 / 文案 / 交互细化**（与 Claudian 现有设置页风格对齐）：见同目录 **[C04-产品与设计_Claude命令与技能配置体验.md](./C04-产品与设计_Claude命令与技能配置体验.md)**。
