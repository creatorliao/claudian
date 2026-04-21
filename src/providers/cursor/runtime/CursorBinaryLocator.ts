import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { getEnhancedPath, parseEnvironmentVariables } from '../../../utils/env';
import { expandHomePath, parsePathEntries } from '../../../utils/path';

/**
 * Cursor IDE 安装包内的 agent 目录（与「curl | bash / PowerShell」装到 ~/.local 或 LOCALAPPDATA 不同，GUI 的 PATH 往往扫不到此处）。
 * 参考：VS Code 系产品在 `resources/app/bin` 下放可执行文件；Cursor 亦采用 `agent` CLI。
 */
export function getCursorIdeBundledAgentBinDirectories(platform: NodeJS.Platform): string[] {
  const candidates: string[] = [];

  if (platform === 'darwin') {
    candidates.push('/Applications/Cursor.app/Contents/Resources/app/bin');
    const home = os.homedir();
    if (home) {
      candidates.push(path.join(home, 'Applications', 'Cursor.app', 'Contents', 'Resources', 'app', 'bin'));
    }
  } else if (platform === 'win32') {
    const local = process.env.LOCALAPPDATA;
    if (local) {
      candidates.push(path.join(local, 'Programs', 'cursor', 'resources', 'app', 'bin'));
    }
  }

  return candidates.filter((dir) => {
    try {
      return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
    } catch {
      return false;
    }
  });
}

/** PATH 各目录下尝试的文件名（与 Cursor 官方安装布局对齐，兼顾 Windows / macOS / Linux） */
const CURSOR_AGENT_NAMES_ON_PATH_WIN32 = [
  'agent.exe',
  'agent.cmd',
  'agent.bat',
  'cursor-agent.exe',
  'cursor-agent.cmd',
  'cursor-agent.bat',
  'agent',
  'cursor-agent',
] as const;

const CURSOR_AGENT_NAMES_ON_PATH_UNIX = ['agent', 'cursor-agent'] as const;

/**
 * 官方包解压目录 `.../cursor-agent/versions/<build>/` 内常见可执行文件名。
 * Windows 优先 .exe，避免未走 shell 时误选 .cmd（由 spawn 层再处理）。
 */
const CURSOR_AGENT_NAMES_IN_VERSION_DIR_WIN32 = [
  'cursor-agent.exe',
  'agent.exe',
  'cursor-agent.cmd',
  'agent.cmd',
  'cursor-agent',
  'agent',
] as const;

const CURSOR_AGENT_NAMES_IN_VERSION_DIR_UNIX = ['cursor-agent', 'agent'] as const;

function isExistingFile(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function resolveConfiguredPath(configuredPath: string | undefined): string | null {
  const trimmed = (configuredPath ?? '').trim();
  if (!trimmed) {
    return null;
  }

  try {
    const expandedPath = expandHomePath(trimmed);
    return isExistingFile(expandedPath) ? expandedPath : null;
  } catch {
    return null;
  }
}

/**
 * 列出 Cursor Agent 官方安装根目录（用于 versions/ 回退）。
 * - Windows：`%LOCALAPPDATA%\cursor-agent`（与 PowerShell 安装脚本一致）
 * - macOS/Linux：`~/.local/share/cursor-agent`（与 curl | bash 安装一致）
 */
export function getCursorAgentDefaultInstallRoots(platform: NodeJS.Platform): string[] {
  if (platform === 'win32') {
    const local = process.env.LOCALAPPDATA;
    return local ? [path.join(local, 'cursor-agent')] : [];
  }
  const home = os.homedir();
  return home ? [path.join(home, '.local', 'share', 'cursor-agent')] : [];
}

/**
 * 在 `installRoot/versions/<build>/` 下查找可执行文件，取 **修改时间最新** 且含有效二进制 的构建目录。
 * 用于「~/.local/bin 未进 PATH」或「仅解压了 versions」等场景，与 GUI 继承的短 PATH 互补。
 */
export function findLatestCursorAgentBinaryInInstallRoot(
  installRoot: string,
  platform: NodeJS.Platform,
): string | null {
  const versionsDir = path.join(installRoot, 'versions');
  let subdirs: string[];
  try {
    subdirs = fs.readdirSync(versionsDir);
  } catch {
    return null;
  }

  const namesInVersion = platform === 'win32'
    ? CURSOR_AGENT_NAMES_IN_VERSION_DIR_WIN32
    : CURSOR_AGENT_NAMES_IN_VERSION_DIR_UNIX;

  let best: { binaryPath: string; dirMtime: number } | null = null;

  for (const name of subdirs) {
    const versionDir = path.join(versionsDir, name);
    let dirStat: fs.Stats;
    try {
      dirStat = fs.statSync(versionDir);
    } catch {
      continue;
    }
    if (!dirStat.isDirectory()) {
      continue;
    }

    for (const bin of namesInVersion) {
      const candidate = path.join(versionDir, bin);
      if (!isExistingFile(candidate)) {
        continue;
      }
      const dirMtime = dirStat.mtimeMs;
      if (!best || dirMtime > best.dirMtime) {
        best = { binaryPath: candidate, dirMtime };
      }
      break;
    }
  }

  return best?.binaryPath ?? null;
}

export function findCursorAgentBinaryPath(
  additionalPath?: string,
  platform: NodeJS.Platform = process.platform,
): string | null {
  const binaryNames = platform === 'win32'
    ? CURSOR_AGENT_NAMES_ON_PATH_WIN32
    : CURSOR_AGENT_NAMES_ON_PATH_UNIX;

  const searchEntries = parsePathEntries(getEnhancedPath(additionalPath));

  for (const dir of searchEntries) {
    if (!dir) continue;

    for (const binaryName of binaryNames) {
      const candidate = path.join(dir, binaryName);
      if (isExistingFile(candidate)) {
        return candidate;
      }
    }
  }

  // 官方独立安装包之前：优先 Cursor.app / Windows 用户级安装目录内的 bin（终端 PATH 常已包含，GUI 则常不行）
  for (const dir of getCursorIdeBundledAgentBinDirectories(platform)) {
    for (const binaryName of binaryNames) {
      const candidate = path.join(dir, binaryName);
      if (isExistingFile(candidate)) {
        return candidate;
      }
    }
  }

  for (const root of getCursorAgentDefaultInstallRoots(platform)) {
    const fromVersions = findLatestCursorAgentBinaryInInstallRoot(root, platform);
    if (fromVersions) {
      return fromVersions;
    }
  }

  return null;
}

export function resolveCursorCliPath(
  hostnamePath: string | undefined,
  legacyPath: string | undefined,
  envText: string,
  hostPlatform: NodeJS.Platform = process.platform,
): string | null {
  const configuredHostnamePath = resolveConfiguredPath(hostnamePath);
  if (configuredHostnamePath) {
    return configuredHostnamePath;
  }

  const configuredLegacyPath = resolveConfiguredPath(legacyPath);
  if (configuredLegacyPath) {
    return configuredLegacyPath;
  }

  const customEnv = parseEnvironmentVariables(envText || '');
  return findCursorAgentBinaryPath(customEnv.PATH, hostPlatform);
}
