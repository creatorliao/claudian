import * as fs from 'fs';
import { Setting } from 'obsidian';

import type { ProviderSettingsTabRenderer } from '../../../core/providers/types';
import { renderEnvironmentSettingsSection } from '../../../features/settings/ui/EnvironmentSettingsSection';
import { t } from '../../../i18n/i18n';
import type { TranslationKey } from '../../../i18n/types';
import { getHostnameKey } from '../../../utils/env';
import { expandHomePath } from '../../../utils/path';
import { getCodexWorkspaceServices } from '../app/CodexWorkspaceServices';
import { isWindowsStyleCliReference } from '../runtime/CodexBinaryLocator';
import { getCodexProviderSettings, updateCodexProviderSettings } from '../settings';
import { CodexSkillSettings } from './CodexSkillSettings';
import { CodexSubagentSettings } from './CodexSubagentSettings';

const SUMMARY_OPTIONS: { value: string; labelKey: TranslationKey }[] = [
  { value: 'auto', labelKey: 'settings.codex.reasoningSummary.optionAuto' },
  { value: 'concise', labelKey: 'settings.codex.reasoningSummary.optionConcise' },
  { value: 'detailed', labelKey: 'settings.codex.reasoningSummary.optionDetailed' },
  { value: 'none', labelKey: 'settings.codex.reasoningSummary.optionOff' },
];

