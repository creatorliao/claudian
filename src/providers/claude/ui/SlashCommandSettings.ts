import type { App, ToggleComponent } from 'obsidian';
import { Modal, Notice, setIcon, Setting } from 'obsidian';

import type { ProviderCommandCatalog } from '../../../core/providers/commands/ProviderCommandCatalog';
import type { ProviderCommandEntry } from '../../../core/providers/commands/ProviderCommandEntry';
import { t } from '../../../i18n/i18n';
import type { OpenInFileManagerResult } from '../../../utils/openInFileManager';
import { openAbsolutePathInFileManager, revealFileOrOpenParentDirectory } from '../../../utils/openInFileManager';
import { extractFirstParagraph, normalizeArgumentHint, parseSlashCommandContent, validateCommandName } from '../../../utils/slashCommand';
import type { SlashAssetScope } from '../settings';
import {
  resolveSlashCommandsRootDir,
  resolveSlashFileAbsolutePath,
  resolveSlashSkillsRootDir,
} from '../storage/slashAssetAbsolutePaths';

function resolveAllowedTools(inputValue: string, parsedTools?: string[]): string[] | undefined {
  const trimmed = inputValue.trim();
  if (trimmed) {
    return trimmed.split(',').map(s => s.trim()).filter(Boolean);
  }
  if (parsedTools && parsedTools.length > 0) {
    return parsedTools;
  }
  return undefined;
}

function isSkillEntry(entry: ProviderCommandEntry): boolean {
  return entry.kind === 'skill';
}

/** 设置页主列表预览条数上限（C03/C04） */
const SLASH_COMMANDS_PREVIEW_LIMIT = 5;

/**
 * 在弹窗中展示全部命令与技能，避免主设置页过长。
 */
class SlashCommandsFullListModal extends Modal {
  constructor(
    app: App,
    private readonly entries: ProviderCommandEntry[],
    private readonly slashAssetScope: SlashAssetScope,
    private readonly renderRow: (parent: HTMLElement, cmd: ProviderCommandEntry) => void,
    private readonly openFolderInManager: (absolutePath: string) => Promise<OpenInFileManagerResult>,
  ) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText(
      t('settings.slashCommands.viewAllModalTitle', { count: String(this.entries.length) }),
    );
    this.modalEl.addClass('claudian-sp-modal');

    const toolbar = this.contentEl.createDiv({ cls: 'claudian-sp-modal-folder-toolbar' });
    toolbar.createEl('p', {
      cls: 'setting-item-description',
      text: t('settings.slashCommands.modalFolderHint'),
    });
    const btnRow = toolbar.createDiv({ cls: 'claudian-sp-modal-folder-btns' });

    const addFolderButton = (label: string, target: string | null): void => {
      const btn = btnRow.createEl('button', {
        type: 'button',
        cls: 'claudian-settings-action-btn claudian-settings-action-btn--text claudian-sp-modal-folder-btn',
      });
      btn.setText(label);
      btn.addEventListener('click', () => {
        void (async () => {
          if (!target) {
            new Notice(t('settings.slashCommands.openFolderVaultPathUnknown'));
            return;
          }
          const result = await this.openFolderInManager(target);
          if (!result.ok) {
            if (result.reason === 'no-shell') {
              new Notice(t('settings.slashCommands.openFolderUnavailable'));
            } else {
              new Notice(t('settings.slashCommands.openFolderFailed', { message: result.detail }));
            }
          }
        })();
      });
    };

    addFolderButton(
      t('settings.slashCommands.modalOpenVaultCommands'),
      resolveSlashCommandsRootDir(this.app, 'vault'),
    );
    addFolderButton(
      t('settings.slashCommands.modalOpenVaultSkills'),
      resolveSlashSkillsRootDir(this.app, 'vault'),
    );
    if (this.slashAssetScope === 'vault-and-user-home') {
      addFolderButton(
        t('settings.slashCommands.modalOpenHomeCommands'),
        resolveSlashCommandsRootDir(this.app, 'user-home'),
      );
      addFolderButton(
        t('settings.slashCommands.modalOpenHomeSkills'),
        resolveSlashSkillsRootDir(this.app, 'user-home'),
      );
    }

