<template>
  <section class="private-books">
    <h2>划线与批注</h2>
    <form class="private-books__toolbar" @submit.prevent="load()"><label>搜索原文、批注或书名<input v-model="query" type="search" /></label><label>颜色<select v-model="color"><option value="">全部颜色</option><option value="yellow">黄色</option><option value="green">绿色</option><option value="blue">蓝色</option><option value="pink">粉色</option></select></label><PButton type="submit" variant="secondary">搜索划线</PButton><PButton type="button" variant="secondary" :disabled="busy" @click="exportMarks">导出筛选结果</PButton></form>
    <p v-if="error" role="alert">{{ error }}</p><p v-if="loading" role="status">正在加载划线…</p>
    <p v-else-if="!items.length">暂无划线，可以在阅读器中选中文字保存。</p>
    <article v-for="item in items" :key="item.id" class="book-catalog__row"><strong>{{ item.work_title }}</strong><blockquote class="private-books__body">{{ item.quote }}</blockquote><p class="private-books__body">{{ item.note }}</p><div class="private-books__toolbar"><RouterLink :to="{ path: resourceReaderPath(item.work_id, item.asset_id, item.revision_id), query: { mark: item.id } }">定位原文</RouterLink><PButton variant="secondary" @click="edit(item)">编辑批注</PButton></div></article>
    <PButton v-if="items.length < total" variant="secondary" :disabled="loading" @click="load(true)">更多划线</PButton>
    <BookHighlightEditor v-if="draft" :key="draft.id" ref="editor" :draft="draft" :busy="busy" :frozen="false" :conflict="conflict" :error="editError" @close="draft = null" @save="save" @delete="remove" />
  </section>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, onBeforeRouteLeave } from 'vue-router'
import { ApiErrorResponseError } from '@/api/client'
import { privateBookRequest, downloadBookData } from '@/api/bookPrivate'
import { saveReadingMark, deleteReadingMark, type ReadingMark } from '@/api/bookReading'
import { resourceReaderPath } from '@/api/bookResources'
import PButton from '@/components/ui/PButton.vue'
import BookHighlightEditor from './BookHighlightEditor.vue'
interface Item extends ReadingMark { work_id: string; asset_id: string; work_title: string }
const items = ref<Item[]>([]), total = ref(0), query = ref(''), color = ref(''), error = ref(''), editError = ref(''), loading = ref(false), busy = ref(false), conflict = ref(false), draft = ref<Item | null>(null)
let sequence = 0
function edit(item: Item) { conflict.value = false; editError.value = ''; draft.value = item }
const editor = ref<InstanceType<typeof BookHighlightEditor>>()
onBeforeRouteLeave(() => editor.value?.requestClose() ?? true)
async function page(offset = 0) { return privateBookRequest<{ items: Item[]; total: number }>(`/me/reading-marks?limit=50&offset=${offset}&q=${encodeURIComponent(query.value)}&color=${encodeURIComponent(color.value)}`) }
async function load(append = false) { const current = ++sequence; loading.value = true; error.value = ''; try { const result = await page(append ? items.value.length : 0); if (current !== sequence) return; items.value = append ? [...items.value, ...result.items] : result.items; total.value = result.total } catch { error.value = '划线加载失败，请重试。' } finally { if (current === sequence) loading.value = false } }
async function save(value: { color: string; style: string; note: string }) { if (!draft.value || busy.value) return; const item = draft.value; busy.value = true; editError.value = ''; try { await saveReadingMark(item.revision_id, item.id, { base_version: item.version, kind: item.kind, anchor: item.anchor, label: item.label, quote: item.quote, ...value }); draft.value = null; await load() } catch (err) { conflict.value = err instanceof ApiErrorResponseError && err.status === 409; editError.value = '保存失败，输入仍保留；云端冲突时请关闭并重新搜索后编辑。' } finally { busy.value = false } }
async function remove() { if (!draft.value || busy.value) return; busy.value = true; try { await deleteReadingMark(draft.value.revision_id, draft.value.id, draft.value.version); draft.value = null; await load() } catch { editError.value = '删除失败，请重新加载后重试。' } finally { busy.value = false } }
async function exportMarks() { busy.value = true; try { const all: Item[] = []; do { const result = await page(all.length); all.push(...result.items); if (all.length >= result.total || !result.items.length) break } while (true); downloadBookData(all.map(item => `## ${item.work_title}\n\n> ${item.quote.replaceAll('\n', '\n> ')}\n\n${item.note}\n`).join('\n'), 'atoman-highlights.md') } catch { error.value = '划线导出失败。' } finally { busy.value = false } }
onMounted(load)
</script>
