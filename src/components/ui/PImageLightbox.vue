<template>
  <Teleport to="body">
    <Transition name="lightbox-fade" appear>
      <div
        v-if="show && images.length"
        class="p-lightbox-backdrop"
        role="dialog"
        aria-label="图片预览"
        aria-modal="true"
        ref="lightboxRef"
        tabindex="-1"
        @click.self="close"
        @keydown="handleKeydown"
      >
        <div class="p-lightbox-header">
          <span v-if="images.length > 1" class="p-lightbox-counter">
            {{ currentIndex + 1 }} / {{ images.length }}
          </span>
          <button
            type="button"
            class="p-lightbox-close"
            aria-label="关闭预览"
            title="关闭预览"
            @click="close"
          >
            <X :size="22" />
          </button>
        </div>

        <button
          v-if="images.length > 1 && currentIndex > 0"
          type="button"
          class="p-lightbox-nav is-prev"
          aria-label="上一张图片"
          title="上一张"
          @click.stop="prev"
        >
          <ChevronLeft :size="28" />
        </button>

        <div class="p-lightbox-stage" @click.self="close">
          <Transition name="lightbox-zoom" mode="out-in">
            <img
              :key="currentImageUrl"
              :src="currentImageUrl"
              alt="预览大图"
              class="p-lightbox-image"
            />
          </Transition>
        </div>

        <button
          v-if="images.length > 1 && currentIndex < images.length - 1"
          type="button"
          class="p-lightbox-nav is-next"
          aria-label="下一张图片"
          title="下一张"
          @click.stop="next"
        >
          <ChevronRight :size="28" />
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { IconChevronLeft as ChevronLeft, IconChevronRight as ChevronRight, IconX as X } from '@tabler/icons-vue'
import { useDialogFocus } from '@/composables/useDialogFocus'

const props = withDefaults(defineProps<{
  show: boolean
  images: string[]
  index?: number
}>(), {
  index: 0,
})

const emit = defineEmits<{
  'update:show': [value: boolean]
  close: []
  change: [index: number]
}>()

const currentIndex = ref(props.index)
const lightboxRef = ref<HTMLElement | null>(null)

watch(() => props.index, (val) => {
  currentIndex.value = Math.max(0, Math.min(val, props.images.length - 1))
})

watch(() => props.show, (val) => {
  if (val) {
    currentIndex.value = Math.max(0, Math.min(props.index, props.images.length - 1))
  }
})

const currentImageUrl = computed(() => props.images[currentIndex.value] || '')
const visible = computed(() => props.show && props.images.length > 0)

function close() {
  emit('update:show', false)
  emit('close')
}

const { handleKeydown: handleDialogKeydown } = useDialogFocus(visible, lightboxRef, close)

function prev() {
  if (currentIndex.value > 0) {
    currentIndex.value -= 1
    emit('change', currentIndex.value)
  }
}

function next() {
  if (currentIndex.value < props.images.length - 1) {
    currentIndex.value += 1
    emit('change', currentIndex.value)
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft') {
    e.preventDefault()
    prev()
    return
  }
  if (e.key === 'ArrowRight') {
    e.preventDefault()
    next()
    return
  }
  handleDialogKeydown(e)
}
</script>

<style scoped>
.p-lightbox-backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--a-z-lightbox);
  background: rgba(15, 23, 42, 0.92);
  display: flex;
  align-items: center;
  justify-content: center;
  outline: none;
  user-select: none;
}

.p-lightbox-header {
  position: absolute;
  top: 1rem;
  left: 1.5rem;
  right: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 10;
}

.p-lightbox-counter {
  color: rgba(255, 255, 255, 0.85);
  font-size: 0.875rem;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  background: rgba(255, 255, 255, 0.12);
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
}

.p-lightbox-close {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  border: none;
  color: #ffffff;
  cursor: pointer;
  transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease, opacity 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
}

.p-lightbox-close:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: scale(1.05);
}

.p-lightbox-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  border: none;
  color: #ffffff;
  cursor: pointer;
  z-index: 10;
  transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease, opacity 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
}

.p-lightbox-nav.is-prev {
  left: 1.5rem;
}

.p-lightbox-nav.is-next {
  right: 1.5rem;
}

.p-lightbox-nav:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-50%) scale(1.08);
}

.p-lightbox-stage {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
}

.p-lightbox-image {
  max-width: 90vw;
  max-height: 85vh;
  object-fit: contain;
  border-radius: var(--a-radius-control, 0.5rem);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

.lightbox-fade-enter-active {
  transition: opacity 180ms ease;
}

.lightbox-fade-leave-active {
  transition: opacity 160ms ease;
}

.lightbox-fade-enter-from,
.lightbox-fade-leave-to {
  opacity: 0;
}

.lightbox-zoom-enter-active {
  transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease;
}

.lightbox-zoom-leave-active {
  transition: transform 160ms cubic-bezier(0.4, 0, 1, 1), opacity 160ms ease;
}

.lightbox-zoom-enter-from {
  opacity: 0;
  transform: scale(0.98);
}

.lightbox-zoom-leave-to {
  opacity: 0;
  transform: scale(0.98);
}

@media (prefers-reduced-motion: reduce) {
  .lightbox-fade-enter-active,
  .lightbox-fade-leave-active,
  .lightbox-zoom-enter-active,
  .lightbox-zoom-leave-active {
    transition-duration: 100ms;
  }

  .lightbox-zoom-enter-from,
  .lightbox-zoom-leave-to {
    transform: none;
  }
}

@media (max-width: 640px) {
  .p-lightbox-nav.is-prev {
    left: 0.5rem;
  }
  .p-lightbox-nav.is-next {
    right: 0.5rem;
  }
  .p-lightbox-stage {
    padding: 3rem 0.5rem;
  }
}
</style>
