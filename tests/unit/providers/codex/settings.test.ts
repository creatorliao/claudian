import {
  DEFAULT_CODEX_PROVIDER_SETTINGS,
  getCodexProviderSettings,
  updateCodexProviderSettings,
} from '@/providers/codex/settings';

const mockGetHostnameKey = jest.fn(() => 'host-a');

jest.mock('@/utils/env', () => ({
  getHostnameKey: () => mockGetHostnameKey(),
}));

describe('codex settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('defaults match DEFAULT_CODEX_PROVIDER_SETTINGS', () => {
    const settings = getCodexProviderSettings({});
    expect(settings.enabled).toBe(DEFAULT_CODEX_PROVIDER_SETTINGS.enabled);
    expect(settings.cliPath).toBe('');
    expect(settings.cliPathsByHost).toEqual({});
  });

  it('ignores legacy installation / WSL keys in stored config', () => {
    const settings = getCodexProviderSettings({
      providerConfigs: {
        codex: {
          installationMethod: 'wsl',
          wslDistroOverride: 'Ubuntu',
        },
      },
    });
    expect((settings as unknown as Record<string, unknown>).installationMethod).toBeUndefined();
  });

  it('round-trips cliPathsByHost on update for the current host', () => {
    const settingsBag: Record<string, unknown> = {
      providerConfigs: {
        codex: {},
      },
    };

    const next = updateCodexProviderSettings(settingsBag, {
      cliPathsByHost: { 'host-a': '/usr/local/bin/codex' },
    });

    expect(next.cliPathsByHost['host-a']).toBe('/usr/local/bin/codex');
    expect(getCodexProviderSettings(settingsBag).cliPathsByHost['host-a']).toBe('/usr/local/bin/codex');
  });
});
