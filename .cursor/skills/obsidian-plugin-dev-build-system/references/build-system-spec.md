# 构建系统技术规范

## 文档信息

- **创建日期**: 2026-02-13
- **版本**: 2.0
- **适用范围**: 所有 Obsidian 插件项目
- **文档性质**: 行为规范文档（非实现规范）

## 0. Claudian 仓库映射（本 monorepo）

若当前仓库为 **Claudian**，以下列为准，**不必**强行套用下文「`dist/{pluginName}` = manifest.name」的示例：

| 项 | Claudian 实际 |
|----|----------------|
| 生产产物 | **`dist/claudian/`**（`scripts/build.mjs` 固定） |
| 开发 watch | 产物可先出现在**仓库根目录** |
| 构建入口 | `scripts/build.mjs`、`esbuild.config.mjs`（根目录） |
| 同步到 Obsidian | `.env.local` 中 `OBSIDIAN_VAULT` → `.obsidian/plugins/claudian/` |

可执行规则：`.cursor/rules/S02-构建系统规则.mdc`。

## 重要说明

**本文档定义的是行为规范，而非具体实现要求。**

- ✅ **必须遵守**：核心行为规范（构建产物位置、目录命名、复制行为）
- ✅ **可以适配**：构建工具选择、构建脚本实现、CSS 处理方式
- 📝 **仅供参考**：文档中的具体实现细节（如 esbuild 配置、CSS 合并方式）

智能体应根据项目实际情况适配构建脚本，但必须遵守核心行为规范。

## 1. 构建产物规范（必须遵守）

### 1.1 构建产物目录结构

**必须遵守**：所有构建产物必须统一输出到以下目录：

```
dist/{pluginName}/
├── main.js         # TypeScript/JavaScript 编译产物（必需）
├── styles.css      # CSS 样式文件（如果项目有 CSS）
├── manifest.json   # 插件清单文件（必需）
└── .hotreload      # 热重载标记文件（可选）
```

**说明**：
- `{pluginName}` **必须**来自 `manifest.json` 的 `name` 字段
- 项目根目录**不应**包含任何构建产物（如 `main.js`、`styles.css`）
- 构建产物**必须**集中管理在 `dist/{pluginName}/` 目录

### 1.2 构建产物清单

| 文件 | 必需性 | 说明 |
|------|--------|------|
| `main.js` | **必需** | TypeScript/JavaScript 编译产物 |
| `styles.css` | **可选** | CSS 样式文件（如果项目有 CSS） |
| `manifest.json` | **必需** | 插件清单文件（从项目根目录复制） |
| `.hotreload` | **可选** | 热重载标记文件（空文件） |

**注意**：
- `styles.css` 是可选的，如果项目不需要 CSS，可以不生成此文件
- `.hotreload` 是可选的，如果项目不需要热重载，可以不创建此文件

### 1.3 构建产物目标位置（必须遵守）

构建完成后，产物**必须**自动复制到以下位置（如果存在）：

1. **当前项目的 Obsidian 插件目录**
   - 路径：`.obsidian/plugins/{pluginId}/`
   - 目录名**必须**使用 `manifest.id`

2. **上级目录的 Obsidian 插件目录**（可选，但行为必须一致）
   - 路径：`../.obsidian/plugins/{pluginName}/`
   - 目录名**必须**使用 `manifest.name`（**重要**：不是 `manifest.id`）
   - 通过向上查找 `.obsidian/plugins/` 目录实现
   - 如果未找到，应静默跳过（不报错）

## 2. 构建行为规范（必须遵守）

### 2.1 构建流程顺序

构建**必须**按以下顺序执行：

1. **TypeScript/JavaScript 编译** → `dist/{pluginName}/main.js`
2. **CSS 构建**（如果项目需要） → `dist/{pluginName}/styles.css`
3. **静态文件处理**（复制 manifest.json，创建 .hotreload 等）
4. **自动复制**到 Obsidian 插件目录

**注意**：CSS 构建是可选的，如果项目不需要 CSS，应跳过此步骤。

### 2.2 目录名规范（必须遵守）

