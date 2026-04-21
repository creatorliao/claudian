import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { getEnhancedPath, parseEnvironmentVariables } from '../../../utils/env';
import { expandHomePath, parsePathEntries } from '../../../utils/path';

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

function dedupeSearchDirectories(dirs: string[], platform: NodeJS.Platform): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const d of dirs) {
    if (!d) continue;
    const key = platform === 'win32' ? d.toLowerCase() : d;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(d);
  }
  return out;
}

/**
 * npm / yarn / pnpm 等自定义全局前缀目录（`getEnhancedPath` 已含常见路径，此处补齐 env 与前缀目录，便于 GUI 短 PATH 仍能找到 `codex`）。
 * 文档参考：`npm i -g @openai/codex`、Homebrew、自定义 `npm config set prefix`。
 */
export function getCodexSupplementalSearchDirectories(platform: NodeJS.Platform): string[] {
  const dirs: string[] = [];
  const home = os.homedir();

  const npmPrefix = process.env.npm_config_prefix?.trim()
    || process.env.NPM_CONFIG_PREFIX?.trim()
    || process.env.NPM_PREFIX?.trim();

  if (npmPrefix) {
    if (platform === 'win32') {
      // Windows 下 npm 全局 `.cmd` 多置于 prefix 根目录
      dirs.push(npmPrefix);
    } else {
      dirs.push(path.join(npmPrefix, 'bin'));
    }
  }

  const pnpmHome = process.env.PNPM_HOME?.trim();
  if (pnpmHome) {
    dirs.push(platform === 'win32' ? pnpmHome : path.join(pnpmHome, 'bin'));
  }

  if (home) {
    dirs.push(path.join(home, '.npm-global', 'bin'));
    dirs.push(path.join(home, '.yarn', 'bin'));
  }

  if (platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      dirs.push(path.join(localAppData, 'pnpm'));
    }
  }

  return dedupeSearchDirectories(
    dirs.filter((dir) => {
      try {
        return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
      } catch {
        return false;
      }
    }),
    platform,
  );
}

export function isWindowsStyleCliReference(value: string | null | undefined): boolean {
  const trimmed = (value ?? '').trim();
  if (!trimmed) {
    return false;
  }

  return /^[A-Za-z]:[\\/]/.test(trimmed)
    || trimmed.startsWith('\\\\')
    || /\.(?:exe|cmd|bat|ps1)$/i.test(trimmed);
}

export function findCodexBinaryPath(
  additionalPath?: string,
  platform: NodeJS.Platform = process.platform,
): string | null {
  const binaryNames = platform === 'win32'
    ? ['codex.exe', 'codex.cmd', 'codex']
    : ['codex'];

  const mergedDirs = dedupeSearchDirectories(
    [
      ...parsePathEntries(getEnhancedPath(additionalPath)),
      ...getCodexSupplementalSearchDirectories(platform),
    ],
    platform,
  );

  for (const dir of mergedDirs) {
    if (!dir) continue;

    for (const binaryName of binaryNames) {
      const candidate = path.join(dir, binaryName);
      if (isExistingFile(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

export function resolveCodexCliPath(
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
  return findCodexBinaryPath(customEnv.PATH, hostPlatform);
}
