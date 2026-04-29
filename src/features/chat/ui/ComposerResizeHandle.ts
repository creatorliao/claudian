import { t } from '../../../i18n/i18n';
import type ClaudianPlugin from '../../../main';
import {
  clampAppliedComposerMinHeight,
  computeComposerMaxHeightPx,
  measureComposerBaselineHeightPx,
} from '../tabs/composerHeight';
import type { TabData } from '../tabs/types';

/** 双击重置高度时：落在可交互子节点上则不打断其默认行为（C9） */
function isDblClickResetBlockedTarget(target: HTMLElement | null): boolean {
  if (!target) {
    return true;
  }
  return !!target.closest(
    'button, a, input, textarea, select, [contenteditable="true"], [role="button"]',
  );
}

async function resetComposerPreference(
  tab: TabData,
  plugin: ClaudianPlugin,
  onAfterApply: () => void,
): Promise<void> {
  Reflect.deleteProperty(plugin.settings, 'composerPreferredMinHeightPx');
  await plugin.saveSettings();
  tab.dom.inputContainerEl.style.minHeight = '';
  applyComposerMinHeightFromSettings(tab, plugin, onAfterApply);
}

function isComposerLayoutHidden(inputContainerEl: HTMLElement): boolean {
  if (inputContainerEl.style.display === 'none') {
    return true;
  }
  const chain = inputContainerEl.closest('.claudian-tab-content') as HTMLElement | null;
  if (chain && chain.style.display === 'none') {
    return true;
  }
  return false;
}

/**
 * 将设置中的偏好钳制后施加到组合器容器，并更新分隔条无障碍属性。
 */
export function applyComposerMinHeightFromSettings(
  tab: TabData,
  plugin: ClaudianPlugin,
  onAfterApply?: () => void,
): void {
  const { inputContainerEl, composerResizeHandleInnerEl } = tab.dom;
  if (isComposerLayoutHidden(inputContainerEl)) {
    return;
  }

  const baseline = measureComposerBaselineHeightPx(inputContainerEl);
  const maxPx = computeComposerMaxHeightPx(tab.dom.contentEl, tab.dom.statusPanelContainerEl);
  const stored = plugin.settings.composerPreferredMinHeightPx;
  const applied = clampAppliedComposerMinHeight(stored, baseline, maxPx);

  if (applied === undefined) {
    inputContainerEl.style.minHeight = '';
  } else {
    inputContainerEl.style.minHeight = `${applied}px`;
  }

  updateResizeHandleA11y(composerResizeHandleInnerEl, applied ?? baseline, baseline, maxPx);
  onAfterApply?.();
}

let activeDrag: {
  tab: TabData;
  plugin: ClaudianPlugin;
  onAfterApply: () => void;
  startClientY: number;
  startHeight: number;
  startUserSelect: string;
  /** 按下并 setPointerCapture 的把手节点（内外缘之一） */
  captureTarget: HTMLElement;
  pointerId: number;
  raf: number | null;
  pendingPx: number | null;
  /** 指针按下后是否至少写入过一次临时高度（用于收尾是否落盘） */
  didApplyTemp: boolean;
  lastClampedPx: number;
} | null = null;

let docListenersAttached = false;

function endDocListeners(): void {
  if (!docListenersAttached) {
    return;
  }
  document.removeEventListener('pointermove', onDocPointerMove);
  document.removeEventListener('pointerup', onDocPointerUp);
  document.removeEventListener('pointercancel', onDocPointerUp);
  document.removeEventListener('visibilitychange', onVisibilityChange);
  window.removeEventListener('blur', onWindowBlur);
  docListenersAttached = false;
}

function onVisibilityChange(): void {
  if (document.visibilityState === 'hidden') {
    finishComposerDrag(true);
  }
}

function onWindowBlur(): void {
  finishComposerDrag(true);
}

