<template>
  <PSheet
    :show="show"
    :title="sheetTitle"
    mode="partial"
    partial-width="var(--a-comment-sheet-width)"
    close-type="header"
    @close="emit('close')"
  >
    <form class="book-edit-form" @submit.prevent="submit">
      <p class="book-edit-form__hint">这是 Wiki 协作修改，提交后由其他贡献者审核。</p>
      <PInput v-if="entityType === 'work'" v-model="draft.title" label="书名" required maxlength="500" />
      <PInput v-if="entityType === 'work'" v-model="draft.original_title" label="原名" maxlength="500" />
      <PInput v-if="entityType === 'work'" v-model="draft.subtitle" label="副标题" maxlength="500" />
      <PTextarea v-if="entityType === 'work'" v-model="draft.description" label="简介" :rows="5" maxlength="20000" />

      <PInput v-if="entityType === 'edition'" v-model="draft.title" label="版本名称" maxlength="500" />
      <PInput v-if="entityType === 'edition'" v-model="draft.publisher" label="出版社" maxlength="500" hint="按实际资料填写，不自动翻译。" />
      <PInput v-if="entityType === 'edition'" v-model="draft.isbn10" label="ISBN-10" maxlength="32" />
      <PInput v-if="entityType === 'edition'" v-model="draft.isbn13" label="ISBN-13" maxlength="32" />
      <PInput v-if="entityType === 'edition'" v-model="draft.language" label="语言" maxlength="64" />
      <PInput v-if="entityType === 'edition'" v-model="draft.page_count" label="页数" type="number" min="0" />
      <PInput v-if="entityType === 'edition'" v-model="draft.binding" label="装帧" maxlength="128" />
      <PInput v-if="entityType === 'edition'" v-model="draft.cover_url" label="封面 URL" type="url" maxlength="4096" />
      <PInput v-if="entityType === 'person' || entityType === 'publisher'" v-model="draft.name" :label="entityType === 'person' ? '作者名' : '出版社名'" required maxlength="500" />
      <PInput v-if="entityType === 'person' || entityType === 'publisher'" v-model="draft.sort_name" label="排序名" maxlength="500" />
      <PTextarea v-if="entityType === 'person' || entityType === 'publisher'" v-model="draft.description" label="简介" :rows="4" maxlength="20000" />

      <PInput v-model="sourceURL" label="资料来源 URL" type="url" required maxlength="4096" placeholder="https://" />
      <PTextarea v-model="reason" label="修改原因" required :rows="3" maxlength="2000" placeholder="说明为什么需要这次修改" />
      <p v-if="errorMessage" class="book-edit-form__error" role="alert">{{ errorMessage }}</p>
      <p v-if="message" class="book-edit-form__message" aria-live="polite">{{ message }}</p>
      <footer class="book-edit-form__actions">
        <PButton type="button" variant="ghost" @click="emit('close')">取消</PButton>
        <PButton type="submit" :loading="saving" loading-text="提交中...">提交修改</PButton>
      </footer>
    </form>
  </PSheet>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import PSheet from '@/components/ui/PSheet.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import { submitBookEdit, type BookPublicEdition, type BookPublicPerson, type BookPublicPublisher, type BookPublicWork } from '@/api/books'

const props = defineProps<{
  show: boolean
  entityType: 'work' | 'edition' | 'person' | 'publisher'
  entityId: string
  work?: BookPublicWork | null
  edition?: BookPublicEdition | null
  person?: BookPublicPerson | null
  publisher?: BookPublicPublisher | null
}>()

const emit = defineEmits<{ close: []; submitted: [] }>()
const saving = ref(false)
const errorMessage = ref('')
const message = ref('')
const sourceURL = ref('')
const reason = ref('')
const draft = reactive<Record<string, string>>({
  title: '', original_title: '', subtitle: '', description: '', publisher: '', isbn10: '', isbn13: '', language: '', page_count: '', binding: '', cover_url: '', name: '', sort_name: '',
})

const sheetTitle = computed(() => ({ work: '编辑作品资料', edition: '编辑版本资料', person: '编辑作者资料', publisher: '编辑出版社资料' })[props.entityType])

function reset() {
  const value = props.entityType === 'work' ? props.work : props.edition
  draft.title = value?.title || ''
  draft.original_title = props.work?.original_title || ''
  draft.subtitle = props.work?.subtitle || ''
  draft.description = props.work?.description || ''
  draft.publisher = props.edition?.publisher || ''
  draft.isbn10 = props.edition?.isbn10 || ''
  draft.isbn13 = props.edition?.isbn13 || ''
  draft.language = props.edition?.language || ''
  draft.page_count = props.edition?.page_count ? String(props.edition.page_count) : ''
  draft.binding = props.edition?.binding || ''
  draft.cover_url = props.edition?.cover_url || ''
  draft.name = props.person?.name || props.publisher?.name || ''
  draft.sort_name = ''
  sourceURL.value = ''
  reason.value = ''
  errorMessage.value = ''
  message.value = ''
}

watch(() => props.show, (show) => { if (show) reset() })

async function submit() {
  if (!sourceURL.value.trim() || !reason.value.trim()) {
    errorMessage.value = '请填写资料来源和修改原因'
    return
  }
  saving.value = true
  errorMessage.value = ''
  message.value = ''
  try {
    const payload = props.entityType === 'work'
      ? { title: draft.title.trim(), original_title: draft.original_title.trim(), subtitle: draft.subtitle.trim(), description: draft.description.trim() }
      : props.entityType === 'edition' ? {
          title: draft.title.trim(), publisher: draft.publisher.trim(), isbn10: draft.isbn10.trim(), isbn13: draft.isbn13.trim(), language: draft.language.trim(),
          page_count: draft.page_count ? Number(draft.page_count) : 0, binding: draft.binding.trim(), cover_url: draft.cover_url.trim(),
        }
      : { name: draft.name.trim(), sort_name: draft.sort_name.trim(), description: draft.description.trim() }
    await submitBookEdit({ type: 'update', entity_type: props.entityType, entity_id: props.entityId, payload, reason: reason.value.trim(), sources: [{ url: sourceURL.value.trim(), title: '资料来源' }] })
    message.value = '修改已提交，等待审核'
    emit('submitted')
  } catch {
    errorMessage.value = '提交失败，请检查资料后重试'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.book-edit-form { display: grid; gap: 1rem; padding: 1rem 0 2rem; }
.book-edit-form__hint { margin: 0; color: var(--a-color-muted); line-height: 1.6; }
.book-edit-form__error { margin: 0; color: var(--a-color-danger); }
.book-edit-form__message { margin: 0; color: var(--a-color-success, #16834b); }
.book-edit-form__actions { display: flex; justify-content: flex-end; gap: 0.6rem; padding-top: 0.5rem; }
</style>
