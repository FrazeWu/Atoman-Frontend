<script setup lang="ts">
import { computed } from 'vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'

const { state } = useMusicDrawers()

const creationFlow = computed(() => state.value.creationFlow)
const artistDraft = computed(() => creationFlow.value?.draft.artist ?? null)
</script>

<template>
  <div v-if="artistDraft" class="artist-step" data-testid="artist-step">
    <div class="artist-step-card">
      <p class="step-kicker">Artist</p>
      <h4>创建艺术家</h4>
      <p class="step-copy">按固定顺序先记录艺术家基础信息，再进入首张专辑草稿。</p>

      <div class="field-stack">
        <label class="field-group">
          <span class="field-label">头像</span>
          <input
            data-testid="artist-avatar-input"
            class="field-input field-input--file"
            type="file"
            disabled
          />
        </label>

        <label class="field-group">
          <span class="field-label">名字</span>
          <input
            v-model="artistDraft.name"
            data-testid="artist-name-input"
            class="field-input"
            type="text"
            placeholder="例如 kanye_west"
          />
        </label>

        <label class="field-group">
          <span class="field-label">国家</span>
          <input
            v-model="artistDraft.country"
            data-testid="artist-country-input"
            class="field-input"
            type="text"
            placeholder="United States"
          />
        </label>

        <label class="field-group">
          <span class="field-label">生日</span>
          <input
            v-model="artistDraft.birthday"
            data-testid="artist-birthday-input"
            class="field-input"
            type="date"
          />
        </label>

        <label class="field-group">
          <span class="field-label">简介</span>
          <textarea
            v-model="artistDraft.bio"
            data-testid="artist-bio-input"
            class="field-input field-input--textarea"
            rows="4"
            placeholder="简要描述艺术家背景"
          />
        </label>

        <label class="field-group">
          <span class="field-label">来源</span>
          <textarea
            v-model="artistDraft.source"
            data-testid="artist-source-input"
            class="field-input field-input--textarea"
            rows="3"
            placeholder="记录资料来源"
          />
        </label>
      </div>
    </div>
  </div>
</template>

<style scoped>
.artist-step { display: flex; flex: 1; flex-direction: column; gap: 1rem; }
.artist-step-card {
  display: grid;
  gap: 0.75rem;
  padding: 1.15rem 1.2rem;
  border-radius: 8px;
  background: color-mix(in srgb, var(--a-color-paper-wash) 74%, white);
}
.step-kicker {
  margin: 0;
  color: var(--a-color-ink-soft);
  font-family: var(--a-font-meta);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.artist-step-card h4 { margin: 0; font-family: var(--a-font-serif); font-size: 1.25rem; }
.step-copy { margin: 0; color: var(--a-color-ink-soft); line-height: 1.6; }
.field-stack { display: grid; gap: 0.9rem; }
.field-group { display: grid; gap: 0.4rem; }
.field-label {
  color: var(--a-color-ink-soft);
  font-family: var(--a-font-meta);
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.field-input {
  width: 100%;
  border: 1px solid color-mix(in srgb, var(--a-color-ink) 12%, transparent);
  border-radius: 0px;
  padding: 0.85rem 0.95rem;
  background: rgba(255, 255, 255, 0.92);
  color: var(--a-color-ink);
  font: inherit;
}
.field-input--textarea {
  resize: vertical;
  min-height: 6rem;
}
.field-input--file {
  padding-block: 0.65rem;
  color: var(--a-color-ink-soft);
}
</style>
