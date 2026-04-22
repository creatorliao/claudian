/**
 * 将插件构建目录下的「仅一层」文件覆盖复制到 Obsidian 插件目录（不递归子目录）。
 * 与 Obsidian 常见插件布局一致：main.js、styles.css、manifest.json 等扁平文件。
 */

import { copyFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * @param {string} srcDir 源目录（通常为 dist/{manifest.id}/）
 * @param {string} destDir 目标目录（通常为 库/.obsidian/plugins/{id}/）
 * @param {boolean} dryRun 为 true 时只打印，不写入
 */
export function copyFlatFiles(srcDir, destDir, dryRun) {
  const names = readdirSync(srcDir);
  const files = names.filter((name) => {
    const p = join(srcDir, name);
    try {
      return statSync(p).isFile();
    } catch {
      return false;
    }
  });
  if (files.length === 0) {
    throw new Error(`源目录中没有可复制的文件: ${srcDir}`);
  }
  if (!dryRun) {
    mkdirSync(destDir, { recursive: true });
  }
  for (const name of files) {
    const from = join(srcDir, name);
    const to = join(destDir, name);
    if (dryRun) {
      process.stdout.write(`[dry-run] ${from} -> ${to}\n`);
    } else {
      copyFileSync(from, to);
    }
  }
}
