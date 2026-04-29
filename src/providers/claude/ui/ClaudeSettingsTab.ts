import * as fs from 'fs';
import { Setting } from 'obsidian';

import { ProviderSettingsCoordinator } from '../../../core/providers/ProviderSettingsCoordinator';
import type {
  ProviderSettingsTabRenderer,
  ProviderSettingsTabRendererContext,
} from '../../../core/providers/types';
import type { ClaudianSettings } from '../../../core/types/settings';
import { renderEnvironmentSettingsSection } from '../../../features/settings/ui/EnvironmentSettingsSection';
import { McpSettingsManager } from '../../../features/settings/ui/McpSettingsManager';
import { t } from '../../../i18n/i18n';
import type ClaudianPlugin from '../../../main';
import { getHostnameKey } from '../../../utils/env';
import { expandHomePath } from '../../../utils/path';
import { getClaudeWorkspaceServices } from '../app/ClaudeWorkspaceServices';
import { resolveClaudeModelSelection } from '../modelOptions';
import { getClaudeProviderSettings, updateClaudeProviderSettings } from '../settings';
import { AgentSettings } from './AgentSettings';
import { claudeChatUIConfig } from './ClaudeChatUIConfig';
import { PluginSettingsManager } from './PluginSettingsManager';
import { SlashCommandSettings } from './SlashCommandSettings';

/** Claude 提供商页是否展开「高级」选项；缺省为简易模式 */
function getClaudeShowMore(settings: ClaudianSettings): boolean {
  return settings.providerShowMoreOptions?.claude === true;
}

async function persistClaudeShowMore(plugin: ClaudianPlugin, value: boolean): Promise<void> {
  const settings = plugin.settings as ClaudianSettings;
  settings.providerShowMoreOptions = {
    ...(settings.providerShowMoreOptions ?? {}),
    claude: value,
  };
  await plugin.saveSettings();
}

function renderSafetySection(
  container: HTMLElement,
  context: ProviderSettingsTabRendererContext,
  settingsBag: Record<string, unknown>,
  claudeSettings: ReturnType<typeof getClaudeProviderSettings>,
): void {
  new Setting(container).setName(t('settings.safety')).setHeading();

  new Setting(container)
    .setName(t('settings.claudeSafeMode.name'))
    .setDesc(t('settings.claudeSafeMode.desc'))
    .addDropdown((dropdown) => {
      dropdown
        .addOption('acceptEdits', t('settings.claudeSafeMode.optionAcceptEdits'))
        .addOption('default', t('settings.claudeSafeMode.optionDefault'))
        .setValue(claudeSettings.safeMode)
        .onChange(async (value) => {
          updateClaudeProviderSettings(
            settingsBag,
            { safeMode: value as 'acceptEdits' | 'default' },
          );
          await context.plugin.saveSettings();
        });
    });
}

