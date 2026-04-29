/**
 * 生产构建完成后：从 process.cwd() 逐级向上查找**第一个** `.obsidian`，
 * 将 dist/{manifest.id}/ 下扁平文件同步到该库的 .obsidian/plugins/{id}/。
 *
 * 未找到库时在 stdout 打印一行「产物位于 dist/{id}/」提示（便于手动复制），不向 stderr 写入。
 * 设置 CLAUDIAN_SKIP_OBSIDIAN_SYNC=1 或 true 时跳过同步。
 */

import { existsSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { copyFlatFiles } from './copy-obsidian-plugin-flat.mjs';
import { readPluginId } from './read-plugin-id.mjs';

/** 默认最多向上层数，与 publish-to-obsidian-vaults.mjs 一致 */
export const DEFAULT_MAX_DEPTH = 32;

/**
 * 自 startDir（含）起向父目录查找，返回第一个存在 `.obsidian` 目录的祖先路径（库根），找不到返回 null。
 *
 * @param {string} startDir 起始目录（通常为 process.cwd()）
 * @param {number} [maxDepth=DEFAULT_MAX_DEPTH]
 * @returns {string | null}
 */
export function findNearestObsidianVaultRoot(startDir, maxDepth = DEFAULT_MAX_DEPTH) {
  let current = resolve(startDir);
  for (let d = 0; d < maxDepth; d++) {
    const obsidianDir = join(current, '.obsidian');
    if (existsSync(obsidianDir) && statSync(obsidianDir).isDirectory()) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

/**
 * @param {string} repoRoot 仓库根目录（含 manifest.json、dist/）
 * @param {{ maxDepth?: number }} [options]
 * @returns {{ synced: boolean, reason?: string, pluginDir?: string, vaultRoot?: string }}
 */
export function trySyncDistToNearestObsidian(repoRoot, options = {}) {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const pluginId = readPluginId(repoRoot);
  const distDir = join(repoRoot, 'dist', pluginId);

  const distRelativeHint = () => {
    const rel = relative(process.cwd(), distDir).replace(/\\/g, '/');
    if (!rel || rel.startsWith('..')) {
      return join('dist', pluginId).replace(/\\/g, '/');
    }
    return rel;
  };

  const skipEnv = process.env.CLAUDIAN_SKIP_OBSIDIAN_SYNC;
  if (skipEnv === '1' || skipEnv === 'true') {
    console.log(
      `[claudian] 已跳过 Obsidian 同步（CLAUDIAN_SKIP_OBSIDIAN_SYNC）。构建产物目录：${distRelativeHint()}/`,
    );
    return { synced: false, reason: 'skipped' };
  }

  if (!existsSync(distDir) || !statSync(distDir).isDirectory()) {
    console.warn(`[claudian] 跳过 Obsidian 同步：未找到构建目录 ${distDir}`);
    return { synced: false, reason: 'no-dist' };
  }

  const vaultRoot = findNearestObsidianVaultRoot(process.cwd(), maxDepth);
  if (!vaultRoot) {
    console.log(
      `[claudian] 构建产物目录：${distRelativeHint()}/（未检测到上层 Obsidian 库，跳过复制到 .obsidian/plugins）`,
    );
    return { synced: false, reason: 'no-vault' };
  }

  const pluginDir = join(vaultRoot, '.obsidian', 'plugins', pluginId);
  copyFlatFiles(distDir, pluginDir, false);
  console.log(`[claudian] 已同步到最近 Obsidian 库: ${pluginDir}`);
  return { synced: true, pluginDir, vaultRoot };
}
