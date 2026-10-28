# 全站外链与站外跳转安全标准化治理设计规范

## 1. 目标与背景

在 Atoman 社区讨论、专栏文章、用户动态与第三方资源引用中，存在大量指向站外（如 GitHub、第三方博客、音视频源）的外部链接。
此前部分站外链接直接触发浏览器默认导航离开应用，既缺少统一的 `rel="nofollow noopener noreferrer"` 防挂马/钓鱼保障，也缺少安全跳转确认机制，用户容易在无感知的情况下离开本站。

本规范的目标是：
1. 建立全局响应式状态中心 `useSafeLink.ts`，统一识别、校验外部链接，过滤危险伪协议并提取目标站点域名；
2. 研发极简扁平线框弹窗 `PSafeLinkModal.vue`，在桌面端（`App.vue`）与移动端（`MobileApp.vue`）根层单例挂载；
3. 为站外链接提供“取消”、“复制链接”（深度联动 `useToast`）与“继续访问”三项标准用户动作，既保障安全又不破坏浏览自主权；
4. 严格遵守 0 阴影（`box-shadow: none !important;`）与 4px 标准圆角（`var(--a-radius-card, 4px)`），绝不修改用户特调的桌面端顶栏交互（`AppTopbarAuthControls.vue`）；
5. 建立自动化单测与契约测试，守护全站外链安全。

---

## 2. 状态中心与核心 API 设计

### 2.1 状态中心 `src/composables/useSafeLink.ts`

```ts
import { ref, readonly } from 'vue'
import { safeExternalUrl } from '@/utils/safeExternalUrl'
import { useToast } from '@/composables/useToast'

export interface SafeLinkState {
  isOpen: boolean
  targetUrl: string
  targetHostname: string
}

const state = ref<SafeLinkState>({
  isOpen: false,
  targetUrl: '',
  targetHostname: '',
})

export function useSafeLink() {
  const toast = useToast()

  function isExternalLink(url: string): boolean {
    if (!url) return false
    const trimmed = url.trim()
    if (trimmed.startsWith('/') || trimmed.startsWith('#') || trimmed.startsWith('./') || trimmed.startsWith('../')) {
      return false
    }
    if (typeof window === 'undefined') return false
    try {
      const parsed = new URL(trimmed, window.location.origin)
      return parsed.origin !== window.location.origin && (parsed.protocol === 'http:' || parsed.protocol === 'https:')
    } catch {
      return false
    }
  }

  function openSafeLink(url: string): boolean {
    const safeUrl = safeExternalUrl(url)
    if (!safeUrl || !isExternalLink(safeUrl)) {
      return false
    }
    try {
      const parsed = new URL(safeUrl)
      state.value = {
        isOpen: true,
        targetUrl: safeUrl,
        targetHostname: parsed.hostname,
      }
      return true
    } catch {
      return false
    }
  }

  function closeSafeLink(): void {
    state.value.isOpen = false
  }

  function proceedToSafeLink(): void {
    if (!state.value.targetUrl) return
    if (typeof window !== 'undefined') {
      window.open(state.value.targetUrl, '_blank', 'noopener,noreferrer')
    }
    closeSafeLink()
  }

  async function copySafeLink(): Promise<void> {
    if (!state.value.targetUrl) return
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(state.value.targetUrl)
        toast.success('链接已复制')
      }
    } catch {
      toast.error('复制失败，请手动复制')
    }
  }

  function handleSafeLinkClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null
    const anchor = target?.closest('a')
    if (!anchor) return
    const href = anchor.getAttribute('href')
    if (href && isExternalLink(href)) {
      event.preventDefault()
      openSafeLink(href)
    }
  }

  return {
    safeLinkState: readonly(state),
    isExternalLink,
    openSafeLink,
    closeSafeLink,
    proceedToSafeLink,
    copySafeLink,
    handleSafeLinkClick,
  }
}
```

---

## 3. 弹窗组件设计 `src/components/ui/PSafeLinkModal.vue`

- **挂载方式**：`<Teleport to="body">` 根层挂载，配备中性半透明蒙层；
- **视觉风格**：
  - 纯平白底（`var(--a-color-bg)`）；
  - 标准线框（`border: 1px solid var(--a-color-border)`）；
  - 4px 标准圆角（`border-radius: var(--a-radius-card, 4px)`）；
  - 显式声明 `box-shadow: none !important;`；
- **内容结构**：
  - 顶部标题栏：标题“访问外部站点”与关闭图标按钮；
  - 说明文案：“你即将离开 Atoman 前往外部站点，请注意个人信息与财产安全。”；
  - 目标详情卡：中性底色区域，第一行大字突出主机名（如 `github.com`），第二行紧凑展示完整 URL；
  - 底部动作栏：
    - 【取消】按钮（次级弱化线框）；
    - 【复制链接】按钮（次级中性操作，点击触发 Toast 提示）；
    - 【继续前往】按钮（主色调填充，安全唤起目标窗口）。

---

## 4. 全站集成与挂载

1. **双端根应用**：
   - 桌面端：在 `src/App.vue` 挂载 `<PSafeLinkModal />`；
   - 移动端：在 `apps/mobile/MobileApp.vue` 挂载 `<PSafeLinkModal />`；
2. **Markdown 与富文本渲染**：
   - 在 `useMarkdownRenderer.ts` 与 `useCommentMarkdown.ts` 中确保所有外链输出 `target="_blank"` 与 `rel="nofollow noopener noreferrer"`；
   - 在富文本阅读容器（如 `FeedReaderContent.vue` 等）通过 `handleSafeLinkClick` 进行容器级事件委托；
3. **基础组件协同**：
   - 在 `PLink.vue` 中，当 `isExternal` 为 `true` 时，点击事件委托给 `openSafeLink` 拦截确认。

---

## 5. 自动化质量守护与测试设计

1. **`tests/unit/composables/useSafeLink.spec.ts`**：
   - 单元测试外部链接判定（相对路径、锚点、同源、外部域名）；
   - 测试非法协议过滤（javascript: 等）；
   - 测试打开、关闭、前往及复制链接联动 Toast 反馈。
2. **`tests/unit/components/PSafeLinkModal.spec.ts`**：
   - 单元测试弹窗打开与关闭、域名呈现、键盘 Esc 响应、按钮点击行为；
   - 断言 0 阴影与 4px 样式合规。
3. **`tests/unit/ui/safe-link-contract.spec.ts`**：
   - 静态契约测试断言双端根应用（`App.vue`、`MobileApp.vue`）均已挂载 `PSafeLinkModal`；
   - 静态扫描 Markdown 渲染器确保外链输出合规。
4. **全站质量回归**：
   - `bun run type-check` (0 Errors)
   - `bun run test:unit` (100% Pass)
   - `bun run build && bun run build:mobile` (0 Errors)
