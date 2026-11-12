<template>
  <article class="shared-notes a-content-frame" aria-label="已发布的读书笔记">
    <div v-if="loading" role="status" class="shared-notes__loading">
      <div class="shared-notes__spinner" aria-hidden="true" />
      <p>正在打开分享的笔记…</p>
    </div>

    <div v-else-if="error" role="alert" class="shared-notes__error">
      <h2>分享已不可访问</h2>
      <p>{{ error }}</p>
      <PButton to="/books" variant="secondary" size="sm">返回图书</PButton>
    </div>

    <template v-else-if="share">
      <!-- 杂志化 Hero 头部 -->
      <header class="shared-notes__heading">
        <div class="shared-notes__eyebrow-row">
          <p class="shared-notes__eyebrow">
            <Bookmark :size="13" class="inline-block mr-1" aria-hidden="true" />
            <span>读书笔记 · {{ share.visibility === 'public' ? '完全公开' : '通过链接分享' }}</span>
          </p>
          <div class="shared-notes__actions">
            <PButton size="sm" variant="secondary" @click="copyShareLink">
              <Link2 :size="13" aria-hidden="true" />
              <span>{{ copiedLink ? '已复制链接 ✓' : '复制链接' }}</span>
            </PButton>
            <PButton size="sm" variant="ghost" @click="copyAllNotes">
              <Copy :size="13" aria-hidden="true" />
              <span>{{ copiedAll ? '已复制全部 ✓' : '复制引文文本' }}</span>
            </PButton>
          </div>
        </div>

        <h1 class="shared-notes__title">{{ share.title }}</h1>
        <p v-if="share.description" class="shared-notes__description">{{ share.description }}</p>

        <div class="shared-notes__meta-bar">
          <small>发布版本 {{ share.version }} · {{ date(share.published_at) }} · 共 {{ share.items.length }} 条笔记</small>
        </div>
      </header>

      <!-- 笔记条目列表 -->
      <ol class="shared-notes__entries">
        <li v-for="(item, index) in share.items" :key="index" class="shared-notes__card">
          <article>
            <div class="shared-notes__card-header">
              <span class="shared-notes__kind-badge" :data-kind="item.kind">
                {{ item.kind === 'highlight' ? '摘录与批注' : '独立阅读笔记' }}
              </span>
              <span v-if="item.chapter" class="shared-notes__chapter">{{ item.chapter }}</span>
            </div>

            <h2 v-if="item.title" class="shared-notes__card-title">{{ item.title }}</h2>

            <blockquote
              v-if="item.quote"
              :data-color="item.color || 'yellow'"
              class="shared-notes__quote"
            >
              “{{ item.quote }}”
            </blockquote>

            <div v-if="item.note" class="shared-notes__thought">
              <div class="shared-notes__thought-header">💬 批注与心得</div>
              <p class="shared-notes__body">{{ item.note }}</p>
            </div>

            <div class="shared-notes__card-footer">
              <button
                type="button"
                class="shared-notes__copy-item-btn"
                @click="copyItem(item, index)"
              >
                {{ copiedIndex === index ? '已复制 ✓' : '复制本条' }}
              </button>
            </div>
          </article>
        </li>
      </ol>

      <!-- 底部版权与隐私说明 -->
      <p class="shared-notes__footnote">
        这是主动发布时保存的内容快照。私有笔记、完整电子书与阅读进度不会随分享公开。
      </p>
    </template>
  </article>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Bookmark, Link2, Copy } from 'lucide-vue-next'
import PButton from '@/components/ui/PButton.vue'
import { getSharedNoteCollection, type SharedNoteCollection, type SharedNoteItem } from '@/api/bookNoteCollections'

const route = useRoute()
const share = ref<SharedNoteCollection>()
const loading = ref(true)
const error = ref('')

const copiedLink = ref(false)
const copiedAll = ref(false)
const copiedIndex = ref<number | null>(null)

function date(value: string) {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('zh-CN')
}

let managedMeta: HTMLMetaElement | undefined
let insertedMeta = false
let oldRobots = ''

function protectUnlistedLink() {
  let node = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null
  if (!node) {
    node = document.createElement('meta')
    node.name = 'robots'
    document.head.appendChild(node)
    insertedMeta = true
  } else {
    oldRobots = node.content
  }
  node.content = 'noindex,nofollow'
  managedMeta = node
}

async function copyShareLink() {
  try {
    await navigator.clipboard.writeText(window.location.href)
    copiedLink.value = true
    setTimeout(() => {
      copiedLink.value = false
    }, 2000)
  } catch {
    // 降级支持
  }
}

async function copyAllNotes() {
  if (!share.value) return
  const text = [
    `《${share.value.title}》读书笔记合集`,
    share.value.description ? `${share.value.description}\n` : '',
    ...share.value.items.map((item, i) => {
      const parts = [`--- 条目 ${i + 1} ---`]
      if (item.title) parts.push(`【${item.title}】`)
      if (item.quote) parts.push(`引文：“${item.quote}”`)
      if (item.note) parts.push(`心得：${item.note}`)
      if (item.chapter) parts.push(`章节：${item.chapter}`)
      return parts.join('\n')
    }),
  ].join('\n\n')

  try {
    await navigator.clipboard.writeText(text)
    copiedAll.value = true
    setTimeout(() => {
      copiedAll.value = false
    }, 2000)
  } catch {}
}

async function copyItem(item: SharedNoteItem, index: number) {
  const parts: string[] = []
  if (item.title) parts.push(`【${item.title}】`)
  if (item.quote) parts.push(`“${item.quote}”`)
  if (item.note) parts.push(`批注：${item.note}`)
  if (item.chapter) parts.push(`(${item.chapter})`)

  try {
    await navigator.clipboard.writeText(parts.join('\n'))
    copiedIndex.value = index
    setTimeout(() => {
      copiedIndex.value = null
    }, 2000)
  } catch {}
}