function onDocPointerMove(ev: PointerEvent): void {
  const drag = activeDrag;
  if (!drag) {
    return;
  }
  if (ev.pointerId !== drag.pointerId) {
    return;
  }
  const baseline = measureComposerBaselineHeightPx(drag.tab.dom.inputContainerEl);
  const maxPx = computeComposerMaxHeightPx(drag.tab.dom.contentEl, drag.tab.dom.statusPanelContainerEl);
  const delta = ev.clientY - drag.startClientY;
  let next = Math.round(drag.startHeight - delta);
  next = clampAppliedComposerMinHeight(next, baseline, maxPx) ?? baseline;
  drag.pendingPx = next;
  if (drag.raf !== null) {
    return;
  }
  drag.raf = window.requestAnimationFrame(() => {
    drag.raf = null;
    const px = drag.pendingPx;
    if (px === null) {
      return;
    }
    drag.tab.dom.inputContainerEl.style.minHeight = `${px}px`;
    drag.didApplyTemp = true;
    drag.lastClampedPx = px;
    updateResizeHandleA11y(drag.tab.dom.composerResizeHandleInnerEl, px, baseline, maxPx);
  });
}

async function onDocPointerUp(ev: PointerEvent): Promise<void> {
  const drag = activeDrag;
  if (!drag) {
    return;
  }
  if (ev.pointerId !== drag.pointerId) {
    return;
  }
  await finishComposerDrag(true);
}

/**
 * 审批 / AskUserQuestion 等隐藏输入区时打断拖拽，避免残留 document 监听。
 */
export function interruptComposerDragIfActive(tab: TabData): void {
  if (activeDrag?.tab === tab) {
    void finishComposerDrag(true);
  }
}

async function finishComposerDrag(shouldPersist: boolean): Promise<void> {
  const drag = activeDrag;
  if (!drag) {
    return;
  }

  if (drag.raf !== null) {
    cancelAnimationFrame(drag.raf);
    drag.raf = null;
  }
  if (drag.pendingPx !== null) {
    const px = drag.pendingPx;
    drag.tab.dom.inputContainerEl.style.minHeight = `${px}px`;
    drag.lastClampedPx = px;
    drag.didApplyTemp = true;
    drag.pendingPx = null;
  }

  const { tab, plugin, onAfterApply, startUserSelect, pointerId, captureTarget } = drag;
  activeDrag = null;

  endDocListeners();

  document.body.style.userSelect = startUserSelect;

  try {
    captureTarget.releasePointerCapture(pointerId);
  } catch {
    /* 部分宿主在 pointercancel 后释放会抛错，忽略 */
  }

  if (shouldPersist && drag.didApplyTemp) {
    plugin.settings.composerPreferredMinHeightPx = drag.lastClampedPx;
    await plugin.saveSettings();
  }

  applyComposerMinHeightFromSettings(tab, plugin, onAfterApply);
}

function updateResizeHandleA11y(
  handleEl: HTMLElement,
  valueNow: number,
  minPx: number,
  maxPx: number,
): void {
  handleEl.setAttribute('aria-valuenow', String(Math.round(valueNow)));
  handleEl.setAttribute('aria-valuemin', String(Math.round(minPx)));
  handleEl.setAttribute('aria-valuemax', String(Math.round(maxPx)));
}

/**
 * 在组合器外缘与内层卡片顶缘外安装拖拽条并注册 ResizeObserver / 全局打断条件。
 */
