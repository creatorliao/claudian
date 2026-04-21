import { resolveCodexExecutionTarget } from './CodexExecutionTargetResolver';
import type { CodexLaunchSpec } from './codexLaunchTypes';
import { createCodexPathMapper } from './CodexPathMapper';

export interface BuildCodexLaunchSpecOptions {
  resolvedCliCommand: string | null;
  hostVaultPath: string | null;
  /** 若设置则作为 Codex 工作目录（否则为 Vault 根） */
  workingDirectory?: string | null;
  env: Record<string, string>;
  hostPlatform?: NodeJS.Platform;
}

const CODEX_APP_SERVER_ARGS = Object.freeze(['app-server', '--listen', 'stdio://']);

export function buildCodexLaunchSpec(
  options: BuildCodexLaunchSpecOptions,
): CodexLaunchSpec {
  const target = resolveCodexExecutionTarget({
    hostPlatform: options.hostPlatform,
  });
  const pathMapper = createCodexPathMapper(target);
  const spawnCwd = options.workingDirectory ?? options.hostVaultPath ?? process.cwd();

  const targetCwd = pathMapper.toTargetPath(spawnCwd);

  if (!targetCwd) {
    throw new Error('Unable to map working directory for Codex launch');
  }

  const resolvedCliCommand = options.resolvedCliCommand?.trim() || 'codex';

  return {
    target,
    command: resolvedCliCommand,
    args: [...CODEX_APP_SERVER_ARGS],
    spawnCwd,
    targetCwd,
    env: options.env,
    pathMapper,
  };
}
