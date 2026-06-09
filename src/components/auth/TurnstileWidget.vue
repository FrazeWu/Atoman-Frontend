<template>
  <div ref="containerRef" class="turnstile-widget" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

type TurnstileOptions = {
  sitekey: string
  callback?: (token: string) => void
  'error-callback'?: () => void
  'expired-callback'?: () => void
  theme?: 'light' | 'dark' | 'auto'
  size?: 'normal' | 'compact' | 'flexible'
  'refresh-expired'?: 'auto' | 'manual' | 'never'
}

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileOptions) => string
  reset: (widgetId: string) => void
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const props = defineProps<{
  siteKey: string
}>()

const emit = defineEmits<{
  verified: [token: string]
  expired: []
  error: []
}>()

const containerRef = ref<HTMLElement | null>(null)
let widgetId: string | null = null

const scriptSrc = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

function loadTurnstileScript() {
  if (window.turnstile) return Promise.resolve()

  return new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-turnstile-script]')
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true })
      existingScript.addEventListener('error', () => reject(new Error('Failed to load Turnstile')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = scriptSrc
    script.async = true
    script.defer = true
    script.dataset.turnstileScript = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Turnstile'))
    document.head.appendChild(script)
  })
}

async function renderWidget() {
  try {
    await loadTurnstileScript()
    if (!containerRef.value || !window.turnstile || widgetId) return

    widgetId = window.turnstile.render(containerRef.value, {
      sitekey: props.siteKey,
      theme: 'auto',
      size: 'flexible',
      'refresh-expired': 'auto',
      callback: (token) => emit('verified', token),
      'expired-callback': () => emit('expired'),
      'error-callback': () => emit('error'),
    })
  } catch {
    emit('error')
  }
}

function reset() {
  if (widgetId && window.turnstile) {
    window.turnstile.reset(widgetId)
  }
}

onMounted(renderWidget)

onBeforeUnmount(() => {
  if (widgetId && window.turnstile) {
    window.turnstile.remove(widgetId)
  }
})

defineExpose({ reset })
</script>

<style scoped>
.turnstile-widget {
  min-height: 65px;
}
</style>
