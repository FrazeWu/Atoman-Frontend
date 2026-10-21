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
    <p v-if="loading" role="status">正在加载书架…</p>

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
        <!-- Segmented Control 分栏选项卡 -->
        <div class="private-books__segmented">
          <button
            type="button"
            class="private-books__segmented-btn"
            :class="{ 'is-active': status === '' }"
            @click="setStatusFilter('')"
          >
            全部 ({{ entries.length }})
          </button>
          <button
            type="button"
            class="private-books__segmented-btn"
            :class="{ 'is-active': status === 'reading' }"
            @click="setStatusFilter('reading')"
          >
            正在读 ({{ countByStatus('reading') }})
          </button>
          <button
            type="button"
            class="private-books__segmented-btn"
            :class="{ 'is-active': status === 'want_to_read' }"
            @click="setStatusFilter('want_to_read')"
          >
            想读 ({{ countByStatus('want_to_read') }})
          </button>
          <button
            type="button"
            class="private-books__segmented-btn"
            :class="{ 'is-active': status === 'read' }"
            @click="setStatusFilter('read')"
          >
            读完 ({{ countByStatus('read') }})
          </button>
        </div>

        <!-- 筛选与搜索输入控件 -->
        <div class="private-books__filter-inputs">
          <label class="private-books__filter-label">
            <span>搜索书名</span>
            <input
              v-model="query"
              type="search"
              placeholder="输入书名检索..."
              class="private-books__filter-input"
            />
          </label>

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

          <PButton to="/books">发现图书</PButton>
        </div>
      </div>

      <!-- 3. 书架书目展示网格 -->
      <p v-if="!filtered.length" class="book-catalog__empty">
        暂无符合条件的图书。到发现页打开图书后即可加入书架。
      </p>

      <ul v-else class="private-books__grid">
        <li v-for="entry in filtered" :key="entry.id" class="private-books__card">
          <!-- 纯白微书脊典雅封面 -->
          <div
            class="private-books__cover"
            title="点击继续阅读"
            @click="read(entry)"
          >
            <div class="private-books__cover-header">
              {{ entry.tags[0] || '书目' }}
            </div>
            <div class="private-books__cover-title">
              {{ entry.work_title }}
            </div>
            <div class="private-books__cover-footer">
              {{ getStatusLabel(entry.status) }}
            </div>
          </div>

          <!-- 右侧书籍信息与操作 -->
          <div class="private-books__info">
            <div>
              <div class="private-books__header-row">
                <RouterLink :to="`/books/work/${entry.work_id}`" class="private-books__title-link">
                  <strong>{{ entry.work_title }}</strong>
                </RouterLink>
                <span class="private-books__rating-badge">★ 4.8</span>
              </div>

              <!-- 私人标签列表 -->
              <div v-if="entry.tags.length" class="private-books__tags">
                <span v-for="t in entry.tags" :key="t" class="private-books__tag">
                  # {{ t }}
                </span>
              </div>

              <!-- 阅读进度条 -->
              <div class="private-books__progress-block tabular-nums">
                <div class="private-books__progress-labels">
                  <span class="font-medium text-amber-700">{{ getStatusLabel(entry.status) }}</span>
                  <span>{{ entry.status === 'read' ? '100%' : '进行中' }}</span>
                </div>
                <div class="private-books__progress-track">
                  <div
                    class="private-books__progress-bar"
                    :style="{ width: entry.status === 'read' ? '100%' : '35%' }"
                  />
                </div>
              </div>

              <!-- 快捷标签修改输入框 -->
              <div class="private-books__tag-editor">
                <label class="private-books__filter-label">
                  <span>标签 (逗号分隔):</span>
                  <input
                    :value="entry.tags.join(', ')"
                    :disabled="busy === entry.id"
                    class="private-books__tag-input"
                    @change="update(entry, entry.status, ($event.target as HTMLInputElement).value.split(/[,，]/))"
                  />
                </label>
              </div>
            </div>

            <!-- 操作按钮行 (保持第 2 个 select 用于状态更新) -->
            <div class="private-books__actions">
              <PButton
                class="private-books__read-btn"
                :disabled="!!busy"
                @click="read(entry)"
              >
                继续阅读 ➔
              </PButton>

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
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
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
      // 优雅跳转到示范阅读器或详情页
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
