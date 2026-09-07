<template>
  <main class="setting-announcements settings-center">
    <PSectionHeader title="公告管理" kicker="SITE ANNOUNCEMENTS" description="发布公告并查看历史投递记录。" />

    <nav class="setting-announcements__views" aria-label="公告管理视图">
      <PTab label="发布公告" :active="view === 'publish'" @click="selectView('publish')" />
      <PTab label="公告记录" :active="view === 'history'" @click="selectView('history')" />
    </nav>

    <section v-if="view === 'publish'" aria-label="发布公告">
      <PSurface :layer="1" class="setting-announcements__surface">
        <form class="setting-announcements__form" @submit.prevent="requestPublish">
          <PInput
            v-model="title"
            label="公告标题"
            hint="最多 120 个字符"
            maxlength="120"
            autocomplete="off"
            :error="titleError"
          />
          <PTextarea
            v-model="body"
            label="公告正文"
            hint="纯文本，最多 1000 个字符"
            :rows="8"
            maxlength="1000"
            :error="bodyError"
          />
          <PInput
            v-model="path"
            label="站内跳转地址"
            hint="可选，必须以 / 开头，例如 /status"
            placeholder="/status"
            autocomplete="off"
            :error="pathError"
          />

          <p v-if="error" class="setting-announcements__message setting-announcements__message--error" role="alert">{{ error }}</p>
          <p v-else-if="success" class="setting-announcements__message" role="status">{{ success }}</p>

          <div class="setting-announcements__actions">
            <PButton type="submit" :loading="publishing" loading-text="发布中...">发布公告</PButton>
          </div>
        </form>
      </PSurface>
    </section>

    <section v-else class="setting-announcements__history" aria-label="公告记录">
      <div class="setting-announcements__toolbar">
        <PInput
          v-model="filters.search"
          class="setting-announcements__search"
          type="search"
          aria-label="搜索公告"
          placeholder="搜索标题、正文或路径"
          @keydown.enter.prevent="applyFilters"
        />
        <PSelect v-model="filters.status" label="状态" :options="statusOptions" />
        <PButton variant="secondary" :loading="loading" loading-text="查询中..." @click="applyFilters">查询</PButton>
      </div>

      <p v-if="historyError" class="setting-announcements__message setting-announcements__message--error" role="alert">{{ historyError }}</p>
      <p v-else-if="success" class="setting-announcements__message" role="status">{{ success }}</p>

      <PSurface :layer="1" class="setting-announcements__list" :aria-busy="loading">
        <div v-if="loading && announcements.length === 0" class="setting-announcements__state" role="status">正在加载...</div>
        <div v-else-if="announcements.length === 0" class="setting-announcements__state">暂无公告记录</div>
        <div v-else class="setting-announcements__table-wrap">
          <table class="setting-announcements__table">
            <thead>
              <tr>
                <th scope="col">公告</th>
                <th scope="col">发布时间</th>
                <th scope="col">投递人数</th>
                <th scope="col">状态</th>
                <th scope="col"><span class="setting-announcements__sr-only">操作</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="announcement in announcements" :key="announcement.source_id">
                <td data-label="公告">
                  <div class="setting-announcements__identity">
                    <strong>{{ announcement.title || '无标题公告' }}</strong>
                    <span>{{ previewText(announcement.body) }}</span>
                  </div>
                </td>
                <td data-label="发布时间" class="setting-announcements__date">
                  <time :datetime="announcement.published_at">{{ formatDateTime(announcement.published_at) }}</time>
                </td>
                <td data-label="投递人数">{{ announcement.delivered }} 人</td>
                <td data-label="状态"><PBadge type="success">已投递</PBadge></td>
                <td data-label="操作">
                  <PButton variant="ghost" size="sm" @click="openDetail(announcement)">查看详情</PButton>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <PaginationBar :meta="meta" :loading="loading" @change="changePage" />
      </PSurface>
    </section>

    <PModal
      :model-value="Boolean(selectedAnnouncement)"
      title="公告详情"
      size="lg"
      @update:model-value="closeDetail"
    >
      <template v-if="selectedAnnouncement">
        <div class="setting-announcements__detail">
          <div class="setting-announcements__detail-head">
            <div>
              <p class="setting-announcements__detail-kicker">公告记录</p>
              <h2>{{ selectedAnnouncement.title || '无标题公告' }}</h2>
            </div>
            <PBadge type="success">已投递 · {{ selectedAnnouncement.delivered }} 人</PBadge>
          </div>

          <dl class="setting-announcements__facts">
            <div><dt>发布时间</dt><dd>{{ formatDateTime(selectedAnnouncement.published_at) }}</dd></div>
            <div><dt>发布人</dt><dd>{{ publisherLabel(selectedAnnouncement) }}</dd></div>
            <div><dt>站内路径</dt><dd>{{ selectedAnnouncement.path || '未设置' }}</dd></div>
          </dl>

          <article class="setting-announcements__body">
            <h3>公告正文</h3>
            <p>{{ selectedAnnouncement.body }}</p>
          </article>

          <article class="setting-announcements__preview" aria-label="用户端通知预览">
            <div class="setting-announcements__preview-meta">
              <span>系统通知</span>
              <time :datetime="selectedAnnouncement.published_at">刚刚</time>
            </div>
            <h3>{{ selectedAnnouncement.title || '无标题公告' }}</h3>
            <p>{{ selectedAnnouncement.body }}</p>
            <PButton v-if="selectedAnnouncement.path" :to="selectedAnnouncement.path" variant="secondary" size="sm">查看详情</PButton>
          </article>
        </div>
      </template>
    </PModal>

    <PConfirm
      :show="confirmOpen"
      title="发布站点公告"
      :message="`将向所有活跃用户投递“${title.trim()}”。已发布内容会作为系统通知进入用户收件箱。`"
      confirm-text="确认发布"
      cancel-text="取消"
      :loading="publishing"
      loading-text="发布中..."
      @confirm="publish"
      @cancel="confirmOpen = false"
    />
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import PBadge from '@/components/ui/PBadge.vue'
import PButton from '@/components/ui/PButton.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import PInput from '@/components/ui/PInput.vue'
import PModal from '@/components/ui/PModal.vue'
import PSectionHeader from '@/components/ui/PSectionHeader.vue'
import PSelect from '@/components/ui/PSelect.vue'
import PSurface from '@/components/ui/PSurface.vue'
import PTab from '@/components/ui/PTab.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import {
  listAnnouncements,
  publishAnnouncement,
  type Announcement,
  type AnnouncementPageMeta,
} from '@/api/adminAnnouncements'