onMounted(async () => {
  try {
    share.value = await getSharedNoteCollection(String(route.params.shareKey || ''))
    if (share.value.visibility === 'link') protectUnlistedLink()
  } catch {
    error.value = '分享可能已撤销、改为私有，或链接不正确。'
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  if (managedMeta) {
    if (insertedMeta) managedMeta.remove()
    else managedMeta.content = oldRobots
  }
})
</script>

<style scoped>
.shared-notes {
  max-width: 48rem;
  margin-inline: auto;
  padding: 2.25rem 1.25rem 4rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.shared-notes__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 4rem 1rem;
  color: var(--a-color-text-secondary, #64748b);
  font-size: 0.875rem;
}

.shared-notes__spinner {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(0, 0, 0, 0.08);
  border-top-color: var(--a-color-primary, #007aff);
  border-radius: 50%;
  animation: sharedNotesSpin 0.75s linear infinite;
}

@keyframes sharedNotesSpin {
  to { transform: rotate(360deg); }
}

.shared-notes__error {
  padding: 3rem 1.5rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.shared-notes__error h2 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
  margin: 0;
}

.shared-notes__error p {
  color: var(--a-color-text-secondary, #64748b);
  font-size: 0.875rem;
  margin: 0;
}

.shared-notes__heading {
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  padding-bottom: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.shared-notes__eyebrow-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.shared-notes__eyebrow {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--a-color-text-secondary, #64748b);
  margin: 0;
  display: inline-flex;
  align-items: center;
}

.shared-notes__actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.shared-notes__title {
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1.3;
  color: var(--a-color-text, #0f172a);
  letter-spacing: -0.02em;
  margin: 0;
}

.shared-notes__description {
  font-size: 0.9375rem;
  line-height: 1.7;
  color: var(--a-color-text-secondary, #475569);
  white-space: pre-wrap;
  margin: 0;
}

.shared-notes__meta-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.75rem;
  color: var(--a-color-text-secondary, #94a3b8);
}

.shared-notes__entries {
  list-style: none;
  counter-reset: note;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 1.25rem;
}

.shared-notes__card {
  background: var(--a-color-bg, #ffffff);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 10px;
  padding: 1.25rem 1.35rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03), 0 1px 2px rgba(0, 0, 0, 0.02);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.shared-notes__card:hover {
  border-color: rgba(0, 0, 0, 0.09);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.shared-notes__card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.75rem;
}

.shared-notes__kind-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  font-size: 0.6875rem;
  font-weight: 500;
  background: rgba(0, 0, 0, 0.04);
  color: var(--a-color-text-secondary, #64748b);
}

.shared-notes__kind-badge[data-kind="highlight"] {
  background: rgba(245, 158, 11, 0.1);
  color: #b45309;
}

.shared-notes__chapter {
  font-size: 0.75rem;
  color: var(--a-color-text-secondary, #94a3b8);
}

.shared-notes__card-title {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
  margin: 0.25rem 0 0;
  line-height: 1.4;
}

.shared-notes__quote {
  margin: 0.5rem 0;
  padding: 0.625rem 0.875rem;
  border-left: 3px solid #f59e0b;
  border-radius: 0 6px 6px 0;
  background: rgba(245, 158, 11, 0.05);
  font-size: 0.9375rem;
  line-height: 1.7;
  color: var(--a-color-text, #1e293b);
  font-style: normal;
}

.shared-notes__quote[data-color="blue"] {
  border-left-color: #0ea5e9;
  background: rgba(14, 165, 233, 0.05);
}

.shared-notes__quote[data-color="green"] {
  border-left-color: #10b981;
  background: rgba(16, 185, 129, 0.05);
}

.shared-notes__quote[data-color="pink"] {
  border-left-color: #ec4899;
  background: rgba(236, 72, 153, 0.05);
}

.shared-notes__thought {
  background: rgba(0, 0, 0, 0.02);
  border: 1px solid rgba(0, 0, 0, 0.04);
  border-radius: 6px;
  padding: 0.65rem 0.85rem;
  font-size: 0.8125rem;
  margin-top: 0.35rem;
}

.shared-notes__thought-header {
  font-weight: 600;
  font-size: 0.6875rem;
  color: var(--a-color-text-secondary, #64748b);
  margin-bottom: 0.2rem;
}

.shared-notes__body {
  margin: 0;
  line-height: 1.65;
  color: var(--a-color-text, #334155);
  white-space: pre-wrap;
}

.shared-notes__card-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(0, 0, 0, 0.03);
}

.shared-notes__copy-item-btn {
  background: transparent;
  border: none;
  font-size: 0.75rem;
  color: var(--a-color-text-secondary, #94a3b8);
  cursor: pointer;
  padding: 0;
  transition: color 0.15s ease;
}

.shared-notes__copy-item-btn:hover {
  color: var(--a-color-primary, #007aff);
}

.shared-notes__footnote {
  padding-top: 1.25rem;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  font-size: 0.75rem;
  color: var(--a-color-text-secondary, #94a3b8);
  line-height: 1.6;
  margin: 0;
}

@media (max-width: 640px) {
  .shared-notes {
    padding: 1.5rem 1rem 3rem;
  }
  .shared-notes__eyebrow-row {
    flex-direction: column;
    align-items: flex-start;
  }
  .shared-notes__actions {
    width: 100%;
  }
  .shared-notes__actions :deep(.p-button) {
    flex: 1;
    justify-content: center;
  }
  .shared-notes__title {
    font-size: 1.4rem;
  }
}
</style>
