<template>
  <section class="highlight-trash" aria-label="划线回收站">
    <header class="highlight-trash__header"><h2>已删除的划线与批注</h2><p>保留 30 天，恢复后回到原电子书与阅读位置；永久销毁不可撤销。</p></header>
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-if="notice" role="status">{{ notice }}</p>
    <p v-if="loading" role="status">正在读取划线回收站…</p>
    <p v-else-if="!items.length">没有待恢复的划线。</p>
    <ul v-else class="highlight-trash__list"><li v-for="item in items" :key="item.id">
      <strong>{{ item.work_title||'未命名作品' }}</strong>
      <blockquote>{{ item.quote }}</blockquote>
      <p v-if="item.note" class="highlight-trash__comment">{{ item.note }}</p>
      <small>恢复截止：{{ formatDate(item.restore_until) }}</small>
      <div class="highlight-trash__actions">
        <PButton size="sm" variant="secondary" :disabled="busy" @click="restore(item)">恢复划线</PButton>
        <PButton size="sm" variant="ghost" :disabled="busy" @click="eraseCandidate=item">永久销毁</PButton>
      </div>
    </li></ul>
    <PButton v-if="items.length<total" variant="secondary" :disabled="busy||loading" @click="load(true)">加载更多已删除划线</PButton>
    <PConfirm :show="!!eraseCandidate" title="彻底销毁这条划线？" message="将立即擦除已删除的原文、批注和阅读定位，之后无法恢复。若原先选择保留公开快照，销毁私人划线并不会撤销那份公开副本。" confirm-text="确认永久销毁" :danger="true" :loading="busy" @cancel="eraseCandidate=undefined" @confirm="erase" />
  </section>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { listTrashedHighlights, restoreTrashedHighlight, eraseTrashedHighlight, type TrashedBookHighlight } from '@/api/bookMarkTrash'
import PButton from '@/components/ui/PButton.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
const items=ref<TrashedBookHighlight[]>([]),total=ref(0),loading=ref(false),busy=ref(false),error=ref(''),notice=ref('')
const eraseCandidate=ref<TrashedBookHighlight>()
let requestID=0
function formatDate(value:string){const d=new Date(value);return Number.isNaN(d.getTime())?'未知':d.toLocaleDateString('zh-CN')}
async function load(append=false){if(loading.value)return;loading.value=true;error.value='';const request=++requestID;try{const result=await listTrashedHighlights(append?items.value.length:0);if(request!==requestID)return;items.value=append?[...items.value,...result.items]:result.items;total.value=result.total}catch{error.value='回收站加载失败，请重试。'}finally{if(request===requestID)loading.value=false}}
async function restore(item:TrashedBookHighlight){if(busy.value)return;busy.value=true;error.value='';notice.value='';try{await restoreTrashedHighlight(item);notice.value='划线已恢复到原电子书（不会自动重新发布此前撤销的分享）。';await load()}catch{error.value='恢复失败，可能已超过 30 天或被其他设备修改。'}finally{busy.value=false}}
async function erase(){const item=eraseCandidate.value;eraseCandidate.value=undefined;if(!item||busy.value)return;busy.value=true;error.value='';notice.value='';try{await eraseTrashedHighlight(item);notice.value='私人划线及批注已永久销毁。';await load()}catch{error.value='永久销毁失败，请刷新回收站后重试。'}finally{busy.value=false}}
onMounted(()=>void load())
</script>
<style scoped>
.highlight-trash{display:grid;gap:1rem;padding:1rem 0}
.highlight-trash__header h2{font-size:1.05rem;margin:0}
.highlight-trash__header p,.highlight-trash small{font-size:.84rem;color:var(--a-color-text-secondary)}
.highlight-trash__list{list-style:none;padding:0;display:grid;gap:.8rem}
.highlight-trash__list li{border:1px solid var(--a-color-border-soft);border-radius:.65rem;padding:1rem;display:grid;gap:.5rem}
.highlight-trash blockquote{margin:0;border-left:3px solid #cbaa45;padding:.4rem .8rem;white-space:pre-wrap}
.highlight-trash__comment{white-space:pre-wrap;line-height:1.65}
.highlight-trash__actions{display:flex;gap:.65rem;flex-wrap:wrap}
</style>
