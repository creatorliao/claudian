import type { Plugin } from 'obsidian';
import { Notice } from 'obsidian';

import { SESSIONS_PATH, SessionStorage } from '../../core/bootstrap/SessionStorage';
import type { SharedAppStorage } from '../../core/bootstrap/storage';
import { CLAUDIAN_STORAGE_PATH } from '../../core/bootstrap/StoragePaths';
import type { AppTabManagerState } from '../../core/providers/types';
import { VaultFileAdapter } from '../../core/storage/VaultFileAdapter';
import { t } from '../../i18n/i18n';
import { ClaudianSettingsStorage, type StoredClaudianSettings } from '../settings/ClaudianSettingsStorage';

export class SharedStorageService implements SharedAppStorage {
  readonly claudianSettings: ClaudianSettingsStorage;
  readonly sessions: SessionStorage;

  private adapter: VaultFileAdapter;
  private plugin: Plugin;

  constructor(plugin: Plugin) {
    this.plugin = plugin;
    this.adapter = new VaultFileAdapter(plugin.app);
    this.claudianSettings = new ClaudianSettingsStorage(this.adapter);
    this.sessions = new SessionStorage(this.adapter);
  }

  async initialize(): Promise<{ claudian: Record<string, unknown> }> {
    await this.ensureDirectories();
    const claudian = await this.claudianSettings.load();
    return { claudian };
  }

  async saveClaudianSettings(settings: Record<string, unknown>): Promise<void> {
    await this.claudianSettings.save(settings as StoredClaudianSettings);
  }

  async setTabManagerState(state: AppTabManagerState): Promise<void> {
    try {
      const data = (await this.plugin.loadData()) || {};
      data.tabManagerState = state;
      await this.plugin.saveData(data);
    } catch {
      new Notice(t('chat.notices.failedSaveTabLayout'));
    }
  }

  async getTabManagerState(): Promise<AppTabManagerState | null> {
    try {
      const data = await this.plugin.loadData();
      if (!data?.tabManagerState) {
        return null;
      }

      return this.validateTabManagerState(data.tabManagerState);
    } catch {
      return null;
    }
  }

  /**
   * 默认工作空间（Vault 相对路径），存于 data.json。
   */
  async getWorkspace(): Promise<string> {
    const data = (await this.plugin.loadData()) || {};
    return typeof data.workspace === 'string' ? data.workspace : '';
  }

  async setWorkspace(value: string): Promise<void> {
    const data = (await this.plugin.loadData()) || {};
    data.workspace = value ?? '';
    await this.plugin.saveData(data);
  }

  getAdapter(): VaultFileAdapter {
    return this.adapter;
  }

  private async ensureDirectories(): Promise<void> {
    await this.adapter.ensureFolder(CLAUDIAN_STORAGE_PATH);
    await this.adapter.ensureFolder(SESSIONS_PATH);
  }

  private validateTabManagerState(data: unknown): AppTabManagerState | null {
    if (!data || typeof data !== 'object') {
      return null;
    }

    const state = data as Record<string, unknown>;
    if (!Array.isArray(state.openTabs)) {
      return null;
    }

    const validatedTabs: AppTabManagerState['openTabs'] = [];
    for (const tab of state.openTabs) {
      if (!tab || typeof tab !== 'object') {
        continue;
      }

      const tabObj = tab as Record<string, unknown>;
      if (typeof tabObj.tabId !== 'string') {
        continue;
      }

      const ws = tabObj.workspace;
      validatedTabs.push({
        tabId: tabObj.tabId,
        conversationId: typeof tabObj.conversationId === 'string' ? tabObj.conversationId : null,
        workspace: typeof ws === 'string' || ws === null ? (ws as string | null) : undefined,
      });
    }

    return {
      openTabs: validatedTabs,
      activeTabId: typeof state.activeTabId === 'string' ? state.activeTabId : null,
    };
  }
}
