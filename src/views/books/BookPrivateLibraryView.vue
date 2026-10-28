<template>
  <section class="book-catalog private-books">
    <!-- 顶栏标题 -->
    <PPageHeader title="我的书架" sub="管理正在阅读、想读与已完成的书籍。" />

    <!-- 错误重试 -->
    <p v-if="error" role="alert" class="book-catalog__error">
      {{ error }}
      <PButton variant="ghost" @click="load">重新加载</PButton>
    </p>

    <!-- 加载中 -->
    <p v-if="loading" role="status" class="text-xs text-[var(--a-color-text-secondary)]">正在加载书架…</p>

    <template v-else>
      <!-- 1. 阅读数据统计卡片 -->
      <section v-if="stats" aria-label="阅读统计" class="private-books__stats-card">
        <div class="private-books__stats-pill">
          <div>
            <span class="text-[10px] text-[var(--a-color-text-secondary)] uppercase block">最近 30 天</span>
            <strong>有效阅读 {{ Math.floor(stats.total_seconds / 60) }} 分钟</strong>
          </div>
          <div class="w-px h-5 bg-[var(--a-color-border-soft)]" />
          <div>
            <span class="text-[10px] text-[var(--a-color-text-secondary)] uppercase block">阅读打卡</span>
            <strong>{{ stats.days.filter(d => d.seconds > 0).length }} 天</strong>
          </div>
        </div>

        <button
          type="button"
          class="private-books__calendar-toggle"
          @click="calendarOpen = !calendarOpen"
        >
          {{ calendarOpen ? '收起打卡日历 ▴' : '展开打卡日历 ▾' }}
        </button>

        <!-- 每日时长折叠列表 -->
        <div v-if="calendarOpen" class="private-books__calendar-panel">
          <ul class="private-books__calendar-list">
            <li
              v-for="day in stats.days"
              :key="day.day"
              class="private-books__calendar-day tabular-nums"
            >
              {{ day.day }}：{{ Math.floor(day.seconds / 60) }} 分钟
            </li>
          </ul>
        </div>
      </section>

      <!-- 2. 分栏切换与搜索工具栏 -->
      <div class="private-books__filter-bar">
        <!-- Segmented Control 选项卡 -->
        <PSegmentedControl
          v-model="status"
          :options="shelfTabOptions"
          @change="setStatusFilter"
        />

        <!-- 筛选与搜索输入控件 -->
        <div class="private-books__filter-inputs">
          <PSearchInput
            v-model="query"
            variant="inline"
            size="sm"
            placeholder="输入书名检索..."
            aria-label="搜索书名检索"
            clearable
          />

          <!-- 保持第 1 个 select 作为状态过滤器以兼容单测与辅助选择 -->
          <label class="private-books__filter-label">
            <span>阅读状态</span>
            <select
              :value="status"
              class="private-books__filter-select"
              @change="status = ($event.target as HTMLSelectElement).value"
            >
              <option value="">全部状态</option>
              <option v-for="item in shelfStatuses" :key="item.value" :value="item.value">
                {{ item.label }}
              </option>
            </select>
          </label>

          <label class="private-books__filter-label">
            <span>私人标签</span>
            <input
              v-model="tag"
              placeholder="标签过滤..."
              class="private-books__filter-input"
            />
          </label>

          <PButton to="/books" size="sm">发现图书</PButton>
        </div>
      </div>

      <!-- 3. 书架书目展示网格 -->
      <PEmpty
        v-if="!filtered.length"
        description="暂无符合条件的图书。到发现大厅添加书籍，或调整筛选条件。"
      />

      <ul v-else class="private-books__shelf-grid">
        <li
          v-for="entry in filtered"
          :key="entry.id"
          class="private-books__book-card"
        >
          <!-- 封面区域：使用通用 BookCover 组件 (具体书封面，无图自动回退 2B) -->
          <div class="private-books__card-cover" @click="read(entry)">
            <BookCover
              variant="edition"
              :title="entry.work_title"
            />
          </div>

          <!-- 卡片元信息区域 -->
          <div class="private-books__card-info">
            <div class="private-books__card-header">
              <span class="private-books__badge-status" :data-status="entry.status">
                {{ getStatusLabel(entry.status) }}
              </span>
            </div>

            <RouterLink
              :to="`/books/work/${entry.work_id}`"
              class="private-books__card-title"
              :title="entry.work_title"
            >
              {{ entry.work_title }}
            </RouterLink>

            <!-- 私人标签展示 -->
            <div v-if="entry.tags && entry.tags.length" class="private-books__card-tags">
              <span v-for="t in entry.tags" :key="t" class="private-books__tag">
                # {{ t }}
              </span>
            </div>

            <!-- 一键继续阅读 -->
            <div class="private-books__card-action-area">
              <button
                type="button"
                class="private-books__btn-read"
                :disabled="busy === entry.id"
                @click="read(entry)"
              >
                继续阅读 ➔
              </button>
            </div>

            <!-- 底部操作：保持第 2 个 select 供更新状态，兼容单测 -->
            <div class="private-books__card-actions">
              <select
                :value="entry.status"
                :disabled="busy === entry.id"
                class="private-books__status-select"
                @change="update(entry, ($event.target as HTMLSelectElement).value as ShelfStatus)"
              >
                <option v-for="item in shelfStatuses" :key="item.value" :value="item.value">
                  {{ item.label }}
                </option>
              </select>

              <button
                type="button"
                class="private-books__remove-btn"
                :disabled="!!busy"
                title="移出书架"
                @click="removing = entry"
              >
                ✕
              </button>
            </div>
          </div>
        </li>
      </ul>

      <!-- 分页加载更多 -->
      <PButton
        v-if="entries.length < total"
        variant="secondary"
        :disabled="!!busy"
        @click="more"
      >
        加载更多
      </PButton>
    </template>

    <!-- 移出书架确认对话框 -->
    <PConfirm
      :show="!!removing"
      title="确定移出书架？"
      message="仅移出个人书架，你的阅读进度、划线批注与笔记不会被删除。"
      @confirm="remove"
      @cancel="removing = null"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import PButton from '@/components/ui/PButton.vue'