function renderModelsSection(
  container: HTMLElement,
  context: ProviderSettingsTabRendererContext,
  settingsBag: Record<string, unknown>,
  claudeSettings: ReturnType<typeof getClaudeProviderSettings>,
  reconcileActiveClaudeModelSelection: () => void,
): void {
  new Setting(container).setName(t('settings.models')).setHeading();

  new Setting(container)
    .setName(t('settings.enableOpus1M.name'))
    .setDesc(t('settings.enableOpus1M.desc'))
    .addToggle((toggle) =>
      toggle
        .setValue(claudeSettings.enableOpus1M)
        .onChange(async (value) => {
          updateClaudeProviderSettings(settingsBag, { enableOpus1M: value });
          context.plugin.normalizeModelVariantSettings();
          await context.plugin.saveSettings();
          context.refreshModelSelectors();
        })
    );

  new Setting(container)
    .setName(t('settings.enableSonnet1M.name'))
    .setDesc(t('settings.enableSonnet1M.desc'))
    .addToggle((toggle) =>
      toggle
        .setValue(claudeSettings.enableSonnet1M)
        .onChange(async (value) => {
          updateClaudeProviderSettings(settingsBag, { enableSonnet1M: value });
          context.plugin.normalizeModelVariantSettings();
          await context.plugin.saveSettings();
          context.refreshModelSelectors();
        })
    );

  new Setting(container)
    .setName(t('settings.customModels.name'))
    .setDesc(t('settings.customModels.desc'))
    .addTextArea((text) => {
      let pendingCustomModels = claudeSettings.customModels;
      let savedCustomModels = claudeSettings.customModels;

      const commitCustomModels = async (): Promise<void> => {
        const previousCustomModels = savedCustomModels;
        const previousModel = typeof settingsBag.model === 'string' ? settingsBag.model : '';
        const previousTitleModel = typeof settingsBag.titleGenerationModel === 'string'
          ? settingsBag.titleGenerationModel
          : '';

        if (pendingCustomModels !== savedCustomModels) {
          updateClaudeProviderSettings(settingsBag, { customModels: pendingCustomModels });
          savedCustomModels = pendingCustomModels;
        }

        reconcileActiveClaudeModelSelection();
        const didReconcileTitleModel = ProviderSettingsCoordinator
          .reconcileTitleGenerationModelSelection(settingsBag);
        const nextModel = typeof settingsBag.model === 'string' ? settingsBag.model : '';
        const nextTitleModel = typeof settingsBag.titleGenerationModel === 'string'
          ? settingsBag.titleGenerationModel
          : '';
        const didModelSelectionChange = previousModel !== nextModel;
        const didCustomModelsChange = previousCustomModels !== savedCustomModels;

        if (!didCustomModelsChange && !didModelSelectionChange && !didReconcileTitleModel
          && previousTitleModel === nextTitleModel) {
          return;
        }

        await context.plugin.saveSettings();
        context.refreshModelSelectors();
      };

      text
        .setPlaceholder(t('settings.customModels.placeholder'))
        .setValue(claudeSettings.customModels)
        .onChange((value) => {
          pendingCustomModels = value;
        });
      text.inputEl.rows = 6;
      text.inputEl.cols = 40;
      text.inputEl.addEventListener('blur', () => {
        void commitCustomModels();
      });
    });
}

/** 命令与技能列表（不含「隐藏命令」；隐藏命令仅在展开后的高级区末尾单独呈现） */
function renderSlashSkillsSection(
  container: HTMLElement,
  context: ProviderSettingsTabRendererContext,
  claudeWorkspace: ReturnType<typeof getClaudeWorkspaceServices>,
): void {
  new Setting(container).setName(t('settings.slashCommands.name')).setHeading();

  const slashCommandsDesc = container.createDiv({ cls: 'claudian-sp-settings-desc' });
  const descP = slashCommandsDesc.createEl('p', { cls: 'setting-item-description' });
  descP.appendText(t('settings.slashCommands.desc') + ' ');
  descP.createEl('a', {
    text: t('common.learnMore'),
    href: 'https://code.claude.com/docs/en/skills',
  });

  const settingsBag = context.plugin.settings as unknown as Record<string, unknown>;
  const claudeSettings = getClaudeProviderSettings(settingsBag);

  const scopeDesc =
    claudeSettings.slashAssetScope === 'vault-only'
      ? t('settings.slashAssetScope.descVaultOnly')
      : t('settings.slashAssetScope.descVaultAndHome');

  new Setting(container)
    .setName(t('settings.slashAssetScope.name'))
    .setDesc(scopeDesc)
    .addDropdown((dropdown) => {
      dropdown
        .addOption('vault-and-user-home', t('settings.slashAssetScope.optionVaultAndHome'))
        .addOption('vault-only', t('settings.slashAssetScope.optionVaultOnly'))
        .setValue(claudeSettings.slashAssetScope)
        .onChange(async (value) => {
          updateClaudeProviderSettings(settingsBag, {
            slashAssetScope: value as 'vault-only' | 'vault-and-user-home',
          });
          await context.plugin.saveSettings();
          context.redisplay();
        });
    });

  const slashCommandsContainer = container.createDiv({ cls: 'claudian-slash-commands-container' });
  new SlashCommandSettings(
    slashCommandsContainer,
    context.plugin.app,
    claudeWorkspace.commandCatalog,
  );
}

