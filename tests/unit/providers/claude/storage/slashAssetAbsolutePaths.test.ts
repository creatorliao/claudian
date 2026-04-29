import type { App } from 'obsidian';
import * as os from 'os';
import * as path from 'path';

import type { ProviderCommandEntry } from '@/core/providers/commands/ProviderCommandEntry';
import {
  resolveSlashCommandsRootDir,
  resolveSlashFileAbsolutePath,
  resolveSlashSkillsRootDir,
} from '@/providers/claude/storage/slashAssetAbsolutePaths';

function mockAppWithVault(vaultPath: string | null): App {
  return {
    vault: {
      adapter: vaultPath === null ? {} : { basePath: vaultPath },
    },
  } as unknown as App;
}

describe('slashAssetAbsolutePaths', () => {
  it('库内命令路径与 SlashCommandStorage 安全文件名规则一致', () => {
    const app = mockAppWithVault('/vault/root');
    const entry: ProviderCommandEntry = {
      id: 'cmd-a--b',
      providerId: 'claude',
      kind: 'command',
      name: 'a/b',
      content: '',
      scope: 'vault',
      source: 'user',
      isEditable: true,
      isDeletable: true,
      displayPrefix: '/',
      insertPrefix: '/',
      slashFileProvenance: 'vault',
    };
    const resolved = resolveSlashFileAbsolutePath(app, entry);
    expect(resolved).toBe(path.join('/vault/root', '.claude', 'commands', 'a', 'b.md'));
  });

  it('库内技能路径指向 SKILL.md', () => {
    const app = mockAppWithVault('/vault/root');
    const entry: ProviderCommandEntry = {
      id: 'skill-foo',
      providerId: 'claude',
      kind: 'skill',
      name: 'foo',
      content: '',
      scope: 'vault',
      source: 'user',
      isEditable: true,
      isDeletable: true,
      displayPrefix: '/',
      insertPrefix: '/',
      slashFileProvenance: 'vault',
    };
    const resolved = resolveSlashFileAbsolutePath(app, entry);
    expect(resolved).toBe(path.join('/vault/root', '.claude', 'skills', 'foo', 'SKILL.md'));
  });

  it('无库根路径时库内解析为 null', () => {
    const app = mockAppWithVault(null);
    const entry: ProviderCommandEntry = {
      id: 'cmd-x',
      providerId: 'claude',
      kind: 'command',
      name: 'x',
      content: '',
      scope: 'vault',
      source: 'user',
      isEditable: true,
      isDeletable: true,
      displayPrefix: '/',
      insertPrefix: '/',
      slashFileProvenance: 'vault',
    };
    expect(resolveSlashFileAbsolutePath(app, entry)).toBeNull();
    expect(resolveSlashCommandsRootDir(app, 'vault')).toBeNull();
    expect(resolveSlashSkillsRootDir(app, 'vault')).toBeNull();
  });

  it('user-home 根目录拼接在 os.homedir() 之下（与当前 OS 路径规则一致）', () => {
    const app = mockAppWithVault('/vault/root');
    const entry: ProviderCommandEntry = {
      id: 'home:cmd-y',
      providerId: 'claude',
      kind: 'command',
      name: 'y',
      content: '',
      scope: 'vault',
      source: 'user',
      isEditable: false,
      isDeletable: true,
      displayPrefix: '/',
      insertPrefix: '/',
      slashFileProvenance: 'user-home',
    };
    expect(resolveSlashFileAbsolutePath(app, entry)).toBe(path.join(os.homedir(), '.claude', 'commands', 'y.md'));
    expect(resolveSlashCommandsRootDir(app, 'user-home')).toBe(path.join(os.homedir(), '.claude', 'commands'));
    expect(resolveSlashSkillsRootDir(app, 'user-home')).toBe(path.join(os.homedir(), '.claude', 'skills'));
  });

  it('无 slashFileProvenance 时返回 null', () => {
    const app = mockAppWithVault('/v');
    const entry: ProviderCommandEntry = {
      id: 'sdk',
      providerId: 'claude',
      kind: 'command',
      name: 'built-in',
      content: '',
      scope: 'runtime',
      source: 'sdk',
      isEditable: false,
      isDeletable: false,
      displayPrefix: '/',
      insertPrefix: '/',
    };
    expect(resolveSlashFileAbsolutePath(app, entry)).toBeNull();
  });
});
