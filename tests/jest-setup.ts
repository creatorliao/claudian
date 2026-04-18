import { setLocale } from '@/i18n/i18n';

/**
 * 单测默认界面语言为英文，避免在 Windows 开发机上以 zh-CN 为默认时大量断言英文文案失败。
 * 需要验证中文的用例在文件内自行 setLocale('zh-CN')。
 */
beforeEach(() => {
  setLocale('en');
});
