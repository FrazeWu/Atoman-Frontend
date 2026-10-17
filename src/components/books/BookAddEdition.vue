<template>
  <div>
    <PButton variant="secondary" @click="opened = true">添加出版版本</PButton>
    <PSheet :show="opened" title="添加出版版本" mode="full" teleport-mobile @close="close">
      <form class="private-books private-books__editor" @submit.prevent="save">
        <p>出版版本只保存书目资料，不绑定或替换电子书文件。保存后直接公开。</p>
        <label>版本名称<input v-model="title" :readonly="busy" /></label>
        <label>出版社<input v-model="publisher" :readonly="busy" /></label>
        <label>ISBN（可选）<input v-model="isbn" :readonly="busy" /></label>
        <label>语言代码<input v-model="language" :readonly="busy" placeholder="例如 zh 或 en" /></label>
        <label>页数<input v-model="pages" type="number" min="0" step="1" :readonly="busy" /></label>
        <p v-if="error" role="alert">{{ error }}</p>
        <PButton type="submit" :disabled="busy">{{ busy ? '正在保存…' : '保存并公开版本' }}</PButton>
      </form>
      <PConfirm :show="confirmClose" title="放弃未保存的版本？" message="当前出版资料尚未保存。" @confirm="finishClose(true)" @cancel="finishClose(false)" />
    </PSheet>
  </div>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { createCatalogEdition } from '@/api/bookCatalog'
import PButton from '@/components/ui/PButton.vue'
import PSheet from '@/components/ui/PSheet.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
const props = defineProps<{ workId: string }>()
const emit = defineEmits<{ saved: [] }>()
const opened = ref(false), busy = ref(false), title = ref(''), publisher = ref(''), isbn = ref(''), language = ref(''), pages = ref(''), error = ref(''), confirmClose = ref(false)
const dirty = computed(() => [title, publisher, isbn, language, pages].some(field => !!field.value.trim()))
let closeResolve: ((value: boolean) => void) | undefined
async function save() { if (busy.value) return; const normalized = isbn.value.replace(/[\s-]/g, ''); if (normalized && !/^(\d{9}[\dXx]|\d{13})$/.test(normalized)) { error.value = 'ISBN 请输入 10 位或 13 位编号。'; return }; busy.value = true; error.value = ''; try { await createCatalogEdition(props.workId, { title: title.value, publisher: publisher.value, language: language.value, page_count: Number(pages.value || 0), ...(normalized.length === 13 ? { isbn13: normalized } : { isbn10: normalized }) }); opened.value = false; title.value = publisher.value = isbn.value = language.value = pages.value = ''; emit('saved') } catch { error.value = '版本保存未确认，请检查图书详情后重试，输入仍保留。' } finally { busy.value = false } }
function close(): Promise<boolean> { if (busy.value) return Promise.resolve(false); if (!dirty.value) { opened.value = false; return Promise.resolve(true) }; confirmClose.value = true; return new Promise(resolve => { closeResolve = resolve }) }
function finishClose(value: boolean) { confirmClose.value = false; if (value) { opened.value = false; title.value = publisher.value = isbn.value = language.value = pages.value = '' }; closeResolve?.(value); closeResolve = undefined }
function beforeUnload(event: BeforeUnloadEvent) { if (opened.value && (dirty.value || busy.value)) { event.preventDefault(); event.returnValue = '' } }
window.addEventListener('beforeunload', beforeUnload)
onBeforeRouteLeave(() => opened.value ? close() : true)
onBeforeUnmount(() => { closeResolve?.(false); window.removeEventListener('beforeunload', beforeUnload) })
</script>
