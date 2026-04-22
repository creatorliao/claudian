# 方案：构建后自动同步至最近的 Obsidian 库（低上游冲突）

## 1. 背景与目标

### 1.1 目标

执行 **`npm run build`**（生产构建）完成后，在**无需额外命令、无需手工拷贝**的前提下，将 **`dist/{manifest.id}/`** 下的产物**覆盖同步**到本机实际生效的 Obsidian 插件目录：

`{库根}/.obsidian/plugins/{manifest.id}/`

### 1.2 查找规则（与现有脚本的区别）

| 维度 | 现有 `publish-to-obsidian-vaults.mjs`（`copy:obsidian`） | 本方案（挂到 `build`） |
|------|----------------------------------------------------------|-------------------------|
| 起点 | 固定为**仓库根**（`REPO_ROOT`） | **`process.cwd()`**（与 npm 脚本运行时工作目录一致；常规为仓库根） |
| 命中策略 | 向上遍历，**每一个**祖先上的 `.obsidian` 都安装一份 | 自起点向父目录逐级查找，**遇到第一个** `.obsidian` 即视为库根并**停止** |
| 典型用途 | 多库并行验证、发版前「扫一遍」上层所有库 | 日常：仓库嵌在某个库目录下时，**只装到最近的那一个库** |

说明：若将来需要从子目录启动构建且 `cwd` 不是仓库根，起点为「当前工作目录」仍符合「从当前目录往上找」的语义；常规 `npm run build` 下 `cwd` 即包根目录，与现有构建脚本一致。

### 1.3 产物与路径约定（与 S02 一致）

- 插件 ID：**`manifest.json` 的 `id`**（单一事实来源：`scripts/lib/read-plugin-id.mjs`）。
- 构建输出目录：**`dist/{id}/`**（`main.js`、`styles.css`、`manifest.json` 等扁平一层文件）。
- 同步目标：**`{库根}/.obsidian/plugins/{id}/`**，对同名文件做覆盖复制（与现 `publish-to-obsidian-vaults.mjs` 的复制粒度一致）。

---

## 2. 现状盘点

### 2.1 已有能力

1. **`scripts/build.mjs`**：`production` 模式下完成 CSS + esbuild + 复制 `manifest.json` 到 `dist/{id}/`，并清理根目录/`dist/` 根下误留产物。
2. **`scripts/publish-to-obsidian-vaults.mjs`**：从仓库根向上查找**多个** `.obsidian`，将 `dist/{id}/` 安装到每个库；支持 `--dry-run`、`--max-depth`。
3. **`esbuild.config.mjs`**：开发模式下可通过 **`OBSIDIAN_VAULT`**（或 `.env.local`）在构建结束时向**单一**路径复制；与「向上自动发现」无关，且该文件与上游同步冲突风险较高，**不宜**作为本需求的主要挂载点。

### 2.2 缺口

- `npm run build` 本身**不会**触发向 `.obsidian/plugins` 的同步，需依赖 `build:try` 或手动 `copy:obsidian`。
- `copy:obsidian` 的行为是「**所有**上层库」，与「**仅最近一个**库」不一致。

---

## 3. 设计方案

### 3.1 总体思路

将「查找最近 `.obsidian` + 扁平文件覆盖复制」抽成**独立模块**，在生产构建流水线**末尾**调用一次；对上游频繁变动的文件（如 `esbuild.config.mjs`）**尽量少改或不改**。

推荐文件布局（新建，降低合并冲突概率）：

```text
scripts/lib/
  read-plugin-id.mjs          # 已有
  sync-dist-to-nearest-obsidian.mjs   # 新增：查找 + 复制（或拆成 find + copy 两个小模块，视行数而定）
```

`scripts/build.mjs` 仅在 `isProd` 分支末尾增加**少量**调用（例如 3～8 行：导入、调用、环境变量门控），避免在 `package.json` 的 `build` 脚本里堆叠一长串命令，从而减少与上游 `package.json` 的并排冲突面。

### 3.2 算法（精确描述）

1. 令 `start = resolve(process.cwd())`。
2. 自 `start` 起，对 `current = start, dirname(current), …` 逐级向上，最多 `maxDepth` 层（默认与现脚本一致，如 32，可常量复用）。
3. 若 `join(current, '.obsidian')` 存在且为目录，则令 `vaultRoot = current`，**立即跳出**循环。
4. 若未找到：打印**警告**（stderr），说明未在向上 N 层内发现 `.obsidian`；**不**将本次构建判为失败（避免 CI 或无库环境破坏 `npm run build`）。
5. 若找到：将 `join(REPO_ROOT, 'dist', pluginId)` 下**一层文件**复制到 `join(vaultRoot, '.obsidian', 'plugins', pluginId)`（与 `publish-to-obsidian-vaults.mjs` 的 `copyFlatFiles` 语义一致，必要时**抽取共用函数**到 `scripts/lib/` 避免重复，抽取时仍以「新文件 + 旧文件一行 import」为主，减少大块改写）。

