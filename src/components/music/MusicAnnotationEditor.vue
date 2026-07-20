<template>
  <section v-if="show" class="music-annotation-editor">
    <p v-if="selectedText" class="music-annotation-editor__quote">
      “{{ selectedText }}”
    </p>

    <p v-if="mode === 'rebind'" class="music-annotation-editor__hint">
      在歌词中选择新的片段
    </p>

    <PTextarea
      v-if="mode !== 'rebind'"
      v-model="body"
      label="注释"
      placeholder="写下这句歌词的解释"
      :rows="5"
      class="music-annotation-editor__input"
    />

    <div class="music-annotation-editor__actions">
      <PButton
        type="button"
        variant="secondary"
        data-testid="annotation-cancel"
        aria-label="取消注释操作"
        class="music-annotation-editor__action-btn"
        @click="handleCancel"
      >
        取消
      </PButton>
      <PButton
        v-if="mode === 'rebind'"
        type="button"
        size="lg"
        :disabled="!selectedText"
        data-testid="annotation-confirm-rebind"
        aria-label="确认重新绑定"
        class="music-annotation-editor__action-btn"
        @click="emit('confirm-rebind')"
      >
        确认重新绑定
      </PButton>
      <PButton
        v-else
        type="button"
        :disabled="!body.trim()"
        class="music-annotation-editor__action-btn"
        @click="handleSave"
      >
        保存
      </PButton>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import PButton from '@/components/ui/PButton.vue'
import PTextarea from '@/components/ui/PTextarea.vue'

const props = defineProps<{
  show: boolean
  selectedText?: string
  initialBody?: string
  mode?: 'create' | 'edit' | 'rebind'
}>()

const emit = defineEmits<{
  save: [body: string]
  cancel: []
  'confirm-rebind': []
}>()

const body = ref('')

watch(() => [props.show, props.initialBody, props.mode] as const, ([show, initialBody, mode]) => {
  body.value = show && mode !== 'rebind' ? (initialBody ?? '') : ''
}, { immediate: true })

function handleCancel() {
  body.value = props.initialBody ?? ''
  emit('cancel')
}

function handleSave() {
  const nextBody = body.value.trim()
  if (!nextBody) return
  emit('save', nextBody)
}
</script>

<style scoped>
.music-annotation-editor {
  display: grid;
  gap: 0.9rem;
  padding: 1rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 4px;
  box-shadow: none;
  background: var(--a-color-bg);
}

.music-annotation-editor__quote {
  margin: 0;
  color: var(--a-color-text);
  font-weight: 800;
  line-height: 1.5;
}

.music-annotation-editor__hint {
  margin: 0;
  color: var(--a-color-muted);
  font-size: 0.9rem;
}

.music-annotation-editor__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

:deep(.music-annotation-editor__input),
:deep(.music-annotation-editor__input textarea),
:deep(.music-annotation-editor__input input) {
  border-radius: 4px !important;
  border: 1px solid var(--a-color-border-soft) !important;
  box-shadow: none !important;
}

:deep(.music-annotation-editor__action-btn) {
  border-radius: 4px !important;
  box-shadow: none !important;
}
</style>