| 用途 | 使用字段 | 示例 | 说明 |
|------|---------|------|------|
| `dist/` 子目录 | `manifest.name` | `dist/T803-笔记协作智能体/` | **必须**使用 `name` |
| 当前项目 Obsidian 插件目录 | `manifest.id` | `.obsidian/plugins/t803-claudian-cn/` | **必须**使用 `id` |
| 上级目录 Obsidian 插件目录 | `manifest.name` | `../.obsidian/plugins/T803-笔记协作智能体/` | **必须**使用 `name` |

**重要**：
- 复制到上级目录时，**必须**使用 `manifest.name` 作为目录名，而非 `manifest.id`
- 这是为了确保在不同 Obsidian 仓库中插件目录名保持一致

### 2.3 自动复制行为规范（必须遵守）

**复制行为要求**：
- 复制所有构建产物文件（包括 `.hotreload` 如果存在）
- 复制操作失败**不应**中断构建过程（应记录错误但继续）
- 复制前应确保目标目录存在（不存在则创建）
- 如果目标目录不存在，应静默跳过（不报错）

## 3. 实现方式（可适配）

### 3.1 构建工具选择

**可以使用任何构建工具**，只要遵守核心行为规范：

- ✅ esbuild（参考实现）
- ✅ Vite
- ✅ Rollup
- ✅ Webpack
- ✅ 或其他工具

**关键要求**：
- 输出到 `dist/{pluginName}/main.js`
- 遵守目录命名规范
- 实现自动复制功能

### 3.2 CSS 构建处理（可适配）

**CSS 构建是可选的**，根据项目情况处理：

- **有 CSS 需要构建**：使用 CSS 构建脚本或构建工具处理
- **有 CSS 无需构建**：直接复制现有 CSS 文件到 `dist/{pluginName}/styles.css`
- **无 CSS**：跳过 CSS 处理步骤

**参考实现方式**：
- CSS 模块化合并（如 `build-css.mjs` 示例）
- PostCSS 处理
- Sass/Less 编译
- 直接复制单个 CSS 文件
- 使用构建工具的 CSS 处理功能

**注意**：无论使用哪种方式，最终输出都应该是 `dist/{pluginName}/styles.css`。

### 3.3 构建模式（可适配）

**生产模式**：
- 一次性构建
- 启用代码压缩（推荐）
- 不生成 sourcemap 或生成外部 sourcemap（可选）

**开发模式**：
- 增量构建（推荐）
- 文件监听（推荐）
- 生成内联 sourcemap（推荐）
- 不压缩代码（推荐）

**注意**：具体实现方式可以灵活选择，但应区分生产和开发模式。

### 3.4 热重载支持（可选）

**如果项目需要热重载**：
- 创建 `.hotreload` 空文件到 `dist/{pluginName}/.hotreload`
- 复制到 Obsidian 插件目录时包含此文件

**如果项目不需要热重载**：
- 跳过创建 `.hotreload` 文件
- 复制时不包含此文件

## 4. 参考实现（仅供参考）

### 4.1 参考构建脚本

以下脚本**仅供参考**，智能体应根据项目实际情况进行适配：

- `scripts/build.mjs` - 构建入口脚本示例
- `scripts/build-css.mjs` - CSS 构建脚本示例（CSS 模块化合并）
- `scripts/esbuild.config.mjs` - esbuild 配置脚本示例

**重要**：这些脚本是参考实现，不是强制要求。可以：
- ✅ 根据项目需求改造
- ✅ 替换为其他构建工具
- ✅ 简化或扩展功能
- ❌ 但不能违反核心行为规范

### 4.2 参考构建流程

**参考流程**（基于 esbuild）：

1. **CSS 构建**（如果项目需要）
   - 读取 `manifest.json` 获取 `pluginName`
   - 创建 `dist/{pluginName}/` 目录（如不存在）
   - 处理 CSS 文件（合并、编译等）
   - 输出到 `dist/{pluginName}/styles.css`

2. **TypeScript/JavaScript 编译**
   - 使用构建工具编译入口文件
   - 输出到 `dist/{pluginName}/main.js`

3. **静态文件处理**
   - 复制 `manifest.json` 到 `dist/{pluginName}/`
   - 创建 `.hotreload` 文件（如果需要）

