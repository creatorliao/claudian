import * as fs from 'fs';
import type { App } from 'obsidian';
import * as os from 'os';
import * as path from 'path';

export function getVaultPath(app: App): string | null {
  const basePath = (app.vault?.adapter as { basePath?: unknown } | undefined)?.basePath;
  return typeof basePath === 'string' ? basePath : null;
}

function getEnvValue(key: string): string | undefined {
  const hasKey = (name: string) => Object.prototype.hasOwnProperty.call(process.env, name);

  if (hasKey(key)) {
    return process.env[key];
  }

  if (process.platform !== 'win32') {
    return undefined;
  }

  const upper = key.toUpperCase();
  if (hasKey(upper)) {
    return process.env[upper];
  }

  const lower = key.toLowerCase();
  if (hasKey(lower)) {
    return process.env[lower];
  }

  const matchKey = Object.keys(process.env).find((name) => name.toLowerCase() === key.toLowerCase());
  return matchKey ? process.env[matchKey] : undefined;
}

function expandEnvironmentVariables(value: string): string {
  if (!value.includes('%') && !value.includes('$') && !value.includes('!')) {
    return value;
  }

  const isWindows = process.platform === 'win32';
  let expanded = value;

  // Windows %VAR% format - allow parentheses for vars like %ProgramFiles(x86)%
  expanded = expanded.replace(/%([A-Za-z_][A-Za-z0-9_]*(?:\([A-Za-z0-9_]+\))?[A-Za-z0-9_]*)%/g, (match, name) => {
    const envValue = getEnvValue(name);
    return envValue !== undefined ? envValue : match;
  });

  if (isWindows) {
    expanded = expanded.replace(/!([A-Za-z_][A-Za-z0-9_]*)!/g, (match, name) => {
      const envValue = getEnvValue(name);
      return envValue !== undefined ? envValue : match;
    });

    expanded = expanded.replace(/\$env:([A-Za-z_][A-Za-z0-9_]*)/gi, (match, name) => {
      const envValue = getEnvValue(name);
      return envValue !== undefined ? envValue : match;
    });
  }

  expanded = expanded.replace(/\$([A-Za-z_][A-Za-z0-9_]*)|\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (match, name1, name2) => {
    const key = name1 ?? name2;
    if (!key) return match;
    const envValue = getEnvValue(key);
    return envValue !== undefined ? envValue : match;
  });

  return expanded;
}

export function expandHomePath(p: string): string {
  const expanded = expandEnvironmentVariables(p);
  if (expanded === '~') {
    return os.homedir();
  }
  if (expanded.startsWith('~/')) {
    return path.join(os.homedir(), expanded.slice(2));
  }
  if (expanded.startsWith('~\\')) {
    return path.join(os.homedir(), expanded.slice(2));
  }
  return expanded;
}

function stripSurroundingQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

export function parsePathEntries(pathValue?: string): string[] {
  if (!pathValue) {
    return [];
  }

  const delimiter = process.platform === 'win32' ? ';' : ':';

  return pathValue
    .split(delimiter)
    .map(segment => stripSurroundingQuotes(segment.trim()))
    .filter(segment => {
      if (!segment) return false;
      const upper = segment.toUpperCase();
      return upper !== '$PATH' && upper !== '${PATH}' && upper !== '%PATH%';
    })
    .map(segment => translateMsysPath(expandHomePath(segment)));
}


const NVM_LATEST_INSTALLED_ALIASES = new Set(['node', 'stable']);

function isNvmBuiltInLatestAlias(alias: string): boolean {
  return NVM_LATEST_INSTALLED_ALIASES.has(alias);
}

function findMatchingNvmVersion(entries: string[], resolvedAlias: string): string | undefined {
  if (isNvmBuiltInLatestAlias(resolvedAlias)) {
    return entries[0];
  }

  const version = resolvedAlias.replace(/^v/, '');
  return entries.find(entry => {
    const entryVersion = entry.slice(1); // strip 'v'
    return entryVersion === version || entryVersion.startsWith(version + '.');
  });
}

function resolveNvmAlias(nvmDir: string, alias: string, depth = 0): string | null {
  if (depth > 5) return null;

  if (/^\d/.test(alias) || alias.startsWith('v')) return alias;
  if (isNvmBuiltInLatestAlias(alias)) return alias;

  try {
    const aliasFile = path.join(nvmDir, 'alias', ...alias.split('/'));
    const target = fs.readFileSync(aliasFile, 'utf8').trim();
    if (!target) return null;
    return resolveNvmAlias(nvmDir, target, depth + 1);
  } catch {
    return null;
  }
}

