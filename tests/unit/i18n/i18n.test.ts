import {
  getAvailableLocales,
  getLocale,
  getLocaleDisplayName,
  normalizeClaudianLocale,
  setLocale,
  t,
} from '@/i18n/i18n';
import type { Locale, TranslationKey } from '@/i18n/types';

describe('i18n', () => {
  beforeEach(() => {
    setLocale('en');
  });

  describe('normalizeClaudianLocale', () => {
    it('保留仍支持的语言代码', () => {
      expect(normalizeClaudianLocale('en')).toBe('en');
      expect(normalizeClaudianLocale('zh-CN')).toBe('zh-CN');
    });

    it('将已移除的语言与异常值映射为简体中文', () => {
      expect(normalizeClaudianLocale('ja')).toBe('zh-CN');
      expect(normalizeClaudianLocale('zh-TW')).toBe('zh-CN');
      expect(normalizeClaudianLocale('')).toBe('zh-CN');
      expect(normalizeClaudianLocale(undefined)).toBe('zh-CN');
    });
  });

  describe('t (translate)', () => {
    it('returns translated string for valid key', () => {
      const result = t('common.save' as TranslationKey);
      expect(result).toBe('Save');
    });

    it('returns string with parameter interpolation', () => {
      const result = t('chat.rewind.notice' as TranslationKey, { count: 2 });
      expect(result).toBe('Rewound: 2 file(s) reverted');
    });

    it('returns key for missing translation in English', () => {
      const result = t('nonexistent.key.here' as TranslationKey);

      expect(result).toBe('nonexistent.key.here');
    });

    it('uses Simplified Chinese strings when locale is zh-CN', () => {
      setLocale('zh-CN');
      expect(t('common.save' as TranslationKey)).toBe('保存');
    });

    it('handles nested keys correctly', () => {
      const result = t('settings.userName.name' as TranslationKey);
      expect(result).toBe('What should Claudian call you?');
    });

    it('handles deeply nested keys', () => {
      const result = t('settings.userName.desc' as TranslationKey);
      expect(result).toBe('Your name for personalized greetings (leave empty for generic greetings)');
    });

    it('returns key when value is not a string', () => {
      const result = t('settings' as TranslationKey);

      expect(result).toBe('settings');
    });

    it('replaces placeholders with params', () => {
      const result = t('chat.fork.failed' as TranslationKey, { error: 'Network timeout' });
      expect(result).toBe('Fork failed: Network timeout');
    });

    it('keeps placeholder if param not provided', () => {
      const result = t('chat.rewind.notice' as TranslationKey, {});
      expect(result).toBe('Rewound: {count} file(s) reverted');
    });
  });

  describe('setLocale', () => {
    it('sets valid locale and returns true', () => {
      const result = setLocale('zh-CN');

      expect(result).toBe(true);
      expect(getLocale()).toBe('zh-CN');
    });

    it('returns false for invalid locale and keeps current', () => {
      setLocale('zh-CN');

      const result = setLocale('invalid' as Locale);

      expect(result).toBe(false);
      expect(getLocale()).toBe('zh-CN');
    });
  });

  describe('getLocale', () => {
    it('returns current locale after change', () => {
      setLocale('zh-CN');
      expect(getLocale()).toBe('zh-CN');
    });
  });

  describe('getAvailableLocales', () => {
    it('returns en and zh-CN only', () => {
      const locales = getAvailableLocales();

      expect(locales).toContain('en');
      expect(locales).toContain('zh-CN');
      expect(locales).toHaveLength(2);
    });
  });

  describe('getLocaleDisplayName', () => {
    it('returns English for en', () => {
      expect(getLocaleDisplayName('en')).toBe('English');
    });

    it('returns Simplified Chinese name for zh-CN', () => {
      expect(getLocaleDisplayName('zh-CN')).toBe('简体中文');
    });
  });

});
