<template>
  <div
    class="academic-reader"
    :class="[`theme-${currentTheme}`, `font-${currentFontFamily}`]"
    @mouseup="handleTextSelection"
    @keyup="handleTextSelection"
  >
    <!-- 1. 沉浸式顶部工具栏 -->
    <header class="academic-reader__header">
      <div class="academic-reader__header-left">
        <RouterLink to="/books" class="academic-reader__btn" title="返回书库">
          <ArrowLeft :size="16" aria-hidden="true" />
          <span>书库</span>
        </RouterLink>

        <div class="academic-reader__book-meta">
          <strong class="academic-reader__book-title">{{ book.title }}</strong>
          <span class="academic-reader__book-badge">{{ book.coverTag }}</span>
          <span class="academic-reader__book-chapter">{{ currentChapterTitle }}</span>
        </div>
      </div>

      <!-- 中间：翻页/进度控制 -->
      <div class="academic-reader__header-center tabular-nums">
        <button
          type="button"
          class="academic-reader__btn academic-reader__btn--icon"
          title="上一章 / 上一页"
          :disabled="currentChapterIndex <= 0"
          @click="prevChapter"
        >
          <ChevronLeft :size="16" aria-hidden="true" />
        </button>
        <span class="academic-reader__page-indicator">
          第 <strong>{{ currentChapterIndex + 1 }}</strong> / {{ book.chapters.length }} 节
        </span>
        <button
          type="button"
          class="academic-reader__btn academic-reader__btn--icon"
          title="下一章 / 下一页"
          :disabled="currentChapterIndex >= book.chapters.length - 1"
          @click="nextChapter"
        >
          <ChevronRight :size="16" aria-hidden="true" />
        </button>
      </div>

      <!-- 右侧：功能菜单与设置 -->
      <div class="academic-reader__header-right">
        <!-- 导览侧栏抽屉开关 -->
        <button
          type="button"
          class="academic-reader__btn"
          :class="{ 'is-active': sidebarOpen }"
          @click="sidebarOpen = !sidebarOpen"
        >
          <List :size="15" aria-hidden="true" />
          <span>导览与批注</span>
        </button>

        <!-- 排版偏好设置 Popover -->
        <div class="academic-reader__popover-wrapper">
          <button
            type="button"
            class="academic-reader__btn"
            :class="{ 'is-active': settingsOpen }"
            @click="settingsOpen = !settingsOpen"
          >
            <span class="font-bold font-serif text-sm">Aa</span>
            <span>排版</span>
          </button>

          <!-- 设置弹窗面板 -->
          <div v-if="settingsOpen" class="academic-reader__settings-panel">
            <div class="academic-reader__settings-heading">
              <span>阅读偏好</span>
              <button type="button" @click="settingsOpen = false">✕</button>
            </div>

            <!-- 纸张底色主题 -->
            <div class="academic-reader__settings-group">
              <span class="academic-reader__settings-label">纸张底色</span>
              <div class="academic-reader__theme-grid">
                <button
                  type="button"
                  class="academic-reader__theme-btn theme-paper-white"
                  :class="{ 'is-active': currentTheme === 'paper-white' }"
                  @click="currentTheme = 'paper-white'"
                >纸白</button>
                <button
                  type="button"
                  class="academic-reader__theme-btn theme-paper-warm"
                  :class="{ 'is-active': currentTheme === 'paper-warm' }"
                  @click="currentTheme = 'paper-warm'"
                >羊皮纸</button>
                <button
                  type="button"
                  class="academic-reader__theme-btn theme-paper-gray"
                  :class="{ 'is-active': currentTheme === 'paper-gray' }"
                  @click="currentTheme = 'paper-gray'"
                >雅灰</button>
                <button
                  type="button"
                  class="academic-reader__theme-btn theme-paper-night"
                  :class="{ 'is-active': currentTheme === 'paper-night' }"
                  @click="currentTheme = 'paper-night'"
                >夜间</button>
              </div>
            </div>

            <!-- 字号大小 -->
            <div class="academic-reader__settings-group">
              <div class="academic-reader__settings-row">
                <span class="academic-reader__settings-label">正文字号</span>
                <span class="tabular-nums font-semibold">{{ fontSize }} px</span>
              </div>
              <div class="academic-reader__btn-group">
                <button type="button" class="academic-reader__btn" @click="changeFontSize(-1)">A -</button>
                <button type="button" class="academic-reader__btn" @click="changeFontSize(1)">A +</button>
              </div>
            </div>

            <!-- 字体选择 -->
            <div class="academic-reader__settings-group">
              <span class="academic-reader__settings-label">正文字体</span>
              <div class="academic-reader__font-grid">
                <button
                  type="button"
                  class="academic-reader__btn font-serif"
                  :class="{ 'is-active': currentFontFamily === 'serif' }"
                  @click="currentFontFamily = 'serif'"
                >经典宋体</button>
                <button
                  type="button"
                  class="academic-reader__btn font-sans"
                  :class="{ 'is-active': currentFontFamily === 'sans' }"
                  @click="currentFontFamily = 'sans'"
                >现代黑体</button>
                <button
                  type="button"
                  class="academic-reader__btn font-kaiti"
                  :class="{ 'is-active': currentFontFamily === 'kaiti' }"
                  @click="currentFontFamily = 'kaiti'"
                >手迹楷体</button>
              </div>
            </div>
          </div>
        </div>

        <!-- 添加当前书签 -->
        <button
          type="button"
          class="academic-reader__btn academic-reader__btn--icon"
          :class="{ 'is-bookmarked': isCurrentPageBookmarked }"
          title="添加/移除书签 (快捷键 B)"
          @click="toggleBookmark"
        >
          <Bookmark :size="16" aria-hidden="true" />
        </button>

        <!-- 全屏沉浸切换 -->
        <button
          type="button"
          class="academic-reader__btn academic-reader__btn--icon"
          title="全屏沉浸阅读"
          @click="toggleFullscreen"
        >
          <Maximize :size="15" aria-hidden="true" />
        </button>
      </div>
    </header>

    <!-- 2. 主体区：左侧导览抽屉 + 中间纯净纸张版心 -->
    <div class="academic-reader__workspace">
      <!-- 左侧导览抽屉 -->
      <aside v-if="sidebarOpen" class="academic-reader__sidebar">
        <!-- 抽屉顶部选项卡 -->
        <nav class="academic-reader__sidebar-tabs">
          <button
            type="button"
            class="academic-reader__sidebar-tab"
            :class="{ 'is-active': activeSidebarTab === 'toc' }"
            @click="activeSidebarTab = 'toc'"
          >目录</button>
          <button
            type="button"
            class="academic-reader__sidebar-tab"
            :class="{ 'is-active': activeSidebarTab === 'bookmarks' }"
            @click="activeSidebarTab = 'bookmarks'"
          >书签 ({{ bookmarks.length }})</button>
          <button
            type="button"
            class="academic-reader__sidebar-tab"
            :class="{ 'is-active': activeSidebarTab === 'annotations' }"
            @click="activeSidebarTab = 'annotations'"
          >批注 ({{ annotations.length }})</button>
        </nav>

        <!-- Tab 1: 目录树 -->
        <div v-show="activeSidebarTab === 'toc'" class="academic-reader__sidebar-pane">
          <ol class="academic-reader__toc-list">
            <li v-for="(item, index) in book.toc" :key="index">
              <button
                type="button"
                class="academic-reader__toc-item"
                :class="{ 'is-nested': item.depth > 0, 'is-active': activeTocHref === item.href }"
                :style="{ paddingLeft: `${item.depth * 14 + 12}px` }"
                @click="jumpToToc(item.href)"
              >
                <span class="academic-reader__toc-text">{{ item.label }}</span>
                <span class="academic-reader__toc-page tabular-nums">P.{{ item.page }}</span>
              </button>
            </li>
          </ol>
        </div>

        <!-- Tab 2: 书签列表 -->
        <div v-show="activeSidebarTab === 'bookmarks'" class="academic-reader__sidebar-pane">
          <p v-if="!bookmarks.length" class="academic-reader__empty-hint">暂无书签，按快捷键 B 或点击顶栏书签图标即可标记此页。</p>
          <ul v-else class="academic-reader__bookmark-list">
            <li
              v-for="b in bookmarks"
              :key="b.id"
              class="academic-reader__bookmark-item"
              @click="jumpToChapterId(b.chapterId)"
            >
              <div class="academic-reader__bookmark-header">
                <strong>🔖 {{ b.title }}</strong>
                <button type="button" class="academic-reader__remove-btn" @click.stop="removeBookmark(b.id)">✕</button>
              </div>
              <p class="academic-reader__bookmark-excerpt">{{ b.excerpt }}</p>
            </li>
          </ul>
        </div>

        <!-- Tab 3: 划线与批注列表 -->
        <div v-show="activeSidebarTab === 'annotations'" class="academic-reader__sidebar-pane">
          <div class="academic-reader__annotations-toolbar">
            <span class="text-xs font-semibold">我的划线笔记</span>
            <button
              v-if="annotations.length"
              type="button"
              class="academic-reader__export-btn"
              @click="exportAnnotationsMarkdown"
            >导出 Markdown</button>
          </div>
          <p v-if="!annotations.length" class="academic-reader__empty-hint">在正文中选中文字，即可高亮划线或记录阅读想法。</p>
          <ul v-else class="academic-reader__annotation-list">
            <li v-for="ann in annotations" :key="ann.id" class="academic-reader__annotation-item">
              <div class="academic-reader__annotation-header">
                <span class="academic-reader__annotation-type" :class="`is-${ann.color}`">
                  {{ ann.color === 'yellow' ? '黄色划线' : ann.color === 'green' ? '绿色划线' : '下划线' }}
                </span>
                <button type="button" class="academic-reader__remove-btn" @click="deleteAnnotation(ann.id)">✕</button>
              </div>
              <blockquote class="academic-reader__annotation-quote" :class="`border-${ann.color}`">
                “{{ ann.text }}”
              </blockquote>
              <div v-if="ann.note" class="academic-reader__annotation-thought">
                💬 <strong>想法：</strong>{{ ann.note }}
              </div>
            </li>
          </ul>
        </div>
      </aside>

      <!-- 中间纯净纸张版心 -->
      <main class="academic-reader__main-viewport">
        <article class="academic-reader__paper-canvas" :style="{ fontSize: `${fontSize}px` }">
          <!-- 书名与学术卷标题 -->
          <header class="academic-reader__paper-header">
            <div class="academic-reader__paper-super">
              <span>{{ book.title }} · {{ book.author }} ({{ book.publisher }} {{ book.publishedYear }})</span>
            </div>
            <h1 class="academic-reader__paper-title">{{ currentChapter.title }}</h1>
          </header>

          <!-- 章节主体小节渲染 -->
          <section
            v-for="section in currentChapter.sections"
            :id="section.id"
            :key="section.id"
            class="academic-reader__paper-section"
          >
            <h2 class="academic-reader__section-title">{{ section.title }}</h2>

            <p
              v-for="(p, pIdx) in section.content"
              :key="pIdx"
              class="academic-reader__paragraph"
            >
              {{ p }}
            </p>

            <!-- 还原学术表格 (如 Table 1.1 / Table 1.2) -->
            <div v-if="section.table" class="academic-reader__table-card">
              <div class="academic-reader__table-caption">{{ section.table.title }}</div>
              <table class="academic-reader__table">
                <thead>
                  <tr>
                    <th v-for="h in section.table.headers" :key="h">{{ h }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, rIdx) in section.table.rows" :key="rIdx">
                    <td v-for="(col, cIdx) in row" :key="cIdx">{{ col }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <!-- 纸张底部页脚 -->
          <footer class="academic-reader__paper-footer tabular-nums">
            <span>ISBN {{ book.isbn }}</span>
            <span>第 {{ currentChapter.pageNumber }} 页</span>
          </footer>
        </article>

        <!-- 划词即时批注气泡 (Highlight Capsule) -->
        <div
          v-if="bubbleVisible"
          class="academic-reader__selection-bubble"
          :style="{ left: `${bubblePos.x}px`, top: `${bubblePos.y}px` }"
        >
          <button
            type="button"
            class="academic-reader__bubble-btn text-amber-500"
            title="黄色高亮"
            @click="addHighlight('yellow')"
          >● 黄色</button>
          <button
            type="button"
            class="academic-reader__bubble-btn text-emerald-500"
            title="绿色高亮"
            @click="addHighlight('green')"
          >● 绿色</button>
          <button
            type="button"
            class="academic-reader__bubble-btn text-sky-500"
            title="下划线"
            @click="addHighlight('underline')"
          >下划线</button>
          <span class="academic-reader__bubble-divider" />
          <button
            type="button"
            class="academic-reader__bubble-btn"
            title="写想法"
            @click="openThoughtInput"
          >
            <Edit3 :size="13" aria-hidden="true" />
            <span>想法</span>
          </button>
          <button
            type="button"
            class="academic-reader__bubble-btn"
            title="复制所选文字"
            @click="copySelectedText"
          >复制</button>
        </div>
      </main>
    </div>

    <!-- 3. 底部精简轻量进度条 -->
    <footer class="academic-reader__footer tabular-nums">
      <div class="academic-reader__footer-left">
        <span class="font-medium">{{ currentChapter.title }}</span>
      </div>

      <div class="academic-reader__footer-center">
        <span class="text-xs text-muted">{{ Math.round(((currentChapterIndex + 1) / book.chapters.length) * 100) }}%</span>
        <input
          type="range"
          min="0"
          :max="book.chapters.length - 1"
          :value="currentChapterIndex"
          class="academic-reader__progress-slider"
          @input="onSliderChange"
        />
        <span class="text-xs text-muted">{{ currentChapterIndex + 1 }}/{{ book.chapters.length }} 节</span>
      </div>

      <div class="academic-reader__footer-right">
        <span>快捷键: ←/→ 翻页 · B 书签 · F 全屏</span>
      </div>
    </footer>

    <!-- 想法输入模态抽屉 -->
    <div v-if="thoughtModalOpen" class="academic-reader__modal-backdrop" @click.self="thoughtModalOpen = false">
      <div class="academic-reader__thought-modal">
        <div class="academic-reader__thought-header">
          <strong>记录我的阅读想法</strong>
          <button type="button" @click="thoughtModalOpen = false">✕</button>
        </div>
        <blockquote class="academic-reader__thought-quote">
          “{{ selectedText }}”
        </blockquote>
        <textarea
          v-model="newThoughtText"
          rows="4"
          placeholder="在此输入你的批注或学术思考..."
          class="academic-reader__thought-textarea"
        />
        <div class="academic-reader__thought-actions">
          <button type="button" class="academic-reader__btn" @click="thoughtModalOpen = false">取消</button>
          <button type="button" class="academic-reader__btn academic-reader__btn--primary" @click="saveThought">
            保存笔记
          </button>
        </div>
      </div>
    </div>

    <!-- 提示消息 Toast -->
    <div v-if="toastMessage" class="academic-reader__toast">
      {{ toastMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import {
  ArrowLeft,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Edit3,
  List,
  Maximize,
} from 'lucide-vue-next'
import { analyzingQuantitativeDataBook } from '@/data/sampleBooks/analyzingQuantitativeData'
import './bookAcademicReader.css'

const book = analyzingQuantitativeDataBook

const currentTheme = ref<'paper-white' | 'paper-warm' | 'paper-gray' | 'paper-night'>('paper-white')
const currentFontFamily = ref<'serif' | 'sans' | 'kaiti'>('serif')
const fontSize = ref(17)
const sidebarOpen = ref(true)
const settingsOpen = ref(false)
const activeSidebarTab = ref<'toc' | 'bookmarks' | 'annotations'>('toc')
const activeTocHref = ref('#intro')

const currentChapterIndex = ref(0)
const currentChapter = computed(() => book.chapters[currentChapterIndex.value] || book.chapters[0])
const currentChapterTitle = computed(() => currentChapter.value.title)

// 选区与划线气泡
const bubbleVisible = ref(false)
const bubblePos = ref({ x: 0, y: 0 })
const selectedText = ref('')
const thoughtModalOpen = ref(false)
const newThoughtText = ref('')

// 书签与笔记持久状态
interface BookmarkRecord {
  id: string
  chapterId: string
  title: string
  excerpt: string
  page: number
}
interface AnnotationRecord {
  id: string
  text: string
  color: 'yellow' | 'green' | 'underline'
  note?: string
  chapterId: string
  createdAt: string
}

const bookmarks = ref<BookmarkRecord[]>([
  {
    id: 'b1',
    chapterId: 'intro',
    title: 'Introduction: Why was it Written?',
    excerpt: 'The challenge that I was given, and which got me hooked, was to be iconoclastic...',
    page: 1,
  },
])

const annotations = ref<AnnotationRecord[]>([
  {
    id: 'a1',
    text: 'This is not a book on statistics, although it covers an array of statistical procedures.',
    color: 'yellow',
    note: '明确区分了数据分析方法（Data Analysis）与纯统计学（Statistics）的目标差异。',
    chapterId: 'intro',
    createdAt: '2026-10-21 19:40',
  },
  {
    id: 'a2',
    text: 'Nominal-level measurement classifies objects into homogeneous, mutually exclusive and exhaustive categories.',
    color: 'green',
    note: '定类测量（Nominal）的三大数学公理：齐次性、互斥性与穷尽性。',
    chapterId: 'ch1',
    createdAt: '2026-10-21 19:42',
  },
])

const isCurrentPageBookmarked = computed(() => {
  return bookmarks.value.some(b => b.chapterId === currentChapter.value.id)
})

const toastMessage = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined
function showToast(msg: string) {
  toastMessage.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastMessage.value = ''
  }, 2000)
}

function prevChapter() {
  if (currentChapterIndex.value > 0) {
    currentChapterIndex.value--
    scrollToTop()
  }
}
function nextChapter() {
  if (currentChapterIndex.value < book.chapters.length - 1) {
    currentChapterIndex.value++
    scrollToTop()
  }
}
function onSliderChange(e: Event) {
  const val = Number((e.target as HTMLInputElement).value)
  currentChapterIndex.value = val
  scrollToTop()
}

function scrollToTop() {
  const viewport = document.querySelector('.academic-reader__main-viewport')
  if (viewport) viewport.scrollTop = 0
}

function changeFontSize(delta: number) {
  fontSize.value = Math.max(14, Math.min(24, fontSize.value + delta))
}

function toggleBookmark() {
  if (isCurrentPageBookmarked.value) {
    bookmarks.value = bookmarks.value.filter(b => b.chapterId !== currentChapter.value.id)
    showToast('已移除当前书签')
  } else {
    bookmarks.value.push({
      id: `b-${Date.now()}`,
      chapterId: currentChapter.value.id,
      title: currentChapter.value.title,
      excerpt: currentChapter.value.sections[0]?.content[0]?.slice(0, 50) + '...',
      page: currentChapter.value.pageNumber,
    })
    showToast('已添加书签 🔖')
  }
}

function removeBookmark(id: string) {
  bookmarks.value = bookmarks.value.filter(b => b.id !== id)
}

function jumpToChapterId(id: string) {
  const idx = book.chapters.findIndex(c => c.id === id)
  if (idx !== -1) {
    currentChapterIndex.value = idx
    scrollToTop()
  }
}

function jumpToToc(href: string) {
  activeTocHref.value = href
  const targetId = href.replace('#', '')
  // 如果是第二章第一节
  if (targetId.startsWith('ch1')) {
    currentChapterIndex.value = 1
  } else {
    currentChapterIndex.value = 0
  }
  setTimeout(() => {
    const el = document.getElementById(targetId)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }, 100)
}

function handleTextSelection() {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || !sel.toString().trim()) {
    bubbleVisible.value = false
    return
  }
  const text = sel.toString().trim()
  if (text.length < 2) {
    bubbleVisible.value = false
    return
  }
  selectedText.value = text

  const range = sel.getRangeAt(0)
  const rect = range.getBoundingClientRect()
  bubblePos.value = {
    x: rect.left + rect.width / 2,
    y: rect.top - 8,
  }
  bubbleVisible.value = true
}

