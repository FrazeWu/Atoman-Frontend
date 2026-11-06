<template>
  <section class="mail-contacts">
    <header class="mail-contacts__header">
      <div><h2>邮件联系人</h2><p>私人通讯录仅自己可见；写邮件时会自动推荐。</p></div>
      <PButton variant="secondary" size="sm" @click="openNew"><Plus :size="15" /> 新建联系人</PButton>
    </header>
    <PSearchInput v-model="search" variant="inline" size="sm" aria-label="搜索邮件联系人" placeholder="搜索姓名或邮箱" :show-shortcut-badge="false" :show-action-button="false" />
    <div v-if="loading" role="status" class="mail-contacts__hint">正在加载联系人…</div>
    <div v-if="error" role="alert" class="mail-contacts__error">{{ error }}</div>
    <PEmpty v-if="!loading && !matches.length" compact :title="search ? '没有找到联系人' : '通讯录还是空的'" :description="search ? '试试其他姓名或地址。' : '保存常用邮箱后，写信时就能自动补全。'" />
    <div v-for="item in matches" :key="item.id" class="mail-contacts__item">
      <div><strong>{{ item.name || item.email }}</strong><small>{{ item.email }}</small></div>
      <PButton variant="ghost" size="sm" :aria-label="'编辑 '+item.email" @click="openEdit(item)"><Pencil :size="16" /></PButton>
      <PButton variant="ghost" size="sm" :aria-label="'删除 '+item.email" @click="deleteTarget = item"><Trash2 :size="16" /></PButton>
    </div>
  </section>
  <PModal :show="editing" :title="form.id ? '编辑联系人' : '新建联系人'" size="md" @close="editing = false">
    <form class="mail-contacts__form" @submit.prevent="save">
      <PInput v-model="form.name" label="姓名" placeholder="备注姓名（可留空）" maxlength="120" />
      <PInput v-model="form.email" label="邮箱地址" type="email" placeholder="name@example.com" required maxlength="254" />
      <PTextarea v-model="form.notes" label="备注" :rows="2" maxlength="2048" placeholder="可选的私人备注" />
      <p v-if="formError" role="alert" class="mail-contacts__error">{{ formError }}</p>
      <div class="mail-contacts__actions"><PButton type="button" variant="secondary" @click="editing = false">取消</PButton><PButton type="submit" :loading="saving">保存联系人</PButton></div>
    </form>
  </PModal>
  <PModal :show="Boolean(deleteTarget)" title="删除联系人" size="sm" @close="deleteTarget = null">
    <p>删除后，通讯录将不再推荐这个地址，但历史邮件不会受到影响。</p>
    <template #footer><PButton variant="secondary" @click="deleteTarget = null">取消</PButton><PButton variant="danger" :loading="saving" @click="remove">删除联系人</PButton></template>
  </PModal>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Pencil, Plus, Trash2 } from 'lucide-vue-next'
import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import PModal from '@/components/ui/PModal.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PSearchInput from '@/components/ui/PSearchInput.vue'
import { createMailContact, deleteMailContact, fetchMailContacts, updateMailContact, type MailContact } from '@/api/mailClient'

const items = ref<MailContact[]>([])
const loading = ref(true), saving = ref(false), error = ref(''), formError = ref('')
const search = ref('')
const editing = ref(false), deleteTarget = ref<MailContact|null>(null)
const form = ref<MailContact>({id:'',name:'',email:'',notes:'',revision:0,updated_at:''})
const matches = computed(() => items.value.filter(item => (item.name+' '+item.email).toLowerCase().includes(search.value.toLowerCase().trim())).slice(0,100))
const openNew = () => { form.value={id:'',name:'',email:'',notes:'',revision:0,updated_at:''};formError.value='';editing.value=true }
const openEdit = (item:MailContact) => { form.value={...item};formError.value='';editing.value=true }
async function refresh() {
 try { items.value = await fetchMailContacts(); error.value='' } catch { error.value='无法加载私人通讯录，请刷新重试。' } finally { loading.value=false }
}
async function save() {
 if(saving.value)return
 saving.value=true;formError.value=''
 try {
  const next = form.value.id ? await updateMailContact(form.value) : await createMailContact(form.value)
  items.value=[next,...items.value.filter(row=>row.id!==next.id)]
  editing.value=false
 } catch {formError.value='保存失败。可能是地址重复、输入无效或联系人已被其他设备修改。'}
 finally {saving.value=false}
}
async function remove() {
 if(!deleteTarget.value || saving.value)return
 saving.value=true;error.value=''
 try {await deleteMailContact(deleteTarget.value.id);items.value=items.value.filter(item=>item.id!==deleteTarget.value?.id);deleteTarget.value=null}
 catch {error.value='无法删除联系人，请重试。'}
 finally {saving.value=false}
}
onMounted(refresh)
</script>
<style scoped>
.mail-contacts { display:grid;gap:16px; }
.mail-contacts__header { display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px; }
.mail-contacts__header h2 {margin:0 0 7px;font-size:18px;font-weight:600;}
.mail-contacts__header p {margin:0;color:var(--a-color-muted);font-size:13px;line-height:1.5;}
.mail-contacts__item {display:flex;align-items:center;gap:8px;padding:12px 0;border-bottom:1px solid var(--a-color-border-soft);}
.mail-contacts__item > div {display:grid;gap:5px;flex:1;min-width:0;}
.mail-contacts__item strong {font-size:13px;font-weight:600;overflow-wrap:anywhere;}
.mail-contacts__item small {font-size:12px;color:var(--a-color-muted);overflow-wrap:anywhere;}
.mail-contacts__form {display:grid;gap:17px;padding-top:15px;}
.mail-contacts__actions {display:flex;justify-content:flex-end;gap:10px;}
.mail-contacts__error {color:var(--a-color-danger);font-size:13px;}
.mail-contacts__hint {font-size:13px;color:var(--a-color-muted);}
.mail-contacts__header .p-button {display:inline-flex;align-items:center;gap:6px;}
.mail-contacts :deep(.p-search-input) {display:flex;width:100%;height:40px;}
</style>
