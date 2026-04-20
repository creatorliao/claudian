#!/usr/bin/env node
/**
 * 上游与社区信号采集脚本（只读 + 写调查报告素材）
 *
 * 功能：git fetch upstream、计算 merge-base、列出 HEAD..upstream/<默认分支> 的提交摘要；
 * 若已安装并登录 GitHub CLI，则拉取上游仓库的 Open Issues / Open PRs 列表。
 *
 * 约束：不向 src/tests 等业务目录写入；仅向 docs/04-Archives（或可配置 --out-dir）输出 Markdown。
 *
 * 用法：
 *   node scripts/upstream-signal-report.mjs
 *   node scripts/upstream-signal-report.mjs --no-fetch
 *   node scripts/upstream-signal-report.mjs --out-dir docs/04-Archives
 *   node scripts/upstream-signal-report.mjs --help
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_OUT = path.join(REPO_ROOT, 'docs', '04-Archives');

function sh(cmd, opts = {}) {
  return execSync(cmd, {
    encoding: 'utf8',
    cwd: REPO_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...opts,
  }).trim();
}

function shQuiet(cmd) {
  try {
    return sh(cmd);
  } catch {
    return '';
  }
}

function printHelp() {
  process.stdout.write(`用法: node scripts/upstream-signal-report.mjs [选项]

选项:
  --no-fetch           不执行 git fetch upstream
  --out-dir <路径>     输出目录（默认 docs/04-Archives）
  -h, --help           显示本说明
`);
}

function parseArgs(argv) {
  let noFetch = false;
  let outDir = DEFAULT_OUT;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') {
      printHelp();
      process.exit(0);
    }
    if (a === '--no-fetch') noFetch = true;
    else if (a === '--out-dir' && argv[i + 1]) {
      outDir = path.resolve(REPO_ROOT, argv[++i]);
    }
  }
  return { noFetch, outDir };
}

/** 从 git remote URL 解析 owner/repo（仅支持 github.com） */
function parseGithubRepoFromRemote(url) {
  if (!url) return null;
  const s = url.replace(/\.git$/i, '');
  // git@github.com:owner/repo
  const ssh = /^git@github\.com:([^/]+)\/([^/]+)$/i.exec(s);
  if (ssh) return `${ssh[1]}/${ssh[2]}`;
  // https://github.com/owner/repo
  const https = /github\.com\/([^/]+)\/([^/]+)$/i.exec(s);
  if (https) return `${https[1]}/${https[2]}`;
  return null;
}

/**
 * 解析用于对比的上游 ref（如 upstream/main）。
 * 顺序：upstream/HEAD（需 remote set-head）→ upstream/main → upstream/master → symbolic-ref。
 */
function resolveUpstreamBranch() {
  const abbrev = shQuiet('git rev-parse --abbrev-ref upstream/HEAD');
  if (abbrev && /^upstream\//.test(abbrev)) {
    return abbrev.trim();
  }
  const candidates = ['upstream/main', 'upstream/master'];
  for (const b of candidates) {
    if (shQuiet(`git rev-parse --verify ${b}`)) return b;
  }
  const sym = shQuiet('git symbolic-ref refs/remotes/upstream/HEAD');
  if (sym) {
    const short = sym.replace(/^refs\/remotes\//, '');
    if (short) return short;
  }
  return null;
}

function ghAvailable() {
  try {
    sh('gh --version');
    return true;
  } catch {
    return false;
  }
}

function ghJson(args) {
  const cmd = ['gh', ...args].join(' ');
  try {
    const out = sh(cmd);
    return JSON.parse(out || '[]');
  } catch (e) {
    return { _error: String(e?.message ?? e) };
  }
}

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return { date, time, iso: d.toISOString() };
}

