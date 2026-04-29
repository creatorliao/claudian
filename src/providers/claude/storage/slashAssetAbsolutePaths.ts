import type { App } from 'obsidian';
import * as os from 'os';
import * as path from 'path';

import type { ProviderCommandEntry } from '../../../core/providers/commands/ProviderCommandEntry';
import { getVaultPath } from '../../../utils/path';
import { SKILLS_PATH } from './SkillStorage';
import { COMMANDS_PATH } from './SlashCommandStorage';

/** 将存储层约定的「vault 相对片段」拆成多段，再与根路径做 path.join，保证 Windows / macOS 一致 */
function joinUnderRoot(root: string, vaultRelativePath: string, ...extraSegments: string[]): string {
  const parts = vaultRelativePath.split('/').filter(Boolean);
  return path.join(root, ...parts, ...extraSegments);
}

/**
 * 与 SlashCommandStorage 中 safeName + `.md` 规则一致；嵌套名（含 `/`）按多级目录拼接。
 * 全程使用 path.join，避免手写 `/` 作为唯一路径连接形式。
 */
function commandMarkdownAbsolutePath(root: string, commandName: string): string {
  const safeName = commandName.replace(/[^a-zA-Z0-9_/-]/g, '-');
  const nested = safeName.split('/').filter(Boolean);
  const leaf = nested.length > 0 ? nested.pop()! : '';
  return path.join(root, ...COMMANDS_PATH.split('/').filter(Boolean), ...nested, `${leaf}.md`);
}

/**
 * 解析文件型斜杠命令/技能在磁盘上的绝对路径（库根或用户主目录下的 .claude）。
 * 路径仅通过 Node path 与 Obsidian 库根拼接，适用于 Windows 与 macOS 桌面端。
 * 无 {@link ProviderCommandEntry.slashFileProvenance} 的条目返回 null。
 */
export function resolveSlashFileAbsolutePath(app: App, entry: ProviderCommandEntry): string | null {
  if (!entry.slashFileProvenance) {
    return null;
  }
  const root = entry.slashFileProvenance === 'vault' ? getVaultPath(app) : os.homedir();
  if (!root) {
    return null;
  }
  if (entry.kind === 'skill') {
    return joinUnderRoot(root, SKILLS_PATH, entry.name, 'SKILL.md');
  }
  return commandMarkdownAbsolutePath(root, entry.name);
}

export function resolveSlashCommandsRootDir(app: App, provenance: 'vault' | 'user-home'): string | null {
  const base = provenance === 'vault' ? getVaultPath(app) : os.homedir();
  if (!base) {
    return null;
  }
  return joinUnderRoot(base, COMMANDS_PATH);
}

export function resolveSlashSkillsRootDir(app: App, provenance: 'vault' | 'user-home'): string | null {
  const base = provenance === 'vault' ? getVaultPath(app) : os.homedir();
  if (!base) {
    return null;
  }
  return joinUnderRoot(base, SKILLS_PATH);
}
