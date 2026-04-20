# 最佳实践：构建产物同步到上层 Obsidian 库

## 目标

发版或本地验证时，在**不手动拷贝文件**的前提下，把生产构建结果安装到当前机器上 Obsidian 实际使用的库目录里，做到「构建完成 → 重启/重载插件即可测」。

## 推荐方式：脚本优先

使用仓库脚本 **`scripts/publish-to-obsidian-vaults.mjs`**（npm：`npm run copy:obsidian`）。

### 行为说明

1. 读取 **`manifest.json` 的 `id`** 作为插件目录名（与 `dist/{id}/`、`.obsidian/plugins/{id}/` 一致）。
2. 从**项目根目录**开始，**一层一层向父目录**查找是否存在 **`.obsidian`** 文件夹；每发现一个，视为一个「库根目录」。
3. 将 **`dist/{id}/` 下所有文件**（扁平一层，如 `main.js`、`styles.css`、`manifest.json`）**覆盖复制**到  
   **`{库根}/.obsidian/plugins/{id}/`**。
4. 若向上多层存在多个库（例如多个祖先目录各自有 `.obsidian`），会对**每一个命中的库**各安装一份，便于多库并行验证。
5. 默认最多向上 **32** 层，可用 **`--max-depth`** 调整。

### 常用命令

```bash
# 先构建，再安装到所有向上能找到的 .obsidian
npm run build:try

# 仅安装（需已执行过 npm run build）
npm run copy:obsidian

# 只看会复制到哪里，不写入
node scripts/publish-to-obsidian-vaults.mjs --dry-run
```

### 前置条件

- 必须已成功执行 **`npm run build`**，且存在目录 **`dist/{manifest.id}/`**。
- 仓库路径应位于某个 Obsidian **库目录之下**（或其子目录），且该库根下存在 **`.obsidian`**。

### 与开发时 `OBSIDIAN_VAULT` 的关系

- **开发**：根目录 **`esbuild.config.mjs`** 仍可在 `.env.local` 里配置 **`OBSIDIAN_VAULT`**，在 watch 构建结束时向**单一**库复制。
- **发版/验收**：推荐使用本脚本，**不依赖**环境变量，按目录结构自动发现所有上层库。

### 故障排查

| 现象 | 处理 |
|------|------|
| 提示未找到 `dist/...` | 先执行 `npm run build` |
| 退出码 2：未找到 `.obsidian` | 确认项目是否在库路径下；或增大 `--max-depth` |
| 想确认复制目标 | 使用 `--dry-run` |

## 实现要点（维护者）

- 插件 ID 单一来源：`scripts/lib/read-plugin-id.mjs`。
- 仅复制 `dist/{id}` 下一层文件，与当前构建产物布局一致；若日后增加子目录资源，需扩展脚本或改为递归复制。
