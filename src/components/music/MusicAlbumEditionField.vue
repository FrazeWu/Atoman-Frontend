<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { listMusicAlbums, type MusicAlbumListItem } from '@/api/musicV1'
import PButton from '@/components/ui/PButton.vue'
import PSelect from '@/components/ui/PSelect.vue'
import type { MusicCreationAlbumDetailsDraft } from './musicCreationTypes'

const props = defineProps<{ draft: MusicCreationAlbumDetailsDraft }>()
const options = ref<MusicAlbumListItem[]>([])
const busy = ref(false)
const error = ref('')
const searched = ref(false)
const artistID = computed(() => props.draft.contributors.find(row => row.roles.some(role=>role.role==='primary'))?.artistId)
const editionOptions = [{label:'原始发行',value:'original'},{label:'再版',value:'reissue'},{label:'重制版',value:'remaster'},{label:'其他版本',value:'other'}]
let requestID = 0
watch([artistID, () => props.draft.title], () => { requestID++; options.value=[]; searched.value=false; props.draft.canonicalAlbumId='' })
async function search() {
  const id = ++requestID
  busy.value=true; error.value=''
  try {
    const result=await listMusicAlbums({q:props.draft.title,artist_id:artistID.value || undefined,page_size:100})
    if (id!==requestID) return
    options.value=result.data.filter(row=>!row.canonical_album_id && row.title.trim().toLocaleLowerCase()===props.draft.title.trim().toLocaleLowerCase())
    searched.value=true
  } catch { if(id===requestID)error.value='已有版本查询失败，请重试' }
  finally { if(id===requestID)busy.value=false }
}
</script>
<template>
  <section class="album-edition" aria-label="发行版本">
    <PSelect :model-value="draft.editionType || 'original'" label="发行版本" :options="editionOptions" @update:model-value="draft.editionType = $event as MusicCreationAlbumDetailsDraft['editionType']" />
    <PButton variant="ghost" size="sm" :disabled="busy || !draft.title.trim() || !artistID" @click="search">查找已有专辑版本</PButton>
    <p v-if="error" role="alert">{{ error }}</p>
    <PSelect v-if="options.length" :model-value="draft.canonicalAlbumId || ''" label="确认关联到原始专辑（可选）" :options="[{label:'不建立版本关联',value:''},...options.map(row=>({label:`${row.title} · ${row.release_date || row.year || '日期未知'}`,value:row.id}))]" @update:model-value="draft.canonicalAlbumId=String($event)" />
    <p v-else-if="searched" role="status">未找到可关联的同名原始专辑。</p>
    <p v-if="draft.canonicalAlbumId">此版本会创建独立专辑和歌曲，不会与原版合并。</p>
  </section>
</template>
<style scoped>
.album-edition { display: grid; gap: .75rem; }
.album-edition p { margin: 0; color: var(--a-color-muted); font-size: .875rem; }
</style>
