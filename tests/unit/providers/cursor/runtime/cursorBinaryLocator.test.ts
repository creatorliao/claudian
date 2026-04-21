import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  findLatestCursorAgentBinaryInInstallRoot,
  getCursorAgentDefaultInstallRoots,
  getCursorIdeBundledAgentBinDirectories,
} from '@/providers/cursor/runtime/CursorBinaryLocator';

describe('CursorBinaryLocator install root helpers', () => {
  it('getCursorAgentDefaultInstallRoots: unix uses ~/.local/share/cursor-agent', () => {
    const roots = getCursorAgentDefaultInstallRoots('darwin');
    expect(roots).toEqual([path.join(os.homedir(), '.local', 'share', 'cursor-agent')]);
  });

  it('getCursorAgentDefaultInstallRoots: win32 uses LOCALAPPDATA', () => {
    const prev = process.env.LOCALAPPDATA;
    process.env.LOCALAPPDATA = 'C:\\Users\\x\\AppData\\Local';
    try {
      const roots = getCursorAgentDefaultInstallRoots('win32');
      expect(roots).toEqual(['C:\\Users\\x\\AppData\\Local\\cursor-agent']);
    } finally {
      if (prev === undefined) {
        delete process.env.LOCALAPPDATA;
      } else {
        process.env.LOCALAPPDATA = prev;
      }
    }
  });

  it('getCursorIdeBundledAgentBinDirectories: win32 在 resources/app/bin 存在时返回该目录', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cursor-local-appdata-'));
    const bundled = path.join(root, 'Programs', 'cursor', 'resources', 'app', 'bin');
    fs.mkdirSync(bundled, { recursive: true });
    const prev = process.env.LOCALAPPDATA;
    process.env.LOCALAPPDATA = root;
    try {
      expect(getCursorIdeBundledAgentBinDirectories('win32')).toEqual([bundled]);
    } finally {
      if (prev === undefined) {
        delete process.env.LOCALAPPDATA;
      } else {
        process.env.LOCALAPPDATA = prev;
      }
    }
  });

  it('findLatestCursorAgentBinaryInInstallRoot: picks newest version dir with cursor-agent', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claudian-cursor-root-'));
    const v1 = path.join(root, 'versions', '2025.01.01-old');
    const v2 = path.join(root, 'versions', '2026.01.01-new');
    fs.mkdirSync(v1, { recursive: true });
    fs.mkdirSync(v2, { recursive: true });
    const oldBin = path.join(v1, 'cursor-agent');
    const newBin = path.join(v2, 'cursor-agent');
    fs.writeFileSync(oldBin, '');
    fs.writeFileSync(newBin, '');
    const oldTime = Date.now() / 1000 - 3600;
    const newTime = Date.now() / 1000;
    fs.utimesSync(v1, oldTime, oldTime);
    fs.utimesSync(v2, newTime, newTime);

    const resolved = findLatestCursorAgentBinaryInInstallRoot(root, 'darwin');
    expect(resolved).toBe(newBin);
  });

  it('findLatestCursorAgentBinaryInInstallRoot: win32 prefers cursor-agent.exe in version dir', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claudian-cursor-win-'));
    const vdir = path.join(root, 'versions', '2026.01.01-ab');
    fs.mkdirSync(vdir, { recursive: true });
    const exe = path.join(vdir, 'cursor-agent.exe');
    fs.writeFileSync(exe, '');

    const resolved = findLatestCursorAgentBinaryInInstallRoot(root, 'win32');
    expect(resolved).toBe(exe);
  });
});
