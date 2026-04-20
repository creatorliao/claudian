/**
 * 从 manifest.json 读取插件 id，供构建产物目录与 Obsidian 插件路径共用。
 * 单一事实来源，避免 scripts 与 esbuild 硬编码分叉。
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * @param {string} repoRoot 仓库根目录（含 manifest.json）
 * @returns {string} manifest.id
 */
export function readPluginId(repoRoot) {
  const manifestPath = join(repoRoot, 'manifest.json');
  const raw = readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(raw);
  if (typeof manifest.id !== 'string' || !manifest.id.trim()) {
    throw new Error(`manifest.json 必须包含非空字符串字段 "id"（当前为 ${JSON.stringify(manifest.id)}）`);
  }
  return manifest.id.trim();
}