// GUI apps don't have NVM_BIN set, so we resolve nvm's default alias
// from the filesystem and match against installed versions.
export function resolveNvmDefaultBin(home: string): string | null {
  const nvmDir = process.env.NVM_DIR || path.join(home, '.nvm');

  try {
    const alias = fs.readFileSync(path.join(nvmDir, 'alias', 'default'), 'utf8').trim();
    if (!alias) return null;

    const resolved = resolveNvmAlias(nvmDir, alias);
    if (!resolved) return null;

    const versionsDir = path.join(nvmDir, 'versions', 'node');
    const entries = fs.readdirSync(versionsDir)
      .filter(entry => entry.startsWith('v'))
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

    const matched = findMatchingNvmVersion(entries, resolved);

    if (matched) {
      const binDir = path.join(versionsDir, matched, 'bin');
      if (fs.existsSync(binDir)) return binDir;
    }
  } catch {
    // nvm not installed
  }

  return null;
}

// Best-effort realpath: if the full path doesn't exist, resolve the nearest
// existing ancestor and re-append the remaining segments.
function resolveRealPath(p: string): string {
  const realpathFn = (fs.realpathSync.native ?? fs.realpathSync) as (path: fs.PathLike) => string;

  try {
    return realpathFn(p);
  } catch {
    const absolute = path.resolve(p);
    let current = absolute;
    const suffix: string[] = [];

    for (;;) {
      try {
        if (fs.existsSync(current)) {
          const resolvedExisting = realpathFn(current);
          return suffix.length > 0
            ? path.join(resolvedExisting, ...suffix.reverse())
            : resolvedExisting;
        }
      } catch {
        // Keep walking up
      }

      const parent = path.dirname(current);
      if (parent === current) {
        return absolute;
      }

      suffix.push(path.basename(current));
      current = parent;
    }
  }
}

// Translates MSYS/Git Bash paths (/c/Users/...) to Windows paths (C:\Users\...).
// Must be called before path.resolve() or path.isAbsolute().
export function translateMsysPath(value: string): string {
  if (process.platform !== 'win32') {
    return value;
  }

  const msysMatch = value.match(/^\/([a-zA-Z])(\/.*)?$/);
  if (msysMatch) {
    const driveLetter = msysMatch[1].toUpperCase();
    const restOfPath = msysMatch[2] ?? '';
    return `${driveLetter}:${restOfPath.replace(/\//g, '\\')}`;
  }

  return value;
}

function normalizePathBeforeResolution(p: string): string {
  const expanded = expandHomePath(p);
  return translateMsysPath(expanded);
}

function normalizeWindowsPathPrefix(value: string): string {
  if (process.platform !== 'win32') {
    return value;
  }

  const normalized = translateMsysPath(value);

  if (normalized.startsWith('\\\\?\\UNC\\')) {
    return `\\\\${normalized.slice('\\\\?\\UNC\\'.length)}`;
  }

  if (normalized.startsWith('\\\\?\\')) {
    return normalized.slice('\\\\?\\'.length);
  }

  return normalized;
}

export function normalizePathForFilesystem(value: string): string {
  if (!value || typeof value !== 'string') {
    return '';
  }
  const expanded = normalizePathBeforeResolution(value);
  const pathImpl = process.platform === 'win32' ? path.win32 : path.posix;
  const normalized = (() => {
    try {
      return pathImpl.normalize(expanded);
    } catch {
      return expanded;
    }
  })();

  return normalizeWindowsPathPrefix(normalized);
}

export function normalizePathForComparison(value: string): string {
  if (!value || typeof value !== 'string') {
    return '';
  }

  const expanded = normalizePathBeforeResolution(value);
  const pathImpl = process.platform === 'win32' ? path.win32 : path.posix;
  const normalized = (() => {
    try {
      return pathImpl.normalize(expanded);
    } catch {
      return expanded;
    }
  })();

  let normalizedWithPrefix = normalizeWindowsPathPrefix(normalized)
    .replace(/\\/g, '/')
    .replace(/\/+$/, '');

  // Windows：path.win32.normalize 会把单独的盘符 "A:" 变成 "A:."（当前目录语义），
  // 导致与 MSYS 风格的 "/a" 不一致，父路径前缀判断（如 externalContext）在 jest 于 win32 上跑 Unix 用例时失败。
  if (process.platform === 'win32') {
    normalizedWithPrefix = normalizedWithPrefix.replace(/^([a-zA-Z]):\.$/, '$1:');
    normalizedWithPrefix = normalizedWithPrefix.toLowerCase();
  }

  return normalizedWithPrefix;
}