function addHighlight(color: 'yellow' | 'green' | 'underline') {
  annotations.value.unshift({
    id: `ann-${Date.now()}`,
    text: selectedText.value,
    color,
    chapterId: currentChapter.value.id,
    createdAt: new Date().toLocaleDateString(),
  })
  bubbleVisible.value = false
  window.getSelection()?.removeAllRanges()
  showToast('已添加划线标记')
  activeSidebarTab.value = 'annotations'
}

function openThoughtInput() {
  bubbleVisible.value = false
  newThoughtText.value = ''
  thoughtModalOpen.value = true
}

function saveThought() {
  if (!newThoughtText.value.trim()) return
  annotations.value.unshift({
    id: `ann-${Date.now()}`,
    text: selectedText.value,
    color: 'yellow',
    note: newThoughtText.value.trim(),
    chapterId: currentChapter.value.id,
    createdAt: new Date().toLocaleDateString(),
  })
  thoughtModalOpen.value = false
  window.getSelection()?.removeAllRanges()
  showToast('想法笔记已存入侧栏')
  activeSidebarTab.value = 'annotations'
}

function copySelectedText() {
  void navigator.clipboard.writeText(selectedText.value)
  bubbleVisible.value = false
  window.getSelection()?.removeAllRanges()
  showToast('已复制所选文字')
}

function deleteAnnotation(id: string) {
  annotations.value = annotations.value.filter(a => a.id !== id)
}

function exportAnnotationsMarkdown() {
  const content = `# 《${book.title}》阅读划线与笔记\n作者：${book.author}\n\n` +
    annotations.value.map(a => `> “${a.text}”\n${a.note ? `\n💬 想法：${a.note}\n` : ''}`).join('\n---\n\n')
  
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${book.title}-Notes.md`
  a.click()
  URL.revokeObjectURL(url)
  showToast('笔记已导出为 Markdown 文件')
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    void document.documentElement.requestFullscreen().catch(() => {})
  } else {
    void document.exitFullscreen().catch(() => {})
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (['input', 'textarea'].includes((e.target as HTMLElement)?.tagName.toLowerCase())) return
  if (e.key === 'ArrowLeft') prevChapter()
  else if (e.key === 'ArrowRight') nextChapter()
  else if (e.key === 'b' || e.key === 'B') toggleBookmark()
  else if (e.key === 'f' || e.key === 'F') toggleFullscreen()
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>