export function wireComposerResize(tab: TabData, plugin: ClaudianPlugin, onAfterApply: () => void): void {
  const outerEl = tab.dom.composerResizeHandleOuterEl;
  const innerEl = tab.dom.composerResizeHandleInnerEl;

  outerEl.setAttribute('role', 'presentation');
  outerEl.setAttribute('aria-hidden', 'true');
  outerEl.tabIndex = -1;

  innerEl.setAttribute('role', 'separator');
  innerEl.setAttribute('aria-orientation', 'horizontal');
  innerEl.setAttribute('aria-label', t('chat.composer.resizeHandleAriaLabel'));
  innerEl.tabIndex = 0;

  const claudianRoot = tab.dom.contentEl.closest('.claudian-container') as HTMLElement | null;
  const roTarget = claudianRoot ?? tab.dom.contentEl;
  const resizeObserver = new ResizeObserver(() => {
    applyComposerMinHeightFromSettings(tab, plugin, onAfterApply);
  });
  resizeObserver.observe(roTarget);
  tab.dom.eventCleanups.push(() => resizeObserver.disconnect());

  const attachResizeHandle = (handleTarget: HTMLElement): void => {
    const onPointerDown = (ev: PointerEvent): void => {
      if (ev.button !== 0 || !ev.isPrimary) {
        return;
      }
      if (activeDrag) {
        void finishComposerDrag(true);
      }

      const { inputContainerEl } = tab.dom;
      if (isComposerLayoutHidden(inputContainerEl)) {
        return;
      }

      ev.preventDefault();

      const rect = inputContainerEl.getBoundingClientRect();
      const startHeight = rect.height;
      const baseline = measureComposerBaselineHeightPx(inputContainerEl);
      const maxPx = computeComposerMaxHeightPx(tab.dom.contentEl, tab.dom.statusPanelContainerEl);

      activeDrag = {
        tab,
        plugin,
        onAfterApply,
        startClientY: ev.clientY,
        startHeight,
        startUserSelect: document.body.style.userSelect,
        captureTarget: handleTarget,
        pointerId: ev.pointerId,
        raf: null,
        pendingPx: null,
        didApplyTemp: false,
        lastClampedPx: clampAppliedComposerMinHeight(
          plugin.settings.composerPreferredMinHeightPx,
          baseline,
          maxPx,
        ) ?? baseline,
      };

      document.body.style.userSelect = 'none';
      try {
        handleTarget.setPointerCapture(ev.pointerId);
      } catch {
        /* 忽略 */
      }

      document.addEventListener('pointermove', onDocPointerMove);
      document.addEventListener('pointerup', onDocPointerUp);
      document.addEventListener('pointercancel', onDocPointerUp);
      document.addEventListener('visibilitychange', onVisibilityChange);
      window.addEventListener('blur', onWindowBlur);
      docListenersAttached = true;
    };

    handleTarget.addEventListener('pointerdown', onPointerDown);

    const onDblClick = async (ev: MouseEvent): Promise<void> => {
      ev.preventDefault();
      ev.stopPropagation();
      await resetComposerPreference(tab, plugin, onAfterApply);
    };
    handleTarget.addEventListener('dblclick', onDblClick);

    tab.dom.eventCleanups.push(() => {
      handleTarget.removeEventListener('pointerdown', onPointerDown);
      handleTarget.removeEventListener('dblclick', onDblClick);
      if (activeDrag?.tab === tab) {
        void finishComposerDrag(false);
      }
    });
  };

  attachResizeHandle(outerEl);
  attachResizeHandle(innerEl);

  /** 外条与内条之间（队列行 / 导航行）双击重置，与把手双击等价（C9） */
  const attachBetweenHandlesDblClickReset = (zoneEl: HTMLElement): void => {
    const onDblClick = async (ev: MouseEvent): Promise<void> => {
      if (isDblClickResetBlockedTarget(ev.target as HTMLElement)) {
        return;
      }
      ev.preventDefault();
      ev.stopPropagation();
      await resetComposerPreference(tab, plugin, onAfterApply);
    };
    zoneEl.addEventListener('dblclick', onDblClick);
    tab.dom.eventCleanups.push(() => zoneEl.removeEventListener('dblclick', onDblClick));
  };

  attachBetweenHandlesDblClickReset(tab.dom.queueIndicatorEl);
  attachBetweenHandlesDblClickReset(tab.dom.navRowEl);

  requestAnimationFrame(() => {
    applyComposerMinHeightFromSettings(tab, plugin, onAfterApply);
  });
}