const title = ref('')
const body = ref('')
const path = ref('')
const view = ref<'publish' | 'history'>('publish')
const confirmOpen = ref(false)
const publishing = ref(false)
const error = ref('')
const success = ref('')
const historyError = ref('')
const loading = ref(false)
const announcements = ref<Announcement[]>([])
const selectedAnnouncement = ref<Announcement | null>(null)
const meta = ref<AnnouncementPageMeta>({ page: 1, page_size: 20, total: 0, has_more: false })
const filters = reactive<{ search: string; status: 'all' | 'delivered' }>({ search: '', status: 'all' })
const statusOptions = [
  { label: '全部状态', value: 'all' },
  { label: '已投递', value: 'delivered' },
]

const titleError = computed(() => title.value.trim() ? '' : '请输入公告标题')
const bodyError = computed(() => body.value.trim() ? '' : '请输入公告正文')
const pathError = computed(() => {
  const value = path.value.trim()
  return value && (!value.startsWith('/') || value.startsWith('//')) ? '请输入有效的站内路径' : ''
})

const requestPublish = () => {
  error.value = ''
  success.value = ''
  if (titleError.value || bodyError.value || pathError.value) return
  confirmOpen.value = true
}

const publish = async () => {
  if (publishing.value) return
  publishing.value = true
  error.value = ''
  try {
    const result = await publishAnnouncement({
      title: title.value.trim(),
      body: body.value.trim(),
      ...(path.value.trim() ? { path: path.value.trim() } : {}),
    })
    success.value = `已向 ${result.delivered} 位活跃用户发布公告。`
    title.value = ''
    body.value = ''
    path.value = ''
    confirmOpen.value = false
    view.value = 'history'
    await loadAnnouncements(1)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '公告暂时无法发布，请稍后重试。'
  } finally {
    publishing.value = false
  }
}

async function loadAnnouncements(page = meta.value.page) {
  loading.value = true
  historyError.value = ''
  try {
    const response = await listAnnouncements({
      search: filters.search.trim(),
      status: filters.status,
      page,
      page_size: meta.value.page_size,
    })
    announcements.value = response.data
    meta.value = response.meta ?? { ...meta.value, page, total: response.data.length, has_more: false }
  } catch (cause) {
    historyError.value = cause instanceof Error ? cause.message : '加载公告记录失败，请重试。'
  } finally {
    loading.value = false
  }
}

function selectView(next: 'publish' | 'history') {
  view.value = next
  if (next === 'history' && announcements.value.length === 0 && !loading.value) void loadAnnouncements(1)
}

function applyFilters() {
  void loadAnnouncements(1)
}

