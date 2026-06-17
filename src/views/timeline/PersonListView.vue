<template>
  <div class="a-page-xl" style="padding-bottom:6rem">
    <APageHeader title="历史人物" accent sub="人物地图轨迹">
      <template #action>
        <ABtn v-if="authStore.isAuthenticated" @click="showForm = true">新建人物</ABtn>
      </template>
    </APageHeader>

    <!-- Search -->
    <div style="display:flex;gap:1rem;margin-bottom:1.5rem">
      <AInput v-model="searchText" placeholder="搜索人物姓名…" style="max-width:320px" @keyup.enter="doSearch" />
      <ABtn outline @click="doSearch">搜索</ABtn>
    </div>

    <!-- Loading -->
    <div v-if="loading" style="padding:4rem;text-align:center">
      <p class="font-bold">加载中...</p>
    </div>

    <!-- Empty -->
    <AEmpty v-else-if="persons.length === 0" text="暂无历史人物" />

    <!-- List -->
    <div v-else class="person-list">
      <PaperEntry
        v-for="person in persons"
        :key="person.id"
        @click="router.push(`/person/${person.id}`)"
      >
        <!-- Meta -->
        <template #meta>
          <span v-if="person.tags?.length" class="a-badge">{{ person.tags[0] }}</span>
          <span v-if="person.birth_date || person.death_date" class="person-dates" style="margin-left:0.5rem">
            {{ formatYear(person.birth_date) }}
            <span v-if="person.birth_date && person.death_date"> — </span>
            {{ formatYear(person.death_date) }}
          </span>
        </template>

        <!-- Name -->
        <template #title>
          {{ person.name }}
        </template>

        <!-- Biography -->
        <template #summary>
          {{ person.bio }}
        </template>

        <!-- Actions -->
        <template #actions>
          <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap">
            <span class="person-link">查看地图轨迹 →</span>
            <template v-if="canManage(person)">
              <button class="card-action-btn" @click.stop="startEdit(person)" title="编辑">✎ 编辑</button>
              <button class="card-action-btn card-action-danger" @click.stop="startDelete(person)" title="删除">✕ 删除</button>
            </template>
          </div>
        </template>
      </PaperEntry>
    </div>

    <!-- Create/Edit Person Modal -->
    <AModal v-if="showForm" size="md" :title="editingPerson ? '编辑人物' : '新建人物'" @close="closeForm">
      <div class="form-group">
        <label class="form-label">姓名 *</label>
        <AInput v-model="form.name" placeholder="历史人物姓名" />
      </div>
      <div class="form-row">
        <div class="form-group" style="flex:1">
          <label class="form-label">出生日期</label>
          <AInput v-model="form.birth_date" placeholder="YYYY-MM-DD" />
        </div>
        <div class="form-group" style="flex:1">
          <label class="form-label">去世日期</label>
          <AInput v-model="form.death_date" placeholder="YYYY-MM-DD" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">简介</label>
        <ATextarea v-model="form.bio" :rows="4" placeholder="人物生平简介" />
      </div>
      <div class="form-group">
        <label class="form-label">标签 (逗号分隔)</label>
        <AInput v-model="tagsInput" placeholder="政治家, 军事家, 哲学家" />
      </div>
      <template #footer>
        <ABtn outline @click="closeForm">取消</ABtn>
        <ABtn :disabled="submitting" @click="submitForm">
          {{ submitting ? '保存中...' : (editingPerson ? '保存' : '创建') }}
        </ABtn>
      </template>
    </AModal>

    <!-- Confirm Delete -->
    <AConfirm
      :show="!!deletingPerson"
      title="删除人物"
      :message="deletingPerson ? `确定要删除「${deletingPerson.name}」及其所有地点记录吗？此操作不可撤销。` : ''"
      :danger="true"
      @confirm="doDelete"
      @cancel="deletingPerson = null"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTimelineStore } from '@/stores/timeline'
import { useAuthStore } from '@/stores/auth'
import { isAdminRole } from '@/utils/roles'
import ABtn from '@/components/ui/ABtn.vue'
import AModal from '@/components/ui/AModal.vue'
import AEmpty from '@/components/ui/AEmpty.vue'
import APageHeader from '@/components/ui/APageHeader.vue'
import AInput from '@/components/ui/AInput.vue'
import ATextarea from '@/components/ui/ATextarea.vue'
import AConfirm from '@/components/ui/AConfirm.vue'
import type { TimelinePerson } from '@/types'
import PaperEntry from '@/components/ui/PaperEntry.vue'

const store = useTimelineStore()
const authStore = useAuthStore()
const router = useRouter()

const { persons, loading } = store

const searchText = ref('')
const showForm = ref(false)
const editingPerson = ref<TimelinePerson | null>(null)
const deletingPerson = ref<TimelinePerson | null>(null)
const submitting = ref(false)

const form = ref({ name: '', bio: '', birth_date: '', death_date: '' })
const tagsInput = ref('')

const canManage = (p: TimelinePerson) =>
  authStore.isAuthenticated &&
  (p.user_id === authStore.user?.uuid || isAdminRole(authStore.user?.role))

const formatYear = (d?: string) => {
  if (!d) return ''
  return d.slice(0, 4)
}

const doSearch = () => {
  store.fetchPersons({ search: searchText.value || undefined })
}

const startEdit = (p: TimelinePerson) => {
  editingPerson.value = p
  form.value = {
    name: p.name,
    bio: p.bio || '',
    birth_date: p.birth_date ? p.birth_date.slice(0, 10) : '',
    death_date: p.death_date ? p.death_date.slice(0, 10) : '',
  }
  tagsInput.value = (p.tags || []).join(', ')
  showForm.value = true
}

const startDelete = (p: TimelinePerson) => {
  deletingPerson.value = p
}

const doDelete = async () => {
  if (!deletingPerson.value) return
  await store.deletePerson(deletingPerson.value.id)
  deletingPerson.value = null
}

const closeForm = () => {
  showForm.value = false
  editingPerson.value = null
  form.value = { name: '', bio: '', birth_date: '', death_date: '' }
  tagsInput.value = ''
}

const submitForm = async () => {
  if (!form.value.name) return
  submitting.value = true
  try {
    const tags = tagsInput.value
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    const payload = { ...form.value, tags }
    if (editingPerson.value) {
      await store.updatePerson(editingPerson.value.id, payload)
    } else {
      const created = await store.createPerson(payload)
      // Navigate to map view for newly created person
      router.push(`/person/${created.id}`)
    }
    closeForm()
  } catch (e) {
    console.error(e)
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  store.fetchPersons()
})
</script>

<style scoped>
.card-action-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.8rem;
  color: var(--a-color-muted-soft);
  padding: 2px 5px;
  transition: color 0.15s;
  line-height: 1;
}
.card-action-btn:hover { color: var(--a-color-fg); }
.card-action-danger:hover { color: var(--a-color-danger); }

.person-dates {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--a-color-muted);
  margin-bottom: 0.5rem;
}
.person-link {
  font-size: 0.75rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--a-color-muted);
}

.form-group { margin-bottom: 1rem; }
.form-row { display: flex; gap: 1rem; margin-bottom: 1rem; }
.form-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 0.4rem;
}
</style>