function renderSubagentsSection(
  container: HTMLElement,
  context: ProviderSettingsTabRendererContext,
  claudeWorkspace: ReturnType<typeof getClaudeWorkspaceServices>,
): void {
  new Setting(container).setName(t('settings.subagents.name')).setHeading();

  const agentsDesc = container.createDiv({ cls: 'claudian-sp-settings-desc' });
  agentsDesc.createEl('p', {
    text: t('settings.subagents.desc'),
    cls: 'setting-item-description',
  });

  const agentsContainer = container.createDiv({ cls: 'claudian-agents-container' });
  new AgentSettings(agentsContainer, {
    app: context.plugin.app,
    agentManager: claudeWorkspace.agentManager,
    agentStorage: claudeWorkspace.agentStorage,
  });
}

function renderMcpSection(
  container: HTMLElement,
  context: ProviderSettingsTabRendererContext,
  claudeWorkspace: ReturnType<typeof getClaudeWorkspaceServices>,
): void {
  new Setting(container).setName(t('settings.mcpServers.name')).setHeading();

  const mcpDesc = container.createDiv({ cls: 'claudian-mcp-settings-desc' });
  mcpDesc.createEl('p', {
    text: t('settings.mcpServers.desc'),
    cls: 'setting-item-description',
  });

  const mcpContainer = container.createDiv({ cls: 'claudian-mcp-container' });
  new McpSettingsManager(mcpContainer, {
    app: context.plugin.app,
    mcpStorage: claudeWorkspace.mcpStorage,
    broadcastMcpReload: async () => {
      for (const view of context.plugin.getAllViews()) {
        await view.getTabManager()?.broadcastToAllTabs(
          (service) => service.reloadMcpServers(),
        );
      }
    },
  });
}

function renderPluginsSection(
  container: HTMLElement,
  context: ProviderSettingsTabRendererContext,
  claudeWorkspace: ReturnType<typeof getClaudeWorkspaceServices>,
): void {
  new Setting(container).setName(t('settings.plugins.name')).setHeading();

  const pluginsDesc = container.createDiv({ cls: 'claudian-plugin-settings-desc' });
  pluginsDesc.createEl('p', {
    text: t('settings.plugins.desc'),
    cls: 'setting-item-description',
  });

  const pluginsContainer = container.createDiv({ cls: 'claudian-plugins-container' });
  new PluginSettingsManager(pluginsContainer, {
    pluginManager: claudeWorkspace.pluginManager,
    agentManager: claudeWorkspace.agentManager,
    restartTabs: async () => {
      const view = context.plugin.getView();
      const tabManager = view?.getTabManager();
      if (!tabManager) {
        return;
      }

      await tabManager.broadcastToAllTabs(
        async (service) => { await service.ensureReady({ force: true }); },
      );
    },
  });
}

function renderEnvironmentSection(
  container: HTMLElement,
  context: ProviderSettingsTabRendererContext,
): void {
  renderEnvironmentSettingsSection({
    container,
    plugin: context.plugin,
    scope: 'provider:claude',
    heading: t('settings.environment'),
    name: t('settings.customVariables.name'),
    desc: t('settings.claudeEnv.desc'),
    placeholder: t('settings.claudeEnv.placeholder'),
    renderCustomContextLimits: (target) => context.renderCustomContextLimits(target, 'claude'),
  });
}

