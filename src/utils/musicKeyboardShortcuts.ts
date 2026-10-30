export type MusicPlayerShortcut =
  | 'lyrics'
  | 'toggle-play'
  | 'previous'
  | 'next'
  | 'skip-back'
  | 'skip-forward'
  | 'volume-up'
  | 'volume-down'
  | 'mute'

export function resolveMusicPlayerShortcut(event: KeyboardEvent): MusicPlayerShortcut | null {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey) return null

  const key = event.key.toLowerCase()
  if (event.shiftKey && !event.altKey && key === 'f') return 'lyrics'
  if (event.shiftKey) return null

  if (event.altKey) {
    if (event.key === 'ArrowLeft') return 'previous'
    if (event.key === 'ArrowRight') return 'next'
    return null
  }

  if (event.key === ' ' || event.code === 'Space') return 'toggle-play'
  if (event.key === 'ArrowLeft') return 'skip-back'
  if (event.key === 'ArrowRight') return 'skip-forward'
  if (event.key === 'ArrowUp') return 'volume-up'
  if (event.key === 'ArrowDown') return 'volume-down'
  if (key === 'm') return 'mute'
  return null
}

/**
 * 校验当前获得焦点的目标或页面上下文是否应该阻断全局音乐播放器快捷键。
 * 避免在输入框、文本编辑、模态弹窗、侧边抽屉、全局搜索与浮层菜单中误触背景音乐播放/暂停/跳曲。
 */
export function isMusicKeyboardShortcutTargetBlocked(
  active: Element | null = typeof document !== 'undefined' ? document.activeElement : null
): boolean {
  if (!active || !(active instanceof HTMLElement)) return false

  const tagName = active.tagName.toLowerCase()
  if (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    active.isContentEditable ||
    Boolean(active.closest?.('.p-editor, .dm-composer, .cm-editor, [contenteditable="true"]'))
  ) {
    return true
  }

  // 1. 焦点位于弹窗、抽屉、提示对话框或图片灯箱内部
  if (
    Boolean(
      active.closest?.(
        '[role="dialog"], [role="alertdialog"], .p-modal, .p-sheet, .p-lightbox, .p-image-lightbox'
      )
    )
  ) {
    return true
  }

  // 2. 焦点位于全局搜索浮层、下拉浮层、通知气泡
  if (
    Boolean(
      active.closest?.(
        '.app-topbar-global-search, .notification-popover, [data-dropdown], [role="menu"]'
      )
    )
  ) {
    return true
  }

  // 3. 页面全局存在打开状态的模态背景或具有 aria-modal="true" 的弹层
  if (typeof document !== 'undefined') {
    const activeOverlay = document.querySelector(
      '.p-modal[aria-modal="true"], .p-sheet[aria-modal="true"], .p-modal-backdrop, .p-sheet-backdrop, [role="dialog"][aria-modal="true"], .p-image-lightbox'
    )
    if (activeOverlay) {
      const isInsidePlayer = Boolean(
        active.closest?.('.player, .audio-player, .player-mini, .music-lyrics-panel')
      )
      if (!isInsidePlayer) {
        return true
      }
    }
  }

  return false
}

