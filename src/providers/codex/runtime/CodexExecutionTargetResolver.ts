import type {
  CodexExecutionPlatformFamily,
  CodexExecutionPlatformOs,
  CodexExecutionTarget,
} from './codexLaunchTypes';

export interface ResolveCodexExecutionTargetOptions {
  hostPlatform?: NodeJS.Platform;
}

function resolveHostPlatformOs(hostPlatform: NodeJS.Platform): CodexExecutionPlatformOs {
  if (hostPlatform === 'win32') {
    return 'windows';
  }

  if (hostPlatform === 'darwin') {
    return 'macos';
  }

  return 'linux';
}

function resolveHostPlatformFamily(hostPlatform: NodeJS.Platform): CodexExecutionPlatformFamily {
  return hostPlatform === 'win32' ? 'windows' : 'unix';
}

/**
 * Codex 仅支持本机直接启动 CLI（Windows 为原生进程，不再提供 WSL 模式）。
 */
export function resolveCodexExecutionTarget(
  options: ResolveCodexExecutionTargetOptions = {},
): CodexExecutionTarget {
  const hostPlatform = options.hostPlatform ?? process.platform;
  if (hostPlatform !== 'win32') {
    return {
      method: 'host-native',
      platformFamily: resolveHostPlatformFamily(hostPlatform),
      platformOs: resolveHostPlatformOs(hostPlatform),
    };
  }

  return {
    method: 'native-windows',
    platformFamily: 'windows',
    platformOs: 'windows',
  };
}
