import { DEFAULT_LOCALE, getLocaleDisplayString, getLocaleInfo, SUPPORTED_LOCALES } from '@/i18n/constants';

describe('i18n/constants', () => {
  it('DEFAULT_LOCALE is Simplified Chinese', () => {
    expect(DEFAULT_LOCALE).toBe('zh-CN');
  });

  it('getLocaleInfo returns metadata for a supported locale', () => {
    const infoEn = getLocaleInfo('en');
    expect(infoEn).toBeDefined();
    expect(infoEn?.code).toBe('en');
    expect(infoEn?.name).toBe('English');
    expect(infoEn?.englishName).toBe('English');
    expect(infoEn?.flag).toBe('🇺🇸');

    const infoZh = getLocaleInfo('zh-CN');
    expect(infoZh?.code).toBe('zh-CN');
    expect(infoZh?.name).toBe('简体中文');
  });

  it('getLocaleInfo returns undefined for unknown locale', () => {
    expect(getLocaleInfo('xx' as any)).toBeUndefined();
  });

  it('getLocaleDisplayString returns a string with a flag by default', () => {
    expect(getLocaleDisplayString('en')).toBe('🇺🇸 English (English)');
  });

  it('getLocaleDisplayString can omit the flag', () => {
    expect(getLocaleDisplayString('en', false)).toBe('English (English)');
  });

  it('getLocaleDisplayString returns code when locale is unknown', () => {
    expect(getLocaleDisplayString('xx' as any)).toBe('xx');
  });

  it('getLocaleDisplayString omits the flag when metadata has no flag', () => {
    const originalFlag = SUPPORTED_LOCALES[0]?.flag;
    SUPPORTED_LOCALES[0].flag = undefined;
    try {
      expect(getLocaleDisplayString('en')).toBe('English (English)');
    } finally {
      SUPPORTED_LOCALES[0].flag = originalFlag;
    }
  });
});

