import { resolveCodexExecutionTarget } from '@/providers/codex/runtime/CodexExecutionTargetResolver';

describe('resolveCodexExecutionTarget', () => {
  it('returns native-windows on Windows', () => {
    expect(resolveCodexExecutionTarget({ hostPlatform: 'win32' })).toEqual({
      method: 'native-windows',
      platformFamily: 'windows',
      platformOs: 'windows',
    });
  });

  it('returns host-native on macOS', () => {
    expect(resolveCodexExecutionTarget({ hostPlatform: 'darwin' })).toEqual({
      method: 'host-native',
      platformFamily: 'unix',
      platformOs: 'macos',
    });
  });

  it('returns host-native on Linux', () => {
    expect(resolveCodexExecutionTarget({ hostPlatform: 'linux' })).toEqual({
      method: 'host-native',
      platformFamily: 'unix',
      platformOs: 'linux',
    });
  });
});
