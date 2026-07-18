<template>
  <section v-if="show" class="music-annotation-editor">
    <p v-if="selectedText" class="music-annotation-editor__quote">
      “{{ selectedText }}”
    </p>

    <PTextarea
      v-model="body"
      label="注释"
      placeholder="写下这句歌词的解释"
      :rows="5"
    />

    <div class="music-annotation-editor__actions">
      <PButton
        type="button"
        variant="secondary"
        @click="handleCancel"
      >
        取消
      </PButton>
      <PButton
        type="button"
        :disabled="!body.trim()"
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
}>()

const emit = defineEmits<{
  save: [body: string]
  cancel: []
}>()

const body = ref('')

watch(() => [props.show, props.initialBody] as const, ([show, initialBody]) => {
  body.value = show ? (initialBody ?? '') : ''
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
  background: var(--a-color-bg);
}

.music-annotation-editor__quote {
  margin: 0;
  color: var(--a-color-text);
  font-weight: 800;
  line-height: 1.5;
}

.music-annotation-editor__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
</style>
