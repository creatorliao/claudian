// Must run before any SDK imports to patch Electron/Node.js realm incompatibility
import { patchSetMaxListenersForElectron } from "./utils/electronCompat";
patchSetMaxListenersForElectron();

import "./providers";

import type {
  Editor,
  WorkspaceLeaf,
  WorkspaceMobileDrawer,
  WorkspaceParent,
  WorkspaceSidedock,
} from "obsidian";
import { addIcon, MarkdownView, Notice, Plugin, TFolder } from "obsidian";
import * as path from "path";

import { DEFAULT_CLAUDIAN_SETTINGS } from "./app/settings/defaultSettings";
import { SharedStorageService } from "./app/storage/SharedStorageService";
import type { SharedAppStorage } from "./core/bootstrap/storage";
import {
  getEnvironmentVariablesForScope as getScopedEnvironmentVariables,
  getRuntimeEnvironmentText,
  setEnvironmentVariablesForScope,
} from "./core/providers/providerEnvironment";
import { ProviderRegistry } from "./core/providers/ProviderRegistry";
import { ProviderSettingsCoordinator } from "./core/providers/ProviderSettingsCoordinator";
import { ProviderWorkspaceRegistry } from "./core/providers/ProviderWorkspaceRegistry";
import type { ProviderId } from "./core/providers/types";
import type { AppTabManagerState } from "./core/providers/types";
import { DEFAULT_CHAT_PROVIDER_ID } from "./core/providers/types";
import type {
  ClaudianSettings,
  Conversation,
  ConversationMeta,
} from "./core/types";
import { VIEW_TYPE_CLAUDIAN } from "./core/types";
import type { EnvironmentScope } from "./core/types/settings";
import { ClaudianView } from "./features/chat/ClaudianView";
import {
  type InlineEditContext,
  InlineEditModal,
} from "./features/inline-edit/ui/InlineEditModal";
import { ClaudianSettingTab } from "./features/settings/ClaudianSettings";
import { normalizeClaudianLocale, setLocale, t } from "./i18n/i18n";
import type { Locale } from "./i18n/types";
import {
  CLAUDIAN_APP_ICON_ID,
  getClaudeBrandMarkAddIconInnerHtml,
} from "./shared/claudeBrandMark";
import { buildCursorContext } from "./utils/editor";
import {
  formatWorkspaceDisplayShort,
  getVaultPath,
  isPathWithinVault,
  resolveWorkspacePath,
} from "./utils/path";

export default class ClaudianPlugin extends Plugin {
  settings!: ClaudianSettings;
  storage!: SharedAppStorage;
  private conversations: Conversation[] = [];
  private lastKnownTabManagerState: AppTabManagerState | null = null;
  /** Ribbon 图标元素，用于更新工作空间 tooltip */
  private ribbonIconEl: HTMLElement | null = null;

