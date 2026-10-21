# 移动端 Web 曲库抽屉手势返回与 Mini 播放器吸底常驻实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为移动端 Web 抽屉增加原生感手势退场（左边缘右推返回 + 顶部下拉返回），实现 Mini 播放器在各级页面的全局自适应吸底常驻与切歌/展开手势，并彻底净化 0 阴影设计规范。

**Architecture:** 
1. 提取可复用无依赖的 `useSheetGesture` 组合式函数，管理触控判定、阻尼像素跟随、阈值退出飞出动效与弹回复位。
2. 在 `PSheet.vue` 移动端模板中接入 `useSheetGesture`，并清除所有残留的 `box-shadow`。
3. 在 `MobileApp.vue` 将 Mini 播放器与底部导航解耦，实现多级页面自适应吸底；并在 `MobileAudioPlayer.vue` 中绑定向上滑动展开大播放器与左右滑动手势切歌。

**Tech Stack:** Vue 3.4, TypeScript 5.8 (strict), Pinia 2, Vue Router 4, Vitest, Happy-DOM.

## Global Constraints

- **严格 0 阴影**：全局遵循 `box-shadow: none !important;`，交互元素与卡片统一遵循 `border-radius: var(--a-radius-control, 4px);`。
- **纯白纸张基底与微边框**：面板遵循 `#FFFFFF` 纸张底色与 `1px solid var(--a-color-border-soft)` 发丝线分割。
- **手势防误触与无冲突**：内嵌长列表垂直滚动不被下拉拦截；交互按钮点击不受滑动拦截；横向标签滚动不受边缘右推拦截。
- **类型安全与全量单测**：`bun run type-check` 0 错误；所有修改的文件均有 100% 对应的单元测试通过。

---

### Task 1: 抽屉触控手势逻辑 `src/composables/useSheetGesture.ts` 与独立单测

**Files:**
- Create: `src/composables/useSheetGesture.ts`
- Test: `tests/unit/composables/useSheetGesture.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface UseSheetGestureOptions {
    targetRef: Ref<HTMLElement | null>
    headerRef?: Ref<HTMLElement | null>
    contentRef?: Ref<HTMLElement | null>
    onDismiss: () => void
    enabled?: MaybeRefOrGetter<boolean>
    edgeThreshold?: number
    dismissThresholdX?: number
    dismissThresholdY?: number
  }

  export interface UseSheetGestureReturn {
    dragStyle: ComputedRef<CSSProperties>
    isDragging: Ref<boolean>
    gestureDirection: Ref<'none' | 'horizontal' | 'vertical'>
  }

  export function useSheetGesture(options: UseSheetGestureOptions): UseSheetGestureReturn
  ```

- [ ] **Step 1: Write the failing unit tests**

创建 `tests/unit/composables/useSheetGesture.spec.ts`：

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { useSheetGesture } from '@/composables/useSheetGesture'

