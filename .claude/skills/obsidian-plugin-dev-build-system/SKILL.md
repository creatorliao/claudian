# Obsidian 插件构建系统

## name
obsidian-plugin-dev-build-system

## description
Obsidian 插件项目的标准化构建系统规范。定义构建产物管理、自动复制到 Obsidian 插件目录、目录命名等核心行为规范。当用户需要为新 Obsidian 插件项目设置构建系统、配置构建流程、理解构建规范、或需要参考构建脚本实现时使用。适用于所有 Obsidian 插件项目，确保构建产物统一管理、行为一致。**重要**：本 skill 定义的是**行为规范**而非**脚本实现**，智能体应根据项目实际情况适配构建脚本，但必须遵守核心行为规范。

## Claudian 本仓库（优先阅读）

以下为 **本仓库实际实现**，若与下文通用模板不一致，**以仓库内脚本为准**：

| 项目 | 实际情况 |
|------|-----------|
| 生产产物目录 | **`dist/claudian/`**（由 `scripts/build.mjs` 固定，与 `manifest.id` 一致） |
| 开发模式 | `npm run dev`：watch 时 **CSS/JS 可先出现在仓库根目录**，见 `build.mjs` / `build-css.mjs` 注释 |
| 编排入口 | `scripts/build.mjs`（生产）、根目录 **`esbuild.config.mjs`** |
| 复制到库 | 配置 `.env.local` 中 **`OBSIDIAN_VAULT`** → `.obsidian/plugins/claudian/` |
| 包管理 | **`npm`**（`package.json`） |
| 可执行规则 | `.cursor/rules/S02-构建系统规则.mdc`、`S00-Claudian-工作区上下文.mdc` |

本 skill 目录下的 `scripts/` 为**通用参考模板**，勿与仓库根目录正在使用的脚本混为一谈。

## 核心行为规范（必须遵守）

### 1. 构建产物目录规范

**必须遵守**：所有构建产物必须统一输出到 `dist/{pluginIdOrBundleDir}/` 目录。多数插件使用 `manifest.name` 作为目录名；**Claudian 使用固定子目录 `dist/claudian/`（与 `manifest.id` 一致）**，以项目 `scripts/build.mjs` 为准。

**构建产物结构**：
```
dist/{pluginName}/
├── main.js         # TypeScript/JavaScript 编译产物（必需）
├── styles.css      # CSS 样式文件（如果项目有 CSS）
├── manifest.json   # 插件清单文件（必需）
└── .hotreload      # 热重载标记文件（可选）
```

**重要原则**：
- 项目根目录不应包含任何构建产物（如 `main.js`、`styles.css`）
- 构建产物必须集中管理在 `dist/{pluginName}/` 目录
- 目录名通常来自 `manifest.json`（常见为 `name`）；**Claudian 为 `dist/claudian/`**，见上表

### 2. 目录命名规范（必须遵守）

**复制目标目录命名规则**：

| 目标位置 | 目录名来源 | 示例 |
|---------|----------|------|
| `dist/` 子目录 | `manifest.name` | `dist/T803-笔记协作智能体/` |
| 当前项目的 `.obsidian/plugins/` | `manifest.id` | `.obsidian/plugins/t803-claudian-cn/` |
| 上级目录的 `.obsidian/plugins/` | `manifest.name` | `../.obsidian/plugins/T803-笔记协作智能体/` |

**重要**：
- 复制到上级目录时，**必须**使用 `manifest.name` 作为目录名，而非 `manifest.id`
- 这是为了确保在不同 Obsidian 仓库中插件目录名保持一致

### 3. 自动复制行为规范（必须遵守）

构建完成后，**必须**自动复制构建产物到以下位置（如果存在）：

1. **当前项目的 Obsidian 插件目录**
   - 路径：`.obsidian/plugins/{pluginId}/`
   - 目录名使用 `manifest.id`

2. **上级目录的 Obsidian 插件目录**（可选，但行为必须一致）
   - 路径：`../.obsidian/plugins/{pluginName}/`
   - 目录名使用 `manifest.name`
   - 通过向上查找 `.obsidian/plugins/` 目录实现
   - 如果未找到，应静默跳过（不报错）

**复制行为要求**：
- 复制所有构建产物文件（包括 `.hotreload` 如果存在）
- 复制操作失败不应中断构建过程（应记录错误但继续）
- 复制前应确保目标目录存在（不存在则创建）

### 4. 构建流程规范（必须遵守）

构建流程应按以下顺序执行：

1. **TypeScript/JavaScript 编译** → `dist/{pluginName}/main.js`
2. **CSS 构建**（如果项目需要） → `dist/{pluginName}/styles.css`
3. **静态文件处理**（复制 manifest.json，创建 .hotreload 等）
4. **自动复制**到 Obsidian 插件目录

**注意**：CSS 构建是可选的，如果项目不需要 CSS，应跳过此步骤。

## 实现方式（可适配）

### 构建脚本实现

**重要**：本 skill 提供的构建脚本（`scripts/build.mjs`、`scripts/build-css.mjs`、`scripts/esbuild.config.mjs`）**仅供参考**，智能体应根据项目实际情况进行适配：

- ✅ **允许改造**：可以根据项目需求修改构建脚本的实现方式
- ✅ **允许替换**：可以使用其他构建工具（如 Vite、Rollup、Webpack 等）
- ✅ **允许简化**：对于简单项目，可以简化构建流程
- ❌ **不允许违反**：核心行为规范（构建产物位置、目录命名、复制行为）

### CSS 构建处理

**CSS 构建是可选的**，根据项目情况处理：

