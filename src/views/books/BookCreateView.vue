<template>
  <section class="book-catalog">
    <PPageHeader title="添加图书" sub="填写书名和作者即可公开，不需要文件，也不需要人工审核。" />
    <form class="book-catalog__form" @submit.prevent="submit">
      <fieldset :disabled="busy || !!createdId" class="book-catalog__fields">
        <PInput id="create-book-title" v-model="title" label="书名" required :maxlength="200" />
        <PTextarea id="create-book-authors" v-model="authors" label="作者" hint="每行一位作者，请填写已确认的作者信息。" required :rows="3" />
        <PInput id="create-book-subtitle" v-model="subtitle" label="副标题（选填）" />
        <PInput id="create-book-original" v-model="originalTitle" label="原作名（选填）" />
        <PInput id="create-book-language" v-model="language" label="语言代码（选填）" placeholder="例如 zh 或 en" />
        <PTextarea id="create-book-description" v-model="description" label="简介（选填）" />
      </fieldset>
      <label v-if="!createdId"><input v-model="addEdition" type="checkbox" :disabled="busy"> 同时补充出版版本（选填）</label>
      <fieldset v-if="addEdition" :disabled="busy" class="book-catalog__fields">
        <legend>出版版本</legend>
        <PInput id="create-edition-publisher" v-model="publisher" label="出版社（选填）" />
        <PInput id="create-edition-isbn" v-model="isbn" label="ISBN（选填）" />
        <PInput id="create-edition-pages" v-model="pages" label="页数（选填）" type="number" min="1" step="1" />
        <PInput id="create-edition-cover" v-model="cover" label="封面图片地址（选填）" type="url" />
      </fieldset>
      <p v-if="error" class="book-catalog__error" role="alert">{{ error }}</p>
      <p v-if="createdId" role="status">图书已公开。出版版本尚未保存，可重试，或先进入图书详情。</p>
      <div class="book-catalog__actions">
        <PButton type="submit" :loading="busy" :disabled="!canSubmit">{{ createdId ? '重试保存出版版本' : '创建并公开' }}</PButton>
        <PButton v-if="createdId" variant="secondary" :disabled="busy" @click="openCreated">进入已创建图书</PButton>
      </div>
    </form>
    <PConfirm :show="leaveOpen" title="离开创建" message="还有未提交的信息，确定离开吗？" @confirm="resolveLeave(true)" @cancel="resolveLeave(false)" />
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { createCatalogEdition, createCatalogWork } from '@/api/bookCatalog'
import PButton from '@/components/ui/PButton.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import PInput from '@/components/ui/PInput.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import './bookCatalog.css'

const router = useRouter()
const route = useRoute()
const title = ref('')
const authors = ref('')
const subtitle = ref('')
const originalTitle = ref('')
const language = ref('')
const description = ref('')
const addEdition = ref(false)
const publisher = ref('')
const isbn = ref('')
const pages = ref('')
const cover = ref('')
const busy = ref(false)
const error = ref('')
const createdId = ref('')
const finished = ref(false)
const leaveOpen = ref(false)
let leaveResolve: ((leave: boolean) => void) | undefined
const authorNames = computed(() => [...new Set(authors.value.split('\n').map(name => name.trim()).filter(Boolean))])
const canSubmit = computed(() => !!title.value.trim() && authorNames.value.length > 0)
const dirty = computed(() => !finished.value && [title.value, authors.value, subtitle.value, originalTitle.value, language.value, description.value, publisher.value, isbn.value, pages.value, cover.value].some(value => !!value.trim()))

async function submit() {
  if (busy.value || !canSubmit.value) return
  const normalizedISBN = isbn.value.replace(/[\s-]/g, '')
  if (addEdition.value && normalizedISBN && !/^(\d{9}[\dXx]|\d{13})$/.test(normalizedISBN)) { error.value = 'ISBN 请输入 10 位或 13 位编号。'; return }
  if (addEdition.value && pages.value && (!Number.isInteger(Number(pages.value)) || Number(pages.value) < 1)) { error.value = '页数请输入正整数。'; return }
  busy.value = true
  error.value = ''
  try {
    // 出版版本失败时保留作品 ID，重试不重复创建作品或作者。
    if (!createdId.value) {
      const work = await createCatalogWork({ title: title.value.trim(), authors: authorNames.value, subtitle: subtitle.value.trim(), original_title: originalTitle.value.trim(), language: language.value.trim(), description: description.value.trim() })
      if (!work.id) throw new Error('创建响应缺少作品 ID')
      createdId.value = work.id
    }
    if (addEdition.value) await createCatalogEdition(createdId.value, { publisher: publisher.value.trim(), isbn10: normalizedISBN.length === 10 ? normalizedISBN : '', isbn13: normalizedISBN.length === 13 ? normalizedISBN : '', page_count: pages.value ? Number(pages.value) : 0, cover_url: cover.value.trim(), language: language.value.trim() })
    await openCreated()
  } catch { error.value = createdId.value ? '图书已创建，出版版本保存失败。请重试，不会重复创建图书。' : '创建结果未确认。请先在发现页查找，确认没有这本书后再重试。' }
  finally { busy.value = false }
}
async function openCreated() {
  if (!createdId.value) return
  finished.value = true
  busy.value = false
  await router.replace({ path: `/books/work/${createdId.value}`, query: route.query })
}
function resolveLeave(leave: boolean) { leaveOpen.value = false; leaveResolve?.(leave); leaveResolve = undefined }
onBeforeRouteLeave(() => {
  if (busy.value) return false
  if (!dirty.value) return true
  leaveOpen.value = true
  return new Promise<boolean>(resolve => { leaveResolve = resolve })
})
function beforeUnload(event: BeforeUnloadEvent) { if (dirty.value || busy.value) { event.preventDefault(); event.returnValue = '' } }
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => { window.removeEventListener('beforeunload', beforeUnload); leaveResolve?.(false) })
</script>
