<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { editMusicTagWiki, getMusicTagHistory, listMusicTagOptions, type MusicTagHistory, type MusicTagOption, type MusicTagSnapshot, type MusicTagWikiInput } from '@/api/musicV1'
import PModal from '@/components/ui/PModal.vue'
import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import PSelect from '@/components/ui/PSelect.vue'
import { useLoginRedirect } from '@/composables/useLoginRedirect'

const props = defineProps<{ tag: MusicTagOption }>()
const emit = defineEmits<{ changed: [] }>()
const { isAuthenticated, requireLogin } = useLoginRedirect()
const open = ref(false)
const action = ref<'rename' | 'move' | 'merge'>('rename')
const name = ref('')
const query = ref('')
const target = ref('')
const options = ref<MusicTagOption[]>([])
const summary = ref('')
const history = ref<MusicTagHistory | null>(null)
const preview = ref<MusicTagSnapshot | null>(null)
const pending = ref<{ action: 'rename' | 'move' | 'merge' | 'revert'; input: MusicTagWikiInput } | null>(null)
const busy = ref(false)
const error = ref('')
const notice = ref('')
const actions = computed(() => [{label:'重命名',value:'rename'},...(props.tag.kind === 'type' ? [{label:'修改父级',value:'move'}] : []),{label:'合并标签',value:'merge'}])
const affectedWorks = computed(() => new Set(preview.value?.assignments.map(row=>`${row.entity_type}:${row.entity_id}`)).size)
let searchID = 0

async function start() {
  open.value = true
  name.value = props.tag.name
  error.value = ''; notice.value = ''; preview.value = null; pending.value = null
  try { history.value = await getMusicTagHistory(props.tag.id) } catch { error.value = '历史加载失败，请重试' }
}
async function search() {
  const id = ++searchID
  try {
    const rows = await listMusicTagOptions({ kind: props.tag.kind, query: query.value })
    if (id === searchID) options.value = rows.filter(row => row.id !== props.tag.id)
  } catch { if (id === searchID) error.value = '分类加载失败' }
}
watch([action, query], () => { target.value = ''; void search() })
watch([action, name, target, summary], () => { preview.value = null; pending.value = null })
async function prepare(revisionID?: string) {
  if (!requireLogin()) return
  busy.value = true; error.value = ''; notice.value = ''
  try {
    const selected = options.value.find(row => row.id === target.value)
    if (!revisionID && action.value === 'merge' && !selected) throw new Error('请选择合并目标')
    const input: MusicTagWikiInput = { base_version: props.tag.version ?? 1, summary: summary.value,
      ...(revisionID ? { revision_id: revisionID } : action.value === 'rename' ? { name: name.value } : action.value === 'move' ? { parent_id: target.value || null } : { target_id: target.value, target_version: selected?.version ?? 1 }) }
    const operation = revisionID ? 'revert' : action.value
    preview.value = await editMusicTagWiki(props.tag.id, operation, input, true)
    pending.value = { action: operation, input }
  } catch (cause) { error.value = cause instanceof Error ? cause.message : '无法预览，请刷新后重试' }
  finally { busy.value = false }
}
async function save() {
  if (!pending.value || !requireLogin()) return
  busy.value = true; error.value = ''
  try {
    await editMusicTagWiki(props.tag.id, pending.value.action, pending.value.input)
    preview.value = null; pending.value = null; notice.value = '修改已保存'
    history.value = await getMusicTagHistory(props.tag.id)
    emit('changed')
  } catch (cause) { error.value = cause instanceof Error ? cause.message : '保存失败，请刷新后重试' }
  finally { busy.value = false }
}
</script>

<template>
  <PButton variant="ghost" size="sm" @click="start">Wiki / 历史</PButton>
  <PModal v-model="open" title="标签 Wiki" size="md">
    <div class="tag-wiki">
      <p>{{ tag.path?.join(' / ') || tag.name }} · 版本 {{ tag.version ?? 1 }}</p>
      <p v-if="error" role="alert">{{ error }}</p>
      <p v-if="notice" role="status">{{ notice }}</p>
      <template v-if="isAuthenticated && !tag.canonical_tag_id">
        <PSelect v-model="action" label="操作" :options="actions" />
        <PInput v-if="action === 'rename'" v-model="name" label="标签名称" maxlength="48" />
        <template v-else>
          <PInput v-model="query" label="查找目标分类" type="search" />
          <PSelect v-model="target" :label="action === 'move' ? '父级（留空为根分类）' : '合并目标'" :options="[{label:action === 'move' ? '无父级' : '请选择',value:''},...options.map(row=>({label:row.path?.join(' / ') || row.name,value:row.id}))]" />
        </template>
        <PInput v-model="summary" label="修改说明" />
        <PButton :disabled="busy" @click="prepare()">预览影响</PButton>
      </template>
      <section v-if="preview" aria-label="修改影响预览" class="tag-wiki__preview">
        <p>将影响 {{ preview.tags.length }} 个分类、{{ preview.assignments.length }} 条作品关联、{{ preview.votes.length }} 条投票记录。</p>
        <p>受影响作品 {{ affectedWorks }} 个；分类：{{ preview.tags.map(row=>row.name).join('、') || '无' }}。</p>
        <p>分类移动会改变祖先风格搜索范围；标签合并后的可信度按去重后的有效投票重新计算。结构及关联冲突会阻止提交。</p>
        <p>同用户重复票按最后修改保留一票；原记录保留。后续有变更时回退会被拒绝。</p>
        <PButton :disabled="busy" @click="save">确认修改</PButton>
      </section>
      <h3>修改历史</h3>
      <p v-if="history && !history.revisions.length">暂无修改记录</p>
      <article v-for="row in history?.revisions" :key="row.id" class="tag-wiki__revision">
        <p>#{{ row.version }} · {{ row.action }} · {{ new Date(row.created_at).toLocaleString() }}</p>
        <p>{{ row.summary }}</p>
        <PButton v-if="isAuthenticated && row.action !== 'create'" variant="ghost" size="sm" :disabled="busy" @click="prepare(row.id)">预览回退</PButton>
      </article>
    </div>
  </PModal>
</template>

<style scoped>
.tag-wiki { display: grid; gap: 1rem; }
.tag-wiki p { margin: 0; color: var(--a-color-muted); }
.tag-wiki [role=alert] { color: var(--a-color-danger); }
.tag-wiki__preview, .tag-wiki__revision { display: grid; gap: .75rem; padding-block: 1rem; border-top: 1px solid var(--a-color-border); }
</style>