function changePage(page: number) {
  void loadAnnouncements(page)
}

function openDetail(announcement: Announcement) {
  selectedAnnouncement.value = announcement
}

function closeDetail(visible: boolean) {
  if (!visible) selectedAnnouncement.value = null
}

function previewText(value: string) {
  const text = value.replace(/\s+/g, ' ').trim()
  return text.length > 80 ? `${text.slice(0, 80)}...` : text
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))
}

function publisherLabel(announcement: Announcement) {
  return announcement.actor?.display_name || announcement.actor?.username || '管理员'
}

onMounted(() => {
  if (view.value === 'history') void loadAnnouncements(1)
})
</script>

<style scoped>
.setting-announcements {
  display: grid;
  gap: 1.5rem;
}

.setting-announcements__views {
  display: flex;
  gap: 0.25rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.setting-announcements__surface,
.setting-announcements__list {
  width: 100%;
}

.setting-announcements__form {
  display: grid;
  gap: 1.25rem;
  max-width: 48rem;
  padding: 1.5rem;
}

.setting-announcements__message {
  margin: 0;
  color: var(--a-color-success);
  font-size: 0.86rem;
  font-weight: 600;
}

.setting-announcements__message--error { color: var(--a-color-danger); }

.setting-announcements__actions {
  display: flex;
  justify-content: flex-end;
}

.setting-announcements__history {
  display: grid;
  gap: 1rem;
}

.setting-announcements__toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 10rem auto;
  gap: 0.75rem;
  align-items: end;
}

.setting-announcements__search :deep(.p-field) { margin: 0; }

.setting-announcements__list { overflow: hidden; }

.setting-announcements__table-wrap { overflow-x: auto; }

.setting-announcements__table {
  width: 100%;
  border-collapse: collapse;
  min-width: 42rem;
}

.setting-announcements__table th,
.setting-announcements__table td {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--a-color-border-soft);
  text-align: left;
  vertical-align: middle;
}

.setting-announcements__table th {
  color: var(--a-color-muted);
  font-size: 0.72rem;
  font-weight: 600;
}

.setting-announcements__identity {
  display: grid;
  gap: 0.3rem;
  min-width: 16rem;
}

.setting-announcements__identity span {
  max-width: 28rem;
  overflow: hidden;
  color: var(--a-color-muted);
  font-size: 0.82rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.setting-announcements__date { white-space: nowrap; color: var(--a-color-muted); font-size: 0.82rem; }
.setting-announcements__state { padding: 3rem 1.5rem; color: var(--a-color-muted); text-align: center; }
.setting-announcements__sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); }

.setting-announcements__detail {
  display: grid;
  gap: 1.5rem;
}

.setting-announcements__detail-head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  padding-right: 1.5rem;
}

.setting-announcements__detail-kicker {
  margin: 0 0 0.4rem;
  color: var(--a-color-muted);
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.setting-announcements__detail h2,
.setting-announcements__detail h3,
.setting-announcements__detail p { margin: 0; }
.setting-announcements__detail h2 { font-size: 1.35rem; line-height: 1.35; }

.setting-announcements__facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
  margin: 0;
  padding: 1rem 0;
  border-top: 1px solid var(--a-color-border-soft);
  border-bottom: 1px solid var(--a-color-border-soft);
}

.setting-announcements__facts div { display: grid; gap: 0.35rem; }
.setting-announcements__facts dt { color: var(--a-color-muted); font-size: 0.74rem; }
.setting-announcements__facts dd { margin: 0; font-size: 0.86rem; }

.setting-announcements__body,
.setting-announcements__preview {
  display: grid;
  gap: 0.7rem;
}

.setting-announcements__body p { white-space: pre-wrap; line-height: 1.7; }

.setting-announcements__preview {
  padding: 1rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-surface);
}

.setting-announcements__preview-meta {
  display: flex;
  justify-content: space-between;
  color: var(--a-color-muted);
  font-size: 0.75rem;
}

.setting-announcements__preview h3 { font-size: 1rem; }
.setting-announcements__preview p { white-space: pre-wrap; line-height: 1.6; }

@media (max-width: 760px) {
  .setting-announcements__toolbar { grid-template-columns: 1fr; align-items: stretch; }
  .setting-announcements__toolbar :deep(.p-button) { width: 100%; }
  .setting-announcements__facts { grid-template-columns: 1fr; }
  .setting-announcements__detail-head { display: grid; }
}

@media (max-width: 640px) {
  .setting-announcements__form { padding: 1rem; }
  .setting-announcements__actions :deep(.p-button) { width: 100%; }
}
</style>
