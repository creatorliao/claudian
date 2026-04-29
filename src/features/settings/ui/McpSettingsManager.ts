import type { App } from 'obsidian';
import { Notice, setIcon } from 'obsidian';

import { tryParseClipboardConfig } from '../../../core/mcp/McpConfigParser';
import { testMcpServer } from '../../../core/mcp/McpTester';
import type { AppMcpStorage } from '../../../core/providers/types';
import type { ManagedMcpServer, McpServerConfig, McpServerType } from '../../../core/types';
import { DEFAULT_MCP_SERVER, getMcpServerType } from '../../../core/types';
import { t } from '../../../i18n/i18n';
import { McpServerModal } from './McpServerModal';
import { McpTestModal } from './McpTestModal';

export interface McpSettingsManagerDeps {
  app: App;
  mcpStorage: AppMcpStorage;
  broadcastMcpReload: () => Promise<void>;
}

export class McpSettingsManager {
  private app: App;
  private containerEl: HTMLElement;
  private mcpStorage: AppMcpStorage;
  private broadcastMcpReload: () => Promise<void>;
  private servers: ManagedMcpServer[] = [];

  constructor(containerEl: HTMLElement, deps: McpSettingsManagerDeps) {
    this.app = deps.app;
    this.containerEl = containerEl;
    this.mcpStorage = deps.mcpStorage;
    this.broadcastMcpReload = deps.broadcastMcpReload;
    this.loadAndRender();
  }

  private async loadAndRender() {
    this.servers = await this.mcpStorage.load();
    this.render();
  }

  /**
   * 从磁盘重载 MCP 配置并重绘列表，再通知各聊天 Tab 调用 reloadMcpServers，使工具栏与运行时列表与文件一致。
   */
  private async refreshList(): Promise<void> {
    try {
      await this.loadAndRender();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      new Notice(t('settings.mcpList.noticeRefreshFailed', { message }));
      return;
    }

    try {
      await this.broadcastMcpReload();
      new Notice(t('settings.mcpList.noticeListRefreshed'));
    } catch {
      new Notice(t('settings.mcpList.noticeReloadFailed'));
    }
  }

