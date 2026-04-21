import type { CodexExecutionTarget } from '@/providers/codex/runtime/codexLaunchTypes';
import { createCodexPathMapper } from '@/providers/codex/runtime/CodexPathMapper';

describe('createCodexPathMapper', () => {
  it('normalizes Windows paths for native-windows targets', () => {
    const target: CodexExecutionTarget = {
      method: 'native-windows',
      platformFamily: 'windows',
      platformOs: 'windows',
    };
    const mapper = createCodexPathMapper(target);

    expect(mapper.toTargetPath('C:\\repo\\src')).toBe('C:\\repo\\src');
    expect(mapper.toHostPath('C:\\repo\\src')).toBe('C:\\repo\\src');
  });

  it('keeps host-native POSIX paths unchanged', () => {
    const target: CodexExecutionTarget = {
      method: 'host-native',
      platformFamily: 'unix',
      platformOs: 'macos',
    };
    const mapper = createCodexPathMapper(target);

    expect(mapper.toTargetPath('/Users/example/repo')).toBe('/Users/example/repo');
    expect(mapper.toHostPath('/Users/example/repo')).toBe('/Users/example/repo');
  });
});
