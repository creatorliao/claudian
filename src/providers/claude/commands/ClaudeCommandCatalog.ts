import type {
  ProviderCommandCatalog,
  ProviderCommandDropdownConfig,
} from '../../../core/providers/commands/ProviderCommandCatalog';
import type { ProviderCommandEntry } from '../../../core/providers/commands/ProviderCommandEntry';
import type { SlashCommand } from '../../../core/types';
import { isSkill } from '../../../utils/slashCommand';
import type { SlashAssetScope } from '../settings';
import type { SkillStorage } from '../storage/SkillStorage';
import type { SlashCommandStorage } from '../storage/SlashCommandStorage';

function slashCommandToEntry(
  cmd: SlashCommand,
  fileProvenance?: 'vault' | 'user-home',
): ProviderCommandEntry {
  const skill = isSkill(cmd);
  const fromUserHome = fileProvenance === 'user-home';
  return {
    id: cmd.id,
    providerId: 'claude',
    kind: skill ? 'skill' : 'command',
    name: cmd.name,
    description: cmd.description,
    content: cmd.content,
    argumentHint: cmd.argumentHint,
    allowedTools: cmd.allowedTools,
    model: cmd.model,
    disableModelInvocation: cmd.disableModelInvocation,
    userInvocable: cmd.userInvocable,
    context: cmd.context,
    agent: cmd.agent,
    hooks: cmd.hooks,
    scope: cmd.source === 'sdk' ? 'runtime' : 'vault',
    source: cmd.source ?? 'user',
    isEditable: cmd.source !== 'sdk' && !fromUserHome,
    isDeletable: cmd.source !== 'sdk' && !fromUserHome,
    displayPrefix: '/',
    insertPrefix: '/',
    ...(fileProvenance ? { slashFileProvenance: fileProvenance } : {}),
  };
}

/** 用户主目录扫描结果使用独立 id 前缀，避免与库内条目 id 冲突。 */
function prefixHomeSlashId(cmd: SlashCommand): SlashCommand {
  return { ...cmd, id: `home:${cmd.id}` };
}

function entryToSlashCommand(entry: ProviderCommandEntry): SlashCommand {
  return {
    id: entry.id,
    name: entry.name,
    description: entry.description,
    content: entry.content,
    argumentHint: entry.argumentHint,
    allowedTools: entry.allowedTools,
    model: entry.model,
    disableModelInvocation: entry.disableModelInvocation,
    userInvocable: entry.userInvocable,
    context: entry.context,
    agent: entry.agent,
    hooks: entry.hooks,
    source: entry.source,
    kind: entry.kind,
  };
}

// SDK built-in skills that have no meaning inside Claudian
const BUILTIN_HIDDEN_COMMANDS = new Set([
  'context', 'cost', 'debug', 'extra-usage', 'heapdump', 'init',
  'insights', 'loop', 'schedule', 'security-review', 'simplify', 'update-config',
]);

export type CommandProbe = () => Promise<SlashCommand[]>;

export interface ClaudeCommandCatalogDeps {
  probe?: CommandProbe;
  homeCommands?: SlashCommandStorage;
  homeSkills?: SkillStorage;
  /** 未注入时视为「本库与主目录合并」，便于单测 */
  getSlashAssetScope?: () => SlashAssetScope;
}

function sortFileEntries(entries: ProviderCommandEntry[]): ProviderCommandEntry[] {
  const isUserHome = (e: ProviderCommandEntry) => e.slashFileProvenance === 'user-home';
  const vault = entries.filter(e => !isUserHome(e));
  const home = entries.filter(e => isUserHome(e));
  const byName = (a: ProviderCommandEntry, b: ProviderCommandEntry) =>
    a.name.localeCompare(b.name);
  return [...vault.sort(byName), ...home.sort(byName)];
}

export class ClaudeCommandCatalog implements ProviderCommandCatalog {
  private sdkCommands: SlashCommand[] = [];
  private probePromise: Promise<void> | null = null;

  constructor(
    private commandStorage: SlashCommandStorage,
    private skillStorage: SkillStorage,
    private deps: ClaudeCommandCatalogDeps = {},
  ) {}

  setRuntimeCommands(commands: SlashCommand[]): void {
    this.sdkCommands = commands;
  }

  private getProbe(): CommandProbe | undefined {
    return this.deps.probe;
  }

