import '@/providers';

import { DEFAULT_CLAUDIAN_SETTINGS } from '@/app/settings/defaultSettings';
import { isProviderCliPresent } from '@/features/settings/providerCliPresence';
import { resolveCodexCliPath } from '@/providers/codex/runtime/CodexBinaryLocator';

jest.mock('@/providers/codex/runtime/CodexBinaryLocator', () => ({
  __esModule: true,
  ...jest.requireActual('@/providers/codex/runtime/CodexBinaryLocator'),
  resolveCodexCliPath: jest.fn(),
}));

const mockedResolveCodexCliPath = resolveCodexCliPath as jest.MockedFunction<
  typeof resolveCodexCliPath
>;

describe('isProviderCliPresent', () => {
  const base = (): Record<string, unknown> =>
    JSON.parse(JSON.stringify(DEFAULT_CLAUDIAN_SETTINGS)) as Record<string, unknown>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Codex 通过 resolveCodexCliPath 判断本机 CLI 是否可用', () => {
    const settings = base();
    (settings.providerConfigs as { codex: Record<string, unknown> }).codex = {
      ...(settings.providerConfigs as { codex: Record<string, unknown> }).codex,
      enabled: true,
      cliPath: '/configured/codex',
    };

    mockedResolveCodexCliPath.mockReturnValue('/configured/codex');
    expect(isProviderCliPresent('codex', settings)).toBe(true);
    expect(mockedResolveCodexCliPath).toHaveBeenCalled();

    mockedResolveCodexCliPath.mockReturnValue(null);
    expect(isProviderCliPresent('codex', settings)).toBe(false);
  });
});
