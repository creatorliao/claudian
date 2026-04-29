import type { SlashCommand as SDKSlashCommand } from '@anthropic-ai/claude-agent-sdk';
import { query as agentQuery } from '@anthropic-ai/claude-agent-sdk';

import type { SlashCommand } from '../../../core/types';
import type ClaudianPlugin from '../../../main';
import { getEnhancedPath, parseEnvironmentVariables } from '../../../utils/env';
import { getVaultPath } from '../../../utils/path';
import { createCustomSpawnFunction } from '../runtime/customSpawn';
import { getClaudeProviderSettings } from '../settings';

function mapSdkCommands(sdkCommands: SDKSlashCommand[]): SlashCommand[] {
  return sdkCommands.map((cmd) => ({
    id: `sdk:${cmd.name}`,
    name: cmd.name,
    description: cmd.description,
    argumentHint: cmd.argumentHint,
    content: '',
    source: 'sdk' as const,
  }));
}

/**
 * Probes the Claude SDK locally to discover available commands and skills.
 *
 * Fires a throwaway query with an empty prompt — the SDK emits a system/init
 * event from local config parsing alone (no API call, no cost). The probe
 * captures that event, calls supportedCommands() for full metadata, then aborts.
 *
 * @param cwdOverride SDK 探测用的工作目录，应与当前 Tab 的 effective cwd 对齐（通常为库根或子文件夹）
 */
export async function probeRuntimeCommands(
  plugin: ClaudianPlugin,
  cwdOverride: string,
): Promise<SlashCommand[]> {
  const vaultPath = getVaultPath(plugin.app);
  if (!vaultPath) return [];

  const cliPath = plugin.getResolvedProviderCliPath('claude');
  if (!cliPath) return [];

  const customEnv = parseEnvironmentVariables(
    plugin.getActiveEnvironmentVariables('claude')
  );
  const enhancedPath = getEnhancedPath(customEnv.PATH, cliPath);
  const claudeSettings = getClaudeProviderSettings(
    plugin.settings as unknown as Record<string, unknown>,
  );

  const abortController = new AbortController();
  let commands: SlashCommand[] = [];
  /** 规范为库内已知目录路径，避免出现无效 cwd */
  const cwd = cwdOverride.trim() ? cwdOverride.trim() : vaultPath;

  try {
    const conversation = agentQuery({
      prompt: '',
      options: {
        cwd,
        abortController,
        pathToClaudeCodeExecutable: cliPath,
        env: { ...process.env, ...customEnv, PATH: enhancedPath },
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        settingSources: claudeSettings.loadUserSettings ? ['user', 'project'] : ['project'],
        ...(claudeSettings.enableChrome ? { extraArgs: { chrome: null } } : {}),
        spawnClaudeCodeProcess: createCustomSpawnFunction(enhancedPath),
        persistSession: false,
      },
    });

    for await (const event of conversation) {
      if (event.type === 'system' && event.subtype === 'init') {
        try {
          const sdkCommands: SDKSlashCommand[] = await conversation.supportedCommands();
          commands = mapSdkCommands(sdkCommands);
        } catch { /* best-effort */ }
        abortController.abort();
        break;
      }
    }
  } catch {
    // Probe is best-effort; swallow abort errors.
  }

  return commands;
}
