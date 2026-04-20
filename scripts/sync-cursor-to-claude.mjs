#!/usr/bin/env node
/**
 * 将 .cursor 下的 commands / skills / rules 以「递归复制」方式同步到 .claude，
 * 供 Claude Code CLI 与 Claudian 读取 .claude/commands、.claude/skills（内容一致，避免手写两份）。
 *
 * 不删除 .claude 根目录其它文件（如 settings.json、mcp.json）。
 *
 * 用法：
 *   node scripts/sync-cursor-to-claude.mjs
 *   node scripts/sync-cursor-to-claude.mjs --dry-run
 *   node scripts/sync-cursor-to-claude.mjs --help
 */

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CURSOR = join(ROOT, '.cursor');
const CLAUDE = join(ROOT, '.claude');

const README_SYNC = `# 与 .cursor 同步说明

以下目录由脚本从 \`.cursor\` **复制**而来，请勿在本仓库中单独维护两套文案：

- \`commands/\`  ← \`.cursor/commands/\`
- \`skills/\`    ← \`.cursor/skills/*/\`（各子目录整夹复制）
- \`rules/\`     ← \`.cursor/rules/\`

更新流程：修改 \`.cursor\` 下对应文件后执行：

\`\`\`bash
npm run sync:claude
\`\`\`

其它 \`.claude/*\`（如 \`settings.json\`、\`mcp.json\`、\`agents/\`）不由本脚本覆盖。
`;

function printHelp() {
  process.stdout.write(`用法: node scripts/sync-cursor-to-claude.mjs [选项]

从 .cursor 递归复制到 .claude（不覆盖 .claude/settings.json 等根文件）：
  .cursor/commands -> .claude/commands
  .cursor/skills/*  -> .claude/skills/*
  .cursor/rules    -> .claude/rules

选项:
  --dry-run, -n    只打印将要执行的操作
  -h, --help       显示本说明
`);
}

function parseArgs(argv) {
  if (argv.includes('-h') || argv.includes('--help')) {
    printHelp();
    process.exit(0);
  }
  return { dryRun: argv.includes('--dry-run') || argv.includes('-n') };
}

function ensureDir(p) {
  mkdirSync(p, { recursive: true });
}

/**
 * 递归复制目录：目标目录内文件与源对齐（Node cpSync 覆盖同名文件）。
 */
function copyDir(src, dest, label, dryRun) {
  if (!existsSync(src) || !statSync(src).isDirectory()) {
    process.stderr.write(`跳过（源不存在或非目录）: ${label} -> ${src}\n`);
    return;
  }
  process.stdout.write(`${dryRun ? '[dry-run] ' : ''}复制 ${src} -> ${dest}\n`);
  if (!dryRun) {
    cpSync(src, dest, { recursive: true });
  }
}

function copySkillSubdirs(dryRun) {
  const srcSkills = join(CURSOR, 'skills');
  if (!existsSync(srcSkills)) {
    process.stderr.write(`跳过 skills：无目录 ${srcSkills}\n`);
    return;
  }
  const destRoot = join(CLAUDE, 'skills');
  if (!dryRun) ensureDir(destRoot);

  const entries = readdirSync(srcSkills, { withFileTypes: true });
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const name = ent.name;
    const from = join(srcSkills, name);
    const to = join(destRoot, name);
    process.stdout.write(`${dryRun ? '[dry-run] ' : ''}复制 skill: ${from} -> ${to}\n`);
    if (!dryRun) {
      cpSync(from, to, { recursive: true });
    }
  }
}

function main() {
  const { dryRun } = parseArgs(process.argv);

  if (!existsSync(CURSOR)) {
    process.stderr.write(`错误: 未找到 ${CURSOR}\n`);
    process.exit(1);
  }

  if (!dryRun) ensureDir(CLAUDE);

  copyDir(join(CURSOR, 'commands'), join(CLAUDE, 'commands'), 'commands', dryRun);
  copySkillSubdirs(dryRun);
  copyDir(join(CURSOR, 'rules'), join(CLAUDE, 'rules'), 'rules', dryRun);

  const readmePath = join(CLAUDE, 'README-SYNC.md');
  process.stdout.write(`${dryRun ? '[dry-run] ' : ''}写入 ${readmePath}\n`);
  if (!dryRun) {
    writeFileSync(readmePath, README_SYNC, 'utf8');
  }

  process.stdout.write(dryRun ? 'dry-run 结束。\n' : 'sync:claude 完成。\n');
}

main();