export const codexSettingsTabRenderer: ProviderSettingsTabRenderer = {
  render(container, context) {
    const codexWorkspace = getCodexWorkspaceServices();
    const settingsBag = context.plugin.settings as unknown as Record<string, unknown>;
    const codexSettings = getCodexProviderSettings(settingsBag);
    const hostnameKey = getHostnameKey();
    const isWindowsHost = process.platform === 'win32';
    let installationMethod = codexSettings.installationMethod;

    // --- Setup ---

    new Setting(container).setName(t('settings.setup')).setHeading();

    new Setting(container)
      .setName(t('settings.codex.providerEnabled.name'))
      .setDesc(t('settings.codex.providerEnabled.desc'))
      .addToggle((toggle) =>
        toggle
          .setValue(codexSettings.enabled)
          .onChange(async (value) => {
            updateCodexProviderSettings(settingsBag, { enabled: value });
            await context.plugin.saveSettings();
            context.refreshModelSelectors();
          })
      );

    if (isWindowsHost) {
      new Setting(container)
        .setName(t('settings.codex.installationMethod.name'))
        .setDesc(t('settings.codex.installationMethod.desc'))
        .addDropdown((dropdown) => {
          dropdown
            .addOption('native-windows', t('settings.codex.installation.nativeWindows'))
            .addOption('wsl', t('settings.codex.installation.wsl'))
            .setValue(installationMethod)
            .onChange(async (value) => {
              installationMethod = value === 'wsl' ? 'wsl' : 'native-windows';
              updateCodexProviderSettings(settingsBag, { installationMethod });
              refreshInstallationMethodUI();
              await context.plugin.saveSettings();
            });
        });
    }

    const getCliPathCopy = (): { desc: string; placeholder: string } => {
      if (!isWindowsHost) {
        return {
          desc: t('settings.codex.cliPath.descGeneric'),
          placeholder: '/usr/local/bin/codex',
        };
      }

      if (installationMethod === 'wsl') {
        return {
          desc: t('settings.codex.cliPath.descWsl'),
          placeholder: 'codex',
        };
      }

      return {
        desc: t('settings.codex.cliPath.descWindowsNative'),
        placeholder: 'C:\\Users\\you\\AppData\\Roaming\\npm\\codex.exe',
      };
    };

    const shouldValidateCliPathAsFile = (): boolean => !isWindowsHost || installationMethod !== 'wsl';

    const cliPathSetting = new Setting(container)
      .setName(t('settings.codex.cliPath.name', { host: hostnameKey }))
      .setDesc(getCliPathCopy().desc);

    const validationEl = container.createDiv({ cls: 'claudian-cli-path-validation' });
    validationEl.style.color = 'var(--text-error)';
    validationEl.style.fontSize = '0.85em';
    validationEl.style.marginTop = '-0.5em';
    validationEl.style.marginBottom = '0.5em';
    validationEl.style.display = 'none';

    const validatePath = (value: string): string | null => {
      const trimmed = value.trim();
      if (!trimmed) return null;

      if (!shouldValidateCliPathAsFile()) {
        if (isWindowsStyleCliReference(trimmed)) {
          return t('settings.codex.cliPathValidation.wslExpectsLinuxPath');
        }
        return null;
      }

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

    const cliPathsByHost = { ...codexSettings.cliPathsByHost };
    let cliPathInputEl: HTMLInputElement | null = null;
    let wslDistroSettingEl: HTMLElement | null = null;
    let wslDistroInputEl: HTMLInputElement | null = null;

    const refreshInstallationMethodUI = (): void => {
      const cliCopy = getCliPathCopy();
      cliPathSetting.setDesc(cliCopy.desc);
      if (cliPathInputEl) {
        cliPathInputEl.placeholder = cliCopy.placeholder;
        updateCliPathValidation(cliPathInputEl.value, cliPathInputEl);
      }
      if (wslDistroSettingEl) {
        wslDistroSettingEl.style.display = installationMethod === 'wsl' ? '' : 'none';
      }
      if (wslDistroInputEl) {
        wslDistroInputEl.disabled = installationMethod !== 'wsl';
      }
    };

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

      updateCodexProviderSettings(settingsBag, { cliPathsByHost: { ...cliPathsByHost } });
      await context.plugin.saveSettings();
      const view = context.plugin.getView();
      await view?.getTabManager()?.broadcastToAllTabs(
        (service) => Promise.resolve(service.cleanup())
      );
      return true;
    };

    const currentValue = codexSettings.cliPathsByHost[hostnameKey] || '';

    cliPathSetting.addText((text) => {
      text
        .setPlaceholder(getCliPathCopy().placeholder)
        .setValue(currentValue)
        .onChange(async (value) => {
          await persistCliPath(value);
        });
      text.inputEl.addClass('claudian-settings-cli-path-input');
      text.inputEl.style.width = '100%';
      cliPathInputEl = text.inputEl;

      updateCliPathValidation(currentValue, text.inputEl);
    });

    if (isWindowsHost) {
      const wslDistroSetting = new Setting(container)
        .setName(t('settings.codex.wslDistro.name'))
        .setDesc(t('settings.codex.wslDistro.desc'));

      wslDistroSettingEl = wslDistroSetting.settingEl;
      wslDistroSetting.addText((text) => {
        text
          .setPlaceholder(t('settings.codex.wslDistro.placeholder'))
          .setValue(codexSettings.wslDistroOverride)
          .onChange(async (value) => {
            updateCodexProviderSettings(settingsBag, { wslDistroOverride: value });
            await context.plugin.saveSettings();
          });

        text.inputEl.addClass('claudian-settings-cli-path-input');
        text.inputEl.style.width = '100%';
        text.inputEl.disabled = installationMethod !== 'wsl';
        wslDistroInputEl = text.inputEl;
      });
    }

    refreshInstallationMethodUI();

    // --- Safety ---

    new Setting(container).setName(t('settings.safety')).setHeading();

    new Setting(container)
      .setName(t('settings.codexSafeMode.name'))
      .setDesc(t('settings.codexSafeMode.desc'))
      .addDropdown((dropdown) => {
        dropdown
          .addOption('workspace-write', t('settings.codexSafeMode.optionWorkspaceWrite'))
          .addOption('read-only', t('settings.codexSafeMode.optionReadOnly'))
          .setValue(codexSettings.safeMode)
          .onChange(async (value) => {
            updateCodexProviderSettings(
              settingsBag,
              { safeMode: value as 'workspace-write' | 'read-only' },
            );
            await context.plugin.saveSettings();
          });
      });

    // --- Models ---

    new Setting(container).setName(t('settings.models')).setHeading();

    new Setting(container)
      .setName(t('settings.codex.reasoningSummary.name'))
      .setDesc(t('settings.codex.reasoningSummary.desc'))
      .addDropdown((dropdown) => {
        for (const opt of SUMMARY_OPTIONS) {
          dropdown.addOption(opt.value, t(opt.labelKey));
        }
        dropdown.setValue(codexSettings.reasoningSummary);
        dropdown.onChange(async (value) => {
          updateCodexProviderSettings(
            settingsBag,
            { reasoningSummary: value as 'auto' | 'concise' | 'detailed' | 'none' },
          );
          await context.plugin.saveSettings();
        });
      });

    // --- Skills ---

    const codexCatalog = codexWorkspace.commandCatalog;
    if (codexCatalog) {
      new Setting(container).setName(t('settings.codex.skillsSection.heading')).setHeading();

      const skillsDesc = container.createDiv({ cls: 'claudian-sp-settings-desc' });
      skillsDesc.createEl('p', {
        cls: 'setting-item-description',
        text: t('settings.codex.skillsSection.desc'),
      });

      const skillsContainer = container.createDiv({ cls: 'claudian-slash-commands-container' });
      new CodexSkillSettings(skillsContainer, codexCatalog, context.plugin.app);
    }

    context.renderHiddenProviderCommandSetting(container, 'codex', {
      name: t('settings.codex.hiddenSkills.name'),
      desc: t('settings.codex.hiddenSkills.desc'),
      placeholder: t('settings.codex.hiddenSkills.placeholder'),
    });

    // --- Subagents ---

    new Setting(container).setName(t('settings.codex.subagentsSection.heading')).setHeading();

    const subagentDesc = container.createDiv({ cls: 'claudian-sp-settings-desc' });
    subagentDesc.createEl('p', {
      cls: 'setting-item-description',
      text: t('settings.codex.subagentsSection.desc'),
    });

    const subagentContainer = container.createDiv({ cls: 'claudian-slash-commands-container' });
    new CodexSubagentSettings(subagentContainer, codexWorkspace.subagentStorage, context.plugin.app, () => {
      void codexWorkspace.refreshAgentMentions?.();
    });

    // --- MCP Servers ---

    new Setting(container).setName(t('settings.mcpServers.name')).setHeading();
    const mcpNotice = container.createDiv({ cls: 'claudian-mcp-settings-desc' });
    const mcpDesc = mcpNotice.createEl('p', { cls: 'setting-item-description' });
    mcpDesc.appendText(t('settings.codex.mcpNotice.beforeCmd'));
    mcpDesc.createEl('code', { text: 'codex mcp' });
    mcpDesc.appendText(t('settings.codex.mcpNotice.afterCmd'));
    mcpDesc.createEl('a', {
      text: t('common.learnMore'),
      href: 'https://developers.openai.com/codex/mcp',
    });

    // --- Environment ---

    renderEnvironmentSettingsSection({
      container,
      plugin: context.plugin,
      scope: 'provider:codex',
      heading: t('settings.environment'),
      name: t('settings.codex.env.name'),
      desc: t('settings.codex.env.desc'),
      placeholder: t('settings.codex.env.placeholder'),
      renderCustomContextLimits: (target) => context.renderCustomContextLimits(target, 'codex'),
    });
  },
};
