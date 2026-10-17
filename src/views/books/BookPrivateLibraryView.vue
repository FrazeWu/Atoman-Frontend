<template>
  <section class="book-catalog private-books">
    <PPageHeader title="我的书架" sub="阅读状态和标签仅本人可见，电子书文件仍公开" />
    <p v-if="error" role="alert">{{ error }} <PButton variant="ghost" @click="load">重新加载</PButton></p>
    <p v-if="loading" role="status">正在加载书架…</p>
    <template v-else>
      <section v-if="stats" aria-label="阅读统计">
        <h2>最近 30 天</h2><p>有效阅读 {{ Math.floor(stats.total_seconds / 60) }} 分钟 · {{ stats.days.filter(day => day.seconds > 0).length }} 天</p>
        <details><summary>阅读日历（{{ stats.timezone }}）</summary><ul class="private-books__calendar"><li v-for="day in stats.days" :key="day.day">{{ day.day }}：{{ Math.floor(day.seconds / 60) }} 分钟</li></ul></details>
      </section>
      <div class="private-books__toolbar">
        <label>搜索书名<input v-model="query" type="search" /></label>
        <label>阅读状态<select v-model="status"><option value="">全部</option><option v-for="item in shelfStatuses" :key="item.value" :value="item.value">{{ item.label }}</option></select></label>
        <label>私人标签<input v-model="tag" /></label>
        <PButton to="/books">发现图书</PButton>
      </div>
      <p v-if="!filtered.length">暂无符合条件的图书。到发现页打开图书后即可加入书架。</p>
      <ul class="book-catalog__list">
        <li v-for="entry in filtered" :key="entry.id" class="book-catalog__row">
          <RouterLink :to="`/books/work/${entry.work_id}`"><strong>{{ entry.work_title }}</strong></RouterLink>
          <div class="private-books__toolbar">
            <label>阅读状态<select :value="entry.status" :disabled="busy === entry.id" @change="update(entry, ($event.target as HTMLSelectElement).value as ShelfStatus)"><option v-for="item in shelfStatuses" :key="item.value" :value="item.value">{{ item.label }}</option></select></label>
            <label>私人标签（逗号分隔）<input :value="entry.tags.join(', ')" :disabled="busy === entry.id" @change="update(entry, entry.status, ($event.target as HTMLInputElement).value.split(/[,，]/))" /></label>
            <PButton :disabled="!!busy" @click="read(entry)">继续阅读</PButton>
            <PButton variant="ghost" :disabled="!!busy" @click="removing = entry">移出书架</PButton>
          </div>
        </li>
      </ul>
      <PButton v-if="entries.length < total" variant="secondary" :disabled="!!busy" @click="more">加载更多</PButton>
    </template>
    <PConfirm :show="!!removing" title="移出书架？" message="仅移出书架，阅读进度、文件选择和笔记不会删除。" @confirm="remove" @cancel="removing = null" />
  </section>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import PButton from '@/components/ui/PButton.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import { listLibrary, saveLibrary, removeLibrary, readingRecommendation, readingStatistics, shelfStatuses, type LibraryEntry, type ReadingStatistics, type ShelfStatus } from '@/api/bookPrivate'
import { resourceReaderPath } from '@/api/bookResources'
import './bookCatalog.css'
import './bookPrivate.css'
const router = useRouter()
const entries = ref<LibraryEntry[]>([]), stats = ref<ReadingStatistics | null>(null)
const loading = ref(true), error = ref(''), busy = ref(''), total = ref(0)
const query = ref(''), status = ref(''), tag = ref(''), removing = ref<LibraryEntry | null>(null)
const filtered = computed(() => entries.value.filter(item => (!status.value || item.status === status.value) && item.work_title.toLowerCase().includes(query.value.toLowerCase()) && (!tag.value || item.tags.includes(tag.value.trim().toLowerCase()))))
async function load() { loading.value = true; error.value = ''; try { const page = await listLibrary(); entries.value = page.items; total.value = page.total; stats.value = await readingStatistics() } catch { error.value = '书架或统计加载失败，请重新加载。' } finally { loading.value = false } }
async function more() { try { const page = await listLibrary(entries.value.length); entries.value.push(...page.items); total.value = page.total } catch { error.value = '加载失败，请重试。' } }
async function update(entry: LibraryEntry, value: ShelfStatus, tags = entry.tags) { if (busy.value) return; busy.value = entry.id; error.value = ''; try { Object.assign(entry, await saveLibrary(entry.work_id, value, tags, entry)) } catch { error.value = '保存失败或其他设备已修改。当前云端数据未被覆盖，请重新加载后重试。' } finally { busy.value = '' } }
async function read(entry: LibraryEntry) { busy.value = entry.id; error.value = ''; try { const result = await readingRecommendation(entry.work_id); if (result.available && result.asset && result.revision_id) await router.push(resourceReaderPath(result.work_id, result.asset.id, result.revision_id)); else { error.value = '原文件暂不可读，请在图书详情中选择文件。'; await router.push(`/books/work/${entry.work_id}`) } } catch { error.value = '无法恢复阅读，请重试或打开图书详情。' } finally { busy.value = '' } }
async function remove() { const entry = removing.value; removing.value = null; if (!entry) return; busy.value = entry.id; try { await removeLibrary(entry); entries.value = entries.value.filter(item => item.id !== entry.id); total.value-- } catch { error.value = '移出失败，请重新加载后重试。' } finally { busy.value = '' } }
onMounted(load)
</script>