**仓库根 `REPO_ROOT`**：须与 `read-plugin-id`、`dist` 路径一致，推荐在同步模块内用 `fileURLToPath` + `join(__dirname, '../..')` 定位到包根（与 `publish-to-obsidian-vaults.mjs` 相同），**不要**依赖「cwd 一定是包根」，以便子目录 cwd 场景下仍能读到正确的 `dist/`。

### 3.3 门控与可观测性

| 机制 | 说明 |
|------|------|
| 跳过同步 | 环境变量例如 **`CLAUDIAN_SKIP_OBSIDIAN_SYNC=1`**（或 `CI=true` 时默认跳过，可选；若采用 CI 默认跳过，需在文档中写明，避免本地误以为已安装） |
| 日志 | 成功时打印一行：库根路径、目标 `plugins/{id}`；未找到时警告；跳过门控时 info 一行 |

### 3.4 与现有命令的关系（建议保留）

- **`npm run copy:obsidian`**：仍为「所有上层 `.obsidian`」，适合多库、发版前校验。
- **`npm run build:try`**：可继续定义为 `build` + `copy:obsidian`，行为不变；或在未来文档中注明「需要全库安装用 `build:try`，仅最近库已在 `build` 内完成」。
- **`npm run dev`**：不改变；继续依赖根目录产物 + 可选 `OBSIDIAN_VAULT`。

---

## 4. 降低与上游合并冲突的策略

1. **新增** `scripts/lib/sync-dist-to-nearest-obsidian.mjs`（及可选的共享 `copyFlatFiles` 小模块），不把大段逻辑写进 `esbuild.config.mjs`。
2. **`scripts/build.mjs`** 只增加**末尾**、**短**的 `import` + 条件调用；避免重排上游可能修改的 `execSync` 顺序大块。
3. **不修改** `package.json` 的 `build` 字段（若上游常改 scripts，可进一步减少并排冲突）；若团队更偏好显式脚本链，也可改为 `"build": "node scripts/build.mjs production"` 保持不变，仍只在 `build.mjs` 内追加。
4. **不删除、不改名** `publish-to-obsidian-vaults.mjs`，仅在有重复代码时考虑「提取公共复制函数」——提取时放在 **`scripts/lib/`** 新文件，旧脚本改为 import，单次合并通常可接受。

---

## 5. 风险与边界

| 场景 | 处理 |
|------|------|
| 多个上层库，只想装其中一个 | 「最近祖先」即用户所需；若需全库，继续用 `copy:obsidian` |
| `dist/{id}` 不存在或为空 | 不应在同步阶段发生（构建末尾调用）；若异常，打印错误并以非 0 退出（与现 publish 脚本一致）或可断言仅在 build 成功路径调用 |
| 仅文件、无子目录资源 | 与现有一致；若日后 `dist` 含子目录，需同步扩展复制逻辑（Areas 文档与 S02 已提示） |

---

## 6. 验收标准

- [ ] 在「仓库位于某 Obsidian 库子路径下、且该库根存在 `.obsidian`」时，执行 `npm run build` 后，**最近**库下的 `.obsidian/plugins/{id}/` 与 `dist/{id}/` 中对应文件一致（时间戳/内容覆盖）。
- [ ] 向上找不到 `.obsidian` 时，`npm run build` **仍成功**，并有明确警告。
- [ ] 设置 `CLAUDIAN_SKIP_OBSIDIAN_SYNC=1` 时，构建成功且**不写**插件目录。
- [ ] `npm run copy:obsidian` 行为与文档一致（多库），未回归。
- [ ] 合并上游时，冲突面主要限于 `scripts/build.mjs` 尾部小块；`esbuild.config.mjs` 无必需改动。

---

## 7. 实施后文档联动（建议）

- 更新 **`.cursor/rules/S02-构建系统规则.mdc`** 中「同步到 Obsidian」一小节：注明 `build` 默认同步**最近**一个库；全库仍用 `copy:obsidian` / `build:try`。
- 更新 **`docs/02-Areas/最佳实践_构建产物同步到上层Obsidian库.md`**：增加与 `build` 集成的说明及环境变量跳过方式。

（以上联动可在编码合并通过后由实施者提交，避免方案文档与代码不同步。）

---

## 8. 版本与记录

| 项目 | 内容 |
|------|------|
| 文档位置 | `docs/01-Projects/R20260423-02-优化构建链路/本文件` |
| 状态 | 已实施：`scripts/lib/sync-dist-to-nearest-obsidian.mjs`、`scripts/lib/copy-obsidian-plugin-flat.mjs`、`scripts/build.mjs` 尾部调用；`publish-to-obsidian-vaults.mjs` 改用共用复制模块 |
