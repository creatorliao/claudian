import {
  TEXTAREA_MAX_HEIGHT_PERCENT,
  TEXTAREA_MIN_MAX_HEIGHT,
} from './types';

/** 消息列表区域至少保留的可见高度（px），与方案 §5.2 / §8 默认取 140（120～160 折中） */
export const MESSAGES_MIN_RESERVED_PX = 140;

/** 组合器基准高度测量失败时的兜底（px） */
export const COMPOSER_MIN_HEIGHT_FALLBACK_PX = 220;

/**
 * 相对 textarea 最大高度之外的固定装帧高度估值（导航、把手、wrapper 顶缘、工具栏、容器 padding 等），
 * 用于与 autoResizeTextarea 的纵向预算对齐（方案 §5.2）。
 */
export const COMPOSER_CHROME_ABOVE_TEXTAREA_PX = 180;

/**
 * 将磁盘或运行时不合法的 composer 偏好规范为有限非负整数或 undefined。
 */
export function normalizeComposerPreferredMinHeightPx(raw: unknown): number | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) {
    return undefined;
  }
  return Math.round(raw);
}

/**
 * 根据用户保存值、空闲态基准与当前视图上限制，计算应写到 inputContainer 的 min-height（px）。
 * - 无用户偏好：undefined（不施加内联样式）
 * - maxPx < baseline（极小窗格）：以上限为准（方案 §5.2 末尾）
 */
export function clampAppliedComposerMinHeight(
  stored: number | undefined,
  baselinePx: number,
  maxPx: number,
): number | undefined {
  if (stored === undefined) {
    return undefined;
  }
  const base = Math.round(baselinePx);
  const maxR = Math.round(maxPx);
  let v = Math.round(stored);
  v = Math.max(v, base);
  v = Math.min(v, maxR);
  return v;
}

/**
 * 计算当前 Tab 下组合器 min-height 允许上限（px）。
 */
export function computeComposerMaxHeightPx(tabContentEl: HTMLElement, statusPanelEl: HTMLElement): number {
  const claudianRoot = tabContentEl.closest('.claudian-container') as HTMLElement | null;
  const viewH = claudianRoot?.clientHeight ?? (typeof window !== 'undefined' ? window.innerHeight : 600);
  const textareaMax = Math.max(TEXTAREA_MIN_MAX_HEIGHT, viewH * TEXTAREA_MAX_HEIGHT_PERCENT);
  const composerFromTextareaRule = textareaMax + COMPOSER_CHROME_ABOVE_TEXTAREA_PX;

  const tabH = tabContentEl.clientHeight;
  const statusH = statusPanelEl.offsetHeight;
  const spaceBudget = tabH - statusH - MESSAGES_MIN_RESERVED_PX;

  const upper = Math.min(composerFromTextareaRule, spaceBudget);
  return Math.max(COMPOSER_MIN_HEIGHT_FALLBACK_PX, Math.round(upper));
}

/**
 * 在未施加组合器 min-height 内联样式瞬间测量自然高度（空闲态基准）。
 * 调用前后会短暂清空并还原 style.minHeight。
 */
export function measureComposerBaselineHeightPx(inputContainerEl: HTMLElement): number {
  const prev = inputContainerEl.style.minHeight;
  inputContainerEl.style.minHeight = '';
  const raw = inputContainerEl.offsetHeight;
  inputContainerEl.style.minHeight = prev;
  if (!Number.isFinite(raw) || raw < 12) {
    return COMPOSER_MIN_HEIGHT_FALLBACK_PX;
  }
  return Math.round(raw);
}
