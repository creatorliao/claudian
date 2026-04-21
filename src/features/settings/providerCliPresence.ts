import { getRuntimeEnvironmentText } from '../../core/providers/providerEnvironment';
import { resolveClaudeCliPath } from '../../providers/claude/runtime/ClaudeCliResolver';
import { getClaudeProviderSettings } from '../../providers/claude/settings';
import { resolveCodexCliPath } from '../../providers/codex/runtime/CodexBinaryLocator';
import { getCodexProviderSettings } from '../../providers/codex/settings';
import { resolveCursorCliPath } from '../../providers/cursor/runtime/CursorBinaryLocator';
import { getCursorProviderSettings } from '../../providers/cursor/settings';
import { getHostnameKey } from '../../utils/env';

/** 与「通用」提供商开关对应的三个 id（ProviderId 为 string，不宜用 Extract） */
export type TriProviderId = 'claude' | 'cursor' | 'codex';

/**
 * 根据当前设置判断本机是否能解析到该提供商的 CLI（与运行时使用同一套解析逻辑）。
 */
export function isProviderCliPresent(
  providerId: TriProviderId,
  settingsBag: Record<string, unknown>,
): boolean {
  const host = getHostnameKey();

  if (providerId === 'claude') {
    const s = getClaudeProviderSettings(settingsBag);
    return (
      resolveClaudeCliPath(
        s.cliPathsByHost[host],
        s.cliPath,
        getRuntimeEnvironmentText(settingsBag, 'claude'),
      ) != null
    );
  }

  if (providerId === 'cursor') {
    const s = getCursorProviderSettings(settingsBag);
    return (
      resolveCursorCliPath(
        s.cliPathsByHost[host],
        s.cliPath,
        getRuntimeEnvironmentText(settingsBag, 'cursor'),
      ) != null
    );
  }

  const s = getCodexProviderSettings(settingsBag);
  return (
    resolveCodexCliPath(
      s.cliPathsByHost[host],
      s.cliPath,
      getRuntimeEnvironmentText(settingsBag, 'codex'),
    ) != null
  );
}
