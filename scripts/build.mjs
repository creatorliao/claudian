#!/usr/bin/env node
/**
 * 生产：`npm run build` → CSS + esbuild，产物写入 dist/{manifest.id}/（main.js、styles.css、manifest.json）。
 * 生产结束后会尝试将 dist/{id}/ 同步到「自 cwd 向上第一个 .obsidian」下的 plugins/{id}/（找不到则静默跳过；可用 CLAUDIAN_SKIP_OBSIDIAN_SYNC 强制跳过）。
 * 开发：请使用 `npm run dev`（产物仍在仓库根目录，便于 watch）。
 */

import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPluginId } from './lib/read-plugin-id.mjs';
import { trySyncDistToNearestObsidian } from './lib/sync-dist-to-nearest-obsidian.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PLUGIN_ID = readPluginId(ROOT);
/** 与 Obsidian 插件目录一致：整文件夹复制到 .obsidian/plugins/{id} */
const DIST_PLUGIN = join(ROOT, 'dist', PLUGIN_ID);

const args = process.argv.slice(2).join(' ');
const isProd = process.argv.slice(2).includes('production');

const childEnv = isProd
  ? { ...process.env, CLAUDIAN_PLUGIN_OUT_DIR: DIST_PLUGIN }
  : { ...process.env };

if (isProd) {
  mkdirSync(DIST_PLUGIN, { recursive: true });
}

execSync('node scripts/build-css.mjs', { cwd: ROOT, stdio: 'inherit', env: childEnv });
execSync(`node esbuild.config.mjs ${args}`, { cwd: ROOT, stdio: 'inherit', env: childEnv });

if (isProd) {
  copyFileSync(join(ROOT, 'manifest.json'), join(DIST_PLUGIN, 'manifest.json'));

  // 避免与 dist/{id} 重复：清理历史遗留的仓库根目录产物
  for (const name of ['main.js', 'styles.css']) {
    const p = join(ROOT, name);
    if (existsSync(p)) {
      try {
        unlinkSync(p);
      } catch {
        // 忽略占用或只读
      }
    }
  }
  // 避免与 dist/{id} 混淆：删除曾误放在 dist/ 根下的同名文件
  for (const name of ['main.js', 'styles.css', 'manifest.json']) {
    const stale = join(ROOT, 'dist', name);
    if (existsSync(stale)) {
      try {
        unlinkSync(stale);
      } catch {
        // ignore
      }
    }
  }

  console.log(`Production bundle -> ${DIST_PLUGIN}`);
  trySyncDistToNearestObsidian(ROOT);
}