function main() {
  const { noFetch, outDir } = parseArgs(process.argv);

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const upstreamUrl = shQuiet('git remote get-url upstream');
  const ghRepo = parseGithubRepoFromRemote(upstreamUrl);

  let fetchNote;
  if (!noFetch) {
    try {
      sh('git fetch upstream --prune');
      fetchNote = '已执行 `git fetch upstream --prune`。';
    } catch (e) {
      fetchNote = `fetch 失败（可检查网络与 upstream remote）：${String(e?.message ?? e)}`;
    }
  } else {
    fetchNote = '已跳过 fetch（--no-fetch）。';
  }

  const head = shQuiet('git rev-parse --abbrev-ref HEAD') || '(detached)';
  const headSha = shQuiet('git rev-parse HEAD');

  const upBranch = resolveUpstreamBranch();
  let gapSection;
  let mergeBase;
  const upBranchShort = upBranch ? upBranch.replace(/^upstream\//, '') : '（未知）';

  if (!upBranch) {
    gapSection =
      '未找到可用的上游跟踪分支（如 `upstream/HEAD`、`upstream/main`）。请确认已 `git remote add upstream <url>` 且已 fetch；必要时执行 `git remote set-head upstream -a`。';
  } else {
    mergeBase = shQuiet(`git merge-base HEAD ${upBranch}`);
    const count = shQuiet(`git rev-list --count HEAD..${upBranch}`) || '?';
    const oneline = shQuiet(`git log --oneline -n 120 HEAD..${upBranch}`) || '(无)';
    gapSection = [
      `- 当前分支：\`${head}\` @ \`${headSha.slice(0, 7)}\``,
      `- 上游跟踪：\`${upBranch}\``,
      `- merge-base：\`${mergeBase || '（无法计算）'}\``,
      `- \`HEAD..${upBranch}\` 提交数：**${count}**`,
      '',
      '```text',
      oneline,
      '```',
    ].join('\n');
  }

  let ghSection;
  if (!ghRepo) {
    ghSection = '无法从 `upstream` remote URL 解析 GitHub 仓库，已跳过 Issues/PRs。';
  } else if (!ghAvailable()) {
    ghSection =
      '未检测到 `gh` CLI 或不可用。安装并执行 `gh auth login` 后可自动拉取 Issues/PRs。';
  } else {
    const issues = ghJson([
      'issue',
      'list',
      '--repo',
      ghRepo,
      '--state',
      'open',
      '--limit',
      '40',
      '--json',
      'number,title,labels,updatedAt,url,author',
    ]);
    const prs = ghJson([
      'pr',
      'list',
      '--repo',
      ghRepo,
      '--state',
      'open',
      '--limit',
      '40',
      '--json',
      'number,title,updatedAt,url,author,isDraft',
    ]);

    const fmtIssues = Array.isArray(issues)
      ? issues
          .map((i) => {
            const labels = (i.labels ?? []).map((l) => l.name).join(', ');
            return `- #${i.number} [${i.title}](${i.url}) — @${i.author?.login ?? '?'} — 更新 ${i.updatedAt}${labels ? ` — labels: ${labels}` : ''}`;
          })
          .join('\n')
      : `\`gh issue list\` 失败：${issues._error ?? JSON.stringify(issues)}`;

    const fmtPrs = Array.isArray(prs)
      ? prs
          .map((p) => {
            const draft = p.isDraft ? ' draft' : '';
            return `- #${p.number} [${p.title}](${p.url}) — @${p.author?.login ?? '?'} — 更新 ${p.updatedAt}${draft}`;
          })
          .join('\n')
      : `\`gh pr list\` 失败：${prs._error ?? JSON.stringify(prs)}`;

    ghSection = [
      `上游仓库（GitHub）：\`${ghRepo}\``,
      '',
      '### Open Issues（节选）',
      fmtIssues || '(无)',
      '',
      '### Open PRs（节选）',
      fmtPrs || '(无)',
    ].join('\n');
  }

  const { date, time, iso } = nowStamp();
  const baseName = `上游社区信号_采集_${date}_${time}.md`;
  const outFile = path.join(outDir, baseName);

  const md = [
    '---',
    `report_type: upstream-community-signal-raw`,
    `generated_at: ${iso}`,
    `local_head_branch: ${head}`,
    `upstream_remote: ${upstreamUrl || '(无)'}`,
    `upstream_compare_branch: ${upBranch || '(无)'}`,
    '---',
    '',
    `# 上游与社区信号 — 原始采集`,
    '',
    `> 由 \`scripts/upstream-signal-report.mjs\` 生成。仅事实采集；**价值优先级研判**请使用项目 Skill「上游社区信号调查报告」由智能体补充，或手工编辑本节下方占位。`,
    '',
    '## 采集说明',
    '',
    fetchNote,
    '',
    `## 1. 代码缺口（HEAD..upstream/${upBranchShort}）`,
    '',
    `对应最佳实践：以 \`git log HEAD..${upBranch || 'upstream/<默认分支>'}\` 为「待合入」真相来源（本机当前解析为 \`${upBranch || '未解析'}\`）。`,
    '',
    gapSection,
    '',
    '## 2. 社区信号（Issues / PRs）',
    '',
    '对应最佳实践：Issue 看风险与复现；Open PR 看机会与维护成本。以下仅为列表快照。',
    '',
    ghSection,
    '',
    '## 3. 价值优先级研判（占位）',
    '',
    '_（请由智能体根据 `docs/02-Areas/最佳实践_fork-同步上游与社区信号筛选.md` 填写：P0/P1/P2，并说明对你方 fork 的理由。本脚本不会自动填写。）_',
    '',
  ].join('\n');

  fs.writeFileSync(outFile, md, { encoding: 'utf8' });
  process.stdout.write(`${outFile}\n`);
}

main();
