# Claudian 上游仓库两周调查报告

**调查对象**：[YishenTu/claudian](https://github.com/YishenTu/claudian)（上游 `upstream`）  
**本仓库**：当前工作区 `main`（与 `origin` 推送历史一致；版本见 `package.json`）  
**统计截止**：2026-04-20（GitHub API / `upstream` 抓取时间）  
**时间窗口**：最近约 **14 天**，即 **2026-04-06** 起至 **2026-04-20**。  

---

## 0. 本 fork 与 `upstream/main` 的差异（仅关心「还没进本仓库」的部分）

以下用本地 Git 核对（请在仓库根目录可复现）：

```bash
git fetch upstream
git merge-base HEAD upstream/main
git log --oneline HEAD..upstream/main    # 上游有、本仓库还没有的提交
git log --oneline upstream/main..HEAD    # 本仓库有、上游没有的提交
```

| 核对项 | 结果 |
|--------|------|
| **共同祖先** | `a26d318`（`feat: support custom Claude model picker entries (#521)`） |
| **上游有、本 `main` 尚未合入的提交** | `f365a2d` — **fix: patch renderer timers and thinking sync (#528)**（仅 **1** 个提交） |
| **本 fork 已单独合入、与上游 Open PR 重功能线** | **PR #384**（文件栏拖拽上下文）、**PR #523**（输入栏发送/停止按钮）— 已从下文「待跟进 Open PR」清单中 **移除** |

**结论（清单裁剪规则）**：

1. **上游已合并 PR（时间窗内 #385～#521 等）**：凡在共同祖先 **之前或等于** `a26d318` 已进入历史的，**本 fork 已包含**，**不再**作为「你还没合并的已合并 PR」逐条列出；**唯一缺口**是 **PR #528**（需合入 `f365a2d` 或合并上游 `main` 至该点之后）。
2. **上游仍为 Open 的 PR**：若本 fork **已合并等价功能**（#384、#523），从清单中 **移除**（不再与上游 Open #384、#530 重复罗列）。
3. **GitHub Issues**：不因「上游某 PR 已合并」自动等于「本 fork 已修复」——除非对应提交已在 **本仓库** 中。当前本 fork **缺少 #528**，与渲染计时器 / Thinking 同步相关的上游修复 **尚未进入本仓库**；其余 Issue 是否仍适用需结合你是否对齐上游。

---

## 1. 仓库快照（截至调查时，上游）

| 指标 | 数值 |
|------|------|
| 默认分支 | `main` |
| Stars / Forks（约） | 8.6k / 517 |
| Open Issues（上游全库，约） | 65 |

---

## 2. 版本与发布节奏（窗口内，上游）

| 版本 | 说明 |
|------|------|
| **2.0.3** | 上游当时 **Latest**（约 2026-04-16） |
| **2.0.2 / 2.0.1 / 2.0.0** | 同周多版本迭代 |

本 fork 另有独立版本线（如 **2.0.16**），与上游版本号 **不对齐** 属正常。

---

## 3. 上游 `main` 在窗口内的主题摘要（背景阅读）

以下用于理解上游在两周内做了什么；**若对应 PR 已在共同祖先之前合入上游且本 fork 已包含该祖先，则不再列入你的「待合并清单」**。

- **稳定性**：多 Tab、流式去重、Stop Hook、Codex / Windows shim、`aux`→`auxiliary` 等。  
- **产品**：自定义 Claude 模型条目（#521）、WikiLink、历史新开 Tab 等。  
- **里程碑**：多提供商 + Codex（#385）等。

---

## 4. 时间窗内「上游已合并 PR」— 本 fork **尚未拉取** 的部分

**仅列缺口（其余已在共同祖先 `a26d318` 之前进入历史，本 fork 已包含）：**

| PR | 标题 |
|----|------|
| [#528](https://github.com/YishenTu/claudian/pull/528) | fix: patch renderer timers and thinking sync |

**操作建议**：将 `upstream/main` 合并或 rebase 到本分支，或至少 cherry-pick `f365a2d`，再处理冲突与回归测试。

---

## 5. 上游仍为 Open、且 **本 fork 未声明等价合并** 的 PR（精简清单）

下列在上游仍为 **Open**，且 **未** 在本 fork 历史中出现与 PR 号一致的合并提交（已排除 **#384、#530**：本 fork 已合入 **#384**、**#523**，功能线与上游「拖拽上下文」「发送/停止」重叠，故从清单移除）。

| PR | 标题 | 备注 |
|----|------|------|
| [#535](https://github.com/YishenTu/claudian/pull/535) | fix: normalize structured tool_result content in Codex/MCP paths | 与 Issue **#534** |
| [#526](https://github.com/YishenTu/claudian/pull/526) | feat: line-range @mention via Option+K and Shift+drop | — |
| [#516](https://github.com/YishenTu/claudian/pull/516) | fix: show free-text input in AskUserQuestion by default | 与 **#487** |
| [#484](https://github.com/YishenTu/claudian/pull/484) | feat: add Cursor Agent as third chat provider | 体量大 |
| [#478](https://github.com/YishenTu/claudian/pull/478) | fix(selection): preserve selection when Claudian is in detached window or own tab | — |
| [#456](https://github.com/YishenTu/claudian/pull/456) | feat: add OpenCode provider integration via ACP protocol | 与多路 ACP PR 并存 |
| [#424](https://github.com/YishenTu/claudian/pull/424) | feat: add built-in provider presets for Anthropic API-compatible services | — |
| [#390](https://github.com/YishenTu/claudian/pull/390) | feat: add Skill Runs page for parallel background skill execution | 进阶 |
| [#380](https://github.com/YishenTu/claudian/pull/380) | feat: support arbitrary ANTHROPIC_DEFAULT_*_MODEL env keys | — |
| [#371](https://github.com/YishenTu/claudian/pull/371) | fix: detect OAuth token expiry and show actionable error message | — |

**已从原清单移除（本 fork 已合并）**

- ~~[#384](https://github.com/YishenTu/claudian/pull/384)~~ — 本仓库已合并（如 `feat(chat): 合并 PR#384 …`）。  
- ~~[#530](https://github.com/YishenTu/claudian/pull/530)~~ — 上游 Open；本仓库已合并 **[#523](https://github.com/YishenTu/claudian/pull/523)** 同主题发送/停止按钮，故不再重复列出。

---

## 6. Issues（上游社区）

窗口内新建 Issue 数量、主题聚类等 **仍以 GitHub 为准**。对本 fork 而言请注意：

- 依赖 **PR #528** 的渲染/计时器类讨论：在合入 `f365a2d` 前，**本仓库可能仍与上游行为不一致**。  
- 其余 Issue 是否已在你侧复现，需以 **当前 `main` + 你的环境** 为准。

（原报告中的主题表仍可作索引；若某 Issue 仅随 #521 及更早合并而关闭，且你的 `main` 已包含 `a26d318`，则该修复 **已在共同祖先中**。）

---

## 7. 优先关注（按本 fork 缺口裁剪）

### 7.1 建议优先对齐上游代码

1. **合并 PR #528**（`f365a2d`）：渲染计时器与 Thinking 同步，与部分已关闭 Issue（如计时器 / `.unref()` 类）在同一修复线。  
2. **Codex/MCP `tool_result`**：跟进上游 **#535**（若合并）。  
3. **CLI/SDK 版本错配**（如 [#524](https://github.com/YishenTu/claudian/issues/524)）：与上游版本同步策略相关。

### 7.2 本 fork 已通过 #384 / #523 覆盖的改进

- **拖拽添加上下文**、**发送/停止按钮**：不必再等待上游 #384 / #530 才具备能力；后续若上游改动接口，再做一次合并对齐即可。

---

## 8. 值得跟进的 Open PR（与本 fork 缺口对照）

| 优先级 | PR | 说明 |
|--------|-----|------|
| 高 | **#528**（先合提交） | 本 fork **唯一**缺的上游已合并项 |
| 高 | **#535** | 结构化 tool_result 崩溃路径 |
| 中 | **#516**、**#526**、**#478** | UX / 上下文 / 分栏选择 |
| 中 | **#424**、**#380**、**#371** | 配置与可观测性 |
| 择要 | **#484**、**#456**、**#390** | 大功能，需维护成本评估 |

~~#384~~、~~#530~~ 已从表移除（理由见第 5 节）。

---。

## 9. 综合结论

1. **本 fork 与 `upstream/main` 仅差 1 个上游提交**：**#528**（`f365a2d`）。  
2. **#384、#523 已在本仓库落地**，报告中原先与上游 Open **#384/#530** 重复的候选应 **删除**。  
3. 其余上游 Open PR、Issue 仍可作为路线图参考，但 **Issue 是否已修复** 必须以 **本仓库是否包含对应提交** 为准。

---

## 10. 调查方法（可复现）

- 上游元数据、Issue/PR 搜索：GitHub API、`gh`  
- **与本 fork 差异**：`git fetch upstream` + `git merge-base` + `git log HEAD..upstream/main`  

---

*本报告随本仓库 `main` 与 `upstream/main` 关系更新；合并上游后请重新运行第 0 节命令刷新「缺口」列表。*
