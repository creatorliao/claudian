import { createMockEl } from '@test/helpers/mockElement';

import type { ProviderCommandDropdownConfig } from '@/core/providers/commands/ProviderCommandCatalog';
import type { ProviderCommandEntry } from '@/core/providers/commands/ProviderCommandEntry';
import {
  SlashCommandDropdown,
  type SlashCommandDropdownCallbacks,
} from '@/shared/components/SlashCommandDropdown';

jest.mock('@/core/commands/builtInCommands', () => ({
  getBuiltInCommandsForDropdown: jest.fn(() => [
    { id: 'builtin:clear', name: 'clear', description: 'Start a new conversation', content: '' },
    { id: 'builtin:add-dir', name: 'add-dir', description: 'Add external context directory', content: '', argumentHint: 'path/to/directory' },
  ]),
}));

function createMockInput(): any {
  return {
    value: '',
    selectionStart: 0,
    selectionEnd: 0,
    focus: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };
}

function createMockCallbacks(overrides: Partial<SlashCommandDropdownCallbacks> = {}): SlashCommandDropdownCallbacks {
  return {
    onSelect: jest.fn(),
    onHide: jest.fn(),
    ...overrides,
  };
}

function getRenderedItems(containerEl: any): { name: string; description: string }[] {
  const dropdownEl = containerEl.children.find(
    (c: any) => c.hasClass('claudian-slash-dropdown')
  );
  if (!dropdownEl) return [];
  const items = dropdownEl.querySelectorAll('.claudian-slash-item');
  return items.map((item: any) => {
    const nameSpan = item.children.find((c: any) => c.hasClass('claudian-slash-name'));
    const descDiv = item.children.find((c: any) => c.hasClass('claudian-slash-desc'));
    return {
      name: nameSpan?.textContent?.replace(/^\//, '') ?? '',
      description: descDiv?.textContent ?? '',
    };
  });
}

function getRenderedCommandNames(containerEl: any): string[] {
  return getRenderedItems(containerEl).map(i => i.name);
}

const CLAUDE_CONFIG: ProviderCommandDropdownConfig = {
  providerId: 'claude',
  triggerChars: ['/'],
  builtInPrefix: '/',
  skillPrefix: '/',
  commandPrefix: '/',
};

function makeEntry(name: string, description = ''): ProviderCommandEntry {
  return {
    id: `cmd-${name}`, providerId: 'claude', kind: 'command', name,
    description, content: '', scope: 'runtime', source: 'sdk',
    isEditable: false, isDeletable: false, displayPrefix: '/', insertPrefix: '/',
  };
}

const PROVIDER_ENTRIES: ProviderCommandEntry[] = [
  makeEntry('commit', 'Create a git commit'),
  makeEntry('pr', 'Create a pull request'),
  makeEntry('review', 'Review code'),
  makeEntry('my-custom', 'Custom command'),
  makeEntry('compact', 'Compact context'),
];

describe('SlashCommandDropdown', () => {
  let containerEl: any;
  let inputEl: any;
  let callbacks: SlashCommandDropdownCallbacks;
  let dropdown: SlashCommandDropdown;

  beforeEach(() => {
    containerEl = createMockEl();
    inputEl = createMockInput();
    callbacks = createMockCallbacks();
    dropdown = new SlashCommandDropdown(containerEl, inputEl, callbacks);
  });

  afterEach(() => {
    dropdown.destroy();
  });

  describe('constructor', () => {
    it('creates dropdown with container and input elements', () => {
      expect(dropdown).toBeInstanceOf(SlashCommandDropdown);
    });

    it('adds input event listener', () => {
      expect(inputEl.addEventListener).toHaveBeenCalledWith('input', expect.any(Function));
    });

    it('accepts optional hiddenCommands in options', () => {
      const hiddenCommands = new Set(['commit', 'pr']);
      const dropdownWithHidden = new SlashCommandDropdown(
        containerEl, inputEl, callbacks, { hiddenCommands }
      );
      expect(dropdownWithHidden).toBeInstanceOf(SlashCommandDropdown);
      dropdownWithHidden.destroy();
    });
  });

  describe('setEnabled', () => {
    it('should not show dropdown when disabled', async () => {
      dropdown.setEnabled(false);

      inputEl.value = '/';
      inputEl.selectionStart = 1;
      dropdown.handleInputChange();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(dropdown.isVisible()).toBe(false);
      expect(getRenderedCommandNames(containerEl)).toEqual([]);
    });

    it('should hide dropdown when disabling while visible', async () => {
      inputEl.value = '/';
      inputEl.selectionStart = 1;
      dropdown.handleInputChange();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(dropdown.isVisible()).toBe(true);

      dropdown.setEnabled(false);

      expect(dropdown.isVisible()).toBe(false);
    });
  });

  describe('hidden commands filtering', () => {
    it('should filter out user-hidden commands from provider entries', async () => {
      const getProviderEntries = jest.fn().mockResolvedValue(PROVIDER_ENTRIES);
      const hiddenCommands = new Set(['commit', 'pr']);

      const dropdownWithHidden = new SlashCommandDropdown(
        containerEl, inputEl, callbacks,
        { hiddenCommands, providerConfig: CLAUDE_CONFIG, getProviderEntries }
      );

      inputEl.value = '/';
      inputEl.selectionStart = 1;
      dropdownWithHidden.handleInputChange();
      await new Promise(resolve => setTimeout(resolve, 10));

      const commandNames = getRenderedCommandNames(containerEl);
      expect(commandNames).not.toContain('commit');
      expect(commandNames).not.toContain('pr');
      expect(commandNames).toContain('review');
      expect(commandNames).toContain('my-custom');

      dropdownWithHidden.destroy();
    });

    it('should NOT filter out built-in commands even if in hiddenCommands', async () => {
      const getProviderEntries = jest.fn().mockResolvedValue(PROVIDER_ENTRIES);
      const hiddenCommands = new Set(['clear', 'add-dir']);

      const dropdownWithHidden = new SlashCommandDropdown(
        containerEl, inputEl, callbacks,
        { hiddenCommands, providerConfig: CLAUDE_CONFIG, getProviderEntries }
      );

      inputEl.value = '/';
      inputEl.selectionStart = 1;
      dropdownWithHidden.handleInputChange();
      await new Promise(resolve => setTimeout(resolve, 10));

      const commandNames = getRenderedCommandNames(containerEl);
      expect(commandNames).toContain('clear');
      expect(commandNames).toContain('add-dir');

      dropdownWithHidden.destroy();
    });
  });

  describe('deduplication', () => {
    it('should deduplicate commands by name (built-in takes priority)', async () => {
      const entriesWithDuplicate: ProviderCommandEntry[] = [
        makeEntry('clear', 'Provider clear command'),
        makeEntry('commit', 'Create commit'),
      ];
      const getProviderEntries = jest.fn().mockResolvedValue(entriesWithDuplicate);

      const dropdownWithEntries = new SlashCommandDropdown(
        containerEl, inputEl, callbacks,
        { providerConfig: CLAUDE_CONFIG, getProviderEntries }
      );

      inputEl.value = '/cle';
      inputEl.selectionStart = 4;
      dropdownWithEntries.handleInputChange();
      await new Promise(resolve => setTimeout(resolve, 10));

      const items = getRenderedItems(containerEl);
      const clearItems = items.filter(i => i.name === 'clear');
      expect(clearItems).toHaveLength(1);
      expect(clearItems[0].description).toBe('Start a new conversation');

      dropdownWithEntries.destroy();
    });
  });

  describe('provider entry caching', () => {
    it('should cache entries after first successful fetch', async () => {
      const getProviderEntries = jest.fn().mockResolvedValue(PROVIDER_ENTRIES);

      const d = new SlashCommandDropdown(
        containerEl, inputEl, callbacks,
        { providerConfig: CLAUDE_CONFIG, getProviderEntries }
      );

      inputEl.value = '/';
      inputEl.selectionStart = 1;
      d.handleInputChange();
      await new Promise(resolve => setTimeout(resolve, 10));

      inputEl.value = '/c';
      inputEl.selectionStart = 2;
      d.handleInputChange();
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(getProviderEntries).toHaveBeenCalledTimes(1);
      d.destroy();
    });

    it('空结果也缓存，连续打开不重复拉取；reset 后可再拉', async () => {
      const getProviderEntries = jest.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(PROVIDER_ENTRIES);

      const d = new SlashCommandDropdown(
        containerEl, inputEl, callbacks,
        { providerConfig: CLAUDE_CONFIG, getProviderEntries }
      );

      inputEl.value = '/';
      inputEl.selectionStart = 1;
      d.handleInputChange();
      await new Promise(resolve => setTimeout(resolve, 10));

      inputEl.value = '/c';
      inputEl.selectionStart = 2;
      d.handleInputChange();
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(getProviderEntries).toHaveBeenCalledTimes(1);

      d.resetSdkSkillsCache();

      inputEl.value = '/';
      inputEl.selectionStart = 1;
      d.handleInputChange();
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(getProviderEntries).toHaveBeenCalledTimes(2);
      expect(getRenderedCommandNames(containerEl)).toContain('commit');

      d.destroy();
    });

    it('失败后缓存空数组，连续打开不重复拉取；reset 后可再拉', async () => {
      const getProviderEntries = jest.fn()
        .mockRejectedValueOnce(new Error('Not ready'))
        .mockResolvedValueOnce(PROVIDER_ENTRIES);

      const d = new SlashCommandDropdown(
        containerEl, inputEl, callbacks,
        { providerConfig: CLAUDE_CONFIG, getProviderEntries }
      );

      inputEl.value = '/';
      inputEl.selectionStart = 1;
      d.handleInputChange();
      await new Promise(resolve => setTimeout(resolve, 10));

      inputEl.value = '/c';
      inputEl.selectionStart = 2;
      d.handleInputChange();
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(getProviderEntries).toHaveBeenCalledTimes(1);

      d.resetSdkSkillsCache();

      inputEl.value = '/';
      inputEl.selectionStart = 1;
      d.handleInputChange();
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(getProviderEntries).toHaveBeenCalledTimes(2);
      expect(getRenderedCommandNames(containerEl)).toContain('commit');

      d.destroy();
    });
  });

  describe('race condition handling', () => {
    it('并发触发只调用一次 getProviderEntries，解析完成后以最新 request 写入缓存', async () => {
      let resolveFirst: (value: ProviderCommandEntry[]) => void;
      const firstPromise = new Promise<ProviderCommandEntry[]>(resolve => { resolveFirst = resolve; });

      const getProviderEntries = jest.fn().mockReturnValueOnce(firstPromise);

      const d = new SlashCommandDropdown(
        containerEl, inputEl, callbacks,
        { providerConfig: CLAUDE_CONFIG, getProviderEntries }
      );

      inputEl.value = '/';
      inputEl.selectionStart = 1;
      d.handleInputChange();

      inputEl.value = '/n';
      inputEl.selectionStart = 2;
      d.handleInputChange();
      await new Promise(resolve => setTimeout(resolve, 5));

      expect(getProviderEntries).toHaveBeenCalledTimes(1);

      resolveFirst!([makeEntry('resolved-later', 'L')]);
      await new Promise(resolve => setTimeout(resolve, 15));

      inputEl.value = '/';
      inputEl.selectionStart = 1;
      d.handleInputChange();
      await new Promise(resolve => setTimeout(resolve, 10));

      const names = getRenderedCommandNames(containerEl);
      expect(names).toContain('resolved-later');
      expect(getProviderEntries).toHaveBeenCalledTimes(1);

      d.destroy();
    });
  });

  describe('setHiddenCommands', () => {
    it('should update hidden commands set', async () => {
      const getProviderEntries = jest.fn().mockResolvedValue(PROVIDER_ENTRIES);

      const d = new SlashCommandDropdown(
        containerEl, inputEl, callbacks,
        { providerConfig: CLAUDE_CONFIG, getProviderEntries }
      );

      inputEl.value = '/';
      inputEl.selectionStart = 1;
      d.handleInputChange();
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(getRenderedCommandNames(containerEl)).toContain('commit');

      d.setHiddenCommands(new Set(['commit']));

      inputEl.value = '/c';
      inputEl.selectionStart = 2;
      d.handleInputChange();
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(getRenderedCommandNames(containerEl)).not.toContain('commit');

      d.destroy();
    });
  });

  describe('resetSdkSkillsCache', () => {
    it('should clear cached entries and allow refetch', async () => {
      const getProviderEntries = jest.fn().mockResolvedValue(PROVIDER_ENTRIES);

      const d = new SlashCommandDropdown(
        containerEl, inputEl, callbacks,
        { providerConfig: CLAUDE_CONFIG, getProviderEntries }
      );

      inputEl.value = '/';
      inputEl.selectionStart = 1;
      d.handleInputChange();
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(getProviderEntries).toHaveBeenCalledTimes(1);

      d.resetSdkSkillsCache();

      inputEl.value = '/c';
      inputEl.selectionStart = 2;
      d.handleInputChange();
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(getProviderEntries).toHaveBeenCalledTimes(2);

      d.destroy();
    });
  });

  describe('空列表与失败缓存（C03 §3.1）', () => {
    it('多次打开空结果时不重复调用 getProviderEntries', async () => {
      const getProviderEntries = jest.fn().mockResolvedValue([]);
      const d = new SlashCommandDropdown(
        containerEl, inputEl, callbacks,
        { providerConfig: CLAUDE_CONFIG, getProviderEntries }
      );

      inputEl.value = '/';
      inputEl.selectionStart = 1;
      d.handleInputChange();
      await new Promise(r => setTimeout(r, 15));

      inputEl.value = '/';
      inputEl.selectionStart = 1;
      d.handleInputChange();
      await new Promise(r => setTimeout(r, 15));

      expect(getProviderEntries).toHaveBeenCalledTimes(1);
      d.destroy();
    });

    it('getProviderEntries 失败后记空缓存，不无限重试', async () => {
      const getProviderEntries = jest.fn().mockRejectedValue(new Error('fail'));
      const d = new SlashCommandDropdown(
        containerEl, inputEl, callbacks,
        { providerConfig: CLAUDE_CONFIG, getProviderEntries }
      );

      inputEl.value = '/';
      inputEl.selectionStart = 1;
      d.handleInputChange();
      await new Promise(r => setTimeout(r, 15));

      inputEl.value = '/';
      inputEl.selectionStart = 1;
      d.handleInputChange();
      await new Promise(r => setTimeout(r, 15));

      expect(getProviderEntries).toHaveBeenCalledTimes(1);
      d.destroy();
    });
  });

  describe('prefetch', () => {
    it('填充缓存且并发 prefetch 与打开共用一次 getProviderEntries', async () => {
      let resolveEntries!: (v: typeof PROVIDER_ENTRIES) => void;
      const getProviderEntries = jest.fn().mockImplementation(
        () => new Promise<typeof PROVIDER_ENTRIES>((res) => { resolveEntries = res; }),
      );
      const d = new SlashCommandDropdown(
        containerEl, inputEl, callbacks,
        { providerConfig: CLAUDE_CONFIG, getProviderEntries }
      );

      const p1 = d.prefetch();
      const p2 = d.prefetch();
      expect(getProviderEntries).toHaveBeenCalledTimes(1);
      resolveEntries([]);
      await Promise.all([p1, p2]);

      inputEl.value = '/';
      inputEl.selectionStart = 1;
      d.handleInputChange();
      await new Promise(r => setTimeout(r, 10));
      expect(getProviderEntries).toHaveBeenCalledTimes(1);

      d.destroy();
    });
  });

  describe('handleInputChange', () => {
    it('should hide dropdown when no valid trigger is found', () => {
      inputEl.value = 'text without trigger';
      inputEl.selectionStart = 20;
      dropdown.handleInputChange();

      expect(callbacks.onHide).toHaveBeenCalled();
    });

    it('should hide dropdown when whitespace follows command', () => {
      inputEl.value = '/clear ';
      inputEl.selectionStart = 7;
      dropdown.handleInputChange();

      expect(callbacks.onHide).toHaveBeenCalled();
    });

    it('should show dropdown when / is at position 0', async () => {
      inputEl.value = '/';
      inputEl.selectionStart = 1;
      dropdown.handleInputChange();
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(containerEl.children.length).toBeGreaterThan(0);
    });
  });

  describe('handleKeydown', () => {
    it('should return false when dropdown is not visible', () => {
      const event = { key: 'ArrowDown', preventDefault: jest.fn() } as any;
      const handled = dropdown.handleKeydown(event);

      expect(handled).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('isVisible', () => {
    it('should return false initially', () => {
      expect(dropdown.isVisible()).toBe(false);
    });
  });

  describe('hide', () => {
    it('should call onHide callback', () => {
      dropdown.hide();
      expect(callbacks.onHide).toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should remove input event listener', () => {
      dropdown.destroy();
      expect(inputEl.removeEventListener).toHaveBeenCalledWith('input', expect.any(Function));
    });
  });

  describe('search filtering', () => {
    it('should filter commands by name', async () => {
      const getProviderEntries = jest.fn().mockResolvedValue(PROVIDER_ENTRIES);

      const d = new SlashCommandDropdown(
        containerEl, inputEl, callbacks,
        { providerConfig: CLAUDE_CONFIG, getProviderEntries }
      );

      inputEl.value = '/com';
      inputEl.selectionStart = 4;
      d.handleInputChange();
      await new Promise(resolve => setTimeout(resolve, 10));

      const commandNames = getRenderedCommandNames(containerEl);
      expect(commandNames).toContain('commit');
      expect(commandNames).not.toContain('pr');

      d.destroy();
    });

    it('should filter commands by description', async () => {
      const getProviderEntries = jest.fn().mockResolvedValue(PROVIDER_ENTRIES);

      const d = new SlashCommandDropdown(
        containerEl, inputEl, callbacks,
        { providerConfig: CLAUDE_CONFIG, getProviderEntries }
      );

      inputEl.value = '/pull';
      inputEl.selectionStart = 5;
      d.handleInputChange();
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(getRenderedCommandNames(containerEl)).toContain('pr');

      d.destroy();
    });

    it('should hide dropdown when search has no matches', async () => {
      inputEl.value = '/xyz123nonexistent';
      inputEl.selectionStart = 18;
      dropdown.handleInputChange();
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(callbacks.onHide).toHaveBeenCalled();
    });

    it('should sort results alphabetically', async () => {
      const getProviderEntries = jest.fn().mockResolvedValue(PROVIDER_ENTRIES);

      const d = new SlashCommandDropdown(
        containerEl, inputEl, callbacks,
        { providerConfig: CLAUDE_CONFIG, getProviderEntries }
      );

      inputEl.value = '/';
      inputEl.selectionStart = 1;
      d.handleInputChange();
      await new Promise(resolve => setTimeout(resolve, 10));

      const names = getRenderedCommandNames(containerEl);
      const sortedNames = [...names].sort();
      expect(names).toEqual(sortedNames);

      d.destroy();
    });
  });

  describe('openSlashPickerFromToolbar', () => {
    it('应在空输入插入斜杠并走与 handleInputChange 相同的展示路径', async () => {
      const getProviderEntries = jest.fn().mockResolvedValue([]);
      const input = createMockInput();
      input.setSelectionRange = jest.fn((start: number, end: number) => {
        input.selectionStart = start;
        input.selectionEnd = end;
      });

      const d = new SlashCommandDropdown(
        containerEl,
        input,
        callbacks,
        { providerConfig: CLAUDE_CONFIG, getProviderEntries },
      );

      d.openSlashPickerFromToolbar();
      await new Promise(resolve => setTimeout(resolve, 15));

      expect(input.value).toBe('/');
      expect(input.focus).toHaveBeenCalled();
      expect(getRenderedCommandNames(containerEl).length).toBeGreaterThan(0);

      d.destroy();
    });

    it('光标已在 / 片段内时应仅刷新列表而不重复插入', async () => {
      const getProviderEntries = jest.fn().mockResolvedValue([]);
      const input = createMockInput();
      input.setSelectionRange = jest.fn((start: number, end: number) => {
        input.selectionStart = start;
        input.selectionEnd = end;
      });
      input.value = '/';
      input.selectionStart = 1;
      input.selectionEnd = 1;

      const d = new SlashCommandDropdown(
        containerEl,
        input,
        callbacks,
        { providerConfig: CLAUDE_CONFIG, getProviderEntries },
      );

      d.openSlashPickerFromToolbar();
      await new Promise(resolve => setTimeout(resolve, 15));

      expect(input.value).toBe('/');

      d.destroy();
    });
  });
});
