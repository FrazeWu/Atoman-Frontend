<template>
  <section class="public-notes a-content-frame" aria-label="公开读书笔记">
    <PPageHeader title="公开读书笔记" sub="只有作者选择“完全公开”的笔记快照才会出现在这里，链接分享不会被列出。" />
    <p v-if="loading" role="status">正在加载…</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-if="!loading&&!error&&!items.length">暂时没有公开笔记合集。</p>
    <ol class="public-notes__list"><li v-for="item in items" :key="item.share_path">
      <article><h2><RouterLink :to="item.share_path">{{ item.title }}</RouterLink></h2>
        <p v-if="item.description">{{ item.description }}</p><small>{{ item.note_count }} 条笔记 · {{ new Date(item.published_at).toLocaleDateString('zh-CN') }}</small>
      </article>
    </li></ol>
    <PButton v-if="items.length<total" variant="secondary" :disabled="loading" @click="load">加载更多</PButton>
  </section>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import PButton from '@/components/ui/PButton.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import { listPublicNoteShares, type PublicNoteShareCard } from '@/api/bookNoteCollections'
const items=ref<PublicNoteShareCard[]>([]),total=ref(0),loading=ref(false),error=ref('')
async function load(){loading.value=true;error.value='';try{const result=await listPublicNoteShares(items.value.length);items.value.push(...result.items);total.value=result.total}catch{error.value='公开笔记加载失败。'}finally{loading.value=false}}
onMounted(()=>void load())
</script>
<style scoped>
.public-notes{max-width:56rem;margin-inline:auto;padding:1.5rem;display:grid;gap:1.2rem}
.public-notes__list{list-style:none;padding:0;display:grid;gap:1rem}
.public-notes__list li{border:1px solid var(--a-color-border-soft);border-radius:.7rem;padding:1rem}
.public-notes__list h2{font-size:1.06rem;margin:0}
.public-notes__list p{line-height:1.5}
.public-notes__list small{color:var(--a-color-text-secondary)}
</style>
