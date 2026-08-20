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
    const handleError = () => {
      image.classList.add('feed-reader-image--failed')
      if (image.nextElementSibling?.classList.contains('feed-reader-image-fallback')) return
      const fallback = document.createElement('span')
      fallback.className = 'feed-reader-image-fallback'
      fallback.textContent = image.alt ? `图片无法加载：${image.alt}` : '图片无法加载'
      image.insertAdjacentElement('afterend', fallback)
    }
    image.addEventListener('error', handleError, { once: true })
    cleanups.push(() => image.removeEventListener('error', handleError))
  })
}

watch(sanitizedHTML, enhanceContent)
onMounted(enhanceContent)
onBeforeUnmount(clearEnhancements)
</script>
