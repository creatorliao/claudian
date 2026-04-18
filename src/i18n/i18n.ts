/**
 * i18n - Internationalization service for Claudian
 *
 * 仅保留 English 与简体中文两套翻译；缺失键时回退到英文词条。
 */

import * as en from './locales/en.json';
import * as zhCN from './locales/zh-CN.json';
import type { Locale, TranslationKey } from './types';

const translations: Record<Locale, typeof en> = {
  en,
  'zh-CN': zhCN,
};

/** 当前语言下缺少翻译键时，从该语言拉取文案（英文为完整基准） */
const FALLBACK_LOCALE: Locale = 'en';

/** 与 DEFAULT_CLAUDIAN_SETTINGS.locale 一致，避免插件 onload 前出现语言漂移 */
let currentLocale: Locale = 'zh-CN';

/**
 * 将磁盘或历史设置中的 locale 规范为仍受支持的一种。
 * 已移除的语言（如 ja、zh-TW）映射为简体中文，以匹配产品默认。
 */
export function normalizeClaudianLocale(raw: string | undefined | null): Locale {
  if (raw === 'en' || raw === 'zh-CN') {
    return raw;
  }
  return 'zh-CN';
}

/**
 * Get a translation by key with optional parameters
 */
export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  const dict = translations[currentLocale];

  const keys = key.split('.');
  let value: any = dict;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      if (currentLocale !== FALLBACK_LOCALE) {
        return tFallback(key, params);
      }
      return key;
    }
  }

  if (typeof value !== 'string') {
    return key;
  }

  if (params) {
    return value.replace(/\{(\w+)\}/g, (_, param) => {
      return params[param]?.toString() ?? `{${param}}`;
    });
  }

  return value;
}

function tFallback(key: TranslationKey, params?: Record<string, string | number>): string {
  const dict = translations[FALLBACK_LOCALE];
  const keys = key.split('.');
  let value: any = dict;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return key;
    }
  }

  if (typeof value !== 'string') {
    return key;
  }

  if (params) {
    return value.replace(/\{(\w+)\}/g, (_, param) => {
      return params[param]?.toString() ?? `{${param}}`;
    });
  }

  return value;
}

/**
 * Set the current locale
 * @returns true if locale was set successfully, false if locale is invalid
 */
export function setLocale(locale: Locale): boolean {
  if (!translations[locale]) {
    return false;
  }
  currentLocale = locale;
  return true;
}

/**
 * Get the current locale
 */
export function getLocale(): Locale {
  return currentLocale;
}

/**
 * Get all available locales
 */
export function getAvailableLocales(): Locale[] {
  return Object.keys(translations) as Locale[];
}

/**
 * Get display name for a locale
 */
export function getLocaleDisplayName(locale: Locale): string {
  const names: Record<Locale, string> = {
    en: 'English',
    'zh-CN': '简体中文',
  };
  return names[locale] ?? locale;
}
