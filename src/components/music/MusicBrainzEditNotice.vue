<script setup lang="ts">
import { AlertTriangle } from 'lucide-vue-next'
</script>

<template>
  <aside class="musicbrainz-edit-notice" role="note" aria-label="MusicBrainz 匹配提示">
    <AlertTriangle :size="18" stroke-width="2" aria-hidden="true" />
    <div class="musicbrainz-edit-notice__content">
      <strong>已通过 MusicBrainz 匹配</strong>
      <p>这份资料已经经过匹配，请谨慎修改。</p>
    </div>
  </aside>
</template>

<style scoped>
.musicbrainz-edit-notice {
  display: flex;
  align-items: flex-start;
  gap: 0.7rem;
  padding: 0.85rem 1rem;
  border: 1px solid color-mix(in srgb, var(--a-color-warning) 38%, var(--a-color-border-soft));
  border-left: 3px solid var(--a-color-warning);
  border-radius: var(--a-radius-control);
  background: color-mix(in srgb, var(--a-color-warning) 8%, var(--a-color-bg));
  color: var(--a-color-text);
}

.musicbrainz-edit-notice > svg {
  flex: 0 0 auto;
  margin-top: 0.1rem;
  color: var(--a-color-warning);
}

.musicbrainz-edit-notice__content {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}

.musicbrainz-edit-notice strong {
  font-size: 0.875rem;
  font-weight: 700;
}

.musicbrainz-edit-notice p {
  margin: 0;
  color: var(--a-color-text-secondary);
  font-size: 0.8125rem;
  line-height: 1.45;
}
</style>