  async onload() {
    await this.loadSettings();
    await ProviderWorkspaceRegistry.initializeAll(this);

    this.registerView(
      VIEW_TYPE_CLAUDIAN,
      (leaf) => new ClaudianView(leaf, this)
    );

    // 功能区与侧栏标签与视图内品牌标一致：使用 Claude 星芒（非 Lucide `bot`）
    addIcon(CLAUDIAN_APP_ICON_ID, getClaudeBrandMarkAddIconInnerHtml());
    // Ribbon：无聊天叶子则创建并打开；已有则侧栏用折叠/展开，主区用切换活动叶子（不销毁视图）
    this.ribbonIconEl = this.addRibbonIcon(CLAUDIAN_APP_ICON_ID, t("ribbon.toggleClaudian"), () => {
      void this.toggleClaudianView();
    });
    void this.updateRibbonTooltipFromStorage();

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (this.settings.allowWorkspaceSwitch !== true) return;
        if (file instanceof TFolder) {
          menu.addItem((item) =>
            item
              .setIcon(CLAUDIAN_APP_ICON_ID)
              .setTitle(t("contextMenu.setWorkspace"))
              .onClick(async () => {
                const vaultPath = getVaultPath(this.app);
                if (!vaultPath) return;
                const folderPath = path.join(vaultPath, file.path);
                if (!isPathWithinVault(folderPath, vaultPath)) {
                  new Notice(t("contextMenu.invalidPath"));
                  return;
                }
                await this.applyWorkspaceSwitch(file.path);
                new Notice(t("contextMenu.workspaceSet"));
              }),
          );
        }
      }),
    );

    this.addCommand({
      id: "open-view",
      name: t("commands.openChatView"),
      callback: () => {
        void this.activateView();
      },
    });

    this.addCommand({
      id: "toggle-view",
      name: t("commands.toggleChatView"),
      callback: () => {
        void this.toggleClaudianView();
      },
    });

    this.addCommand({
      id: "inline-edit",
      name: t("commands.inlineEdit"),
      editorCallback: async (editor: Editor, ctx) => {
        const view =
          ctx instanceof MarkdownView
            ? ctx
            : this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) {
          new Notice(t("chat.notices.inlineEditNoMarkdownView"));
          return;
        }

        const selectedText = editor.getSelection();
        const notePath = view.file?.path || "unknown";

        let editContext: InlineEditContext;
        if (selectedText.trim()) {
          editContext = { mode: "selection", selectedText };
        } else {
          const cursor = editor.getCursor();
          const cursorContext = buildCursorContext(
            (line) => editor.getLine(line),
            editor.lineCount(),
            cursor.line,
            cursor.ch
          );
          editContext = { mode: "cursor", cursorContext };
        }

        const modal = new InlineEditModal(
          this.app,
          this,
          editor,
          view,
          editContext,
          notePath,
          () =>
            this.getView()
              ?.getActiveTab()
              ?.ui.externalContextSelector?.getExternalContexts() ?? []
        );
        const result = await modal.openAndWait();

        if (result.decision === "accept" && result.editedText !== undefined) {
          new Notice(
            editContext.mode === "cursor"
              ? t("chat.notices.inlineEditInserted")
              : t("chat.notices.inlineEditApplied"),
          );
        }
      },
    });

    this.addCommand({
      id: "new-tab",
      name: t("commands.newTab"),
      checkCallback: (checking: boolean) => {
        if (!this.canCreateNewTab()) return false;

        if (!checking) {
          void this.openNewTab();
        }
        return true;
      },
    });

    this.addCommand({
      id: "new-session",
      name: t("commands.newSession"),
      checkCallback: (checking: boolean) => {
        const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDIAN)[0];
        if (!leaf) return false;

        const view = leaf.view as ClaudianView;
        const tabManager = view.getTabManager();
        if (!tabManager) return false;

        const activeTab = tabManager.getActiveTab();
        if (!activeTab) return false;

        if (activeTab.state.isStreaming) return false;

        if (!checking) {
          tabManager.createNewConversation();
        }
        return true;
      },
    });

    this.addCommand({
      id: "close-current-tab",
      name: t("commands.closeCurrentTab"),
      checkCallback: (checking: boolean) => {
        const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDIAN)[0];
        if (!leaf) return false;

        const view = leaf.view as ClaudianView;
        const tabManager = view.getTabManager();
        if (!tabManager) return false;

        if (!checking) {
          const activeTabId = tabManager.getActiveTabId();
          if (activeTabId) {
            tabManager.closeTab(activeTabId);
          }
        }
        return true;
      },
    });

    this.addCommand({
      id: "reset-workspace",
      name: t("commands.resetWorkspace"),
      checkCallback: (checking: boolean) => {
        if (this.settings.allowWorkspaceSwitch !== true) return false;
        if (!checking) {
          void this.resetWorkspaceAndNotify();
        }
        return true;
      },
    });

    this.addSettingTab(new ClaudianSettingTab(this.app, this));
  }

  async onunload() {
    // Ensures state is saved even if Obsidian quits without calling onClose()
    for (const view of this.getAllViews()) {
      const tabManager = view.getTabManager();
      if (tabManager) {
        const state = tabManager.getPersistedState();
        await this.persistTabManagerState(state);
      }
    }
  }

  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_CLAUDIAN)[0];

    if (!leaf) {
      const newLeaf = this.settings.openInMainTab
        ? workspace.getLeaf("tab")
        : workspace.getRightLeaf(false);
      if (newLeaf) {
        await newLeaf.setViewState({
          type: VIEW_TYPE_CLAUDIAN,
          active: true,
        });
        leaf = newLeaf;
      }
    }

    if (leaf) {
      await workspace.revealLeaf(leaf);
    }
  }

  /**
   * Ribbon / toggle-view：在「腾出空间」与「回到聊天」之间切换。
   *
   * **不销毁视图**：本方法 **绝不** 调用 `detachLeavesOfType`、`WorkspaceLeaf.detach()` 或任何移除叶子的 API，因此 **不会** 触发 `ClaudianView.onClose()`（该处会 `tabManager.destroy()`，才会停止会话与流式等）。侧栏 `collapse` / 主区 `setActiveLeaf` 仅改变可见性与焦点，**聊天 TabManager、进行中的任务与流式应持续运行**（与「关闭 Claudian 内部某一标签」的 `deactivateTab` 无关，后者仅在视图内多标签切换时发生）。
   *
   * - **尚无** `claudian-view` 叶子：等同首次打开 → `activateView()`（按设置落在右侧栏或主编辑区）。
   * - **在侧栏**（左/右 dock 或移动抽屉祖先）：dock **已折叠** → `expand` + `revealLeaf`（再次展示）；**未折叠** → `collapse`（收起让出宽度）。
   * - **在主编辑区等**（祖先链上无左右 dock）：当前活动视图是 Claudian → 若有主区其它叶子则 `setActiveLeaf`，**否则静默 return**；活动视图不是 Claudian → `revealLeaf` 回到聊天。
   *
   * 边界：主区仅有聊天、无其它根叶子时，无法切换焦点，**不** 调用 `revealLeaf`（静默跳过；可用侧栏模式或另开笔记）。
   */
  async toggleClaudianView(): Promise<void> {
    const { workspace } = this.app;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_CLAUDIAN);

    if (leaves.length === 0) {
      await this.activateView();
      return;
    }

    const primaryLeaf = leaves[0];
    const sidedock = this.findParentSidedock(primaryLeaf);

    if (sidedock) {
      if (sidedock.collapsed) {
        sidedock.expand();
        await workspace.revealLeaf(primaryLeaf);
      } else {
        sidedock.collapse();
      }
      return;
    }

    const activeClaudian = workspace.getActiveViewOfType(ClaudianView);
    if (activeClaudian) {
      const alternate = this.findLastNonClaudianRootLeaf();
      if (alternate) {
        workspace.setActiveLeaf(alternate, { focus: true });
      }
      return;
    }

    await workspace.revealLeaf(primaryLeaf);
  }

  /**
   * 自叶子沿 `parent` 向上查找，判断是否在左/右侧栏或移动抽屉内。
   */
  private findParentSidedock(
    leaf: WorkspaceLeaf,
  ): WorkspaceSidedock | WorkspaceMobileDrawer | null {
    const { workspace } = this.app;
    let p: WorkspaceParent | null = leaf.parent;
    while (p) {
      if (p === workspace.rightSplit || p === workspace.leftSplit) {
        return p as WorkspaceSidedock | WorkspaceMobileDrawer;
      }
      p = p.parent;
    }
    return null;
  }

  /**
   * 在主工作区（`iterateRootLeaves`）中寻找非 Claudian 的叶子，返回遍历中**最后一个**候选，以尽量贴近最近用过的标签。
   */
  private findLastNonClaudianRootLeaf(): WorkspaceLeaf | null {
    let candidate: WorkspaceLeaf | null = null;
    this.app.workspace.iterateRootLeaves((leaf) => {
      if (leaf.view.getViewType() !== VIEW_TYPE_CLAUDIAN) {
        candidate = leaf;
      }
    });
    return candidate;
  }

  private canCreateNewTab(): boolean {
    const view = this.getView();
    const tabManager = view?.getTabManager();

    if (tabManager) {
      return tabManager.canCreateTab();
    }

    if (view) {
      return false;
    }

    return this.getLastKnownOpenTabCount() < this.getMaxTabsLimit();
  }

  private async ensureViewOpen(): Promise<ClaudianView | null> {
    const existingView = this.getView();
    if (existingView) {
      return existingView;
    }

    await this.activateView();
    return this.getView();
  }

  private async openNewTab(): Promise<void> {
    const existingView = this.getView();
    if (existingView) {
      await existingView.createNewTab();
      return;
    }

    const restoredTabCount = this.getLastKnownOpenTabCount();
    const view = await this.ensureViewOpen();
    if (!view) {
      return;
    }

    // A cold-open view creates its initial tab during restore. Avoid stacking
    // an extra blank tab on top when there was no prior layout to restore.
    if (restoredTabCount === 0) {
      return;
    }

    await view.createNewTab();
  }

  async loadSettings() {
    this.storage = new SharedStorageService(this);
    const { claudian } = await this.storage.initialize();
    this.lastKnownTabManagerState = await this.storage.getTabManagerState();

    this.settings = {
      ...DEFAULT_CLAUDIAN_SETTINGS,
      ...claudian,
    } as ClaudianSettings;

    // 关闭「切换工作空间」时：不保留独立的默认工作目录快照（仅存空串等价库根）
    if (this.settings.allowWorkspaceSwitch !== true) {
      try {
        await this.storage.setWorkspace("");
      } catch {
        /* best-effort */
      }
    }

    // Plan mode is ephemeral — normalize back to normal on load so the app
    // doesn't start stuck in plan mode after a restart (prePlanPermissionMode is lost)
    if (this.settings.permissionMode === "plan") {
      this.settings.permissionMode = "normal";
    }

    const rawLocale = this.settings.locale;
    const normalizedLocale = normalizeClaudianLocale(rawLocale);
    const didNormalizeLocale = normalizedLocale !== rawLocale;
    this.settings.locale = normalizedLocale;

    const didNormalizeProviderSelection =
      ProviderSettingsCoordinator.normalizeProviderSelection(
        this.settings as unknown as Record<string, unknown>
      );
    const didNormalizeModelVariants = this.normalizeModelVariantSettings();

    const allMetadata = await this.storage.sessions.listMetadata();
    this.conversations = allMetadata
      .map((meta) => {
        const resumeSessionId =
          meta.sessionId !== undefined ? meta.sessionId : meta.id;

        return {
          id: meta.id,
          providerId: meta.providerId ?? DEFAULT_CHAT_PROVIDER_ID,
          title: meta.title,
          createdAt: meta.createdAt,
          updatedAt: meta.updatedAt,
          lastResponseAt: meta.lastResponseAt,
          sessionId: resumeSessionId,
          providerState: meta.providerState,
          messages: [],
          currentNote: meta.currentNote,
          externalContextPaths: meta.externalContextPaths,
          enabledMcpServers: meta.enabledMcpServers,
          usage: meta.usage,
          titleGenerationStatus: meta.titleGenerationStatus,
          resumeAtMessageId: meta.resumeAtMessageId,
        };
      })
      .sort(
        (a, b) =>
          (b.lastResponseAt ?? b.updatedAt) - (a.lastResponseAt ?? a.updatedAt)
      );
    setLocale(this.settings.locale as Locale);

    const backfilledConversations =
      this.backfillConversationResponseTimestamps();

    const { changed, invalidatedConversations } =
      this.reconcileModelWithEnvironment();

    ProviderSettingsCoordinator.projectActiveProviderState(
      this.settings as unknown as Record<string, unknown>
    );

    if (changed || didNormalizeModelVariants || didNormalizeProviderSelection || didNormalizeLocale) {
      await this.saveSettings();
    }

    const conversationsToSave = new Set([
      ...backfilledConversations,
      ...invalidatedConversations,
    ]);
    for (const conv of conversationsToSave) {
      await this.storage.sessions.saveMetadata(
        this.storage.sessions.toSessionMetadata(conv)
      );
    }
  }

  private backfillConversationResponseTimestamps(): Conversation[] {
    const updated: Conversation[] = [];
    for (const conv of this.conversations) {
      if (conv.lastResponseAt != null) continue;
      if (!conv.messages || conv.messages.length === 0) continue;

      for (let i = conv.messages.length - 1; i >= 0; i--) {
        const msg = conv.messages[i];
        if (msg.role === "assistant") {
          conv.lastResponseAt = msg.timestamp;
          updated.push(conv);
          break;
        }
      }
    }
    return updated;
  }

  normalizeModelVariantSettings(): boolean {
    return ProviderSettingsCoordinator.normalizeAllModelVariants(
      this.settings as unknown as Record<string, unknown>
    );
  }

  async saveSettings() {
    ProviderSettingsCoordinator.normalizeProviderSelection(
      this.settings as unknown as Record<string, unknown>
    );
    ProviderSettingsCoordinator.persistProjectedProviderState(
      this.settings as unknown as Record<string, unknown>
    );

    await this.storage.saveClaudianSettings(this.settings);
  }

  /** Updates and persists environment variables, restarting processes to apply changes. */
  async applyEnvironmentVariables(
    scope: EnvironmentScope,
    envText: string
  ): Promise<void> {
    await this.applyEnvironmentVariablesBatch([{ scope, envText }]);
  }

  async applyEnvironmentVariablesBatch(
    updates: Array<{ scope: EnvironmentScope; envText: string }>
  ): Promise<void> {
    const settingsBag = this.settings as unknown as Record<string, unknown>;
    const nextEnvironmentByScope = new Map<EnvironmentScope, string>();
    for (const update of updates) {
      nextEnvironmentByScope.set(update.scope, update.envText);
    }

    const changedScopes: EnvironmentScope[] = [];
    for (const [scope, envText] of nextEnvironmentByScope) {
      const currentValue = getScopedEnvironmentVariables(settingsBag, scope);
      if (currentValue !== envText) {
        changedScopes.push(scope);
      }
      setEnvironmentVariablesForScope(settingsBag, scope, envText);
    }

    if (changedScopes.length === 0) {
      await this.saveSettings();
      return;
    }

    const affectedProviderIds =
      this.getAffectedEnvironmentProviders(changedScopes);
    const { changed, invalidatedConversations } =
      this.reconcileModelWithEnvironment(affectedProviderIds);
    await this.saveSettings();

    if (invalidatedConversations.length > 0) {
      for (const conv of invalidatedConversations) {
        await this.storage.sessions.saveMetadata(
          this.storage.sessions.toSessionMetadata(conv)
        );
      }
    }

    const view = this.getView();
    const tabManager = view?.getTabManager();

    if (tabManager) {
      const affectedTabs = tabManager
        .getAllTabs()
        .filter((tab) =>
          affectedProviderIds.includes(
            tab.providerId ?? DEFAULT_CHAT_PROVIDER_ID
          )
        );

      for (const tab of affectedTabs) {
        if (tab.state.isStreaming) {
          tab.controllers.inputController?.cancelStreaming();
        }
      }

      let failedTabs = 0;
      const vp = getVaultPath(this.app);
      if (changed) {
        for (const tab of affectedTabs) {
          if (!tab.service || !tab.serviceInitialized) {
            continue;
          }
          try {
            const externalContextPaths =
              tab.ui.externalContextSelector?.getExternalContexts() ?? [];
            const effectiveCwd = vp
              ? resolveWorkspacePath(tab.workspace, vp) ?? vp
              : undefined;
            tab.service.resetSession();
            await tab.service.ensureReady({ externalContextPaths, effectiveCwd });
          } catch {
            failedTabs++;
          }
        }
      } else {
        for (const tab of affectedTabs) {
          if (!tab.service || !tab.serviceInitialized) {
            continue;
          }
          try {
            const effectiveCwd = vp
              ? resolveWorkspacePath(tab.workspace, vp) ?? vp
              : undefined;
            await tab.service.ensureReady({ force: true, effectiveCwd });
          } catch {
            failedTabs++;
          }
        }
      }
      if (failedTabs > 0) {
        new Notice(t("chat.notices.envPartialTabRestart", { count: String(failedTabs) }));
      }
    }

    for (const openView of this.getAllViews()) {
      openView.refreshModelSelector();
    }

    new Notice(
      changed ? t("chat.notices.envAppliedRebuild") : t("chat.notices.envApplied"),
    );
  }

  /** Returns the runtime environment variables (fixed at plugin load). */
  getActiveEnvironmentVariables(
    providerId: ProviderId = ProviderRegistry.resolveSettingsProviderId(
      this.settings as unknown as Record<string, unknown>
    )
  ): string {
    return getRuntimeEnvironmentText(
      this.settings as unknown as Record<string, unknown>,
      providerId
    );
  }

  getEnvironmentVariablesForScope(scope: EnvironmentScope): string {
    return getScopedEnvironmentVariables(
      this.settings as unknown as Record<string, unknown>,
      scope
    );
  }

  getResolvedProviderCliPath(providerId: ProviderId): string | null {
    const cliResolver = ProviderWorkspaceRegistry.getCliResolver(providerId);
    if (!cliResolver) {
      return null;
    }

    return cliResolver.resolveFromSettings(
      this.settings as unknown as Record<string, unknown>
    );
  }

  private reconcileModelWithEnvironment(
    providerIds: ProviderId[] = ProviderRegistry.getRegisteredProviderIds()
  ): {
    changed: boolean;
    invalidatedConversations: Conversation[];
  } {
    return ProviderSettingsCoordinator.reconcileProviders(
      this.settings as unknown as Record<string, unknown>,
      this.conversations,
      providerIds
    );
  }

  private getAffectedEnvironmentProviders(
    scopes: EnvironmentScope[]
  ): ProviderId[] {
    const registeredProviderIds = new Set(
      ProviderRegistry.getRegisteredProviderIds()
    );
    const affectedProviderIds = new Set<ProviderId>();

    for (const scope of scopes) {
      if (scope === "shared") {
        for (const providerId of registeredProviderIds) {
          affectedProviderIds.add(providerId);
        }
        continue;
      }

      const providerId = scope.slice("provider:".length) as ProviderId;
      if (registeredProviderIds.has(providerId)) {
        affectedProviderIds.add(providerId);
      }
    }

    return Array.from(affectedProviderIds);
  }

  private generateConversationId(): string {
    return `conv-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  private generateDefaultTitle(): string {
    const now = new Date();
    return now.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  private getConversationPreview(conv: Conversation): string {
    const firstUserMsg = conv.messages.find((m) => m.role === "user");
    if (!firstUserMsg) {
      return "New conversation";
    }
    return (
      firstUserMsg.content.substring(0, 50) +
      (firstUserMsg.content.length > 50 ? "..." : "")
    );
  }

  private async loadSdkMessagesForConversation(
    conversation: Conversation
  ): Promise<void> {
    await ProviderRegistry.getConversationHistoryService(
      conversation.providerId
    ).hydrateConversationHistory(conversation, getVaultPath(this.app));
  }

  async createConversation(options?: {
    providerId?: ProviderId;
    sessionId?: string;
  }): Promise<Conversation> {
    const providerId = options?.providerId ?? DEFAULT_CHAT_PROVIDER_ID;
    const sessionId = options?.sessionId;
    const conversationId = sessionId ?? this.generateConversationId();
    const conversation: Conversation = {
      id: conversationId,
      providerId,
      title: this.generateDefaultTitle(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sessionId: sessionId ?? null,
      messages: [],
    };

    this.conversations.unshift(conversation);
    await this.storage.sessions.saveMetadata(
      this.storage.sessions.toSessionMetadata(conversation)
    );

    return conversation;
  }

  async switchConversation(id: string): Promise<Conversation | null> {
    const conversation = this.conversations.find((c) => c.id === id);
    if (!conversation) return null;

    await this.loadSdkMessagesForConversation(conversation);

    return conversation;
  }

  async deleteConversation(id: string): Promise<void> {
    const index = this.conversations.findIndex((c) => c.id === id);
    if (index === -1) return;

    const conversation = this.conversations[index];
    this.conversations.splice(index, 1);

    await ProviderRegistry.getConversationHistoryService(
      conversation.providerId
    ).deleteConversationSession(conversation, getVaultPath(this.app));

    await this.storage.sessions.deleteMetadata(id);

    for (const view of this.getAllViews()) {
      const tabManager = view.getTabManager();
      if (!tabManager) continue;

      for (const tab of tabManager.getAllTabs()) {
        if (tab.conversationId === id) {
          tab.controllers.inputController?.cancelStreaming();
          await tab.controllers.conversationController?.createNew({
            force: true,
          });
        }
      }
    }
  }

  async renameConversation(id: string, title: string): Promise<void> {
    const conversation = this.conversations.find((c) => c.id === id);
    if (!conversation) return;

    conversation.title = title.trim() || this.generateDefaultTitle();
    conversation.updatedAt = Date.now();

    await this.storage.sessions.saveMetadata(
      this.storage.sessions.toSessionMetadata(conversation)
    );
  }

  async updateConversation(
    id: string,
    updates: Partial<Conversation>
  ): Promise<void> {
    const conversation = this.conversations.find((c) => c.id === id);
    if (!conversation) return;

    // providerId is immutable — strip it from updates to prevent accidental mutation
    const { providerId: _, ...safeUpdates } = updates;
    Object.assign(conversation, safeUpdates, { updatedAt: Date.now() });

    await this.storage.sessions.saveMetadata(
      this.storage.sessions.toSessionMetadata(conversation)
    );

    // Clear image data from memory after save (data is persisted by SDK).
    // Skip for pending forks: their deep-cloned images aren't in SDK storage yet.
    if (
      !ProviderRegistry.getConversationHistoryService(
        conversation.providerId
      ).isPendingForkConversation(conversation)
    ) {
      for (const msg of conversation.messages) {
        if (msg.images) {
          for (const img of msg.images) {
            img.data = "";
          }
        }
      }
    }
  }

  async getConversationById(id: string): Promise<Conversation | null> {
    const conversation = this.conversations.find((c) => c.id === id) || null;

    if (conversation) {
      await this.loadSdkMessagesForConversation(conversation);
    }

    return conversation;
  }

  getConversationSync(id: string): Conversation | null {
    return this.conversations.find((c) => c.id === id) || null;
  }

  findEmptyConversation(): Conversation | null {
    return this.conversations.find((c) => c.messages.length === 0) || null;
  }

  getConversationList(): ConversationMeta[] {
    return this.conversations.map((c) => ({
      id: c.id,
      providerId: c.providerId,
      title: c.title,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      lastResponseAt: c.lastResponseAt,
      messageCount: c.messages.length,
      preview: this.getConversationPreview(c),
      titleGenerationStatus: c.titleGenerationStatus,
    }));
  }

  async persistTabManagerState(state: AppTabManagerState): Promise<void> {
    this.lastKnownTabManagerState = state;
    await this.storage.setTabManagerState(state);
  }

  getView(): ClaudianView | null {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDIAN);
    if (leaves.length > 0) {
      return leaves[0].view as ClaudianView;
    }
    return null;
  }

  getAllViews(): ClaudianView[] {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDIAN);
    return leaves.map((leaf) => leaf.view as ClaudianView);
  }

  findConversationAcrossViews(
    conversationId: string
  ): { view: ClaudianView; tabId: string } | null {
    for (const view of this.getAllViews()) {
      const tabManager = view.getTabManager();
      if (!tabManager) continue;

      const tabs = tabManager.getAllTabs();
      for (const tab of tabs) {
        if (tab.conversationId === conversationId) {
          return { view, tabId: tab.id };
        }
      }
    }
    return null;
  }

  /**
   * Claude 斜杠命令冷探测使用的 cwd：与当前激活 Tab 的 effective cwd 一致；
   * 尚无聊天视图时退化为 Vault 根。
   */
  getProbeCwdForClaudeSlashCommands(): string {
    const vp = getVaultPath(this.app);
    if (!vp) {
      return process.cwd();
    }
    const primaryLeaf =
      this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDIAN)[0];
    const view = primaryLeaf?.view as ClaudianView | undefined;
    const tab = view?.getTabManager()?.getActiveTab();
    if (!tab) {
      return vp;
    }
    return resolveWorkspacePath(tab.workspace, vp) ?? vp;
  }

  /** 是否与 C01/R07 对齐：露出文件树与工作区标题栏相关工作空间控件 */
  allowsWorkspaceSwitch(): boolean {
    return this.settings.allowWorkspaceSwitch === true;
  }

  /**
   * 将默认工作目录设为给定 Vault 相对路径（空串即库根），并同步所有已打开 Tab、
   * 下拉命令缓存与就绪中的运行时 cwd。
   */
  async applyWorkspaceSwitch(vaultRelativePath: string): Promise<void> {
    const vp = getVaultPath(this.app);
    if (!vp) return;

    const rel = (vaultRelativePath ?? "").trim();
    await this.storage.setWorkspace(rel);

    let absForTabs: string | null = null;
    if (rel) {
      const resolved = resolveWorkspacePath(rel, vp);
      if (!resolved) {
        new Notice(t("contextMenu.invalidPath"));
        await this.storage.setWorkspace("");
        absForTabs = null;
      } else {
        absForTabs = resolved;
      }
    }

    for (const view of this.getAllViews()) {
      const tabManager = view.getTabManager();
      if (!tabManager) continue;
      for (const tab of tabManager.getAllTabs()) {
        tab.workspace = absForTabs;
      }
      view.updateWorkspaceSubtitle();
    }

    await this.updateRibbonTooltipFromStorage();
    await this.refreshWorkspaceDerivedStateAfterPathChange();

    await this.persistWorkspaceTabLayouts();
  }

  /** 将所有已打开的聊天视图布局（含 workspace 快照）写入 data.json */
  async persistWorkspaceTabLayouts(): Promise<void> {
    for (const view of this.getAllViews()) {
      const tabManager = view.getTabManager();
      if (tabManager) {
        await this.persistTabManagerState(tabManager.getPersistedState());
      }
    }
  }

  private async refreshWorkspaceDerivedStateAfterPathChange(): Promise<void> {
    for (const providerId of ProviderRegistry.getRegisteredProviderIds()) {
      const catalog =
        ProviderWorkspaceRegistry.getCommandCatalog(providerId);
      if (catalog) {
        await catalog.refresh().catch(() => {});
      }
    }

    await ProviderWorkspaceRegistry.refreshAgentMentions(
      "claude",
    ).catch(() => {});

    for (const view of this.getAllViews()) {
      const tabManager = view.getTabManager();
      if (!tabManager) continue;
      for (const tab of tabManager.getAllTabs()) {
        tab.ui.slashCommandDropdown?.resetSdkSkillsCache();
      }
    }

    const vp = getVaultPath(this.app);
    if (!vp) return;

    let failedTabs = 0;

    for (const view of this.getAllViews()) {
      const tabManager = view.getTabManager();
      if (!tabManager) continue;

      for (const tab of tabManager.getAllTabs()) {
        if (tab.state.isStreaming) {
          tab.controllers.inputController?.cancelStreaming();
        }

        if (!tab.service || !tab.serviceInitialized) {
          continue;
        }

        try {
          const externalContextPaths =
            tab.ui.externalContextSelector?.getExternalContexts() ?? [];
          const effectiveCwd =
            resolveWorkspacePath(tab.workspace, vp) ?? vp;
          tab.service.resetSession();
          await tab.service.ensureReady({
            externalContextPaths,
            effectiveCwd,
            force: true,
          });
        } catch {
          failedTabs++;
        }
      }
    }

    if (failedTabs > 0) {
      new Notice(
        t("chat.notices.envPartialTabRestart", {
          count: String(failedTabs),
        }),
      );
    }

    this.syncWorkspaceChromeAcrossViews();
  }

  /** 与工作空间切换相关的标题栏控件显隐（设置项切换时调用）。 */
  syncWorkspaceChromeAcrossViews(): void {
    const visible = this.allowsWorkspaceSwitch();
    for (const view of this.getAllViews()) {
      view.setWorkspaceSwitchChromeVisible(visible);
    }
  }

  /** 根据持久化工作空间更新 Ribbon 提示（全局默认目录） */
  async updateRibbonTooltipFromStorage(): Promise<void> {
    const vaultPath = getVaultPath(this.app);
    if (!this.ribbonIconEl || !vaultPath) return;
    const rel = await this.storage.getWorkspace();
    const abs = resolveWorkspacePath(rel?.trim() || null, vaultPath);
    const short = abs ? formatWorkspaceDisplayShort(abs, vaultPath) : "";
    const ribbonBase = t("ribbon.toggleClaudian");
    const suffix = short ? ` — ${short}` : ` — ${t("workspace.vaultRoot")}`;
    const tip = `${ribbonBase}${suffix}`;
    this.ribbonIconEl.setAttribute("aria-label", tip);
    this.ribbonIconEl.setAttribute("title", tip);
  }

  /** 将工作目录重置为库根并在所有视图与运行时中收敛（等价于对工作空间快照全员刷新） */
  async resetWorkspaceAndNotify(): Promise<void> {
    await this.applyWorkspaceSwitch("");
    new Notice(t("contextMenu.workspaceReset"));
  }

  private getLastKnownOpenTabCount(): number {
    return this.lastKnownTabManagerState?.openTabs.length ?? 0;
  }

  private getMaxTabsLimit(): number {
    const maxTabs = this.settings.maxTabs ?? 3;
    return Math.max(3, Math.min(10, maxTabs));
  }
}
