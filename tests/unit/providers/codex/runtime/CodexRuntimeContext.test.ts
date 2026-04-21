import type { CodexLaunchSpec } from '@/providers/codex/runtime/codexLaunchTypes';
import { createCodexPathMapper } from '@/providers/codex/runtime/CodexPathMapper';
import { createCodexRuntimeContext } from '@/providers/codex/runtime/CodexRuntimeContext';

function createHostLaunchSpec(overrides: Partial<CodexLaunchSpec> = {}): CodexLaunchSpec {
  const target = {
    method: 'host-native' as const,
    platformFamily: 'unix' as const,
    platformOs: 'macos' as const,
  };

  return {
    target,
    command: 'codex',
    args: ['app-server', '--listen', 'stdio://'],
    spawnCwd: '/Users/test/repo',
    targetCwd: '/Users/test/repo',
    env: { HOME: '/Users/test' },
    pathMapper: createCodexPathMapper(target),
    ...overrides,
  };
}

function createWindowsLaunchSpec(overrides: Partial<CodexLaunchSpec> = {}): CodexLaunchSpec {
  const target = {
    method: 'native-windows' as const,
    platformFamily: 'windows' as const,
    platformOs: 'windows' as const,
  };

  return {
    target,
    command: 'C:\\codex.exe',
    args: ['app-server', '--listen', 'stdio://'],
    spawnCwd: 'C:\\repo',
    targetCwd: 'C:\\repo',
    env: { USERPROFILE: 'C:\\Users\\test' },
    pathMapper: createCodexPathMapper(target),
    ...overrides,
  };
}

describe('createCodexRuntimeContext', () => {
  it('derives paths from initialize.codexHome for native-windows targets', () => {
    const context = createCodexRuntimeContext(
      createWindowsLaunchSpec(),
      {
        userAgent: 'test/0.1',
        codexHome: 'C:\\Users\\test\\.codex',
        platformFamily: 'windows',
        platformOs: 'windows',
      },
    );

    expect(context.codexHomeTarget).toBe('C:\\Users\\test\\.codex');
    expect(context.codexHomeHost).toBe('C:\\Users\\test\\.codex');
    expect(context.sessionsDirTarget).toBe('C:\\Users\\test\\.codex\\sessions');
  });

  it('fails fast when initialize platform metadata does not match the selected target', () => {
    expect(() => createCodexRuntimeContext(
      createWindowsLaunchSpec(),
      {
        userAgent: 'test/0.1',
        codexHome: '/home/user/.codex',
        platformFamily: 'unix',
        platformOs: 'linux',
      },
    )).toThrow('Codex target mismatch');
  });

  it('falls back to HOME when initialize omits codexHome for host-native targets', () => {
    const context = createCodexRuntimeContext(
      createHostLaunchSpec(),
      {
        userAgent: 'test/0.1',
        platformFamily: 'unix',
        platformOs: 'macos',
      },
    );

    expect(context.codexHomeTarget).toBe('/Users/test/.codex');
    expect(context.codexHomeHost).toBe('/Users/test/.codex');
    expect(context.sessionsDirTarget).toBe('/Users/test/.codex/sessions');
    expect(context.sessionsDirHost).toBe('/Users/test/.codex/sessions');
    expect(context.memoriesDirTarget).toBe('/Users/test/.codex/memories');
  });
});
