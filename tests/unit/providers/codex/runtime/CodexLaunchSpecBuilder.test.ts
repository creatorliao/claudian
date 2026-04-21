import { buildCodexLaunchSpec } from '@/providers/codex/runtime/CodexLaunchSpecBuilder';

describe('buildCodexLaunchSpec', () => {
  it('builds a native Windows launch spec with a direct codex executable', () => {
    const spec = buildCodexLaunchSpec({
      resolvedCliCommand: 'C:\\Users\\user\\AppData\\Roaming\\npm\\codex.exe',
      hostVaultPath: 'C:\\repo',
      env: { OPENAI_API_KEY: 'sk-test' },
      hostPlatform: 'win32',
    });

    expect(spec.command).toBe('C:\\Users\\user\\AppData\\Roaming\\npm\\codex.exe');
    expect(spec.args).toEqual(['app-server', '--listen', 'stdio://']);
    expect(spec.spawnCwd).toBe('C:\\repo');
    expect(spec.targetCwd).toBe('C:\\repo');
    expect(spec.target).toMatchObject({
      method: 'native-windows',
      platformFamily: 'windows',
      platformOs: 'windows',
    });
  });

  it('builds a host-native launch spec on macOS', () => {
    const spec = buildCodexLaunchSpec({
      resolvedCliCommand: '/opt/homebrew/bin/codex',
      hostVaultPath: '/Users/me/vault',
      env: {},
      hostPlatform: 'darwin',
    });

    expect(spec.command).toBe('/opt/homebrew/bin/codex');
    expect(spec.target.method).toBe('host-native');
    expect(spec.targetCwd).toBe('/Users/me/vault');
  });
});
