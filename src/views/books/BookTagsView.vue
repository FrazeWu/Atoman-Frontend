<template>
  <section class="book-catalog book-tags-view">
    <PPageHeader title="书库标签与分类" sub="按学科体系、思想流派与文献主题索引全部收录作品。" />

    <!-- 顶部快速检索标签 -->
    <div class="book-tags__filter-box">
      <PInput
        id="tag-search"
        v-model="searchQuery"
        label="搜索标签"
        placeholder="搜索领域、流派或主题标签..."
      />
    </div>

    <!-- 1. 核心学科领域分类 -->
    <div class="book-tags__section">
      <h2 class="book-tags__section-title">学科与领域</h2>
      <div class="book-tags__grid">
        <button
          v-for="cat in filteredCategories"
          :key="cat.name"
          class="book-tags__category-card"
          @click="selectTag(cat.name)"
        >
          <div class="book-tags__category-header">
            <span class="book-tags__category-name">{{ cat.name }}</span>
            <span class="book-tags__category-count">{{ cat.count }} 本</span>
          </div>
          <p class="book-tags__category-desc">{{ cat.desc }}</p>
        </button>
      </div>
    </div>

    <!-- 2. 精细流派与主题标签 -->
    <div class="book-tags__section">
      <h2 class="book-tags__section-title">精选流派与时代</h2>
      <div class="book-tags__chips">
        <button
          v-for="tag in filteredTags"
          :key="tag.name"
          class="book-tags__chip"
          @click="selectTag(tag.name)"
        >
          <span class="book-tags__chip-prefix">#</span>
          <span class="book-tags__chip-name">{{ tag.name }}</span>
          <span class="book-tags__chip-count">{{ tag.count }}</span>
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PInput from '@/components/ui/PInput.vue'
import './bookCatalog.css'

const router = useRouter()
const searchQuery = ref('')

const categories = [
  { name: '哲学与思想', count: 34, desc: '形而上学、认识论、伦理学与先哲经典思辨' },
  { name: '历史与文明', count: 26, desc: '全球通史、国别兴衰、宏观历史学与文明考古' },
  { name: '文学经典', count: 42, desc: '诗歌、戏剧、长篇小说与世界文学名著' },
  { name: '科学与技术', count: 18, desc: '自然科学基石、计算机体系结构与数学原理' },
  { name: '社会与制度', count: 12, desc: '社会学田野调查、政治哲学、法学与制度演变' },
  { name: '艺术与美学', count: 9, desc: '建筑学、造型艺术史、音乐文献与美学原理' },
]

const popularTags = [
  { name: '斯多葛哲学', count: 6 },
  { name: '古希腊先哲', count: 12 },
  { name: '宏观历史学', count: 5 },
  { name: '硬科幻', count: 8 },
  { name: '先秦诸子', count: 14 },
  { name: '汉译世界学术名著', count: 22 },
  { name: '存在主义', count: 7 },
  { name: '启蒙运动', count: 9 },
  { name: '算法导论', count: 4 },
  { name: '近现代思潮', count: 11 },
  { name: '诗学与修辞', count: 5 },
  { name: '罗马史', count: 6 },
]

const filteredCategories = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return categories
  return categories.filter(c => c.name.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q))
})

const filteredTags = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return popularTags
  return popularTags.filter(t => t.name.toLowerCase().includes(q))
})

function selectTag(tagName: string) {
  void router.push({ path: '/books', query: { q: tagName } })
}
</script>
