<template>
  <section class="private-books" aria-label="我的阅读状态">
    <div class="private-books__toolbar">
      <label>我的书架状态<select v-model="status"><option v-for="item in shelfStatuses" :key="item.value" :value="item.value">{{ item.label }}</option></select></label>
      <PButton :disabled="busy || !loaded" @click="save">{{ entry ? '更新书架' : '加入书架' }}</PButton>
      <PButton variant="secondary" :to="{ path: '/books/notes', query: { work: workId, new: '1' } }">写私人笔记</PButton>
    </div>
    <p v-if="message" role="status">{{ message }}</p>
    <PButton v-if="!loaded && !busy" variant="ghost" @click="load">重试加载书架状态</PButton>
  </section>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { listLibrary, saveLibrary, shelfStatuses, type LibraryEntry, type ShelfStatus } from '@/api/bookPrivate'
import PButton from '@/components/ui/PButton.vue'
const props = defineProps<{ workId: string }>()
const entry = ref<LibraryEntry>(), status = ref<ShelfStatus>('want_to_read'), loaded = ref(false), busy = ref(false), message = ref('')
async function load() { busy.value = true; try { let offset = 0; do { const page = await listLibrary(offset); entry.value = page.items.find(item => item.work_id === props.workId); offset += page.items.length; if (entry.value || offset >= page.total || !page.items.length) break } while (true); status.value = entry.value?.status || 'want_to_read'; loaded.value = true } catch { message.value = '无法加载当前书架状态，请重试。' } finally { busy.value = false } }
async function save() { if (!loaded.value || busy.value) return; busy.value = true; try { entry.value = await saveLibrary(props.workId, status.value, entry.value?.tags || [], entry.value); message.value = '书架状态已保存，仅本人可见。' } catch { message.value = '保存失败或书架已更改，请重新加载后重试。'; loaded.value = false } finally { busy.value = false } }
onMounted(load)
</script>
