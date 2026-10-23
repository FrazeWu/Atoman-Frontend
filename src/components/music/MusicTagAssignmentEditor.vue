<script setup lang="ts">
import { ref, watch } from 'vue'
import { createMusicTag, editMusicTagAssignments, getMusicTagHistory, listMusicTags, listMusicTagOptions, searchMusicTags, type MusicTag, type MusicTagHistory, type MusicTagKind, type MusicTagOption } from '@/api/musicV1'
import PModal from '@/components/ui/PModal.vue'
import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import PSelect from '@/components/ui/PSelect.vue'
import { useLoginRedirect } from '@/composables/useLoginRedirect'

const props = defineProps<{ entity: 'song' | 'album'; entityId: string; suggestions?: string[] }>()
const emit = defineEmits<{ changed: [] }>()
const { requireLogin } = useLoginRedirect()
const open = ref(false)
const tags = ref<MusicTag[]>([])
const selected = ref<MusicTagOption[]>([])
const history = ref<MusicTagHistory | null>(null)
const kind = ref<MusicTagKind>('type')
const query = ref('')
const options = ref<MusicTagOption[]>([])
const summary = ref('')
const error = ref('')
const notice = ref('')
const busy = ref(false)
const ready = ref(false)
const pendingRevert = ref('')
const parent = ref<MusicTagOption | null>(null)
let searchID = 0

async function load() {
  const [rows, revisions] = await Promise.all([listMusicTags(props.entity, props.entityId), getMusicTagHistory(props.entityId, props.entity)])
  tags.value = rows; selected.value = rows; history.value = revisions; ready.value = true
}
async function start() {
  if (!requireLogin()) return
  open.value = true; error.value = ''; notice.value = ''; ready.value = false; pendingRevert.value = ''
  try { await load() } catch { error.value = '标签和历史加载失败，请关闭后重试' }
}
watch([kind, query], async () => {
  const id = ++searchID
  try {
    const result = await searchMusicTags(kind.value, query.value)
    if (id === searchID) options.value = result
  } catch { if (id === searchID) error.value = '标签搜索失败' }
})
function add(option: MusicTagOption) {
  if (selected.value.some(row => row.id === option.id)) return
  if (selected.value.length >= 12) { error.value = '最多 12 个标签，请先移除要替换的标签'; return }
  selected.value = [...selected.value, option]; pendingRevert.value = ''
}
async function browse(node: MusicTagOption | null = null) {
  const id=++searchID
  try {
    const rows=await listMusicTagOptions({kind:'type',...(node ? {parentId:node.id} : {root:true})})
    if(id===searchID){options.value=rows;parent.value=node}
  } catch { if(id===searchID)error.value='分类加载失败' }
}
async function create() {
  busy.value = true; error.value = ''
  try { add(await createMusicTag({kind:kind.value,name:query.value})) }
  catch { error.value = '创建失败，可能已存在同名分类，请重新搜索' }
  finally { busy.value = false }
}
async function save() {
  if (!ready.value || !history.value) return
  busy.value = true; error.value = ''; notice.value = ''
  try {
    await editMusicTagAssignments(props.entity, props.entityId, { base_version: history.value.version, summary: summary.value,
      ...(pendingRevert.value ? {revision_id:pendingRevert.value} : {
        add:selected.value.filter(row=>!tags.value.some(old=>old.id===row.id)).map(row=>row.id),
        remove:tags.value.filter(row=>!selected.value.some(next=>next.id===row.id)).map(row=>row.id),
      }) })
    await load(); emit('changed'); pendingRevert.value = ''; notice.value = '标签修改已保存'
  } catch (cause) { error.value = cause instanceof Error ? cause.message : '修改失败，请重新打开加载最新版本' }
  finally { busy.value = false }
}
</script>

<template>
  <PButton variant="ghost" size="sm" @click="start">管理 / 替换 / 历史</PButton>
  <PModal v-model="open" title="作品标签 Wiki" size="md">
    <div class="assignment-wiki">
      <p v-if="error" role="alert">{{ error }}</p>
      <p v-if="notice" role="status">{{ notice }}</p>
      <template v-if="ready">
        <p>当前选择 {{ selected.length }}/12。移除和添加会一次提交；专辑和歌曲标签互不继承。</p>
        <div v-for="row in selected" :key="row.id" class="assignment-wiki__row">
          <span>{{ row.path?.join(' / ') || row.name }}</span>
          <PButton variant="ghost" size="sm" :aria-label="`移除 ${row.name}`" @click="selected = selected.filter(tag=>tag.id !== row.id); pendingRevert = ''">移除</PButton>
        </div>
        <PSelect v-model="kind" label="标签分类" :options="[{label:'风格',value:'type'},{label:'情绪',value:'mood'},{label:'场景',value:'scene'},{label:'主题',value:'theme'},{label:'乐器',value:'instrument'}]" />
        <PInput v-model="query" label="搜索标签" type="search" />
        <PButton v-if="kind === 'type'" variant="ghost" size="sm" @click="browse()">浏览一级风格</PButton>
        <p v-if="kind === 'type' && parent">{{ parent.path?.join(' / ') || parent.name }} / 下级风格</p>
        <div v-for="row in options" :key="row.id" class="assignment-wiki__row">
          <span>{{ row.path?.join(' / ') || row.name }} <small v-if="row.kind === 'type'">{{ row.depth || 1 }} 级</small></span>
          <PButton v-if="row.kind === 'type' && (row.child_count ?? 0) > 0" variant="ghost" size="sm" @click="browse(row)">展开下级</PButton>
          <PButton variant="ghost" size="sm" :disabled="selected.some(tag=>tag.id===row.id) || selected.length >= 12" @click="add(row)">选择</PButton>
        </div>
        <PButton v-if="query.trim() && !options.length" :disabled="busy" variant="ghost" @click="create">创建公共标签「{{ query }}」</PButton>
        <section v-if="suggestions?.length">
          <h3>外部风格建议（尚未绑定）</h3>
          <PButton v-for="name in suggestions" :key="name" variant="ghost" size="sm" @click="kind = 'type'; query = name">查找 {{ name }}</PButton>
        </section>
        <PInput v-model="summary" label="修改说明" />
        <p v-if="pendingRevert" role="status">准备撤销所选修订。确认后服务端会检查后续编辑，存在冲突时不会覆盖。</p>
        <PButton :disabled="busy" @click="save">{{ pendingRevert ? '确认回退' : '保存标签修改' }}</PButton>
        <h3>完整关联历史</h3>
        <article v-for="row in history?.revisions" :key="row.id">
          <p>#{{ row.version }} · {{ row.action }} · {{ row.summary }} · {{ new Date(row.created_at).toLocaleString() }}</p>
          <PButton variant="ghost" size="sm" :disabled="busy" @click="pendingRevert = row.id">选择回退</PButton>
        </article>
      </template>
    </div>
  </PModal>
</template>

<style scoped>
.assignment-wiki { display: grid; gap: 1rem; }
.assignment-wiki p { margin: 0; color: var(--a-color-muted); }
.assignment-wiki [role=alert] { color: var(--a-color-danger); }
.assignment-wiki__row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.assignment-wiki article { border-top: 1px solid var(--a-color-border); padding-top: .75rem; }
</style>
