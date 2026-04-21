import * as path from 'path';

import type { CodexExecutionTarget, CodexPathMapper } from './codexLaunchTypes';

function normalizeWindowsPath(value: string): string {
  if (!value) {
    return '';
  }

  let normalized = value.replace(/\//g, '\\');
  if (normalized.startsWith('\\\\?\\UNC\\')) {
    normalized = `\\\\${normalized.slice('\\\\?\\UNC\\'.length)}`;
  } else if (normalized.startsWith('\\\\?\\')) {
    normalized = normalized.slice('\\\\?\\'.length);
  }

  return path.win32.normalize(normalized);
}

function normalizePosixPath(value: string): string {
  if (!value) {
    return '';
  }

  const normalized = path.posix.normalize(value.replace(/\\/g, '/'));
  return normalized === '/' ? normalized : normalized.replace(/\/+$/, '');
}

function createIdentityMapper(target: CodexExecutionTarget): CodexPathMapper {
  return {
    target,
    toTargetPath(hostPath: string): string | null {
      if (!hostPath) {
        return null;
      }

      return target.platformFamily === 'windows'
        ? normalizeWindowsPath(hostPath)
        : normalizePosixPath(hostPath);
    },
    toHostPath(targetPath: string): string | null {
      if (!targetPath) {
        return null;
      }

      return target.platformFamily === 'windows'
        ? normalizeWindowsPath(targetPath)
        : normalizePosixPath(targetPath);
    },
    mapTargetPathList(hostPaths: string[]): string[] {
      return hostPaths
        .map(hostPath => this.toTargetPath(hostPath))
        .filter((value): value is string => typeof value === 'string' && value.length > 0);
    },
    canRepresentHostPath(hostPath: string): boolean {
      return this.toTargetPath(hostPath) !== null;
    },
  };
}

export function createCodexPathMapper(target: CodexExecutionTarget): CodexPathMapper {
  return createIdentityMapper(target);
}
