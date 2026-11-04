<template>
  <section class="note-collections a-content-frame" aria-label="笔记合集">
    <PPageHeader title="我的笔记合集" sub="整理私人笔记后主动发布快照。默认私有，已发布内容不会随草稿编辑自动变化。" />
    <nav class="note-collections__nav">
      <RouterLink :to="`/books/work/${workId}/notes`">返回作品笔记</RouterLink>
      <RouterLink :to="`/books/work/${workId}`">作品详情</RouterLink>
      <RouterLink to="/books/shared-notes">浏览完全公开的笔记</RouterLink>
    </nav>
    <PButton :to="`/books/work/${workId}/collections/new`">创建笔记合集</PButton>
    <p v-if="loading" role="status">正在读取合集…</p>
    <div v-else-if="error" role="alert">{{ error }} <PButton variant="ghost" @click="load">重试</PButton></div>
    <p v-else-if="!collections.length">尚未创建合集。可以从同一作品的不同电子书版本挑选多条笔记。</p>
    <ul v-else class="note-collections__list">
      <li v-for="item in collections" :key="item.id" class="note-collections__card">
        <div>
          <h2>{{ item.title }}</h2>
          <p v-if="item.description">{{ item.description }}</p>
          <p class="note-collections__meta">{{ item.items.length }} 条记录 · {{ visibilityLabel(item.visibility) }} · 已发布 {{ item.published_version }} 版</p>
        </div>
        <div class="note-collections__actions">
          <RouterLink :to="`/books/work/${workId}/collections/${item.id}`">编辑与分享</RouterLink>
          <RouterLink v-if="item.share_path" :to="item.share_path">查看分享</RouterLink>
        </div>
      </li>
    </ul>
  </section>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import PButton from '@/components/ui/PButton.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import { listNoteCollections, type NoteCollection } from '@/api/bookNoteCollections'
const route=useRoute()
const workId=computed(()=>String(route.params.workId||''))
const collections=ref<NoteCollection[]>([])
const loading=ref(false)
const error=ref('')
function visibilityLabel(visibility:string){return ({private:'私有草稿',link:'通过链接访问',public:'完全公开'} as Record<string,string>)[visibility]||'未知状态'}
async function load(){loading.value=true;error.value='';try{collections.value=(await listNoteCollections(workId.value)).items}catch{error.value='合集加载失败，请重试。'}finally{loading.value=false}}
onMounted(()=>void load())
</script>
<style scoped>
.note-collections{max-width:58rem;margin-inline:auto;display:grid;gap:1rem;padding:1.25rem 1.5rem 3rem}
.note-collections__nav,.note-collections__actions{display:flex;gap:1rem;flex-wrap:wrap;font-size:.9rem}
.note-collections__list{list-style:none;padding:0;margin:0;display:grid;gap:.9rem}
.note-collections__card{border:1px solid var(--a-color-border-soft);border-radius:.7rem;padding:1rem;display:flex;justify-content:space-between;gap:1rem;align-items:center}
.note-collections__card h2{font-size:1.05rem;margin:0}
.note-collections__card p{margin:.35rem 0}
.note-collections__meta{font-size:.8rem;color:var(--a-color-text-secondary)}
</style>
