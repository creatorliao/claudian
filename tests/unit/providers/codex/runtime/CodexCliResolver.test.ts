import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { CodexCliResolver } from '@/providers/codex/runtime/CodexCliResolver';

const isWindows = process.platform === 'win32';

jest.mock('fs');
jest.mock('os');

const mockedExists = fs.existsSync as jest.Mock;
const mockedStat = fs.statSync as jest.Mock;
const mockedHostname = os.hostname as jest.Mock;

describe('CodexCliResolver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedHostname.mockReturnValue('current-host');
  });

  it('uses the current host path instead of another synced host path', () => {
    mockedExists.mockImplementation((filePath: string) => filePath === '/current/codex');
    mockedStat.mockReturnValue({ isFile: () => true });

    const resolver = new CodexCliResolver();
    const resolved = resolver.resolve(
      {
        'other-host': '/other/codex',
        'current-host': '/current/codex',
      },
      '/legacy/codex',
      '',
    );

    expect(resolved).toBe('/current/codex');
  });

  it('falls back to the legacy path when the current host has no custom path', () => {
    mockedExists.mockImplementation((filePath: string) => filePath === '/legacy/codex');
    mockedStat.mockReturnValue({ isFile: () => true });

    const resolver = new CodexCliResolver();
    const resolved = resolver.resolve(
      { 'other-host': '/other/codex' },
      '/legacy/codex',
      '',
    );

    expect(resolved).toBe('/legacy/codex');
  });

  it('auto-detects from the runtime PATH when no configured path is valid', () => {
    const expected = isWindows ? path.join('/custom/bin', 'codex.exe') : path.join('/custom/bin', 'codex');
    mockedExists.mockImplementation((filePath: string) => filePath === expected);
    mockedStat.mockImplementation((filePath: string) => ({
      isFile: () => filePath === expected,
    }));

    const resolver = new CodexCliResolver();
    const resolved = resolver.resolve(
      { 'other-host': '/other/codex' },
      '',
      'PATH=/custom/bin',
    );

    expect(resolved).toBe(expected);
  });

  it('returns a Linux-side command in WSL mode without host filesystem validation', () => {
    mockedExists.mockReturnValue(false);

    const resolver = new CodexCliResolver();
    const resolved = resolver.resolve(
      {
        'current-host': 'codex',
      },
      '',
      '',
      { installationMethod: 'wsl', hostPlatform: 'win32' },
    );

    expect(resolved).toBe('codex');
  });

  it('falls back to the Linux command when a Windows-native CLI path is configured in WSL mode', () => {
    mockedExists.mockReturnValue(false);

    const resolver = new CodexCliResolver();
    const resolved = resolver.resolve(
      {
        'current-host': 'C:\\Users\\user\\AppData\\Roaming\\npm\\codex.exe',
      },
      '',
      '',
      { installationMethod: 'wsl', hostPlatform: 'win32' },
    );

    expect(resolved).toBe('codex');
  });
});