describe('useSheetGesture', () => {
  let targetEl: HTMLElement
  let headerEl: HTMLElement
  let contentEl: HTMLElement
  const onDismiss = vi.fn()

  beforeEach(() => {
    onDismiss.mockReset()
    targetEl = document.createElement('div')
    headerEl = document.createElement('header')
    contentEl = document.createElement('div')
    targetEl.appendChild(headerEl)
    targetEl.appendChild(contentEl)
    document.body.appendChild(targetEl)
  })

  function createTouchEvent(type: string, touches: Array<{ clientX: number; clientY: number; target?: EventTarget }>) {
    const touchList = touches.map(t => ({
      clientX: t.clientX,
      clientY: t.clientY,
      target: t.target || targetEl,
      identifier: 0,
      pageX: t.clientX,
      pageY: t.clientY,
      screenX: t.clientX,
      screenY: t.clientY,
      radiusX: 1,
      radiusY: 1,
      rotationAngle: 0,
      force: 1,
    }))
    return new TouchEvent(type, {
      bubbles: true,
      cancelable: true,
      touches: type === 'touchend' ? [] : (touchList as any),
      targetTouches: type === 'touchend' ? [] : (touchList as any),
      changedTouches: touchList as any,
    })
  }

  it('triggers onDismiss when edge-swiped from the left edge beyond dismissThresholdX', async () => {
    const targetRef = ref(targetEl)
    const headerRef = ref(headerEl)
    const contentRef = ref(contentEl)

    const { dragStyle, isDragging, gestureDirection } = useSheetGesture({
      targetRef,
      headerRef,
      contentRef,
      onDismiss,
      enabled: true,
      edgeThreshold: 36,
      dismissThresholdX: 60,
    })

    // Start at left edge (clientX: 20 <= 36)
    targetEl.dispatchEvent(createTouchEvent('touchstart', [{ clientX: 20, clientY: 150 }]))
    expect(isDragging.value).toBe(true)

    // Move right by 80px (clientX: 100, deltaX: 80)
    targetEl.dispatchEvent(createTouchEvent('touchmove', [{ clientX: 100, clientY: 155 }]))
    expect(gestureDirection.value).toBe('horizontal')
    expect(dragStyle.value.transform).toContain('translate3d')

    // End touch
    targetEl.dispatchEvent(createTouchEvent('touchend', [{ clientX: 100, clientY: 155 }]))
    expect(isDragging.value).toBe(false)
    // Wait for transition timer
    await new Promise(r => setTimeout(r, 260))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('does NOT trigger horizontal dismiss when touch starts outside edge threshold', async () => {
    const targetRef = ref(targetEl)
    const headerRef = ref(headerEl)
    const contentRef = ref(contentEl)

    const { isDragging, gestureDirection } = useSheetGesture({
      targetRef,
      headerRef,
      contentRef,
      onDismiss,
      enabled: true,
      edgeThreshold: 36,
      dismissThresholdX: 60,
    })

    // Start in the center of the screen (clientX: 150 > 36)
    targetEl.dispatchEvent(createTouchEvent('touchstart', [{ clientX: 150, clientY: 150 }]))
    targetEl.dispatchEvent(createTouchEvent('touchmove', [{ clientX: 250, clientY: 150 }]))

    expect(gestureDirection.value).toBe('none')

    targetEl.dispatchEvent(createTouchEvent('touchend', [{ clientX: 250, clientY: 150 }]))
    await new Promise(r => setTimeout(r, 260))
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('triggers onDismiss when pulled down from the header beyond dismissThresholdY', async () => {
    const targetRef = ref(targetEl)
    const headerRef = ref(headerEl)
    const contentRef = ref(contentEl)

    const { gestureDirection } = useSheetGesture({
      targetRef,
      headerRef,
      contentRef,
      onDismiss,
      enabled: true,
      dismissThresholdY: 70,
    })

    // Touch started inside header
    headerEl.dispatchEvent(createTouchEvent('touchstart', [{ clientX: 150, clientY: 20, target: headerEl }]))
    headerEl.dispatchEvent(createTouchEvent('touchmove', [{ clientX: 150, clientY: 110, target: headerEl }]))

    expect(gestureDirection.value).toBe('vertical')

    headerEl.dispatchEvent(createTouchEvent('touchend', [{ clientX: 150, clientY: 110, target: headerEl }]))
    await new Promise(r => setTimeout(r, 260))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('does NOT trigger vertical dismiss if content scrollTop > 0', async () => {
    const targetRef = ref(targetEl)
    const headerRef = ref(headerEl)
    const contentRef = ref(contentEl)

    // Simulate scrolled content
    Object.defineProperty(contentEl, 'scrollTop', { value: 150, writable: true })

    const { gestureDirection } = useSheetGesture({
      targetRef,
      headerRef,
      contentRef,
      onDismiss,
      enabled: true,
      dismissThresholdY: 70,
    })

    // Touch started in content area when scrolled down
    contentEl.dispatchEvent(createTouchEvent('touchstart', [{ clientX: 150, clientY: 200, target: contentEl }]))
    contentEl.dispatchEvent(createTouchEvent('touchmove', [{ clientX: 150, clientY: 300, target: contentEl }]))

    expect(gestureDirection.value).toBe('none')

    contentEl.dispatchEvent(createTouchEvent('touchend', [{ clientX: 150, clientY: 300, target: contentEl }]))
    await new Promise(r => setTimeout(r, 260))
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('snaps back when touch movement does not reach the dismiss threshold', async () => {
    const targetRef = ref(targetEl)
    const headerRef = ref(headerEl)
    const contentRef = ref(contentEl)

    const { dragStyle } = useSheetGesture({
      targetRef,
      headerRef,
      contentRef,
      onDismiss,
      enabled: true,
      edgeThreshold: 36,
      dismissThresholdX: 60,
    })

    targetEl.dispatchEvent(createTouchEvent('touchstart', [{ clientX: 20, clientY: 150 }]))
    // Only moved 20px (< 60px)
    targetEl.dispatchEvent(createTouchEvent('touchmove', [{ clientX: 40, clientY: 150 }]))
    targetEl.dispatchEvent(createTouchEvent('touchend', [{ clientX: 40, clientY: 150 }]))

    await new Promise(r => setTimeout(r, 260))
    expect(onDismiss).not.toHaveBeenCalled()
    expect(dragStyle.value.transform).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd Atoman-Frontend
bun run test:unit tests/unit/composables/useSheetGesture.spec.ts
```
Expected: FAIL (Cannot find module `@/composables/useSheetGesture`)

- [ ] **Step 3: Implement `src/composables/useSheetGesture.ts`**

```ts
import { computed, onBeforeUnmount, onMounted, ref, toValue, type CSSProperties, type MaybeRefOrGetter, type Ref } from 'vue'

export interface UseSheetGestureOptions {
  targetRef: Ref<HTMLElement | null>
  headerRef?: Ref<HTMLElement | null>
  contentRef?: Ref<HTMLElement | null>
  onDismiss: () => void
  enabled?: MaybeRefOrGetter<boolean>
  edgeThreshold?: number
  dismissThresholdX?: number
  dismissThresholdY?: number
}

export interface UseSheetGestureReturn {
  dragStyle: ComputedRef<CSSProperties>
  isDragging: Ref<boolean>
  gestureDirection: Ref<'none' | 'horizontal' | 'vertical'>
}

export function useSheetGesture(options: UseSheetGestureOptions): UseSheetGestureReturn {
  const {
    targetRef,
    headerRef,
    contentRef,
    onDismiss,
    enabled = true,
    edgeThreshold = 36,
    dismissThresholdX = 60,
    dismissThresholdY = 70,
  } = options

  const isDragging = ref(false)
  const isDismissing = ref(false)
  const gestureDirection = ref<'none' | 'horizontal' | 'vertical'>('none')
  const offsetX = ref(0)
  const offsetY = ref(0)

  let startX = 0
  let startY = 0
  let isTracking = false
  let canPullDown = false
  let canSwipeRight = false

  function isInteractiveElement(target: EventTarget | null): boolean {
    if (!target || !(target instanceof HTMLElement)) return false
    return Boolean(
      target.closest(
        'button, a, input, select, textarea, [data-interactive], .p-segmented-control, .p-sheet-mobile-page__back'
      )
    )
  }

  function handleTouchStart(e: TouchEvent) {
    if (!toValue(enabled) || isDismissing.value) return
    const touch = e.touches[0]
    if (!touch) return

    if (isInteractiveElement(touch.target)) return

    startX = touch.clientX
    startY = touch.clientY
    offsetX.value = 0
    offsetY.value = 0
    gestureDirection.value = 'none'

    canSwipeRight = startX <= edgeThreshold

    const targetEl = touch.target as HTMLElement
    const inHeader = headerRef?.value ? headerRef.value.contains(targetEl) : false
    const contentScrollTop = contentRef?.value ? contentRef.value.scrollTop : 0
    canPullDown = inHeader || contentScrollTop <= 0

    if (canSwipeRight || canPullDown) {
      isTracking = true
      isDragging.value = true
    }
  }

  function handleTouchMove(e: TouchEvent) {
    if (!isTracking || !toValue(enabled)) return
    const touch = e.touches[0]
    if (!touch) return

    const deltaX = touch.clientX - startX
    const deltaY = touch.clientY - startY
    const absX = Math.abs(deltaX)
    const absY = Math.abs(deltaY)

    if (gestureDirection.value === 'none') {
      if (canSwipeRight && deltaX > 8 && absX > 1.2 * absY) {
        gestureDirection.value = 'horizontal'
      } else if (canPullDown && deltaY > 8 && absY > 1.2 * absX) {
        // Double check content scrollTop hasn't changed
        const currentScrollTop = contentRef?.value ? contentRef.value.scrollTop : 0
        if (currentScrollTop <= 0) {
          gestureDirection.value = 'vertical'
        } else {
          isTracking = false
          isDragging.value = false
          return
        }
      } else if (absX > 10 || absY > 10) {
        isTracking = false
        isDragging.value = false
        return
      }
    }

    if (gestureDirection.value === 'horizontal') {
      if (deltaX > 0) {
        if (e.cancelable) e.preventDefault()
        offsetX.value = deltaX <= dismissThresholdX
          ? deltaX
          : dismissThresholdX + (deltaX - dismissThresholdX) * 0.35
      } else {
        offsetX.value = 0
      }
    } else if (gestureDirection.value === 'vertical') {
      if (deltaY > 0) {
        if (e.cancelable) e.preventDefault()
        offsetY.value = deltaY <= dismissThresholdY
          ? deltaY
          : dismissThresholdY + (deltaY - dismissThresholdY) * 0.35
      } else {
        offsetY.value = 0
      }
    }
  }

  function handleTouchEnd() {
    if (!isTracking) return
    isTracking = false
    isDragging.value = false

    const direction = gestureDirection.value
    if (direction === 'horizontal' && offsetX.value >= dismissThresholdX) {
      isDismissing.value = true
      offsetX.value = window.innerWidth || 400
      setTimeout(() => {
        onDismiss()
        isDismissing.value = false
        offsetX.value = 0
        offsetY.value = 0
        gestureDirection.value = 'none'
      }, 220)
    } else if (direction === 'vertical' && offsetY.value >= dismissThresholdY) {
      isDismissing.value = true
      offsetY.value = window.innerHeight || 800
      setTimeout(() => {
        onDismiss()
        isDismissing.value = false
        offsetX.value = 0
        offsetY.value = 0
        gestureDirection.value = 'none'
      }, 220)
    } else {
      offsetX.value = 0
      offsetY.value = 0
      gestureDirection.value = 'none'
    }
  }

  const dragStyle = computed<CSSProperties>(() => {
    if (!isDragging.value && !isDismissing.value && offsetX.value === 0 && offsetY.value === 0) {
      return {}
    }

    const transform = `translate3d(${offsetX.value}px, ${offsetY.value}px, 0)`
    const transition = isDragging.value
      ? 'none'
      : 'transform 0.22s cubic-bezier(0.25, 1, 0.5, 1)'

    return {
      transform,
      transition,
      touchAction: gestureDirection.value !== 'none' ? 'none' : undefined,
    }
  })

  function attachListeners(el: HTMLElement | null) {
    if (!el) return
    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    el.addEventListener('touchend', handleTouchEnd, { passive: true })
    el.addEventListener('touchcancel', handleTouchEnd, { passive: true })
  }

  function detachListeners(el: HTMLElement | null) {
    if (!el) return
    el.removeEventListener('touchstart', handleTouchStart)
    el.removeEventListener('touchmove', handleTouchMove)
    el.removeEventListener('touchend', handleTouchEnd)
    el.removeEventListener('touchcancel', handleTouchEnd)
  }

  onMounted(() => {
    attachListeners(targetRef.value)
  })

  onBeforeUnmount(() => {
    detachListeners(targetRef.value)
  })

  return {
    dragStyle,
    isDragging,
    gestureDirection,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd Atoman-Frontend
bun run test:unit tests/unit/composables/useSheetGesture.spec.ts
```
Expected: PASS (5/5 tests passing)

- [ ] **Step 5: Commit**

```bash
cd Atoman-Frontend
git add src/composables/useSheetGesture.ts tests/unit/composables/useSheetGesture.spec.ts
git commit -m "feat(mobile): create useSheetGesture composable for edge-swipe and pull-down dismiss"
```

---

### Task 2: `PSheet.vue` 接入手势并彻底净化 0 阴影规范

**Files:**
- Modify: `src/components/ui/PSheet.vue`
- Test: `tests/unit/components/ui/PSheet.spec.ts`

**Interfaces:**
- Consumes: `useSheetGesture` from `@/composables/useSheetGesture`
- Produces: Natural edge-swipe and header-pulldown dismiss for all mobile sheets, 0-shadow styling.

- [ ] **Step 1: Check existing `PSheet.spec.ts`**

```bash
cd Atoman-Frontend
bun run test:unit tests/unit/components/ui/PSheet.spec.ts
```
Ensure baseline tests pass before modifications.

- [ ] **Step 2: Modify `src/components/ui/PSheet.vue`**

1. 引入并绑定 `useSheetGesture`：
   - 为移动端根 DOM 增加 `ref="mobilePanelRef"`，头部增加 `ref="mobileHeaderRef"`，内容区增加 `ref="mobileContentRef"`。
   - 绑定 `:style="[mobileSheetStyle, dragStyle]"`。
   - 当 `useSheetGesture` 触发 `onDismiss` 时，执行 `$emit('close')`。
2. 消除残留的 `box-shadow`：
   - 将 `.p-sheet-mobile-page` 样式中的 `box-shadow: -8px 0 18px -16px rgba(0, 0, 0, 0.35);` 替换为 `box-shadow: none !important;`。
   - 将 `.p-sheet-mobile-page.is-left` 样式中的 `box-shadow: 8px 0 18px -16px rgba(0, 0, 0, 0.35);` 替换为 `box-shadow: none !important;`。
   - 将 `.p-sheet-layer.is-right` 样式中的 `box-shadow: -8px 0 18px -16px rgba(0, 0, 0, 0.35);` 替换为 `box-shadow: none !important;`。
   - 将 `.p-sheet-layer.is-left` 样式中的 `box-shadow` 替换为 `box-shadow: none !important;`。

- [ ] **Step 3: Add mobile gesture integration test in `tests/unit/components/ui/PSheet.spec.ts`**

增加测试验证在移动端模式下调用 `close` 回调：
```ts
it('emits close event when mobile sheet gesture dismisses', async () => {
  // Mount with mobile simulation and check close emit on gesture
})
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd Atoman-Frontend
bun run test:unit tests/unit/components/ui/PSheet.spec.ts tests/unit/components/music/AlbumDrawer.spec.ts tests/unit/components/music/ArtistDrawer.spec.ts tests/unit/components/music/PlaylistDrawer.spec.ts
```
Expected: PASS with 0 errors and 0 warnings.

- [ ] **Step 5: Commit**

```bash
cd Atoman-Frontend
git add src/components/ui/PSheet.vue tests/unit/components/ui/PSheet.spec.ts
git commit -m "feat(sheet): integrate touch gestures in mobile PSheet and eliminate remaining box-shadow rules"
```

---

### Task 3: `MobileApp.vue` & `MobileAudioPlayer.vue` 全局常驻吸底与触摸切歌/展开手势

**Files:**
- Modify: `apps/mobile/MobileApp.vue`
- Modify: `apps/mobile/MobileAudioPlayer.vue`
- Test: `tests/unit/mobile/music-views.spec.ts`
- Test: `tests/unit/mobile/navigation-shell.spec.ts`

**Interfaces:**
- Produces: Persistent Mini Player on all mobile subroutes, swipe gestures on track card (up to expand, left/right to skip).

- [ ] **Step 1: Write the failing tests in `tests/unit/mobile/music-views.spec.ts` and `navigation-shell.spec.ts`**

In `tests/unit/mobile/navigation-shell.spec.ts`:
- 验证当用户进入无底部导航的路由（如 `/music/album/1` 或 `/books/work/1`）且当前有曲目播放时，`MobileAudioPlayer` 依然渲染挂载。
- 验证 `--mobile-app-player-bottom` CSS 变量在无 BottomNav 时为 `env(safe-area-inset-bottom, 0px)`。

In `tests/unit/mobile/music-views.spec.ts`:
- 验证在 `MobileAudioPlayer.vue` 上向上滑动触发路由跳转至 `/music/player`。
- 验证在 `MobileAudioPlayer.vue` 上向左滑动触发 `player.playNext()`。
- 验证在 `MobileAudioPlayer.vue` 上向右滑动触发 `player.playPrevious()`。

- [ ] **Step 2: Run test to verify it fails**

```bash
cd Atoman-Frontend
bun run test:unit tests/unit/mobile/music-views.spec.ts tests/unit/mobile/navigation-shell.spec.ts
```
Expected: FAIL

- [ ] **Step 3: Update `apps/mobile/MobileApp.vue`**

1. 解耦 `showMobilePlayer`：
   ```ts
   const showMobilePlayer = computed(() => (
     playerPresence.hasCurrentTrack && route.path !== '/music/player'
   ))
   ```
2. 动态注入 `--mobile-app-player-bottom` CSS 变量：
   ```ts
   const mobilePlayerBottom = computed(() => (
     showMobileBottomNav.value
       ? 'calc(56px + env(safe-area-inset-bottom, 0px))'
       : 'env(safe-area-inset-bottom, 0px)'
   ))
   ```
   绑定在外层容器 style 上：`:style="{ '--mobile-app-player-bottom': mobilePlayerBottom }"`。
3. 调整主内容区底部留白：确保当 `showMobilePlayer` 为 true 时，即使 `showMobileBottomNav` 为 false，`.mobile-app-main` 仍具有对应的 `padding-bottom: calc(var(--mobile-app-player-height, 64px) + env(safe-area-inset-bottom, 0px))`，防止内容被遮挡。

- [ ] **Step 4: Update `apps/mobile/MobileAudioPlayer.vue`**

1. 修改吸底样式：
   ```css
   .mobile-mini-player {
     position: fixed;
     right: 0;
     bottom: var(--mobile-app-player-bottom, calc(56px + env(safe-area-inset-bottom, 0px)));
     left: 0;
     z-index: var(--a-z-player, 90);
     transition: bottom 0.2s ease;
     ...
   }
   ```
2. 在 `.mobile-mini-player__track` 上绑定触摸手势：
   - 监听 `touchstart`, `touchmove`, `touchend`。
   - `deltaY < -40px && Math.abs(deltaY) > 1.2 * Math.abs(deltaX)` -> 触发 `openPlayer()`。
   - `deltaX < -50px && Math.abs(deltaX) > 1.2 * Math.abs(deltaY)` -> 触发 `player.playNext()`。
   - `deltaX > 50px && Math.abs(deltaX) > 1.2 * Math.abs(deltaY)` -> 触发 `player.playPrevious()`。

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd Atoman-Frontend
bun run test:unit tests/unit/mobile/music-views.spec.ts tests/unit/mobile/navigation-shell.spec.ts
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd Atoman-Frontend
git add apps/mobile/MobileApp.vue apps/mobile/MobileAudioPlayer.vue tests/unit/mobile/music-views.spec.ts tests/unit/mobile/navigation-shell.spec.ts
git commit -m "feat(mobile): persist mini player across detail routes and add swipe gestures for track switching"
```

---

### Task 4: 全量回归、类型检查与构建验证

**Files:**
- Verification only

- [ ] **Step 1: Run all mobile and music unit tests**

```bash
cd Atoman-Frontend
bun run test:unit tests/unit/mobile/ tests/unit/composables/useSheetGesture.spec.ts tests/unit/components/music/ tests/unit/entities/music/
```
Expected: 100% test files pass.

- [ ] **Step 2: Run strict TypeScript type-check**

```bash
cd Atoman-Frontend
bun run type-check
```
Expected: Exit code 0, 0 errors.

- [ ] **Step 3: Run production build**

```bash
cd Atoman-Frontend
bun run build
```
Expected: Exit code 0, build succeeds.

- [ ] **Step 4: Commit verification chore**

```bash
cd Atoman-Frontend
git commit --allow-empty -m "chore(mobile): complete verification for mobile sheet gestures and persistent player docking"
```
