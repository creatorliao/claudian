# Claudian 上游仓库两周调查报告

**调查对象**：[YishenTu/claudian](https://github.com/YishenTu/claudian)（Obsidian 插件「Claudian」官方主线，与本仓库 `upstream` 远程一致）  
**统计截止**：2026-04-20（以 GitHub API 返回的 UTC 时间为准）  
**时间窗口**：最近约 **14 天**，即 **2026-04-06** 起至 **2026-04-20**（含首尾用于提交检索的 `since=2026-04-06T00:00:00Z`）。  
**数据获取**：GitHub REST/Search API、`gh` CLI；未改动本仓库任何代码文件。

---

## 1. 仓库快照（截至调查时）

| 指标 | 数值 |
|------|------|
| 默认分支 | `main` |
| 最近推送 `pushed_at` | 2026-04-20T05:16:30Z 前后 |
| Stars | 约 8.6k |
| Forks | 约 517 |
| 当前 Open Issues（全库） | 约 65 |

---

## 2. 版本与发布节奏（窗口内）

窗口内 **GitHub Releases** 可见的主要版本线：

| 版本 | 发布时间（UTC，约） | 说明 |
|------|---------------------|------|
| **2.0.3** | 2026-04-16 | 当前 **Latest** 发布 |
| **2.0.2** | 2026-04-09 | 小版本迭代 |
| **2.0.1** | 2026-04-06 | 小版本迭代 |
| **2.0.0** | 2026-04-06 | 与多提供商架构上线同周 |

窗口内主线完成了从 **2.0.0（多提供商大版本）** 到 **2.0.3** 的连续修修补补，节奏很快，偏「问题驱动发布」。

---

## 3. `main` 分支提交概览（约 2026-04-06～04-20）

以下按时间从新到旧摘录**有代表性的提交主题**（同一问题可能对应多笔提交；此处概括用户可感知的变化）。

### 3.1 稳定性与渲染/会话

- **渲染定时器与「思考」同步**（如 #528）：针对 Obsidian 渲染进程环境与计时器 API 差异的修复方向，与社区反馈的「计时器 / `.unref()`」类问题一致。
- **Claude 流去重、工具输入增量合并、空白 Tab 路由（禁用 Codex 时）、Foreground 完成后 Stop Hook 循环**：降低多 Tab、工具流、权限 Hook 交互下的错乱与假死感。
- **Tab 会话在 Thinking / 待保存状态下的同步**（#491）：缓解切 Tab 与长思维链下的状态不同步。
- **聊天区 Obsidian WikiLink 消失**（#511）：改善笔记与聊天混排时的链接显示。

### 3.2 产品与设置

- **设置中可维护自定义 Claude 模型条目**（#521）：对自建网关、第三方兼容端点用户价值高（与 Issue 中「自定义模型未加载」类反馈直接相关）。
- **Claude effort（含 xhigh）热更新**（#517）：减少「改设置必须重启」的摩擦。
- **主系统提示中日期获取方式**（#515）：与「模型对话中时间上下文」相关。

### 3.3 平台与 Codex

- **Windows 下 `aux` 保留名导致的克隆/路径问题**（#457）：通过改名为 `auxiliary` 等路径约定缓解，利于 Windows 用户与 CI。
- **Codex：非 Windows 隐藏不当的 Windows 设置**（#489）、**缺少 `codexHome` 时的初始化**（#464）、**Windows Codex shim**（#490）：集中解决 Codex 在不同系统与安装方式下的可用性。

### 3.4 架构里程碑（窗口起点）

- **约 2026-04-06**：合并多提供商架构 + Codex 运行时（大型 PR #385），随即 2.0.x 系列快速发布，说明该阶段以 **稳定性与跨提供商一致性** 为主战场。

---

## 4. 窗口内「已合并 PR」清单（`merged:>=2026-04-06` 检索）

下列 PR 均在上述时间窗内合并（闭合时间见 GitHub；此处列出标题与链接便于追溯）。

| PR | 标题（原文） |
|----|----------------|
| [#528](https://github.com/YishenTu/claudian/pull/528) | fix: patch renderer timers and thinking sync |
| [#521](https://github.com/YishenTu/claudian/pull/521) | Add custom Claude model entries in settings |
| [#517](https://github.com/YishenTu/claudian/pull/517) | Support Claude xhigh effort updates without restart |
| [#515](https://github.com/YishenTu/claudian/pull/515) | Use bash date lookup in the main system prompt |
| [#511](https://github.com/YishenTu/claudian/pull/511) | Fix disappearing Obsidian chat wikilinks |
| [#510](https://github.com/YishenTu/claudian/pull/510) | fix: consolidate claude stream dedup |
| [#508](https://github.com/YishenTu/claudian/pull/508) | Stream incremental Claude tool input updates |
| [#507](https://github.com/YishenTu/claudian/pull/507) | Fix New tab when Claudian view is closed |
| [#506](https://github.com/YishenTu/claudian/pull/506) | Fix blank-tab routing when Codex is disabled |
| [#502](https://github.com/YishenTu/claudian/pull/502) | Fix stop hook loop after foreground task completion |
| [#491](https://github.com/YishenTu/claudian/pull/491) | Fix tab session sync during thinking and pending saves |
| [#490](https://github.com/YishenTu/claudian/pull/490) | fix: support Windows Codex shims |
| [#489](https://github.com/YishenTu/claudian/pull/489) | Fix Codex settings on non-Windows hosts |
| [#467](https://github.com/YishenTu/claudian/pull/467) | fix: remove duplicate tooltip on tab badge hover |
| [#464](https://github.com/YishenTu/claudian/pull/464) | fix: handle missing codexHome in Codex app-server initialize response |
| [#457](https://github.com/YishenTu/claudian/pull/457) | fix: rename aux directories to auxiliary for Windows compatibility |
| [#454](https://github.com/YishenTu/claudian/pull/454) | Fix note selection highlight on sidebar focus |
| [#453](https://github.com/YishenTu/claudian/pull/453) | Add new-tab actions to conversation history |
| [#452](https://github.com/YishenTu/claudian/pull/452) | Fix Claude vault path lookup for wrapped adapters |
| [#385](https://github.com/YishenTu/claudian/pull/385) | refactor: multi-provider architecture with Codex runtime support |

**小结**：合并项以 **Bugfix + 多 Tab / 流式 / Codex / Windows** 为主，功能型合并里 **自定义模型条目** 与 **历史记录下新开 Tab** 对用户最明显。

---

## 5. 当前开放的 Pull Request（全库 Open 状态，截止调查时）

下列 PR 仍为 **Open**（不一定全部在两周内新建，但是用户若做 fork 合并时的直接候选列表）：

| PR | 标题 | 备注（简要） |
|----|------|--------------|
| [#535](https://github.com/YishenTu/claudian/pull/535) | fix: normalize structured tool_result content in Codex/MCP paths | 与 Issue **#534** crash 报告对应，偏 **P0 修复向** |
| [#530](https://github.com/YishenTu/claudian/pull/530) | feat: add send/stop button to input toolbar | 同主题曾出现 **#523**（已关闭），属体验增强 |
| [#526](https://github.com/YishenTu/claudian/pull/526) | feat: line-range @mention via Option+K and Shift+drop | 精细化上下文引用 |
| [#516](https://github.com/YishenTu/claudian/pull/516) | fix: show free-text input in AskUserQuestion by default | 与 **#487** 需求一致 |
| [#484](https://github.com/YishenTu/claudian/pull/484) | feat: add Cursor Agent as third chat provider | 架构面大，需评估维护成本 |
| [#478](https://github.com/YishenTu/claudian/pull/478) | fix(selection): preserve selection when Claudian is in detached window or own tab | 弹窗/独立窗口场景 |
| [#456](https://github.com/YishenTu/claudian/pull/456) | feat: add OpenCode provider integration via ACP protocol | 与近期 **#514/#527** 等多方 ACP PR 同期竞争态 |
| [#424](https://github.com/YishenTu/claudian/pull/424) | feat: add built-in provider presets for Anthropic API-compatible services | 降低兼容端点配置成本 |
| [#390](https://github.com/YishenTu/claudian/pull/390) | feat: add Skill Runs page for parallel background skill execution | 偏工作流/进阶用户 |
| [#384](https://github.com/YishenTu/claudian/pull/384) | feat: 从文件栏拖拽文件到会话上下文 | 中文标题；上下文添加路径更顺 |
| [#380](https://github.com/YishenTu/claudian/pull/380) | feat: support arbitrary ANTHROPIC_DEFAULT_*_MODEL env keys | 模型环境变量灵活性 |
| [#371](https://github.com/YishenTu/claudian/pull/371) | fix: detect OAuth token expiry and show actionable error message | 可观测性与登录体验 |

---

## 6. Issues：窗口内新建规模与主题聚类

使用 `created:2026-04-06..2026-04-20` 检索，**约 63 条** Issue 在该 **15 天日历区间**内新建（含已关闭），密度很高，与 2.0 大版本上线后的反馈洪峰相符。

### 6.1 按主题聚类（用户视角）

| 主题 | 代表 Issue（节选） | 说明 |
|------|---------------------|------|
| **卡顿 / 假死 / 冻结** | [#538](https://github.com/YishenTu/claudian/issues/538)、[#446](https://github.com/YishenTu/claudian/issues/446)、[#519](https://github.com/YishenTu/claudian/issues/519) | 影响基本可用性，情绪权重高 |
| **初始化 / 超时 / Node** | [#539](https://github.com/YishenTu/claudian/issues/539)、[#541](https://github.com/YishenTu/claudian/issues/541)、已关闭 [#525](https://github.com/YishenTu/claudian/issues/525) | 环境差异（Electron/Node 版本）与渲染进程约束 |
| **Claude Code / CLI 版本兼容** | [#524](https://github.com/YishenTu/claudian/issues/524)、[#412](https://github.com/YishenTu/claudian/issues/412)、[#496](https://github.com/YishenTu/claudian/issues/496)、[#459](https://github.com/YishenTu/claudian/issues/459) | Windows 与 CLI 升级后出现集中 |
| **扩展思维（thinking）与历史** | [#532](https://github.com/YishenTu/claudian/issues/532)、[#420](https://github.com/YishenTu/claudian/issues/420)、[#449](https://github.com/YishenTu/claudian/issues/449) | 与流式渲染、切 Tab、历史回放强相关 |
| **Codex / MCP / 工具结果** | [#534](https://github.com/YishenTu/claudian/issues/534)、[#475](https://github.com/YishenTu/claudian/issues/475)、[#471](https://github.com/YishenTu/claudian/issues/471)、[#463](https://github.com/YishenTu/claudian/issues/463) | 工具链与跨平台 spawn |
| **第三方 API / 网关** | [#522](https://github.com/YishenTu/claudian/issues/522)、[#537](https://github.com/YishenTu/claudian/issues/537)、[#503](https://github.com/YishenTu/claudian/issues/503) | `context_management`、1M 上下文提示等 |
| **内联编辑与替换** | [#531](https://github.com/YishenTu/claudian/issues/531) | 编辑工作流阻塞型 |
| **权限与效率（YOLO/Auto）** | [#518](https://github.com/YishenTu/claudian/issues/518)、[#495](https://github.com/YishenTu/claudian/issues/495)、[#494](https://github.com/YishenTu/claudian/issues/494) | 产品策略与安全边界 |
| **体验建议** | [#540](https://github.com/YishenTu/claudian/issues/540)、[#536](https://github.com/YishenTu/claudian/issues/536)、[#443](https://github.com/YishenTu/claudian/issues/443) | Tab 标题、关闭方式等 |

### 6.2 已与上游修复形成闭环的示例（调查窗口内）

部分 Issue 在两周内被密集讨论并 **关闭**，与合并的 PR/版本形成对应（举例，非穷举）：

- **#520** 自定义模型 ↔ **#521** 合并  
- **#513/#493** Stop Hook ↔ **#502**  
- **#474** WikiLink ↔ **#511**  
- **#488** 新开 Tab ↔ **#507**  
- **#497** 空白 Tab 误路由 ↔ **#506**  
- **#455** Windows `aux` ↔ **#457**  
- **#472** Codex.cmd ↔ 工程上向 **#490** 等修复收敛  

这类闭环说明：**维持主线跟进能快速减少「已知已修仍恐慌」的噪声**；若本仓库滞后上游，会重复踩坑。

---

## 7. 用户价值导向：哪些问题「值得优先修复」

下列按 **影响面 × 不可替代性 × 与 2.0 主线一致性** 排序，供你做「合并上游 / 本地 issue backlog」时参考。**不**包含对具体补丁正确性的代码审查结论（本次仅为公开 Issue/PR 信息归纳）。

### 7.1 建议列为 P0 / P1（强修复价值）

1. **卡顿与主线程压力**（[#538](https://github.com/YishenTu/claudian/issues/538)、[#446](https://github.com/YishenTu/claudian/issues/446) 等）  
   - *理由*：一旦 Obsidian 整体冻结，其他功能无意义。与已合并的流式/渲染修复同一战线，应持续跟进主线。

2. **Codex/MCP `tool_result` 结构化内容崩溃**（[#534](https://github.com/YishenTu/claudian/issues/534) + PR [#535](https://github.com/YishenTu/claudian/pull/535)）  
   - *理由*：属「工具一返回就炸」类缺陷，优先吸收 **#535** 或等上游合并后再同步。

3. **Claude Code CLI 与插件版本错配**（[#524](https://github.com/YishenTu/claudian/issues/524)）  
   - *理由*：升级 CLI 的用户面大；需与 SDK/CLI 变更同步，否则表现为「突然全员不可用」。

4. **Node / Electron 新版本的 API 假设**（[#541](https://github.com/YishenTu/claudian/issues/541)）  
   - *理由*：偏底层，会随用户环境滚动升级而爆发。

5. **Windows 下 Claude/Codex 启动失败**（[#496](https://github.com/YishenTu/claudian/issues/496)、[#412](https://github.com/YishenTu/claudian/issues/412)、[#533](https://github.com/YishenTu/claudian/issues/533)）  
   - *理由*：用户基数大；上游已有多笔 Windows/Codex 相关合并，应 **优先对齐上游** 再区分剩余个案。

6. **扩展思维 + 历史请求 400**（[#532](https://github.com/YishenTu/claudian/issues/532)）  
   - *理由*：影响「长推理」场景与历史复用，和 Claude API 行为强相关。

7. **内联编辑无法替换原文**（[#531](https://github.com/YishenTu/claudian/issues/531)）  
   - *理由*：核心卖点功能 regression 时伤害极高。

### 7.2 建议列为 P2（质量与国际化）

- **中文文件名空格路径**（[#479](https://github.com/YishenTu/claudian/issues/479)）  
- **流式在自定义代理下不实时**（[#477](https://github.com/YishenTu/claudian/issues/477)）  
- **npm 安装的 Codex CLI spawn**（[#475](https://github.com/YishenTu/claudian/issues/475)，部分已由 shim 类修复覆盖，需验证）  
- **macOS 误判 Windows/WSL**（[#471](https://github.com/YishenTu/claudian/issues/471)）

### 7.3 更长周期的产品提案（适合路线讨论而非 sprint）

- **自动/YOLO/路由策略**（[#495](https://github.com/YishenTu/claudian/issues/495)、[#494](https://github.com/YishenTu/claudian/issues/494)）：牵涉安全模型与产品哲学。  
- **语音模式**（[#492](https://github.com/YishenTu/claudian/issues/492)）：依赖 Claude Code 能力与 Obsidian 集成边界。  
- **第三方生态（Cursor/OpenCode/Trae）**（[#481](https://github.com/YishenTu/claudian/issues/481)、[#448](https://github.com/YishenTu/claudian/issues/448)）：PR 体量与维护成本需单独评估。

---

## 8. 用户价值导向：哪些 PR「值得被吸收 / 关注」

### 8.1 建议优先考虑合并或紧盯上游合并的 PR

| PR | 类型 | 推荐理由 |
|----|------|----------|
| [#535](https://github.com/YishenTu/claudian/pull/535) | 修复 | 对应 **#534** 的崩溃路径，风险若不修会持续出现 |
| [#516](https://github.com/YishenTu/claudian/pull/516) | 修复/UX | 与 **#487** 一致；提升工具交互的默认可用性 |
| [#530](https://github.com/YishenTu/claudian/pull/530) | 功能 | 发送/停止按钮降低误操作与热键依赖 |
| [#526](https://github.com/YishenTu/claudian/pull/526) | 功能 | 行级 `@mention` 对「引用代码/片段」用户价值高 |
| [#478](https://github.com/YishenTu/claudian/pull/478) | 修复 | 独立窗口与 Obsidian 布局多样性的刚需 |
| [#384](https://github.com/YishenTu/claudian/pull/384) | 功能 | 从文件栏拖入上下文，降低「先 @ 再选」的摩擦 |

### 8.2 高价值但需评估成本与设计的 PR

| PR | 说明 |
|----|------|
| [#424](https://github.com/YishenTu/claudian/pull/424) | 兼容端点 **预设** 减少配置错误；与 **#503** 类「模型未加载」问题同属一派 |
| [#380](https://github.com/YishenTu/claudian/pull/380) | 环境变量模型键通用化；需与设置 UI **#521** 的路线是否重复评估 |
| [#484](https://github.com/YishenTu/claudian/pull/484) | **Cursor Agent** 第三提供商：吸引力强，但测试与长期维护成本高 |
| [#456](https://github.com/YishenTu/claudian/pull/456) | **OpenCode + ACP** 与已关闭的 **[#527](https://github.com/YishenTu/claudian/pull/527)** 等方向并存，建议 **等上游选定主线** 再吸收，避免分叉实现 |

### 8.3 可缓行或视个人路线选择

- [#390](https://github.com/YishenTu/claudian/pull/390) Skill Runs：偏高级自动化；普通笔记用户感知弱。  
- [#371](https://github.com/YishenTu/claudian/pull/371) OAuth 过期提示：利于减少「神秘失败」，可择机合并。

---

## 9. 综合结论（给「想用好产品」的读者）

1. **两周内上游的主旋律**是：**2.0 多提供商落地后的高强度修 Bug**，尤其是 **多 Tab、流式、扩展思维、Codex 跨平台、Windows 路径与 shim**。若你关心稳定性，**紧跟 `main` 的 2.0.3 及后续小版本** 通常优于在旧版本上本地打补丁。  

2. **开放 Issue 数量多且主题集中**：「**卡死 / 超时 / CLI 与 SDK 版本**」与「**Codex/MCP 工具链**」占显要位置；这与大版本迁移期一致，**不等于**项目停滞，而是 **曝光面变大**。  

3. **最值得期待的未完成项**里，**#535（tool_result）**、**#524（CLI 兼容）**、**卡顿类** 对「每日使用者」收益最大；功能向 **#530 / #526 / #384** 能明显改善输入与上下文体验。  

4. **第三方提供商大杂烩（Cursor/OpenCode/多 ACP PR）** 同时出现，说明社区想扩展生态；从用户长期利益看，**优先等待上游选定一种 ACP/OpenCode 集成方式** 再移植，通常比自己抢先合并多个冲突实现更省心。

---

## 10. 调查方法说明（可复现）

- 仓库元数据：`GET /repos/YishenTu/claudian`  
- 提交列表：`GET /repos/YishenTu/claudian/commits?since=2026-04-06T00:00:00Z`  
- 已合并 PR：`gh search prs "merged:>=2026-04-06" --repo YishenTu/claudian`  
- Issue 创建量：`search/issues?q=repo:YishenTu/claudian+is:issue+created:2026-04-06..2026-04-20`  
- Release：`gh release list -R YishenTu/claudian`  

若以其他时区解释「两周」或需要包含 **2026-04-05** 的提交，可微调 `since` 与 `created` 区间后重跑上述命令复核。

---

*本报告仅基于公开 GitHub 数据与命令行查询结果整理，不构成对任何 Issue/PR 技术正确性的担保。若需二次核对，请直接打开文中链接查看最新讨论与代码变更。*
