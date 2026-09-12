<template>
  <section class="dm-admin-reports">
    <header>
      <h3>私信举报</h3>
      <div class="dm-admin-reports__action">
        <PButton size="sm" variant="secondary" :loading="loading" @click="load">刷新</PButton>
        <PActionFeedback v-if="loadErrorAction === 'refresh'" :message="loadError" />
      </div>
    </header>
    <p v-if="!reports.length && !loading" class="dm-admin-reports__empty">暂无举报</p>
    <article v-for="report in reports" :key="report.id">
      <div>
        <strong>{{ report.reason }}</strong>
        <span>{{ report.status }}</span>
      </div>
      <p>{{ report.snapshot_content || (report.has_snapshot_image ? '含图片' : '无文字内容') }}</p>
      <small>{{ report.conversation_context }} · {{ formatTime(report.created_at) }}</small>
      <div v-if="report.status === 'pending'" class="dm-admin-reports__action">
        <PButton size="sm" :loading="updatingId === report.id" @click="update(report.id, 'resolved')">处理完成</PButton>
        <PButton size="sm" variant="secondary" :loading="updatingId === report.id" @click="update(report.id, 'dismissed')">驳回</PButton>
        <PActionFeedback v-if="updateErrorId === report.id" :message="updateError" />
      </div>
    </article>
    <div v-if="cursor" class="dm-admin-reports__action">
      <PButton variant="secondary" :loading="loading" @click="loadMore">加载更多</PButton>
      <PActionFeedback v-if="loadErrorAction === 'more'" :message="loadError" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

import PActionFeedback from '@/components/ui/PActionFeedback.vue'
import PButton from '@/components/ui/PButton.vue'
import { listDMReports, updateDMReport, type DMReport } from '@/api/dm'
import { errorMessage } from '@/utils/logger'

const reports = ref<DMReport[]>([])
const cursor = ref<string>()
const loading = ref(false)
const loadError = ref('')
const loadErrorAction = ref<'refresh' | 'more'>('refresh')
const updatingId = ref('')
const updateError = ref('')
const updateErrorId = ref('')

const fetchPage = async (append = false) => {
  loading.value = true
  loadError.value = ''
  loadErrorAction.value = append ? 'more' : 'refresh'
  try {
    const page = await listDMReports(append ? cursor.value : undefined)
    reports.value = append ? [...reports.value, ...page.items] : page.items
    cursor.value = page.next_cursor
  } catch (cause) {
    loadError.value = errorMessage(cause, '举报列表加载失败，请重试')
  } finally {
    loading.value = false
  }
}

const load = () => fetchPage()
const loadMore = () => fetchPage(true)

const update = async (id: string, status: 'resolved' | 'dismissed') => {
  if (updatingId.value) return
  updatingId.value = id
  updateError.value = ''
  updateErrorId.value = ''
  try {
    const next = await updateDMReport(id, status)
    reports.value = reports.value.map(report => report.id === id ? next : report)
  } catch (cause) {
    updateError.value = errorMessage(cause, '举报处理失败，请重试')
    updateErrorId.value = id
  } finally {
    updatingId.value = ''
  }
}

const formatTime = (value: string) => new Date(value).toLocaleString('zh-CN')
onMounted(load)
</script>

<style scoped>
.dm-admin-reports { display: grid; gap: .75rem; }
.dm-admin-reports header, .dm-admin-reports article > div { display: flex; justify-content: space-between; align-items: center; gap: .5rem; }
.dm-admin-reports h3, .dm-admin-reports p { margin: 0; }
.dm-admin-reports article { display: grid; gap: .5rem; padding: 1rem 0; border-top: 1px solid var(--a-color-border-soft); }
.dm-admin-reports small { color: var(--a-color-muted); }
.dm-admin-reports__action { display: grid; justify-items: end; gap: .35rem; }
.dm-admin-reports article > div:last-child { justify-items: start; justify-content: flex-start; }
.dm-admin-reports__empty { color: var(--a-color-muted); }
</style>
