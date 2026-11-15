<template>
  <PModal
    :show="show"
    title="检测到版本冲突"
    :above-player="abovePlayer"
    size="lg"
    @close="emit('close')"
  >
    <div class="conflict-modal-body">
      <div class="conflict-modal-banner a-card-sm" role="alert">
        <AlertTriangle :size="20" class="conflict-modal-banner-icon" aria-hidden="true" />
        <div class="conflict-modal-banner-text">
          <strong>云端内容已在其他会话或设备更新</strong>
          <p class="a-muted">直接覆盖将替换远端版本；直接刷新会丢失当前未保存修改。建议先导出本地备份后再做决定。</p>
        </div>
      </div>

      <div class="conflict-diff-layout">
        <!-- 本地版本 -->
        <div class="conflict-diff-card a-card-sm">
          <div class="conflict-diff-header">
            <span class="a-badge a-badge--secondary">本地未保存修改</span>
            <span class="conflict-diff-stats a-muted">{{ localContent.length }} 字符</span>
          </div>
          <div class="conflict-diff-title">
            <strong>{{ localTitle || '未命名标题' }}</strong>
          </div>
          <div class="conflict-diff-preview a-code-scroll">
            <pre>{{ localPreviewText }}</pre>
          </div>
        </div>

        <!-- 远端版本 -->
        <div class="conflict-diff-card a-card-sm">
          <div class="conflict-diff-header">
            <span class="a-badge">云端最新版本</span>
            <span v-if="!loadingRemote" class="conflict-diff-stats a-muted">
              {{ remoteContent.length }} 字符 · {{ formattedUpdatedAt }}
            </span>
            <span v-else class="conflict-diff-stats a-muted">加载远端中…</span>
          </div>
          <div class="conflict-diff-title">
            <strong>{{ remoteTitle || '未命名标题' }}</strong>
          </div>
          <div class="conflict-diff-preview a-code-scroll">
            <div v-if="loadingRemote" class="conflict-loading-placeholder a-muted">
              正在拉取云端内容…
            </div>
            <pre v-else>{{ remotePreviewText }}</pre>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="conflict-modal-footer">
        <div class="conflict-footer-export">
          <PButton
            type="button"
            variant="secondary"
            size="sm"
            @click="handleExportLocal"
          >
            <Download :size="14" aria-hidden="true" />
            <span>导出本地副本 (.md)</span>
          </PButton>
        </div>
        <div class="conflict-footer-actions">
          <PButton
            type="button"
            variant="ghost"
            size="sm"
            @click="emit('close')"
          >
            暂不处理
          </PButton>
          <PButton
            type="button"
            variant="ghost"
            size="sm"
            :disabled="saving || loadingRemote"
            @click="emit('discard')"
          >
            放弃修改并拉取最新
          </PButton>
          <PButton
            type="button"
            variant="primary"
            size="sm"
            :loading="saving"
            :disabled="loadingRemote"
            loading-text="保存中…"
            @click="emit('overwrite')"
          >
            覆盖云端保存
          </PButton>
        </div>
      </div>
    </template>
  </PModal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { AlertTriangle, Download } from 'lucide-vue-next'
import PButton from '@/components/ui/PButton.vue'
import PModal from '@/components/ui/PModal.vue'
import { downloadTextFile } from '@/utils/textDownload'

const props = defineProps<{
  show: boolean
  localTitle: string
  localContent: string
  remoteTitle: string
  remoteContent: string
  remoteUpdatedAt: string
  loadingRemote?: boolean
  saving?: boolean
  abovePlayer?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'overwrite'): void
  (e: 'discard'): void
}>()

const formattedUpdatedAt = computed(() => {
  if (!props.remoteUpdatedAt) return '刚刚'
  try {
    const d = new Date(props.remoteUpdatedAt)
    if (isNaN(d.getTime())) return props.remoteUpdatedAt
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch {
    return props.remoteUpdatedAt
  }
})

const localPreviewText = computed(() => {
  if (!props.localContent) return '（正文为空）'
  return props.localContent.length > 500
    ? props.localContent.slice(0, 500) + '\n\n……（后文省略）'
    : props.localContent
})

const remotePreviewText = computed(() => {
  if (!props.remoteContent) return '（正文为空）'
  return props.remoteContent.length > 500
    ? props.remoteContent.slice(0, 500) + '\n\n……（后文省略）'
    : props.remoteContent
})

const handleExportLocal = () => {
  const title = props.localTitle.trim() || '未命名文章'
  const text = `# ${title}\n\n${props.localContent}`
  const now = new Date()
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  downloadTextFile(`${title}-本地备份-${dateStr}`, text, '.md')
}
</script>

<style scoped>
.conflict-modal-body {
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}

.conflict-modal-banner {
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
  padding: 0.85rem 1rem;
  border-left: 3px solid var(--a-color-warning, #f59e0b);
  background: var(--a-color-surface, #f8fafc);
}

.conflict-modal-banner-icon {
  flex-shrink: 0;
  color: var(--a-color-warning, #f59e0b);
  margin-top: 0.1rem;
}

.conflict-modal-banner-text {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.875rem;
}

.conflict-modal-banner-text strong {
  font-weight: 600;
  color: var(--a-color-fg, #0f172a);
}

.conflict-modal-banner-text p {
  margin: 0;
  font-size: 0.825rem;
  line-height: 1.45;
}

.conflict-diff-layout {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

@media (max-width: 640px) {
  .conflict-diff-layout {
    grid-template-columns: 1fr;
  }
}

.conflict-diff-card {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.9rem;
  background: var(--a-color-bg, #ffffff);
  border: var(--a-border);
  min-height: 220px;
}

.conflict-diff-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.conflict-diff-stats {
  font-size: 0.75rem;
  white-space: nowrap;
}

.conflict-diff-title {
  font-size: 0.92rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conflict-diff-preview {
  flex: 1;
  max-height: 180px;
  overflow-y: auto;
  padding: 0.6rem;
  background: var(--a-color-surface, #f8fafc);
  border: 1px solid var(--a-border-color, #e2e8f0);
  border-radius: var(--a-radius-sm, 4px);
}

.conflict-diff-preview pre {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--a-font-mono, monospace);
  color: var(--a-color-fg-muted, #475569);
}

.conflict-loading-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100px;
  font-size: 0.85rem;
}

.conflict-modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  width: 100%;
  flex-wrap: wrap;
}

.conflict-footer-export {
  display: flex;
  align-items: center;
}

.conflict-footer-actions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-left: auto;
}
</style>