export function isPathWithinDirectory(
  candidatePath: string,
  directoryPath: string,
  relativeBasePath?: string,
): boolean {
  if (!candidatePath || !directoryPath) {
    return false;
  }

  const directoryReal = normalizePathForComparison(resolveRealPath(directoryPath));
  const normalizedCandidate = normalizePathForFilesystem(candidatePath);
  if (!normalizedCandidate) {
    return false;
  }

  const absCandidate = path.isAbsolute(normalizedCandidate)
    ? normalizedCandidate
    : path.resolve(relativeBasePath ?? directoryPath, normalizedCandidate);

  const resolvedCandidate = normalizePathForComparison(resolveRealPath(absCandidate));
  return resolvedCandidate === directoryReal || resolvedCandidate.startsWith(directoryReal + '/');
}

export function isPathWithinVault(candidatePath: string, vaultPath: string): boolean {
  return isPathWithinDirectory(candidatePath, vaultPath, vaultPath);
}

export function normalizePathForVault(
  rawPath: string | undefined | null,
  vaultPath: string | null | undefined
): string | null {
  if (!rawPath) return null;

  const normalizedRaw = normalizePathForFilesystem(rawPath);
  if (!normalizedRaw) return null;

  if (vaultPath && isPathWithinVault(normalizedRaw, vaultPath)) {
    const absolute = path.isAbsolute(normalizedRaw)
      ? normalizedRaw
      : path.resolve(vaultPath, normalizedRaw);
    const relative = path.relative(vaultPath, absolute);
    return relative ? relative.replace(/\\/g, '/') : null;
  }

  return normalizedRaw.replace(/\\/g, '/');
}

/**
 * 将绝对工作目录转为 Vault 相对路径（供文档胶囊等按工作空间过滤）。
 * 若不在 Vault 内或无法解析则返回 null。
 */
export function absoluteWorkspaceToVaultRelative(
  absoluteWorkspace: string | null | undefined,
  vaultPath: string | null,
): string | null {
  if (!vaultPath || !absoluteWorkspace?.trim()) return null;
  const normalized = normalizePathForFilesystem(absoluteWorkspace.trim());
  if (!normalized) return null;
  if (!isPathWithinVault(normalized, vaultPath)) return null;
  const rel = path.relative(vaultPath, normalized);
  return rel ? rel.replace(/\\/g, '/') : null;
}

/**
 * 解析持久化或 Tab 快照中的工作目录为绝对路径。
 * 必须在 Vault 内、存在且为目录；否则返回 null（调用方视为 Vault 根）。
 */
export function resolveWorkspacePath(
  rawWorkspace: string | null | undefined,
  vaultPath: string | null,
): string | null {
  if (!vaultPath || !rawWorkspace?.trim()) return null;
  const normalized = normalizePathForFilesystem(rawWorkspace.trim());
  if (!normalized) return null;
  const absolute = path.isAbsolute(normalized)
    ? normalized
    : path.join(vaultPath, normalized);
  if (!isPathWithinVault(absolute, vaultPath)) return null;
  try {
    const stat = fs.statSync(absolute);
    if (!stat.isDirectory()) return null;
  } catch {
    return null;
  }
  return absolute;
}

/**
 * 判断 Vault 相对路径的文件是否落在给定工作空间（Vault 相对）内。
 * workspace 为空或 null 表示整个 Vault。
 */
export function isFileInWorkspaceVaultRelative(
  fileVaultRelativePath: string,
  workspaceVaultRelative: string | null | undefined,
): boolean {
  if (!workspaceVaultRelative || workspaceVaultRelative === '') return true;
  const normFile = fileVaultRelativePath.replace(/\\/g, '/');
  const normWs = workspaceVaultRelative.replace(/\\/g, '/');
  return normFile === normWs || normFile.startsWith(`${normWs}/`);
}

/**
 * 标题区 / Ribbon 用的简短展示（相对 Vault 的最后一级或末两级）。
 */
export function formatWorkspaceDisplayShort(
  absoluteWorkspace: string | null | undefined,
  vaultPath: string | null,
): string {
  if (!vaultPath || !absoluteWorkspace?.trim()) return '';
  const normalized = normalizePathForFilesystem(absoluteWorkspace.trim());
  if (!normalized || !isPathWithinVault(normalized, vaultPath)) return '';
  const rel = path.relative(vaultPath, normalized).replace(/\\/g, '/');
  if (!rel || rel === '.') return '';
  const parts = rel.split('/').filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length <= 2) return parts.join('/');
  return parts[parts.length - 1] ?? '';
}