- **有 CSS 需要构建**：使用 CSS 构建脚本（如 `build-css.mjs`）或构建工具处理
- **有 CSS 无需构建**：直接复制现有 CSS 文件到 `dist/{pluginName}/styles.css`
- **无 CSS**：跳过 CSS 处理步骤

**参考实现**：
- `scripts/build-css.mjs` - CSS 模块化合并示例（仅供参考）
- 也可以使用 PostCSS、Sass、Less 等工具
- 也可以直接复制单个 CSS 文件

### 构建工具选择

**可以使用任何构建工具**，只要遵守核心行为规范：

- esbuild（参考实现）
- Vite
- Rollup
- Webpack
- 或其他工具

**关键要求**：
- 输出到 `dist/{pluginName}/main.js`
- 遵守目录命名规范
- 实现自动复制功能

### 热重载支持

**可选功能**，如果项目需要热重载：

- 创建 `.hotreload` 空文件到 `dist/{pluginName}/.hotreload`
- 复制到 Obsidian 插件目录时包含此文件
- 如果不需要，可以跳过此步骤

## 使用指南

### 为新项目设置构建系统

1. **理解核心规范**：
   - 构建产物必须输出到 `dist/{pluginName}/`
   - 必须实现自动复制到 Obsidian 插件目录
   - 必须遵守目录命名规范

2. **检查项目结构**：
   - `manifest.json` 存在且包含 `name` 和 `id` 字段
   - 确定入口文件位置（如 `src/main.ts`）
   - 确定是否需要 CSS 构建

3. **适配构建脚本**：
   - 参考 `scripts/` 目录下的示例脚本
   - 根据项目实际情况改造或替换
   - 确保遵守核心行为规范

4. **配置 package.json**：
   ```json
   {
     "scripts": {
       "build": "node scripts/build.mjs production",
       "dev": "node scripts/esbuild.config.mjs"
     }
   }
   ```

5. **验证构建结果**：
   - 检查 `dist/{pluginName}/` 目录结构
   - 验证文件已复制到目标目录
   - 确认项目根目录无构建产物

### 适配不同项目需求

**无 CSS 的项目**：
- 跳过 CSS 构建步骤
- 修改构建脚本，移除 CSS 相关逻辑
- 确保 `copyStaticFiles()` 不处理 CSS

**不使用热重载的项目**：
- 不创建 `.hotreload` 文件
- 复制时不包含此文件

**不需要自动复制的项目**：
- 可以禁用自动复制功能
- 但建议保留此功能以便开发调试

**使用其他构建工具的项目**：
- 使用 Vite/Rollup/Webpack 等工具
- 配置输出到 `dist/{pluginName}/main.js`
- 实现自动复制逻辑（参考示例）

## 参考资源

### 技术规范文档

详细的技术规范、检查清单和常见问题，参见 `references/build-system-spec.md`。

**注意**：技术规范文档中的具体实现细节仅供参考，核心是理解行为规范。

### 参考脚本（仅供参考）

- `scripts/build.mjs` - 构建入口脚本示例
- `scripts/build-css.mjs` - CSS 构建脚本示例
- `scripts/esbuild.config.mjs` - esbuild 配置脚本示例

**重要**：这些脚本是**参考实现**，不是强制要求。智能体应根据项目实际情况进行适配或替换。

## 检查清单

### 构建前检查

- [ ] `manifest.json` 存在且包含 `name` 和 `id` 字段
- [ ] 入口文件存在（如 `src/main.ts`）
- [ ] 构建脚本已配置（可以是参考脚本或自定义脚本）
- [ ] `package.json` 已配置构建命令

### 构建后验证（必须通过）

- [ ] `dist/{pluginName}/` 目录存在（使用 `manifest.name`）
- [ ] `dist/{pluginName}/main.js` 存在
- [ ] `dist/{pluginName}/manifest.json` 存在
- [ ] 项目根目录无构建产物（无 `main.js`、无 `styles.css`）
- [ ] 成功复制到 `.obsidian/plugins/{pluginId}/`（如果存在）
- [ ] 成功复制到上级目录 `.obsidian/plugins/{pluginName}/`（如果存在，使用 `manifest.name`）

### 行为一致性检查

- [ ] 构建产物位置正确：`dist/{pluginName}/`
- [ ] 目录命名规范正确：当前项目用 `id`，上级目录用 `name`
- [ ] 自动复制行为正确：复制所有文件，失败不中断构建
- [ ] CSS 处理正确：有则构建/复制，无则跳过

## 注意事项

1. **行为规范优先**：核心行为规范必须遵守，实现方式可以灵活适配
2. **字符编码**：所有输出使用 ASCII 字符，避免 Unicode 字符（如 ✓、⚠️ 等）
3. **路径处理**：使用 `path.join()` 和 `path.resolve()` 确保跨平台兼容
4. **错误处理**：复制操作失败不应中断构建过程
5. **目录名**：复制到上级目录时必须使用 `manifest.name` 而非 `manifest.id`
6. **脚本适配**：允许智能体根据项目实际情况改造构建脚本，但必须保持行为一致性

## 智能体使用指南

当使用本 skill 为项目设置构建系统时：

1. **首先理解核心规范**：明确哪些是必须遵守的行为规范
2. **检查项目现状**：了解项目已有的构建脚本和配置
3. **适配而非照搬**：根据项目实际情况改造构建脚本
4. **验证行为一致性**：确保改造后的脚本遵守核心行为规范
5. **提供参考而非强制**：参考示例脚本，但不强制使用

**关键原则**：行为规范是固定的，实现方式是灵活的。