4. **自动复制**
   - 复制到当前项目的 Obsidian 插件目录
   - 复制到上级目录的 Obsidian 插件目录（如果找到）

## 5. 检查清单

### 5.1 构建前检查

- [ ] `manifest.json` 存在且格式正确
- [ ] `manifest.json` 包含 `name` 和 `id` 字段
- [ ] 入口文件存在（如 `src/main.ts`）
- [ ] 构建脚本已配置（可以是参考脚本或自定义脚本）
- [ ] `package.json` 已配置构建命令

### 5.2 构建后验证（必须通过）

- [ ] `dist/{pluginName}/` 目录存在（使用 `manifest.name`）
- [ ] `dist/{pluginName}/main.js` 存在
- [ ] `dist/{pluginName}/manifest.json` 存在
- [ ] 项目根目录无构建产物（无 `main.js`、无 `styles.css`）
- [ ] 成功复制到 `.obsidian/plugins/{pluginId}/`（如果存在，使用 `manifest.id`）
- [ ] 成功复制到上级目录 `.obsidian/plugins/{pluginName}/`（如果存在，使用 `manifest.name`）

### 5.3 行为一致性检查（必须通过）

- [ ] 构建产物位置正确：`dist/{pluginName}/`
- [ ] 目录命名规范正确：当前项目用 `id`，上级目录用 `name`
- [ ] 自动复制行为正确：复制所有文件，失败不中断构建
- [ ] CSS 处理正确：有则构建/复制，无则跳过

### 5.4 构建验证命令（参考）

```bash
# 清理并重新构建
rm -rf dist && npm run build

# 检查构建产物
ls -lh dist/{pluginName}/

# 验证文件存在
test -f dist/{pluginName}/main.js && echo "[OK] main.js exists"
test -f dist/{pluginName}/manifest.json && echo "[OK] manifest.json exists"

# 验证项目根目录无构建产物
test ! -f main.js && echo "[OK] No main.js in root"
test ! -f styles.css && echo "[OK] No styles.css in root"
```

## 6. 常见问题

### 6.1 CSS 文件出现在项目根目录

**问题**：`styles.css` 出现在项目根目录

**原因**：CSS 构建脚本输出路径不正确

**解决**：确保 CSS 构建脚本输出到 `dist/{pluginName}/styles.css`，而不是项目根目录

### 6.2 上级目录复制失败

**问题**：未复制到上级目录的 Obsidian 插件目录

**检查**：
- 确认上级目录存在 `.obsidian/plugins/` 目录
- 确认查找函数正常工作
- 确认使用 `manifest.name` 作为目录名（不是 `manifest.id`）

**解决**：检查项目是否位于 Obsidian 仓库的子目录中，确认目录名使用 `manifest.name`

### 6.3 目录名错误

**问题**：复制到上级目录时使用了错误的目录名

**原因**：使用了 `manifest.id` 而非 `manifest.name`

**解决**：复制到上级目录**必须**使用 `manifest.name`

### 6.4 构建脚本不适用

**问题**：参考脚本不适用于当前项目

**解决**：
- 根据项目实际情况改造构建脚本
- 或使用其他构建工具（Vite、Rollup 等）
- 但必须遵守核心行为规范（构建产物位置、目录命名、复制行为）

## 7. 适配指南

### 7.1 无 CSS 的项目

- 跳过 CSS 构建步骤
- 修改构建脚本，移除 CSS 相关逻辑
- 确保 `copyStaticFiles()` 不处理 CSS

### 7.2 不使用热重载的项目

- 不创建 `.hotreload` 文件
- 复制时不包含此文件

### 7.3 使用其他构建工具的项目

- 使用 Vite/Rollup/Webpack 等工具
- 配置输出到 `dist/{pluginName}/main.js`
- 实现自动复制逻辑（参考示例）

### 7.4 简单项目

- 可以简化构建流程
- 但必须遵守核心行为规范
- 确保构建产物位置和目录命名正确

---

**文档维护**: 本文档定义的是行为规范，而非具体实现要求。任何构建流程变更都应确保遵守核心行为规范。