function renderExperimentalSection(
  container: HTMLElement,
  context: ProviderSettingsTabRendererContext,
  settingsBag: Record<string, unknown>,
  claudeSettings: ReturnType<typeof getClaudeProviderSettings>,
): void {
  new Setting(container).setName(t('settings.experimental')).setHeading();

  new Setting(container)
    .setName(t('settings.enableChrome.name'))
    .setDesc(t('settings.enableChrome.desc'))
    .addToggle((toggle) =>
      toggle
        .setValue(claudeSettings.enableChrome)
        .onChange(async (value) => {
          updateClaudeProviderSettings(settingsBag, { enableChrome: value });
          await context.plugin.saveSettings();
        })
    );

  const bangBashValidationEl = container.createDiv({ cls: 'claudian-bang-bash-validation' });
  bangBashValidationEl.style.color = 'var(--text-error)';
  bangBashValidationEl.style.fontSize = '0.85em';
  bangBashValidationEl.style.marginTop = '-0.5em';
  bangBashValidationEl.style.marginBottom = '0.5em';
  bangBashValidationEl.style.display = 'none';

  new Setting(container)
    .setName(t('settings.enableBangBash.name'))
    .setDesc(t('settings.enableBangBash.desc'))
    .addToggle((toggle) =>
      toggle
        .setValue(claudeSettings.enableBangBash)
        .onChange(async (value) => {
          bangBashValidationEl.style.display = 'none';
          if (value) {
            const { findNodeExecutable, getEnhancedPath } = await import('../../../utils/env');
            const nodePath = findNodeExecutable(getEnhancedPath());
            if (!nodePath) {
              bangBashValidationEl.setText(t('settings.enableBangBash.validation.noNode'));
              bangBashValidationEl.style.display = 'block';
              toggle.setValue(false);
              return;
            }
          }
          updateClaudeProviderSettings(settingsBag, { enableBangBash: value });
          await context.plugin.saveSettings();
        })
    );
}

function renderCliPathSection(
  container: HTMLElement,
  context: ProviderSettingsTabRendererContext,
  settingsBag: Record<string, unknown>,
  claudeWorkspace: ReturnType<typeof getClaudeWorkspaceServices>,
  claudeSettings: ReturnType<typeof getClaudeProviderSettings>,
): void {
  new Setting(container).setName(t('settings.setup')).setHeading();

  const hostnameKey = getHostnameKey();
  const platformDesc = process.platform === 'win32'
    ? t('settings.cliPath.descWindows')
    : t('settings.cliPath.descUnix');
  const cliPathDescription = `${t('settings.cliPath.desc')} ${platformDesc}`;

  const cliPathSetting = new Setting(container)
    .setName(`${t('settings.cliPath.name')} (${hostnameKey})`)
    .setDesc(cliPathDescription);

  const validationEl = container.createDiv({ cls: 'claudian-cli-path-validation' });
  validationEl.style.color = 'var(--text-error)';
  validationEl.style.fontSize = '0.85em';
  validationEl.style.marginTop = '-0.5em';
  validationEl.style.marginBottom = '0.5em';
  validationEl.style.display = 'none';

  const validatePath = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const expandedPath = expandHomePath(trimmed);

    if (!fs.existsSync(expandedPath)) {
      return t('settings.cliPath.validation.notExist');
    }
    const stat = fs.statSync(expandedPath);
    if (!stat.isFile()) {
      return t('settings.cliPath.validation.isDirectory');
    }
    return null;
  };

  const updateCliPathValidation = (value: string, inputEl?: HTMLInputElement): boolean => {
    const error = validatePath(value);
    if (error) {
      validationEl.setText(error);
      validationEl.style.display = 'block';
      if (inputEl) {
        inputEl.style.borderColor = 'var(--text-error)';
      }
      return false;
    }

    validationEl.style.display = 'none';
    if (inputEl) {
      inputEl.style.borderColor = '';
    }
    return true;
  };

  const currentValue = claudeSettings.cliPathsByHost[hostnameKey] || '';
  const cliPathsByHost = { ...claudeSettings.cliPathsByHost };
  let cliPathInputEl: HTMLInputElement | null = null;

  const persistCliPath = async (value: string): Promise<boolean> => {
    const isValid = updateCliPathValidation(value, cliPathInputEl ?? undefined);
    if (!isValid) {
      return false;
    }

    const trimmed = value.trim();
    if (trimmed) {
      cliPathsByHost[hostnameKey] = trimmed;
    } else {
      delete cliPathsByHost[hostnameKey];
    }

    updateClaudeProviderSettings(settingsBag, { cliPathsByHost: { ...cliPathsByHost } });
    await context.plugin.saveSettings();
    claudeWorkspace.cliResolver.reset();
    const view = context.plugin.getView();
    await view?.getTabManager()?.broadcastToAllTabs(
      (service) => Promise.resolve(service.cleanup()),
    );
    return true;
  };

  cliPathSetting.addText((text) => {
    const placeholder = process.platform === 'win32'
      ? 'D:\\nodejs\\node_global\\node_modules\\@anthropic-ai\\claude-code\\cli.js'
      : '/usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js';

    text
      .setPlaceholder(placeholder)
      .setValue(currentValue)
      .onChange(async (value) => {
        await persistCliPath(value);
      });
    text.inputEl.addClass('claudian-settings-cli-path-input');
    text.inputEl.style.width = '100%';
    cliPathInputEl = text.inputEl;

    updateCliPathValidation(currentValue, text.inputEl);
  });
}

