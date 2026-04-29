/**
 * @jest-environment jsdom
 */

import {
  clampAppliedComposerMinHeight,
  COMPOSER_CHROME_ABOVE_TEXTAREA_PX,
  COMPOSER_MIN_HEIGHT_FALLBACK_PX,
  computeComposerMaxHeightPx,
  MESSAGES_MIN_RESERVED_PX,
  normalizeComposerPreferredMinHeightPx,
} from '@/features/chat/tabs/composerHeight';
import { TEXTAREA_MAX_HEIGHT_PERCENT, TEXTAREA_MIN_MAX_HEIGHT } from '@/features/chat/tabs/types';

describe('composerHeight', () => {
  describe('normalizeComposerPreferredMinHeightPx', () => {
    it('接受非负有限数并四舍五入', () => {
      expect(normalizeComposerPreferredMinHeightPx(320.4)).toBe(320);
      expect(normalizeComposerPreferredMinHeightPx(0)).toBe(0);
    });

    it('非法输入返回 undefined', () => {
      expect(normalizeComposerPreferredMinHeightPx(undefined)).toBeUndefined();
      expect(normalizeComposerPreferredMinHeightPx(NaN)).toBeUndefined();
      expect(normalizeComposerPreferredMinHeightPx(-1)).toBeUndefined();
      expect(normalizeComposerPreferredMinHeightPx('240' as unknown as number)).toBeUndefined();
    });
  });

  describe('clampAppliedComposerMinHeight', () => {
    it('无偏好时不施加样式', () => {
      expect(clampAppliedComposerMinHeight(undefined, 200, 500)).toBeUndefined();
    });

    it('钳制在 baseline 与 max 之间', () => {
      expect(clampAppliedComposerMinHeight(100, 200, 500)).toBe(200);
      expect(clampAppliedComposerMinHeight(400, 200, 350)).toBe(350);
      expect(clampAppliedComposerMinHeight(280, 200, 500)).toBe(280);
    });

    it('max 小于 baseline 时以上限为准（极小窗格）', () => {
      expect(clampAppliedComposerMinHeight(500, 300, 150)).toBe(150);
    });
  });

  describe('computeComposerMaxHeightPx', () => {
    it('至少为兜底常量，且不大于由视高与消息留白推导的预算', () => {
      const tabContent = document.createElement('div');
      const statusPanel = document.createElement('div');
      const container = document.createElement('div');
      container.className = 'claudian-container';
      container.style.height = '800px';
      tabContent.style.height = '800px';
      statusPanel.style.height = '40px';
      container.appendChild(tabContent);

      Object.defineProperty(tabContent, 'clientHeight', {
        configurable: true,
        value: 800,
      });
      Object.defineProperty(statusPanel, 'offsetHeight', {
        configurable: true,
        value: 40,
      });
      Object.defineProperty(container, 'clientHeight', {
        configurable: true,
        value: 800,
      });

      const maxPx = computeComposerMaxHeightPx(tabContent, statusPanel);
      const textareaMax = Math.max(
        TEXTAREA_MIN_MAX_HEIGHT,
        800 * TEXTAREA_MAX_HEIGHT_PERCENT,
      );
      const fromTextareaRule = textareaMax + COMPOSER_CHROME_ABOVE_TEXTAREA_PX;
      const spaceBudget = 800 - 40 - MESSAGES_MIN_RESERVED_PX;
      const expectedUpper = Math.min(fromTextareaRule, spaceBudget);
      expect(maxPx).toBeGreaterThanOrEqual(COMPOSER_MIN_HEIGHT_FALLBACK_PX);
      expect(maxPx).toBe(Math.max(COMPOSER_MIN_HEIGHT_FALLBACK_PX, Math.round(expectedUpper)));
    });
  });
});
