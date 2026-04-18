import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { parsePathEntries, resolveNvmDefaultBin } from '../../../utils/path';

/** 与逻辑平台一致地拼接路径：jest 在 Windows 上把 platform mock 成 darwin 时，须用 posix.join 才能与 Unix 风格桩路径一致 */
function joinPath(isWindows: boolean, ...segments: string[]): string {
  return (isWindows ? path.win32 : path.posix).join(...segments);
}

function pathBasename(isWindows: boolean, p: string): string {
  return (isWindows ? path.win32 : path.posix).basename(p);
}

function pathDirname(isWindows: boolean, p: string): string {
  return (isWindows ? path.win32 : path.posix).dirname(p);
}

function getEnvValue(name: string): string | undefined {
  return process.env[name];
}

function dedupePaths(entries: string[]): string[] {
  const seen = new Set<string>();
  return entries.filter(entry => {
    const key = process.platform === 'win32' ? entry.toLowerCase() : entry;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function findFirstExistingPath(entries: string[], candidates: string[], isWindows: boolean): string | null {
  for (const dir of entries) {
    if (!dir) continue;
    for (const candidate of candidates) {
      const fullPath = joinPath(isWindows, dir, candidate);
      if (isExistingFile(fullPath)) {
        return fullPath;
      }
    }
  }
  return null;
}

function isExistingFile(filePath: string): boolean {
  try {
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      return stat.isFile();
    }
  } catch {
    // Inaccessible path
  }
  return false;
}

function resolveCliJsNearPathEntry(entry: string, isWindows: boolean): string | null {
  const directCandidate = joinPath(isWindows, entry, 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js');
  if (isExistingFile(directCandidate)) {
    return directCandidate;
  }

  const baseName = pathBasename(isWindows, entry).toLowerCase();
  if (baseName === 'bin') {
    const prefix = pathDirname(isWindows, entry);
    const candidate = isWindows
      ? joinPath(isWindows, prefix, 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js')
      : joinPath(isWindows, prefix, 'lib', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js');
    if (isExistingFile(candidate)) {
      return candidate;
    }
  }

  return null;
}

function resolveCliJsFromPathEntries(entries: string[], isWindows: boolean): string | null {
  for (const entry of entries) {
    const candidate = resolveCliJsNearPathEntry(entry, isWindows);
    if (candidate) {
      return candidate;
    }
  }
  return null;
}

function resolveClaudeFromPathEntries(
  entries: string[],
  isWindows: boolean
): string | null {
  if (entries.length === 0) {
    return null;
  }

  if (!isWindows) {
    const unixCandidate = findFirstExistingPath(entries, ['claude'], false);
    return unixCandidate;
  }

  const exeCandidate = findFirstExistingPath(entries, ['claude.exe', 'claude'], true);
  if (exeCandidate) {
    return exeCandidate;
  }

  const cliJsCandidate = resolveCliJsFromPathEntries(entries, isWindows);
  if (cliJsCandidate) {
    return cliJsCandidate;
  }

  return null;
}

function getNpmGlobalPrefix(): string | null {
  if (process.env.npm_config_prefix) {
    return process.env.npm_config_prefix;
  }

  if (process.platform === 'win32') {
    const appDataNpm = process.env.APPDATA
      ? path.win32.join(process.env.APPDATA, 'npm')
      : null;
    if (appDataNpm && fs.existsSync(appDataNpm)) {
      return appDataNpm;
    }
  }

  return null;
}

function getNpmCliJsPaths(): string[] {
  const homeDir = os.homedir();
  const isWindows = process.platform === 'win32';
  const cliJsPaths: string[] = [];

  if (isWindows) {
    cliJsPaths.push(
      joinPath(true, homeDir, 'AppData', 'Roaming', 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js')
    );

    const npmPrefix = getNpmGlobalPrefix();
    if (npmPrefix) {
      cliJsPaths.push(
        joinPath(true, npmPrefix, 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js')
      );
    }

    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

    cliJsPaths.push(
      joinPath(true, programFiles, 'nodejs', 'node_global', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js'),
      joinPath(true, programFilesX86, 'nodejs', 'node_global', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js')
    );

    cliJsPaths.push(
      joinPath(true, 'D:', 'Program Files', 'nodejs', 'node_global', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js')
    );
  } else {
    cliJsPaths.push(
      joinPath(false, homeDir, '.npm-global', 'lib', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js'),
      '/usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js',
      '/usr/lib/node_modules/@anthropic-ai/claude-code/cli.js'
    );

    if (process.env.npm_config_prefix) {
      cliJsPaths.push(
        joinPath(false, process.env.npm_config_prefix, 'lib', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js')
      );
    }
  }

  return cliJsPaths;
}

export function findClaudeCLIPath(pathValue?: string): string | null {
  const homeDir = os.homedir();
  const isWindows = process.platform === 'win32';

  const customEntries = dedupePaths(parsePathEntries(pathValue));

  if (customEntries.length > 0) {
    const customResolution = resolveClaudeFromPathEntries(customEntries, isWindows);
    if (customResolution) {
      return customResolution;
    }
  }

  // On Windows, prefer native .exe, then cli.js. Avoid .cmd fallback
  // because it requires shell: true and breaks SDK stdio streaming.
  if (isWindows) {
    const exePaths: string[] = [
      joinPath(true, homeDir, '.claude', 'local', 'claude.exe'),
      joinPath(true, homeDir, 'AppData', 'Local', 'Claude', 'claude.exe'),
      joinPath(true, process.env.ProgramFiles || 'C:\\Program Files', 'Claude', 'claude.exe'),
      joinPath(true, process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Claude', 'claude.exe'),
      joinPath(true, homeDir, '.local', 'bin', 'claude.exe'),
    ];

    for (const p of exePaths) {
      if (isExistingFile(p)) {
        return p;
      }
    }

    const cliJsPaths = getNpmCliJsPaths();
    for (const p of cliJsPaths) {
      if (isExistingFile(p)) {
        return p;
      }
    }

  }

  const commonPaths: string[] = [
    joinPath(isWindows, homeDir, '.claude', 'local', 'claude'),
    joinPath(isWindows, homeDir, '.local', 'bin', 'claude'),
    joinPath(isWindows, homeDir, '.volta', 'bin', 'claude'),
    joinPath(isWindows, homeDir, '.asdf', 'shims', 'claude'),
    joinPath(isWindows, homeDir, '.asdf', 'bin', 'claude'),
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
    joinPath(isWindows, homeDir, 'bin', 'claude'),
    joinPath(isWindows, homeDir, '.npm-global', 'bin', 'claude'),
  ];

  const npmPrefix = getNpmGlobalPrefix();
  if (npmPrefix) {
    commonPaths.push(joinPath(isWindows, npmPrefix, 'bin', 'claude'));
  }

  // NVM: resolve default version bin when NVM_BIN env var is not available (GUI apps)
  const nvmBin = resolveNvmDefaultBin(homeDir);
  if (nvmBin) {
    commonPaths.push(joinPath(isWindows, nvmBin, 'claude'));
  }

  for (const p of commonPaths) {
    if (isExistingFile(p)) {
      return p;
    }
  }

  if (!isWindows) {
    const cliJsPaths = getNpmCliJsPaths();
    for (const p of cliJsPaths) {
      if (isExistingFile(p)) {
        return p;
      }
    }
  }

  const envEntries = dedupePaths(parsePathEntries(getEnvValue('PATH')));
  if (envEntries.length > 0) {
    const envResolution = resolveClaudeFromPathEntries(envEntries, isWindows);
    if (envResolution) {
      return envResolution;
    }
  }

  return null;
}
