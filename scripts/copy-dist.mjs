#!/usr/bin/env node
/**
 * 将生产构建产物复制到 dist/claudian/，便于打包或离线分发（单文件夹即插件根目录）。
 */
import { copyFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST_ROOT = join(ROOT, 'dist');
/** 与 Obsidian 插件目录结构一致：解压或复制 dist/claudian 到 .obsidian/plugins/claudian 即可 */
const DIST_PLUGIN = join(DIST_ROOT, 'claudian');

const FILES = ['main.js', 'styles.css', 'manifest.json'];
/** 仅由构建生成、位于仓库根目录的产物；复制完成后删除，避免与 dist/claudian 重复堆积 */
const ROOT_BUILD_ARTIFACTS = ['main.js', 'styles.css'];

mkdirSync(DIST_PLUGIN, { recursive: true });

for (const name of FILES) {
  const src = join(ROOT, name);
  if (!existsSync(src)) {
    console.error(`copy-dist: 缺少 ${name}，请先执行 npm run build`);
    process.exit(1);
  }
  copyFileSync(src, join(DIST_PLUGIN, name));
}

// 若曾在 dist/ 根目录生成过同名文件，删除以免与 dist/claudian/ 混淆
for (const name of FILES) {
  const stale = join(DIST_ROOT, name);
  if (existsSync(stale)) {
    try {
      unlinkSync(stale);
    } catch {
      // 忽略只读或占用导致的删除失败
    }
  }
}

// 清理仓库根目录的构建产物（manifest.json 为源码，保留）
for (const name of ROOT_BUILD_ARTIFACTS) {
  const built = join(ROOT, name);
  if (existsSync(built)) {
    try {
      unlinkSync(built);
    } catch {
      // 忽略删除失败
    }
  }
}

console.log(
  `copy-dist: 已复制 → dist/claudian/；已删除仓库根目录的 main.js、styles.css（本地调试请用 npm run dev 或再执行 build:dist）`,
);
