<template>
  <div class="private-books">
    <div class="private-books__toolbar">
      <PButton variant="secondary" :disabled="busy" @click="load">文件版本</PButton>
      <PButton v-if="authenticated" variant="ghost" :disabled="busy" @click="setDefault">设为 {{ asset.language }} 社区默认文件</PButton>
    </div>
    <p v-if="message" role="status">{{ message }}</p>
    <ul v-if="revisions.length" class="book-catalog__list"><li v-for="revision in revisions" :key="revision.id" class="book-catalog__row">
      <span>版本 {{ revision.number }} · {{ revision.original_filename }}</span>
      <PButton :disabled="busy" @click="read(revision.id)">{{ authenticated ? '选用此版本阅读' : '阅读此版本' }}</PButton>
    </li></ul>
    <details v-if="authenticated"><summary>替换这份电子书文件</summary><p>将为这份电子书新增文件版本，不会覆盖旧文件、进度或笔记。格式必须相同。</p><BookResourceUpload :work-id="asset.work_id" :title="asset.title" :replace-asset="asset" @ready="load" /></details>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import type { CatalogResource } from '@/api/bookCatalog'
import { privateBookRequest, selectReading } from '@/api/bookPrivate'
import { listResourceRevisions, resourceReaderPath, type ResourceRevision } from '@/api/bookResources'
import PButton from '@/components/ui/PButton.vue'
import BookResourceUpload from './BookResourceUpload.vue'
const props = defineProps<{ asset: CatalogResource; authenticated: boolean }>()
const router = useRouter(), revisions = ref<ResourceRevision[]>([]), busy = ref(false), message = ref('')
async function load() { busy.value = true; try { revisions.value = (await listResourceRevisions(props.asset.id)).items } catch { message.value = '版本加载失败，请重试。' } finally { busy.value = false } }
async function read(revisionId: string) { busy.value = true; try { if (props.authenticated) await selectReading(props.asset.work_id, props.asset.id, revisionId); await router.push(resourceReaderPath(props.asset.work_id, props.asset.id, revisionId)) } catch { message.value = '选择文件版本失败，请重试。' } finally { busy.value = false } }
async function setDefault() { busy.value = true; try { await privateBookRequest(`/works/${encodeURIComponent(props.asset.work_id)}/default-assets/${encodeURIComponent(props.asset.language)}`, 'PUT', { asset_id: props.asset.id }); message.value = '社区默认文件已设置，不会改变读者已有的文件选择。' } catch { message.value = '设置失败，请检查文件是否可读后重试。' } finally { busy.value = false } }
</script>