export const claudeSettingsTabRenderer: ProviderSettingsTabRenderer = {
  render(container, context) {
    const claudeWorkspace = getClaudeWorkspaceServices();
    const settingsBag = context.plugin.settings as unknown as Record<string, unknown>;
    const claudeSettings = getClaudeProviderSettings(settingsBag);
    const claudian = context.plugin.settings as ClaudianSettings;

    const reconcileActiveClaudeModelSelection = (): void => {
      const activeProvider = settingsBag.settingsProvider;
      if (activeProvider !== undefined && activeProvider !== 'claude') {
        return;
      }

      const currentModel = typeof settingsBag.model === 'string' ? settingsBag.model : '';
      const nextModel = resolveClaudeModelSelection(settingsBag, currentModel);
      if (!nextModel || nextModel === currentModel) {
        return;
      }

      settingsBag.model = nextModel;
      claudeChatUIConfig.applyModelDefaults(nextModel, settingsBag);
    };

    const showMore = getClaudeShowMore(claudian);

    // 固定区：安全、命令与技能、子智能体、插件（与「显示更多」开关互不穿插）
    renderSafetySection(container, context, settingsBag, claudeSettings);
    renderSlashSkillsSection(container, context, claudeWorkspace);
    renderSubagentsSection(container, context, claudeWorkspace);
    renderPluginsSection(container, context, claudeWorkspace);

    new Setting(container)
      .setName(t('settings.moreOptions.name'))
      .setDesc(t('settings.moreOptions.providerDescClaude'))
      .addToggle((toggle) =>
        toggle.setValue(showMore).onChange(async (value) => {
          await persistClaudeShowMore(context.plugin, value);
          context.redisplay();
        }),
      );

    if (!showMore) {
      return;
    }

    // 展开区：全部高级项集中在开关之后、连续排列，便于扫读
    const advancedRoot = container.createDiv({
      cls: 'claudian-settings-claude-advanced-block',
    });

    const hintEl = advancedRoot.createDiv({
      cls: 'setting-item-description claudian-more-options-expanded-hint',
    });
    hintEl.style.marginBottom = '1rem';
    hintEl.setText(t('settings.moreOptions.hintWhenExpanded'));

    renderModelsSection(
      advancedRoot,
      context,
      settingsBag,
      claudeSettings,
      reconcileActiveClaudeModelSelection,
    );

    context.renderHiddenProviderCommandSetting(advancedRoot, 'claude', {
      name: t('settings.hiddenSlashCommands.name'),
      desc: t('settings.hiddenSlashCommands.desc'),
      placeholder: t('settings.hiddenSlashCommands.placeholder'),
    });

    renderMcpSection(advancedRoot, context, claudeWorkspace);
    renderEnvironmentSection(advancedRoot, context);
    renderExperimentalSection(advancedRoot, context, settingsBag, claudeSettings);
    renderCliPathSection(advancedRoot, context, settingsBag, claudeWorkspace, claudeSettings);
  },
};
