#!/usr/bin/env node
/**
 * 从仓库根目录向上逐层查找 `.obsidian`，将生产构建产物 dist/{pluginId}/ 下的文件
 * 全量覆盖复制到每个命中的 `{vault}/.obsidian/plugins/{pluginId}/`，便于发版后立即在 Obsidian 里验证。
 *
 * 前置条件：已执行 `npm run build`（或 `node scripts/build.mjs production`），dist 目录存在且非空。
 *
 * 用法：
 *   node scripts/publish-to-obsidian-vaults.mjs
 *   node scripts/publish-to-obsidian-vaults.mjs --dry-run
 *   node scripts/publish-to-obsidian-vaults.mjs --max-depth 25
 *   node scripts/publish-to-obsidian-vaults.mjs --help
 */

import { existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyFlatFiles } from './lib/copy-obsidian-plugin-flat.mjs';
import { readPluginId } from './lib/read-plugin-id.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

/** 默认最多向上层数，防止异常挂载导致长时间遍历 */
const DEFAULT_MAX_DEPTH = 32;

function printHelp() {
  process.stdout.write(`用法: node scripts/publish-to-obsidian-vaults.mjs [选项]

从项目根目录向上查找任意包含 .obsidian 的目录（视为 Obsidian 库根），
将 dist/{manifest.id}/ 内文件复制到 库/.obsidian/plugins/{id}/。

选项:
  --dry-run              只打印将要复制的目标，不写入
  --max-depth <n>        最多向上查找层数（默认 ${DEFAULT_MAX_DEPTH}）
  -h, --help             显示本说明
`);
}

function parseArgs(argv) {
  let dryRun = false;
  let maxDepth = DEFAULT_MAX_DEPTH;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') {
      printHelp();
      process.exit(0);
    }
    if (a === '--dry-run') dryRun = true;
    else if (a === '--max-depth' && argv[i + 1]) {
      const n = Number.parseInt(argv[++i], 10);
      if (Number.isFinite(n) && n > 0) maxDepth = n;
    }
  }
  return { dryRun, maxDepth };
}

/**
 * 收集从 startDir 向上直到根路径的所有目录（含 startDir）。
 */
function walkAncestors(startDir, maxDepth) {
  const dirs = [];
  let current = resolve(startDir);
  for (let d = 0; d < maxDepth; d++) {
    dirs.push(current);
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return dirs;
}

function main() {
  const { dryRun, maxDepth } = parseArgs(process.argv);
  const pluginId = readPluginId(REPO_ROOT);
  const distDir = join(REPO_ROOT, 'dist', pluginId);

  if (!existsSync(distDir) || !statSync(distDir).isDirectory()) {
    process.stderr.write(
      `错误: 未找到构建目录 ${distDir}。请先执行: npm run build\n`,
    );
    process.exit(1);
  }

  const ancestors = walkAncestors(REPO_ROOT, maxDepth);
  /** @type {string[]} 已写入的插件目录绝对路径，避免重复复制 */
  const installedTo = [];

  for (const vaultCandidate of ancestors) {
    const obsidianDir = join(vaultCandidate, '.obsidian');
    if (!existsSync(obsidianDir) || !statSync(obsidianDir).isDirectory()) {
      continue;
    }
    const pluginDir = join(obsidianDir, 'plugins', pluginId);
    const key = resolve(pluginDir);
    if (installedTo.includes(key)) continue;

    process.stdout.write(
      `${dryRun ? '[dry-run] ' : ''}安装到库: ${vaultCandidate}\n  -> ${pluginDir}\n`,
    );
    copyFlatFiles(distDir, pluginDir, dryRun);
    installedTo.push(key);
  }

  if (installedTo.length === 0) {
    process.stderr.write(
      `未在向上 ${maxDepth} 层内找到任何 .obsidian 目录。` +
        `请确认仓库位于某个 Obsidian 库路径之下，或提高 --max-depth。\n`,
    );
    process.exit(2);
  }

  process.stdout.write(
    `完成: 已${dryRun ? '预览' : '复制'}到 ${installedTo.length} 个 .obsidian/plugins/${pluginId}。\n`,
  );
}

main();