  private currentScope(): SlashAssetScope {
    return this.deps.getSlashAssetScope?.() ?? 'vault-and-user-home';
  }

  async listDropdownEntries(context: { includeBuiltIns: boolean }): Promise<ProviderCommandEntry[]> {
    void context;
    // SDK commands already include vault commands/skills (the SDK scans
    // .claude/commands/ and .claude/skills/ internally). No file scan needed.
    // When the cache is empty (cold start, no active runtime), probe the SDK.
    if (this.sdkCommands.length === 0 && this.getProbe()) {
      await this.ensureProbed();
    }
    const runtimeEntries = this.sdkCommands
      .filter(cmd => !BUILTIN_HIDDEN_COMMANDS.has(cmd.name.toLowerCase()))
      .map(c => slashCommandToEntry(c));
    if (runtimeEntries.length > 0) {
      return runtimeEntries;
    }
    return this.listVaultEntries();
  }

  /** Probe the SDK for commands. Deduplicates concurrent calls. */
  private async ensureProbed(): Promise<void> {
    const probe = this.getProbe();
    if (!probe) return;
    if (!this.probePromise) {
      this.probePromise = probe().then((commands) => {
        // Only apply probe results if the runtime hasn't provided fresher data
        if (this.sdkCommands.length === 0 && commands.length > 0) {
          this.sdkCommands = commands;
        }
      }).catch(() => {
        // Probe is best-effort
      }).finally(() => {
        this.probePromise = null;
      });
    }
    await this.probePromise;
  }

  async listVaultEntries(): Promise<ProviderCommandEntry[]> {
    const vaultCommands = await this.commandStorage.loadAll();
    const vaultSkills = await this.skillStorage.loadAll();
    const vaultEntries = [
      ...vaultCommands.map(c => slashCommandToEntry(c, 'vault')),
      ...vaultSkills.map(c => slashCommandToEntry(c, 'vault')),
    ];

    if (this.currentScope() !== 'vault-and-user-home') {
      return sortFileEntries(vaultEntries);
    }

    const homeCmdStore = this.deps.homeCommands;
    const homeSkillStore = this.deps.homeSkills;
    if (!homeCmdStore || !homeSkillStore) {
      return sortFileEntries(vaultEntries);
    }

    const homeCommandsRaw = await homeCmdStore.loadAll();
    const homeSkillsRaw = await homeSkillStore.loadAll();
    const vaultNames = new Set(vaultEntries.map(e => e.name.toLowerCase()));

    const homeEntries: ProviderCommandEntry[] = [];
    for (const c of homeCommandsRaw) {
      if (vaultNames.has(c.name.toLowerCase())) continue;
      homeEntries.push(slashCommandToEntry(prefixHomeSlashId(c), 'user-home'));
    }
    for (const c of homeSkillsRaw) {
      if (vaultNames.has(c.name.toLowerCase())) continue;
      homeEntries.push(slashCommandToEntry(prefixHomeSlashId(c), 'user-home'));
    }

    return sortFileEntries([...vaultEntries, ...homeEntries]);
  }

  async saveVaultEntry(entry: ProviderCommandEntry): Promise<void> {
    if (entry.slashFileProvenance === 'user-home') {
      throw new Error('claudian: cannot modify commands or skills in user home from settings');
    }
    const cmd = entryToSlashCommand(entry);
    if (entry.kind === 'skill') {
      await this.skillStorage.save(cmd);
    } else {
      await this.commandStorage.save(cmd);
    }
  }

  async deleteVaultEntry(entry: ProviderCommandEntry): Promise<void> {
    if (entry.slashFileProvenance === 'user-home') {
      throw new Error('claudian: cannot delete commands or skills in user home from settings');
    }
    if (entry.kind === 'skill') {
      await this.skillStorage.delete(entry.id.replace(/^home:/, ''));
    } else {
      await this.commandStorage.delete(entry.id.replace(/^home:/, ''));
    }
  }

  getDropdownConfig(): ProviderCommandDropdownConfig {
    return {
      providerId: 'claude',
      triggerChars: ['/'],
      builtInPrefix: '/',
      skillPrefix: '/',
      commandPrefix: '/',
    };
  }

  async refresh(): Promise<void> {
    // Claude revalidation happens externally via setRuntimeCommands
  }
}