  private render() {
    this.containerEl.empty();

    const headerEl = this.containerEl.createDiv({ cls: 'claudian-mcp-header' });
    headerEl.createSpan({ text: t('settings.mcpList.headerLabel'), cls: 'claudian-mcp-label' });

    const headerActions = headerEl.createDiv({ cls: 'claudian-mcp-header-actions' });

    const refreshBtn = headerActions.createEl('button', {
      cls: 'claudian-settings-action-btn',
      attr: { 'aria-label': t('common.refresh') },
    });
    setIcon(refreshBtn, 'refresh-cw');
    refreshBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      void this.refreshList();
    });

    const addContainer = headerActions.createDiv({ cls: 'claudian-mcp-add-container' });
    const addBtn = addContainer.createEl('button', {
      cls: 'claudian-settings-action-btn',
      attr: { 'aria-label': t('settings.mcpList.addAria') },
    });
    setIcon(addBtn, 'plus');

    const dropdown = addContainer.createDiv({ cls: 'claudian-mcp-add-dropdown' });

    const stdioOption = dropdown.createDiv({ cls: 'claudian-mcp-add-option' });
    setIcon(stdioOption.createSpan({ cls: 'claudian-mcp-add-option-icon' }), 'terminal');
    stdioOption.createSpan({ text: t('settings.mcpList.addStdio') });
    stdioOption.addEventListener('click', () => {
      dropdown.removeClass('is-visible');
      this.openModal(null, 'stdio');
    });

    const httpOption = dropdown.createDiv({ cls: 'claudian-mcp-add-option' });
    setIcon(httpOption.createSpan({ cls: 'claudian-mcp-add-option-icon' }), 'globe');
    httpOption.createSpan({ text: t('settings.mcpList.addRemote') });
    httpOption.addEventListener('click', () => {
      dropdown.removeClass('is-visible');
      this.openModal(null, 'http');
    });

    const importOption = dropdown.createDiv({ cls: 'claudian-mcp-add-option' });
    setIcon(importOption.createSpan({ cls: 'claudian-mcp-add-option-icon' }), 'clipboard-paste');
    importOption.createSpan({ text: t('settings.mcpList.importClipboard') });
    importOption.addEventListener('click', () => {
      dropdown.removeClass('is-visible');
      this.importFromClipboard();
    });

    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.toggleClass('is-visible', !dropdown.hasClass('is-visible'));
    });

    document.addEventListener('click', () => {
      dropdown.removeClass('is-visible');
    });

    if (this.servers.length === 0) {
      const emptyEl = this.containerEl.createDiv({ cls: 'claudian-mcp-empty' });
      emptyEl.setText(t('settings.mcpList.empty'));
      return;
    }

    const listEl = this.containerEl.createDiv({ cls: 'claudian-mcp-list' });
    for (const server of this.servers) {
      this.renderServerItem(listEl, server);
    }
  }

  private renderServerItem(listEl: HTMLElement, server: ManagedMcpServer) {
    const itemEl = listEl.createDiv({ cls: 'claudian-mcp-item' });
    if (!server.enabled) {
      itemEl.addClass('claudian-mcp-item-disabled');
    }

    const statusEl = itemEl.createDiv({ cls: 'claudian-mcp-status' });
    statusEl.addClass(
      server.enabled ? 'claudian-mcp-status-enabled' : 'claudian-mcp-status-disabled'
    );

    const infoEl = itemEl.createDiv({ cls: 'claudian-mcp-info' });

    const nameRow = infoEl.createDiv({ cls: 'claudian-mcp-name-row' });

    const nameEl = nameRow.createSpan({ cls: 'claudian-mcp-name' });
    nameEl.setText(server.name);

    const serverType = getMcpServerType(server.config);
    const typeEl = nameRow.createSpan({ cls: 'claudian-mcp-type-badge' });
    typeEl.setText(serverType);

    if (server.contextSaving) {
      const csEl = nameRow.createSpan({ cls: 'claudian-mcp-context-saving-badge' });
      csEl.setText('@');
      csEl.setAttribute('title', t('settings.mcpList.contextSavingTitle', { name: server.name }));
    }

    const previewEl = infoEl.createDiv({ cls: 'claudian-mcp-preview' });
    if (server.description) {
      previewEl.setText(server.description);
    } else {
      previewEl.setText(this.getServerPreview(server, serverType));
    }

    const actionsEl = itemEl.createDiv({ cls: 'claudian-mcp-actions' });

    const testBtn = actionsEl.createEl('button', {
      cls: 'claudian-mcp-action-btn',
      attr: { 'aria-label': t('settings.mcpList.verifyAria') },
    });
    setIcon(testBtn, 'zap');
    testBtn.addEventListener('click', () => this.testServer(server));

    const toggleBtn = actionsEl.createEl('button', {
      cls: 'claudian-mcp-action-btn',
      attr: {
        'aria-label': server.enabled ? t('settings.mcpList.disableAria') : t('settings.mcpList.enableAria'),
      },
    });
    setIcon(toggleBtn, server.enabled ? 'toggle-right' : 'toggle-left');
    toggleBtn.addEventListener('click', () => this.toggleServer(server));

    const editBtn = actionsEl.createEl('button', {
      cls: 'claudian-mcp-action-btn',
      attr: { 'aria-label': t('settings.mcpList.editAria') },
    });
    setIcon(editBtn, 'pencil');
    editBtn.addEventListener('click', () => this.openModal(server));

    const deleteBtn = actionsEl.createEl('button', {
      cls: 'claudian-mcp-action-btn claudian-mcp-delete-btn',
      attr: { 'aria-label': t('settings.mcpList.deleteAria') },
    });
    setIcon(deleteBtn, 'trash-2');
    deleteBtn.addEventListener('click', () => this.deleteServer(server));
  }

  private async testServer(server: ManagedMcpServer) {
    const modal = new McpTestModal(
      this.app,
      server.name,
      server.disabledTools,
      async (toolName, enabled) => {
        await this.updateDisabledTool(server, toolName, enabled);
      },
      async (disabledTools) => {
        await this.updateAllDisabledTools(server, disabledTools);
      }
    );
    modal.open();

    try {
      const result = await testMcpServer(server);
      modal.setResult(result);
    } catch (error) {
      modal.setError(
        error instanceof Error ? error.message : t('chat.notices.mcpVerificationFailed'),
      );
    }
  }

  /** Rolls back on save failure; warns on reload failure (since save succeeded). */
  private async updateServerDisabledTools(
    server: ManagedMcpServer,
    newDisabledTools: string[] | undefined
  ): Promise<void> {
    const previous = server.disabledTools ? [...server.disabledTools] : undefined;
    server.disabledTools = newDisabledTools;

    try {
      await this.mcpStorage.save(this.servers);
    } catch (error) {
      server.disabledTools = previous;
      throw error;
    }

    try {
      await this.broadcastMcpReload();
    } catch {
      // Save succeeded but reload failed - don't rollback since disk has correct state
      new Notice(t('settings.mcpList.noticeReloadFailed'));
    }
  }

  private async updateDisabledTool(
    server: ManagedMcpServer,
    toolName: string,
    enabled: boolean
  ) {
    const disabledTools = new Set(server.disabledTools ?? []);
    if (enabled) {
      disabledTools.delete(toolName);
    } else {
      disabledTools.add(toolName);
    }
    await this.updateServerDisabledTools(
      server,
      disabledTools.size > 0 ? Array.from(disabledTools) : undefined
    );
  }

  private async updateAllDisabledTools(server: ManagedMcpServer, disabledTools: string[]) {
    await this.updateServerDisabledTools(
      server,
      disabledTools.length > 0 ? disabledTools : undefined
    );
  }

  private getServerPreview(server: ManagedMcpServer, type: McpServerType): string {
    if (type === 'stdio') {
      const config = server.config as { command: string; args?: string[] };
      const args = config.args?.join(' ') || '';
      return args ? `${config.command} ${args}` : config.command;
    } else {
      const config = server.config as { url: string };
      return config.url;
    }
  }

  private openModal(existing: ManagedMcpServer | null, initialType?: McpServerType) {
    const modal = new McpServerModal(
      this.app,
      existing,
      async (server) => {
        await this.saveServer(server, existing);
      },
      initialType
    );
    modal.open();
  }

  private async importFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        new Notice(t('settings.mcpList.clipboardEmpty'));
        return;
      }

      const parsed = tryParseClipboardConfig(text);
      if (!parsed || parsed.servers.length === 0) {
        new Notice(t('settings.mcpList.clipboardInvalid'));
        return;
      }

      if (parsed.needsName || parsed.servers.length === 1) {
        const server = parsed.servers[0];
        const type = getMcpServerType(server.config);
        const modal = new McpServerModal(
          this.app,
          null,
          async (savedServer) => {
            await this.saveServer(savedServer, null);
          },
          type,
          server  // Pre-fill with parsed config
        );
        modal.open();
        if (parsed.needsName) {
          new Notice(t('settings.mcpList.clipboardNamePrompt'));
        }
        return;
      }

      await this.importServers(parsed.servers);
    } catch {
      new Notice(t('settings.mcpList.clipboardReadFailed'));
    }
  }

  private async saveServer(server: ManagedMcpServer, existing: ManagedMcpServer | null) {
    if (existing) {
      const index = this.servers.findIndex((s) => s.name === existing.name);
      if (index !== -1) {
        if (server.name !== existing.name) {
          const conflict = this.servers.find((s) => s.name === server.name);
          if (conflict) {
            new Notice(t('settings.mcpList.serverExists', { name: server.name }));
            return;
          }
        }
        this.servers[index] = server;
      }
    } else {
      const conflict = this.servers.find((s) => s.name === server.name);
      if (conflict) {
        new Notice(t('settings.mcpList.serverExists', { name: server.name }));
        return;
      }
      this.servers.push(server);
    }

    await this.mcpStorage.save(this.servers);
    await this.broadcastMcpReload();
    this.render();
    new Notice(
      existing
        ? t('settings.mcpList.serverUpdated', { name: server.name })
        : t('settings.mcpList.serverAdded', { name: server.name }),
    );
  }

  private async importServers(servers: Array<{ name: string; config: McpServerConfig }>) {
    const added: string[] = [];
    const skipped: string[] = [];

    for (const server of servers) {
      const name = server.name.trim();
      if (!name || !/^[a-zA-Z0-9._-]+$/.test(name)) {
        skipped.push(server.name || '<unnamed>');
        continue;
      }

      const conflict = this.servers.find((s) => s.name === name);
      if (conflict) {
        skipped.push(name);
        continue;
      }

      this.servers.push({
        name,
        config: server.config,
        enabled: DEFAULT_MCP_SERVER.enabled,
        contextSaving: DEFAULT_MCP_SERVER.contextSaving,
      });
      added.push(name);
    }

    if (added.length === 0) {
      new Notice(t('settings.mcpList.importNone'));
      return;
    }

    await this.mcpStorage.save(this.servers);
    await this.broadcastMcpReload();
    this.render();

    new Notice(
      skipped.length > 0
        ? t('settings.mcpList.importedWithSkipped', { count: added.length, skipped: skipped.length })
        : t('settings.mcpList.imported', { count: added.length }),
    );
  }

  private async toggleServer(server: ManagedMcpServer) {
    server.enabled = !server.enabled;
    await this.mcpStorage.save(this.servers);
    await this.broadcastMcpReload();
    this.render();
    new Notice(
      t('settings.mcpList.serverToggled', {
        name: server.name,
        state: server.enabled
          ? t('settings.mcpList.serverEnabled')
          : t('settings.mcpList.serverDisabled'),
      }),
    );
  }

  private async deleteServer(server: ManagedMcpServer) {
    if (!confirm(t('settings.mcpList.deleteConfirm', { name: server.name }))) {
      return;
    }

    this.servers = this.servers.filter((s) => s.name !== server.name);
    await this.mcpStorage.save(this.servers);
    await this.broadcastMcpReload();
    this.render();
    new Notice(t('settings.mcpList.serverDeleted', { name: server.name }));
  }

  /** Refresh the server list (call after external changes). */
  public refresh() {
    this.loadAndRender();
  }
}