    const scroll = this.contentEl.createDiv({ cls: 'claudian-sp-modal-scroll' });
    scroll.style.maxHeight = '70vh';
    scroll.style.overflow = 'auto';
    for (const cmd of this.entries) {
      this.renderRow(scroll, cmd);
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export class SlashCommandModal extends Modal {
  private entries: ProviderCommandEntry[];
  private existingEntry: ProviderCommandEntry | null;
  private onSave: (entry: ProviderCommandEntry) => Promise<void>;

  constructor(
    app: App,
    entries: ProviderCommandEntry[],
    existingEntry: ProviderCommandEntry | null,
    onSave: (entry: ProviderCommandEntry) => Promise<void>,
  ) {
    super(app);
    this.entries = entries;
    this.existingEntry = existingEntry;
    this.onSave = onSave;
  }

  onOpen() {
    const existingIsSkill = this.existingEntry ? isSkillEntry(this.existingEntry) : false;
    let selectedType: 'command' | 'skill' = existingIsSkill ? 'skill' : 'command';

    const refreshTitle = () => {
      if (this.existingEntry) {
        this.setTitle(
          selectedType === 'skill'
            ? t('settings.slashCommandModal.modalTitleEditSkill')
            : t('settings.slashCommandModal.modalTitleEditCommand'),
        );
      } else {
        this.setTitle(
          selectedType === 'skill'
            ? t('settings.slashCommandModal.modalTitleAddSkill')
            : t('settings.slashCommandModal.modalTitleAddCommand'),
        );
      }
    };
    refreshTitle();
    this.modalEl.addClass('claudian-sp-modal');

    const { contentEl } = this;

    let nameInput: HTMLInputElement;
    let descInput: HTMLInputElement;
    let hintInput: HTMLInputElement;
    let modelInput: HTMLInputElement;
    let toolsInput: HTMLInputElement;
    let disableModelToggle = this.existingEntry?.disableModelInvocation ?? false;
    let disableUserInvocation = this.existingEntry?.userInvocable === false;
    let contextValue: 'fork' | '' = this.existingEntry?.context ?? '';
    let agentInput: HTMLInputElement;

    /* eslint-disable prefer-const -- assigned in Setting callbacks */
    let disableUserSetting!: Setting;
    let disableUserToggle!: ToggleComponent;
    /* eslint-enable prefer-const */

    const updateSkillOnlyFields = () => {
      const isSkillType = selectedType === 'skill';
      disableUserSetting.settingEl.style.display = isSkillType ? '' : 'none';
      if (!isSkillType) {
        disableUserInvocation = false;
        disableUserToggle.setValue(false);
      }
    };

    new Setting(contentEl)
      .setName(t('settings.slashCommandModal.typeName'))
      .setDesc(t('settings.slashCommandModal.typeDesc'))
      .addDropdown(dropdown => {
        dropdown
          .addOption('command', t('settings.slashCommandModal.typeCommand'))
          .addOption('skill', t('settings.slashCommandModal.typeSkill'))
          .setValue(selectedType)
          .onChange(value => {
            selectedType = value as 'command' | 'skill';
            refreshTitle();
            updateSkillOnlyFields();
          });
        if (this.existingEntry) {
          dropdown.setDisabled(true);
        }
      });

    new Setting(contentEl)
      .setName(t('settings.slashCommandModal.commandName'))
      .setDesc(t('settings.slashCommandModal.commandNameDesc'))
      .addText(text => {
        nameInput = text.inputEl;
        text.setValue(this.existingEntry?.name || '')
          .setPlaceholder('review-code');
      });

    new Setting(contentEl)
      .setName(t('settings.slashCommandModal.description'))
      .setDesc(t('settings.slashCommandModal.descriptionDesc'))
      .addText(text => {
        descInput = text.inputEl;
        text.setValue(this.existingEntry?.description || '');
      });

    const details = contentEl.createEl('details', { cls: 'claudian-sp-advanced-section' });
    details.createEl('summary', {
      text: t('settings.subagents.modal.advancedOptions'),
      cls: 'claudian-sp-advanced-summary',
    });
    if (
      this.existingEntry?.argumentHint
      || this.existingEntry?.model
      || this.existingEntry?.allowedTools?.length
      || this.existingEntry?.disableModelInvocation
      || this.existingEntry?.userInvocable === false
      || this.existingEntry?.context
      || this.existingEntry?.agent
    ) {
      details.open = true;
    }

    new Setting(details)
      .setName(t('settings.slashCommandModal.argumentHint'))
      .setDesc(t('settings.slashCommandModal.argumentHintDesc'))
      .addText(text => {
        hintInput = text.inputEl;
        text.setValue(this.existingEntry?.argumentHint || '');
      });

    new Setting(details)
      .setName(t('settings.slashCommandModal.modelOverride'))
      .setDesc(t('settings.slashCommandModal.modelOverrideDesc'))
      .addText(text => {
        modelInput = text.inputEl;
        text.setValue(this.existingEntry?.model || '')
          .setPlaceholder('claude-sonnet-4-5');
      });

    new Setting(details)
      .setName(t('settings.slashCommandModal.allowedTools'))
      .setDesc(t('settings.slashCommandModal.allowedToolsDesc'))
      .addText(text => {
        toolsInput = text.inputEl;
        text.setValue(this.existingEntry?.allowedTools?.join(', ') || '');
      });

    new Setting(details)
      .setName(t('settings.slashCommandModal.disableModelInvocation'))
      .setDesc(t('settings.slashCommandModal.disableModelInvocationDesc'))
      .addToggle(toggle => {
        toggle.setValue(disableModelToggle)
          .onChange(value => { disableModelToggle = value; });
      });

    disableUserSetting = new Setting(details)
      .setName(t('settings.slashCommandModal.disableUserInvocation'))
      .setDesc(t('settings.slashCommandModal.disableUserInvocationDesc'))
      .addToggle(toggle => {
        disableUserToggle = toggle;
        toggle.setValue(disableUserInvocation)
          .onChange(value => { disableUserInvocation = value; });
      });

    updateSkillOnlyFields();

    new Setting(details)
      .setName(t('settings.slashCommandModal.context'))
      .setDesc(t('settings.slashCommandModal.contextDesc'))
      .addToggle(toggle => {
        toggle.setValue(contextValue === 'fork')
          .onChange(value => {
            contextValue = value ? 'fork' : '';
            agentSetting.settingEl.style.display = value ? '' : 'none';
          });
      });

    const agentSetting = new Setting(details)
      .setName(t('settings.slashCommandModal.agent'))
      .setDesc(t('settings.slashCommandModal.agentDesc'))
      .addText(text => {
        agentInput = text.inputEl;
        text.setValue(this.existingEntry?.agent || '')
          .setPlaceholder('code-reviewer');
      });
    agentSetting.settingEl.style.display = contextValue === 'fork' ? '' : 'none';

    new Setting(contentEl)
      .setName(t('settings.slashCommandModal.promptTemplate'))
      .setDesc(t('settings.slashCommandModal.promptTemplateDesc'));

    const contentArea = contentEl.createEl('textarea', {
      cls: 'claudian-sp-content-area',
      attr: {
        rows: '10',
        placeholder: 'Review this code for:\n$ARGUMENTS\n\n@$1',
      },
    });
    const initialContent = this.existingEntry
      ? parseSlashCommandContent(this.existingEntry.content).promptContent
      : '';
    contentArea.value = initialContent;

    const buttonContainer = contentEl.createDiv({ cls: 'claudian-sp-modal-buttons' });

    const cancelBtn = buttonContainer.createEl('button', {
      text: t('common.cancel'),
      cls: 'claudian-cancel-btn',
    });
    cancelBtn.addEventListener('click', () => this.close());

    const saveBtn = buttonContainer.createEl('button', {
      text: t('common.save'),
      cls: 'claudian-save-btn',
    });
    saveBtn.addEventListener('click', async () => {
      const name = nameInput.value.trim();
      const nameError = validateCommandName(name);
      if (nameError) {
        new Notice(nameError);
        return;
      }

      const content = contentArea.value;
      if (!content.trim()) {
        new Notice(t('settings.slashCommandModal.promptRequired'));
        return;
      }

      const existing = this.entries.find(
        entry => entry.name.toLowerCase() === name.toLowerCase()
          && entry.id !== this.existingEntry?.id,
      );
      if (existing) {
        new Notice(
          isSkillEntry(existing)
            ? t('settings.slashCommandModal.skillExists', { name })
            : t('settings.slashCommandModal.commandExists', { name }),
        );
        return;
      }

      const parsed = parseSlashCommandContent(content);
      const promptContent = parsed.promptContent;
      const isSkillType = selectedType === 'skill';

      const entry: ProviderCommandEntry = {
        id: this.existingEntry?.id || (
          isSkillType
            ? `skill-${name}`
            : `cmd-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
        ),
        providerId: 'claude',
        kind: isSkillType ? 'skill' : 'command',
        name,
        description: descInput.value.trim() || parsed.description || undefined,
        argumentHint: normalizeArgumentHint(hintInput.value.trim()) || parsed.argumentHint || undefined,
        allowedTools: resolveAllowedTools(toolsInput.value, parsed.allowedTools),
        model: modelInput.value.trim() || parsed.model || undefined,
        content: promptContent,
        disableModelInvocation: disableModelToggle || undefined,
        userInvocable: disableUserInvocation ? false : undefined,
        context: contextValue || undefined,
        agent: contextValue === 'fork' ? (agentInput.value.trim() || undefined) : undefined,
        hooks: parsed.hooks ?? this.existingEntry?.hooks,
        scope: 'vault',
        source: this.existingEntry?.source ?? 'user',
        isEditable: true,
        isDeletable: true,
        displayPrefix: '/',
        insertPrefix: '/',
        persistenceKey: this.existingEntry?.persistenceKey,
      };

      try {
        await this.onSave(entry);
      } catch {
        new Notice(
          isSkillType
            ? t('settings.slashCommandModal.saveFailedSkill')
            : t('settings.slashCommandModal.saveFailedCommand'),
        );
        return;
      }
      this.close();
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      }
    };
    contentEl.addEventListener('keydown', handleKeyDown);
  }

  onClose() {
    this.contentEl.empty();
  }
}

export class SlashCommandSettings {
  private app: App;
  private containerEl: HTMLElement;
  private catalog: ProviderCommandCatalog | null;
  private commands: ProviderCommandEntry[] = [];
  private slashAssetScope: SlashAssetScope;

  constructor(
    containerEl: HTMLElement,
    app: App,
    catalog: ProviderCommandCatalog | null,
    slashAssetScope: SlashAssetScope = 'vault-and-user-home',
  ) {
    this.app = app;
    this.containerEl = containerEl;
    this.catalog = catalog;
    this.slashAssetScope = slashAssetScope;
    void this.loadAndRender();
  }

  private handleOpenFolderResult(result: OpenInFileManagerResult): void {
    if (result.ok) {
      return;
    }
    if (result.reason === 'no-shell') {
      new Notice(t('settings.slashCommands.openFolderUnavailable'));
    } else {
      new Notice(t('settings.slashCommands.openFolderFailed', { message: result.detail }));
    }
  }

  /** 在系统文件管理器中打开某一命令/技能对应的文件或目录 */
  private async revealSlashEntryPath(cmd: ProviderCommandEntry): Promise<void> {
    const absolute = resolveSlashFileAbsolutePath(this.app, cmd);
    if (!absolute) {
      new Notice(t('settings.slashCommands.openFolderPathUnresolved'));
      return;
    }
    const result = await revealFileOrOpenParentDirectory(absolute);
    this.handleOpenFolderResult(result);
  }

  private async loadAndRender(): Promise<void> {
    if (!this.catalog) {
      this.renderUnavailable();
      return;
    }

    this.commands = await this.catalog.listVaultEntries();
    this.render();
  }

  /** 用户主动重扫库内与本机（若已启用）命令/技能文件，行为对齐插件列表「刷新」。 */
  private async onRefreshClicked(): Promise<void> {
    try {
      await this.loadAndRender();
      new Notice(t('settings.slashCommands.noticeRefreshed'));
    } catch {
      new Notice(t('settings.slashCommands.refreshFailed'));
    }
  }

  private renderUnavailable(): void {
    this.containerEl.empty();
    const emptyEl = this.containerEl.createDiv({ cls: 'claudian-sp-empty-state' });
    emptyEl.setText(t('settings.slashCommandModal.catalogUnavailable'));
  }

  private render(): void {
    this.containerEl.empty();

    const headerEl = this.containerEl.createDiv({ cls: 'claudian-sp-header' });
    headerEl.createSpan({ text: t('settings.slashCommands.previewLabel'), cls: 'claudian-sp-label' });

    const actionsEl = headerEl.createDiv({ cls: 'claudian-sp-header-actions' });

    if (this.commands.length > SLASH_COMMANDS_PREVIEW_LIMIT) {
      const viewAllBtn = actionsEl.createEl('button', {
        cls: 'claudian-settings-action-btn claudian-settings-action-btn--text',
        attr: { 'aria-label': t('settings.slashCommands.viewAll', { count: String(this.commands.length) }) },
      });
      viewAllBtn.setText(t('settings.slashCommands.viewAll', { count: String(this.commands.length) }));
      viewAllBtn.addEventListener('click', () => this.openViewAllModal());
    }

    const addBtn = actionsEl.createEl('button', {
      cls: 'claudian-settings-action-btn',
      attr: { 'aria-label': t('common.add') },
    });
    setIcon(addBtn, 'plus');
    addBtn.addEventListener('click', () => this.openCommandModal(null));

    const refreshBtn = actionsEl.createEl('button', {
      cls: 'claudian-settings-action-btn claudian-sp-header-action-trailing',
      attr: { 'aria-label': t('common.refresh') },
    });
    setIcon(refreshBtn, 'refresh-cw');
    refreshBtn.addEventListener('click', () => {
      void this.onRefreshClicked();
    });

    if (this.commands.length === 0) {
      const emptyEl = this.containerEl.createDiv({ cls: 'claudian-sp-empty-state' });
      emptyEl.setText(t('settings.slashCommandModal.emptyList'));
      return;
    }

    const listEl = this.containerEl.createDiv({ cls: 'claudian-sp-list' });

    const preview = this.commands.slice(0, SLASH_COMMANDS_PREVIEW_LIMIT);
    for (const cmd of preview) {
      this.renderCommandRow(listEl, cmd);
    }
  }

  private openViewAllModal(): void {
    const modal = new SlashCommandsFullListModal(
      this.app,
      this.commands,
      this.slashAssetScope,
      (parent, cmd) => this.renderCommandRow(parent, cmd),
      (absolutePath) => openAbsolutePathInFileManager(absolutePath),
    );
    modal.open();
  }

  /** 存在「本机共用」条目时，为「本库」行也显示来源标签，便于区分。 */
  private shouldShowVaultProvenanceTag(): boolean {
    return this.commands.some(c => c.slashFileProvenance === 'user-home');
  }

  private renderCommandRow(listEl: HTMLElement, cmd: ProviderCommandEntry): void {
    const itemEl = listEl.createDiv({ cls: 'claudian-sp-item' });

    const infoEl = itemEl.createDiv({ cls: 'claudian-sp-info' });

    const headerRow = infoEl.createDiv({ cls: 'claudian-sp-item-header' });

    const nameEl = headerRow.createSpan({ cls: 'claudian-sp-item-name' });
    nameEl.setText(`/${cmd.name}`);

    if (isSkillEntry(cmd)) {
      headerRow.createSpan({ text: t('settings.codexSkills.badgeSkill'), cls: 'claudian-slash-item-badge' });
    }

    if (cmd.slashFileProvenance === 'user-home') {
      headerRow.createSpan({
        text: t('settings.slashCommands.provenanceUserHome'),
        cls: 'claudian-slash-provenance-tag',
      });
    } else if (this.shouldShowVaultProvenanceTag() && cmd.slashFileProvenance === 'vault') {
      headerRow.createSpan({
        text: t('settings.slashCommands.provenanceVault'),
        cls: 'claudian-slash-provenance-tag',
      });
    }

    if (cmd.argumentHint) {
      const hintEl = headerRow.createSpan({ cls: 'claudian-slash-item-hint' });
      hintEl.setText(cmd.argumentHint);
    }

    if (cmd.description) {
      const descEl = infoEl.createDiv({ cls: 'claudian-sp-item-desc' });
      descEl.setText(cmd.description);
    }

    const actionsEl = itemEl.createDiv({ cls: 'claudian-sp-item-actions' });

    if (cmd.isEditable) {
      const editBtn = actionsEl.createEl('button', {
        cls: 'claudian-settings-action-btn',
        attr: { 'aria-label': t('common.edit') },
      });
      setIcon(editBtn, 'pencil');
      editBtn.addEventListener('click', () => this.openCommandModal(cmd));
    }

    if (cmd.slashFileProvenance) {
      const revealBtn = actionsEl.createEl('button', {
        cls: 'claudian-settings-action-btn',
        attr: { 'aria-label': t('settings.slashCommands.revealInFileManagerAria') },
      });
      setIcon(revealBtn, 'folder-open');
      revealBtn.addEventListener('click', () => {
        void this.revealSlashEntryPath(cmd);
      });
    }

    if (!isSkillEntry(cmd) && cmd.isEditable) {
      const convertBtn = actionsEl.createEl('button', {
        cls: 'claudian-settings-action-btn',
        attr: { 'aria-label': t('settings.slashCommandModal.convertToSkillAria') },
      });
      setIcon(convertBtn, 'package');
      convertBtn.addEventListener('click', async () => {
        try {
          await this.transformToSkill(cmd);
        } catch {
          new Notice(t('settings.slashCommandModal.convertToSkillFailed'));
        }
      });
    }

    if (cmd.isDeletable) {
      const deleteBtn = actionsEl.createEl('button', {
        cls: 'claudian-settings-action-btn claudian-settings-delete-btn',
        attr: { 'aria-label': t('common.delete') },
      });
      setIcon(deleteBtn, 'trash-2');
      deleteBtn.addEventListener('click', async () => {
        try {
          await this.deleteCommand(cmd);
        } catch {
          new Notice(
            isSkillEntry(cmd)
              ? t('settings.slashCommandModal.deleteFailedSkill')
              : t('settings.slashCommandModal.deleteFailedCommand'),
          );
        }
      });
    }
  }

  private openCommandModal(existingCmd: ProviderCommandEntry | null): void {
    const modal = new SlashCommandModal(
      this.app,
      this.commands,
      existingCmd,
      async (cmd) => {
        await this.saveCommand(cmd, existingCmd);
      },
    );
    modal.open();
  }

  private async saveCommand(cmd: ProviderCommandEntry, existing: ProviderCommandEntry | null): Promise<void> {
    if (!this.catalog) {
      return;
    }

    try {
      await this.catalog.saveVaultEntry(cmd);
    } catch {
      new Notice(t('settings.slashCommands.readOnlyHomeNotice'));
      return;
    }

    if (existing && existing.name !== cmd.name) {
      await this.catalog.deleteVaultEntry(existing);
    }

    await this.reloadCommands();

    this.render();
    const action = existing ? t('settings.slashCommandModal.updated') : t('settings.slashCommandModal.created');
    new Notice(
      isSkillEntry(cmd)
        ? t('settings.slashCommandModal.savedSkill', { name: cmd.name, action })
        : t('settings.slashCommandModal.savedCommand', { name: cmd.name, action }),
    );
  }

  private async deleteCommand(cmd: ProviderCommandEntry): Promise<void> {
    if (!this.catalog) {
      return;
    }

    await this.catalog.deleteVaultEntry(cmd);

    await this.reloadCommands();

    this.render();
    new Notice(
      isSkillEntry(cmd)
        ? t('settings.slashCommandModal.deletedSkill', { name: cmd.name })
        : t('settings.slashCommandModal.deletedCommand', { name: cmd.name }),
    );
  }

  private async transformToSkill(cmd: ProviderCommandEntry): Promise<void> {
    if (!this.catalog) {
      return;
    }

    const skillName = cmd.name.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 64);

    const existingSkill = this.commands.find(
      entry => isSkillEntry(entry) && entry.name === skillName,
    );
    if (existingSkill) {
      new Notice(t('settings.slashCommandModal.skillExists', { name: skillName }));
      return;
    }

    const skill: ProviderCommandEntry = {
      ...cmd,
      id: `skill-${skillName}`,
      kind: 'skill',
      name: skillName,
      description: cmd.description || extractFirstParagraph(cmd.content),
      source: 'user',
      scope: 'vault',
      slashFileProvenance: 'vault',
      isEditable: true,
      isDeletable: true,
      displayPrefix: '/',
      insertPrefix: '/',
    };

    await this.catalog.saveVaultEntry(skill);
    await this.catalog.deleteVaultEntry(cmd);

    await this.reloadCommands();
    this.render();
    new Notice(t('settings.slashCommandModal.convertedToSkill', { name: cmd.name }));
  }

  private async reloadCommands(): Promise<void> {
    if (!this.catalog) {
      this.commands = [];
      return;
    }

    this.commands = await this.catalog.listVaultEntries();
  }

  public refresh(): void {
    void this.loadAndRender();
  }
}
