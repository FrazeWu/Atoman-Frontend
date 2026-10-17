<template>
  <div>
    <PButton variant="ghost" @click="browse">本版本的段落讨论</PButton>
    <p v-if="error" role="alert">{{ error }}</p>
    <PSheet :show="opened" title="段落讨论" mode="partial" teleport-mobile @close="opened = false">
      <section class="private-books private-books__editor">
        <p>讨论绑定当前文件版本。私人批注不会自动公开；在下方主动发表的评论将公开。</p>
        <PButton v-if="selected" variant="ghost" @click="selected = null">返回段落列表</PButton>
        <CommentSection v-if="selected" :key="selected.id" :target="{ kind: 'book_passage', resourceId: selected.id }" noun="讨论" />
        <template v-else><p v-if="!items.length">本版本还没有段落讨论。选中文字后，可在批注面板中发起公开讨论。</p><ul class="book-catalog__list"><li v-for="(item, index) in items" :key="item.id" class="book-catalog__row"><span>{{ anchorLabel(item, index) }}</span><PButton variant="secondary" @click="selected = item">查看讨论</PButton></li></ul><PButton v-if="items.length < total" variant="secondary" :disabled="busy" @click="load(true)">更多段落</PButton></template>
      </section>
    </PSheet>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { createPassage, listPassages, type BookPassage } from '@/api/bookCommunity'
import type { ReadingAnchor } from '@/api/bookReading'
import PButton from '@/components/ui/PButton.vue'
import PSheet from '@/components/ui/PSheet.vue'
import CommentSection from '@/components/comment/CommentSection.vue'
import '@/views/books/bookPrivate.css'
import '@/views/books/bookCatalog.css'
const props = defineProps<{ revisionId: string }>()
const opened = ref(false), selected = ref<BookPassage | null>(null), items = ref<BookPassage[]>([]), total = ref(0), busy = ref(false), error = ref('')
async function load(append = false) { busy.value = true; error.value = ''; try { const page = await listPassages(props.revisionId, append ? items.value.length : 0); items.value = append ? [...items.value, ...page.items] : page.items; total.value = page.total } catch { error.value = '段落讨论加载失败，请重试。' } finally { busy.value = false } }
async function browse() { selected.value = null; opened.value = true; await load() }
async function discuss(anchor: ReadingAnchor) { if (busy.value) return; busy.value = true; try { selected.value = await createPassage(props.revisionId, anchor); opened.value = true; error.value = '' } catch { error.value = '无法发起段落讨论，请检查文件状态并重试。' } finally { busy.value = false } }
function anchorLabel(item: BookPassage, index: number) { const anchor = item.anchor; return anchor.pdf_page ? `第 ${anchor.pdf_page} 页的段落` : anchor.txt_offset_start !== undefined ? `正文字符 ${anchor.txt_offset_start}–${anchor.txt_offset_end}` : `EPUB 段落 ${index + 1}` }
defineExpose({ discuss })
</script>
