<template>
  <PSheet
    :show="show"
    width="560px"
    close-type="header"
    above-player
    @close="emit('close')"
  >
    <template #header>
      <div class="music-lyric-editor-drawer__header">
        <h2>编辑歌词</h2>
      </div>
    </template>

    <div class="music-lyric-editor-drawer__body">
      <PTextarea
        v-model="draftContent"
        label="歌词"
        :rows="10"
        placeholder="输入歌词"
      />

      <PTextarea
        v-model="draftTranslation"
        label="翻译"
        :rows="8"
        placeholder="输入翻译"
      />

      <label class="music-lyric-editor-drawer__field">
        <span class="music-lyric-editor-drawer__field-label">格式</span>
        <select v-model="draftFormat" class="music-lyric-editor-drawer__select">
          <option value="plain">纯文本</option>
          <option value="lrc">LRC</option>
        </select>
      </label>

      <PInput
        v-model="draftEditSummary"
        label="摘要"
        placeholder="写本次修改"
      />

      <div class="music-lyric-editor-drawer__actions">
        <PButton
          type="button"
          variant="secondary"
          @click="emit('close')"
        >
          取消
        </PButton>
        <PButton
          type="button"
          :disabled="!canSave"
          :loading="saving"
          loading-text="保存中..."
          @click="handleSave"
        >
          保存
        </PButton>
      </div>
    </div>
  </PSheet>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { MusicLyricsFormat } from '@/api/musicV1'
import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import PSheet from '@/components/ui/PSheet.vue'
import PTextarea from '@/components/ui/PTextarea.vue'

const props = withDefaults(defineProps<{
  show: boolean
  content?: string
  translation?: string
  format?: MusicLyricsFormat
  saving?: boolean
}>(), {
  content: '',
  translation: '',
  format: 'plain',
  saving: false,
})

const emit = defineEmits<{
  close: []
  save: [payload: {
    content: string
    translation: string
    format: MusicLyricsFormat
    editSummary: string
  }]
}>()

const draftContent = ref('')
const draftTranslation = ref('')
const draftFormat = ref<MusicLyricsFormat>('plain')
const draftEditSummary = ref('')

const canSave = computed(() => draftContent.value.trim() && draftEditSummary.value.trim())

watch(
  () => [props.show, props.content, props.translation, props.format] as const,
  ([show, content, translation, format]) => {
    if (!show) return
    draftContent.value = content ?? ''
    draftTranslation.value = translation ?? ''
    draftFormat.value = format ?? 'plain'
    draftEditSummary.value = ''
  },
  { immediate: true },
)

function handleSave() {
  const content = draftContent.value.trim()
  const editSummary = draftEditSummary.value.trim()
  if (!content || !editSummary) return

  emit('save', {
    content,
    translation: draftTranslation.value.trim(),
    format: draftFormat.value,
    editSummary,
  })
}
</script>

<style scoped>
.music-lyric-editor-drawer__header h2 {
  margin: 0;
  color: var(--a-color-text);
  font-size: 1rem;
  font-weight: 900;
}

.music-lyric-editor-drawer__body {
  display: grid;
  gap: 1rem;
  padding: 1rem;
}

.music-lyric-editor-drawer__field {
  display: grid;
  gap: 0.5rem;
}

.music-lyric-editor-drawer__field-label {
  color: var(--a-color-muted);
  font-family: var(--a-font-sans);
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.05em;
}

.music-lyric-editor-drawer__select {
  width: 100%;
  border: 0;
  border-bottom: 1px solid color-mix(in srgb, var(--a-color-text) 22%, transparent);
  background: transparent;
  color: var(--a-color-text);
  padding: 0 0 0.72rem;
  font: inherit;
}

.music-lyric-editor-drawer__select:focus {
  outline: none;
  border-bottom-color: var(--a-color-accent-confirm);
}

.music-lyric-editor-drawer__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
</style>
