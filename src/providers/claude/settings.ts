import { getProviderConfig, setProviderConfig } from '../../core/providers/providerConfig';
import { getProviderEnvironmentVariables } from '../../core/providers/providerEnvironment';
import type { HostnameCliPaths } from '../../core/types/settings';

export type ClaudeSafeMode = 'acceptEdits' | 'default';

/** Claude 文件型命令/技能的扫描范围（与 SDK settingSources 对齐）。 */
export type SlashAssetScope = 'vault-only' | 'vault-and-user-home';

export interface ClaudeProviderSettings {
  /** 是否作为聊天提供商启用；默认 true，老配置缺省视为启用 */
  enabled: boolean;
  safeMode: ClaudeSafeMode;
  cliPath: string;
  cliPathsByHost: HostnameCliPaths;
  /** 命令与技能及用户 settings 合并范围；缺省由旧版 loadUserSettings 推导 */
  slashAssetScope: SlashAssetScope;
  /**
   * 与 slashAssetScope 联动：vault-and-user-home 时为 true。
   * 持久化时与 slashAssetScope 同步，供仍读取该字段的逻辑使用。
   */
  loadUserSettings: boolean;
  enableChrome: boolean;
  enableBangBash: boolean;
  enableOpus1M: boolean;
  enableSonnet1M: boolean;
  customModels: string;
  lastModel: string;
  environmentVariables: string;
  environmentHash: string;
}

export const DEFAULT_CLAUDE_PROVIDER_SETTINGS: Readonly<ClaudeProviderSettings> = Object.freeze({
  enabled: true,
  safeMode: 'acceptEdits',
  cliPath: '',
  cliPathsByHost: {},
  slashAssetScope: 'vault-and-user-home',
  loadUserSettings: true,
  enableChrome: false,
  enableBangBash: false,
  enableOpus1M: false,
  enableSonnet1M: false,
  customModels: '',
  lastModel: 'haiku',
  environmentVariables: '',
  environmentHash: '',
});

function normalizeHostnameCliPaths(value: unknown): HostnameCliPaths {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const result: HostnameCliPaths = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string' && entry.trim()) {
      result[key] = entry.trim();
    }
  }
  return result;
}

function resolveSlashAssetScope(
  config: Record<string, unknown>,
  settings: Record<string, unknown>,
): SlashAssetScope {
  const raw = config.slashAssetScope;
  if (raw === 'vault-only' || raw === 'vault-and-user-home') {
    return raw;
  }
  const legacyFalse =
    config.loadUserSettings === false
    || settings.loadUserClaudeSettings === false;
  if (legacyFalse) {
    return 'vault-only';
  }
  return 'vault-and-user-home';
}

export function getClaudeProviderSettings(
  settings: Record<string, unknown>,
): ClaudeProviderSettings {
  const config = getProviderConfig(settings, 'claude');

  const slashAssetScope = resolveSlashAssetScope(config, settings);
  const loadUserSettings = slashAssetScope === 'vault-and-user-home';

  return {
    enabled:
      (config.enabled as boolean | undefined) ?? DEFAULT_CLAUDE_PROVIDER_SETTINGS.enabled,
    safeMode: (config.safeMode as ClaudeSafeMode | undefined)
      ?? (settings.claudeSafeMode as ClaudeSafeMode | undefined)
      ?? DEFAULT_CLAUDE_PROVIDER_SETTINGS.safeMode,
    cliPath: (config.cliPath as string | undefined)
      ?? (settings.claudeCliPath as string | undefined)
      ?? DEFAULT_CLAUDE_PROVIDER_SETTINGS.cliPath,
    cliPathsByHost: normalizeHostnameCliPaths(config.cliPathsByHost ?? settings.claudeCliPathsByHost),
    slashAssetScope,
    loadUserSettings,
    enableChrome: (config.enableChrome as boolean | undefined)
      ?? (settings.enableChrome as boolean | undefined)
      ?? DEFAULT_CLAUDE_PROVIDER_SETTINGS.enableChrome,
    enableBangBash: (config.enableBangBash as boolean | undefined)
      ?? (settings.enableBangBash as boolean | undefined)
      ?? DEFAULT_CLAUDE_PROVIDER_SETTINGS.enableBangBash,
    enableOpus1M: (config.enableOpus1M as boolean | undefined)
      ?? (settings.enableOpus1M as boolean | undefined)
      ?? DEFAULT_CLAUDE_PROVIDER_SETTINGS.enableOpus1M,
    enableSonnet1M: (config.enableSonnet1M as boolean | undefined)
      ?? (settings.enableSonnet1M as boolean | undefined)
      ?? DEFAULT_CLAUDE_PROVIDER_SETTINGS.enableSonnet1M,
    customModels: (config.customModels as string | undefined)
      ?? DEFAULT_CLAUDE_PROVIDER_SETTINGS.customModels,
    lastModel: (config.lastModel as string | undefined)
      ?? (settings.lastClaudeModel as string | undefined)
      ?? DEFAULT_CLAUDE_PROVIDER_SETTINGS.lastModel,
    environmentVariables: (config.environmentVariables as string | undefined)
      ?? getProviderEnvironmentVariables(settings, 'claude')
      ?? DEFAULT_CLAUDE_PROVIDER_SETTINGS.environmentVariables,
    environmentHash: (config.environmentHash as string | undefined)
      ?? (settings.lastEnvHash as string | undefined)
      ?? DEFAULT_CLAUDE_PROVIDER_SETTINGS.environmentHash,
  };
}

export function updateClaudeProviderSettings(
  settings: Record<string, unknown>,
  updates: Partial<ClaudeProviderSettings>,
): ClaudeProviderSettings {
  const current = getClaudeProviderSettings(settings);

  let slashAssetScope = current.slashAssetScope;
  let loadUserSettings = current.loadUserSettings;

  if (updates.slashAssetScope !== undefined) {
    slashAssetScope = updates.slashAssetScope;
    loadUserSettings = slashAssetScope === 'vault-and-user-home';
  } else if (updates.loadUserSettings !== undefined) {
    loadUserSettings = updates.loadUserSettings;
    slashAssetScope = loadUserSettings ? 'vault-and-user-home' : 'vault-only';
  }

  const next: ClaudeProviderSettings = {
    ...current,
    ...updates,
    slashAssetScope,
    loadUserSettings,
  };

  setProviderConfig(settings, 'claude', { ...next } as Record<string, unknown>);
  return next;
}
