<template>
  <div
    ref="rootRef"
    class="feed-reader-content"
    :class="{ 'feed-reader-content--empty': !sanitizedHTML }"
    v-html="sanitizedHTML"
  />
</template>

<script setup lang="ts">
import DOMPurify from 'dompurify'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{
  html: string
}>()

const rootRef = ref<HTMLElement | null>(null)
const cleanups: Array<() => void> = []

const sanitizedHTML = computed(() => DOMPurify.sanitize(props.html || '', {
  USE_PROFILES: { html: true },
  ADD_ATTR: ['target', 'rel', 'loading', 'decoding'],
  FORBID_TAGS: ['style', 'form', 'input', 'button', 'iframe', 'object', 'embed'],
  FORBID_ATTR: ['style'],
}))

const clearEnhancements = () => {
  cleanups.splice(0).forEach((cleanup) => cleanup())
}

const enhanceContent = async () => {
  clearEnhancements()
  await nextTick()
  const root = rootRef.value
  if (!root) return

  root.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((link) => {
    let parsed: URL
    try {
      parsed = new URL(link.href, window.location.href)
    } catch {
      link.removeAttribute('href')
      return
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      link.removeAttribute('href')
      return
    }
    if (parsed.origin !== window.location.origin) {
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
    }
  })

  root.querySelectorAll<HTMLImageElement>('img').forEach((image) => {
    image.setAttribute('loading', 'lazy')
    image.setAttribute('decoding', 'async')
    const width = Number.parseInt(image.getAttribute('width') || '', 10)
    const height = Number.parseInt(image.getAttribute('height') || '', 10)
    if (width > 0 && height > 0) {
      image.classList.add('feed-reader-image--sized')
      image.style.setProperty('--feed-reader-image-width', `${width}px`)
      image.style.setProperty('--feed-reader-image-ratio', `${width} / ${height}`)
    }
    const setWideMedia = () => {
      const mediaWidth = width || image.naturalWidth
      const mediaHeight = height || image.naturalHeight
      if (mediaWidth >= 800 && mediaWidth > mediaHeight) {
        image.classList.add('feed-reader-media--wide')
        image.closest('figure')?.classList.add('feed-reader-media--wide')
      }
    }
    setWideMedia()
    const handleError = () => {
      image.classList.add('feed-reader-image--failed')
      if (image.nextElementSibling?.classList.contains('feed-reader-image-fallback')) return
      const fallback = document.createElement('span')
      fallback.className = 'feed-reader-image-fallback'
      fallback.textContent = image.alt ? `图片无法加载：${image.alt}` : '图片无法加载'
      image.insertAdjacentElement('afterend', fallback)
    }
    image.addEventListener('load', setWideMedia, { once: true })
    image.addEventListener('error', handleError, { once: true })
    cleanups.push(() => image.removeEventListener('load', setWideMedia))
    cleanups.push(() => image.removeEventListener('error', handleError))
  })

  root.querySelectorAll<HTMLPreElement>('pre').forEach((pre) => {
    if (pre.parentElement?.classList.contains('feed-reader-code-block')) return
    const wrapper = document.createElement('div')
    wrapper.className = 'feed-reader-code-block'
    pre.replaceWith(wrapper)
    wrapper.append(pre)
    const copyButton = document.createElement('button')
    copyButton.type = 'button'
    copyButton.className = 'feed-reader-code-copy'
    copyButton.textContent = '复制'
    const copyCode = async () => {
      try {
        await navigator.clipboard.writeText(pre.textContent || '')
        copyButton.textContent = '已复制'
      } catch {
        copyButton.textContent = '复制失败'
      }
      window.setTimeout(() => { copyButton.textContent = '复制' }, 1600)
    }
    copyButton.addEventListener('click', copyCode)
    wrapper.append(copyButton)
    cleanups.push(() => copyButton.removeEventListener('click', copyCode))
  })

  root.querySelectorAll<HTMLTableElement>('table').forEach((table) => {
    if (table.parentElement?.classList.contains('feed-reader-table-wrap')) return
    const wrapper = document.createElement('div')
    wrapper.className = 'feed-reader-table-wrap'
    wrapper.setAttribute('tabindex', '0')
    wrapper.setAttribute('aria-label', '可横向滚动的表格')
    table.replaceWith(wrapper)
    wrapper.append(table)
  })
}

watch(sanitizedHTML, enhanceContent)
onMounted(enhanceContent)
onBeforeUnmount(clearEnhancements)
</script>
