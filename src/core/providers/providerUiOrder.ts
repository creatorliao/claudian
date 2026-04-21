import type { ProviderId } from './types';

/**
 * 内置提供商在设置页签、模型分组、启用列表中的统一顺序：Claude → Cursor → Codex。
 * 新增内置提供商时需同步更新本列表。
 */
export const PROVIDER_UI_ORDER: readonly ProviderId[] = [
  'claude',
  'cursor',
  'codex',
];

/** 未出现在 {@link PROVIDER_UI_ORDER} 中的注册 id 排在末尾 */
const FALLBACK_RANK = 100;

/** 与 UI 顺序一致的排序键（升序 = Claude → Cursor → Codex） */
export function getProviderUiRank(providerId: ProviderId): number {
  const i = PROVIDER_UI_ORDER.indexOf(providerId);
  return i === -1 ? FALLBACK_RANK : i;
}