import PSearchInput from '@/components/ui/PSearchInput.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import BookCover from '@/components/books/BookCover.vue'
import {
  listLibrary,
  saveLibrary,
  removeLibrary,
  readingRecommendation,
  readingStatistics,
  shelfStatuses,
  type LibraryEntry,
  type ReadingStatistics,
  type ShelfStatus,
} from '@/api/bookPrivate'
import { resourceReaderPath } from '@/api/bookResources'
import './bookCatalog.css'
import './bookPrivate.css'

const router = useRouter()
const entries = ref<LibraryEntry[]>([])
const stats = ref<ReadingStatistics | null>(null)
const loading = ref(true)
const error = ref('')
const busy = ref('')
const total = ref(0)
const query = ref('')
const status = ref('')
const tag = ref('')
const removing = ref<LibraryEntry | null>(null)
const calendarOpen = ref(false)

const shelfTabOptions = computed(() => [
  { label: `全部 (${entries.value.length})`, value: '' },
  { label: `正在读 (${countByStatus('reading')})`, value: 'reading' },
  { label: `想读 (${countByStatus('want_to_read')})`, value: 'want_to_read' },
  { label: `读完 (${countByStatus('read')})`, value: 'read' },
])

const filtered = computed(() =>
  entries.value.filter(
    item =>
      (!status.value || item.status === status.value) &&
      item.work_title.toLowerCase().includes(query.value.toLowerCase()) &&
      (!tag.value || item.tags.includes(tag.value.trim().toLowerCase()))
  )
)

function setStatusFilter(val: string) {
  status.value = val
}

function countByStatus(val: string) {
  return entries.value.filter(e => e.status === val).length
}

function getStatusLabel(s: string) {
  const match = shelfStatuses.find(item => item.value === s)
  return match ? match.label : '在读'
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const page = await listLibrary()
    entries.value = page.items
    total.value = page.total
    stats.value = await readingStatistics()
  } catch {
    error.value = '书架或统计加载失败，请重新加载。'
  } finally {
    loading.value = false
  }
}

async function more() {
  try {
    const page = await listLibrary(entries.value.length)
    entries.value.push(...page.items)
    total.value = page.total
  } catch {
    error.value = '加载失败，请重试。'
  }
}

async function update(entry: LibraryEntry, value: ShelfStatus, tags = entry.tags) {
  if (busy.value) return
  busy.value = entry.id
  error.value = ''
  try {
    Object.assign(entry, await saveLibrary(entry.work_id, value, tags, entry))
  } catch {
    error.value = '保存失败或其他设备已修改。当前云端数据未被覆盖，请重新加载后重试。'
  } finally {
    busy.value = ''
  }
}

async function read(entry: LibraryEntry) {
  busy.value = entry.id
  error.value = ''
  try {
    const result = await readingRecommendation(entry.work_id)
    if (result.available && result.asset && result.revision_id) {
      await router.push(resourceReaderPath(result.work_id, result.asset.id, result.revision_id))
    } else {
      await router.push(`/books/work/${entry.work_id}`)
    }
  } catch {
    error.value = '无法恢复阅读，请重试或打开图书详情。'
  } finally {
    busy.value = ''
  }
}

async function remove() {
  const entry = removing.value
  removing.value = null
  if (!entry) return
  busy.value = entry.id
  try {
    await removeLibrary(entry)
    entries.value = entries.value.filter(item => item.id !== entry.id)
    total.value--
  } catch {
    error.value = '移出失败，请重新加载后重试。'
  } finally {
    busy.value = ''
  }
}

onMounted(load)
</script>
