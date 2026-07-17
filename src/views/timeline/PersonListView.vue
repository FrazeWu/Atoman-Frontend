<template>
  <div class="a-page-xl" style="padding-bottom:6rem">
    <PPageHeader title="历史人物" accent sub="人物地图轨迹">
      <template #action>
        <PButton v-if="authStore.isAuthenticated" @click="showForm = true">新建人物</PButton>
      </template>
    </PPageHeader>

    <!-- Search -->
    <div style="display:flex;gap:1rem;margin-bottom:1.5rem">
      <PInput v-model="searchText" :disabled="deleting || !!deletingPerson" placeholder="搜索人物姓名…" style="max-width:320px" @keyup.enter="doSearch" />
      <PButton outline :disabled="deleting || !!deletingPerson" @click="doSearch">搜索</PButton>
    </div>

    <!-- Loading -->
    <div v-if="loading && persons.length === 0" style="padding:4rem;text-align:center">
      <p class="font-bold">加载中...</p>
    </div>

    <!-- Empty -->
    <PEmpty v-else-if="error && persons.length === 0" text="人物加载失败，请重试" />
    <PEmpty v-else-if="persons.length === 0" text="暂无历史人物" />

    <!-- List -->
    <div v-else class="person-list">
      <PEntry
        v-for="person in persons"
        :key="person.id"
        @click="router.push(`/timeline/person/${person.id}`)"
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
              <button
                class="card-action-btn card-action-danger"
                :disabled="loading || deleting || !!deletingPerson"
                @click.stop="startDelete(person)"
                title="删除"
              >✕ 删除</button>
            </template>
          </div>
        </template>
      </PEntry>
    </div>

    <div v-if="persons.length > 0 && (paginationInvalidated || persons.length < personsTotal)" style="margin-top:1.5rem;text-align:center">
      <PButton
        outline
        :loading="loading"
        :disabled="loading || deleting || !!deletingPerson"
        :label="error || paginationInvalidated ? '加载失败，请重试' : '加载更多'"
        loading-text="加载中..."
        @click="loadMore"
      />
    </div>

    <!-- Create/Edit Person Modal -->
    <PModal v-if="showForm" size="md" :title="editingPerson ? '编辑人物' : '新建人物'" @close="closeForm">
      <div class="form-group">
        <label class="form-label">姓名 *</label>
        <PInput v-model="form.name" placeholder="历史人物姓名" />
      </div>
      <div class="form-row">
        <div class="form-group" style="flex:1">
          <label class="form-label">出生日期</label>
          <PInput v-model="form.birth_date" placeholder="YYYY-MM-DD" />
        </div>
        <div class="form-group" style="flex:1">
          <label class="form-label">去世日期</label>
          <PInput v-model="form.death_date" placeholder="YYYY-MM-DD" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">简介</label>
        <PTextarea v-model="form.bio" :rows="4" placeholder="人物生平简介" />
      </div>
      <div class="form-group">
        <label class="form-label">标签 (逗号分隔)</label>
        <PInput v-model="tagsInput" placeholder="政治家, 军事家, 哲学家" />
      </div>
      <template #footer>
        <PButton outline @click="closeForm">取消</PButton>
        <PButton :disabled="submitting" @click="submitForm">
          {{ submitting ? '保存中...' : (editingPerson ? '保存' : '创建') }}
        </PButton>
      </template>
    </PModal>

    <!-- Confirm Delete -->
    <PConfirm
      :show="!!deletingPerson"
      title="删除人物"
      :message="deletingPerson ? `确定要删除「${deletingPerson.name}」及其所有地点记录吗？此操作不可撤销。` : ''"
      :danger="true"
      :loading="deleting"
      loading-text="删除中..."
      @confirm="doDelete"
      @cancel="cancelDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useTimelineStore } from '@/stores/timeline'
import { useAuthStore } from '@/stores/auth'
import { isAdminRole } from '@/utils/roles'
import PButton from '@/components/ui/PButton.vue'
import PModal from '@/components/ui/PModal.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PInput from '@/components/ui/PInput.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import type { TimelinePerson } from '@/types'
import PEntry from '@/components/ui/PEntry.vue'

const store = useTimelineStore()
const authStore = useAuthStore()
const router = useRouter()

const {
  persons,
  personsTotal,
  personsLoading: loading,
  personsError: error,
} = storeToRefs(store)

const searchText = ref('')
const appliedSearch = ref('')
const currentPage = ref(1)
const paginationInvalidated = ref(false)
const invalidatedSearch = ref('')
const limit = 20
const showForm = ref(false)
const editingPerson = ref<TimelinePerson | null>(null)
const deletingPerson = ref<TimelinePerson | null>(null)
const deleting = ref(false)
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

const doSearch = async () => {
  if (deleting.value || deletingPerson.value) return
  const requestedSearch = searchText.value.trim()
  const succeeded = await store.fetchPersons({
    search: requestedSearch || undefined,
    page: 1,
    limit,
  })
  if (succeeded) {
    appliedSearch.value = requestedSearch
    currentPage.value = 1
    paginationInvalidated.value = false
  }
}

const reloadFirstPage = async (search = appliedSearch.value) => {
  const succeeded = await store.fetchPersons({
    search: search || undefined,
    page: 1,
    limit,
  })
  if (succeeded) {
    appliedSearch.value = search
    currentPage.value = 1
    paginationInvalidated.value = false
  }
}

const loadMore = async () => {
  if (loading.value || deleting.value || deletingPerson.value) return
  if (paginationInvalidated.value) {
    await reloadFirstPage(invalidatedSearch.value)
    return
  }
  const nextPage = currentPage.value + 1
  const succeeded = await store.fetchPersons({
    search: appliedSearch.value || undefined,
    page: nextPage,
    limit,
  })
  if (succeeded) currentPage.value = nextPage
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
  if (loading.value || deleting.value || deletingPerson.value) return
  deletingPerson.value = p
}

const cancelDelete = () => {
  if (!deleting.value) deletingPerson.value = null
}

const doDelete = async () => {
  if (!deletingPerson.value || deleting.value || loading.value) return
  const personId = deletingPerson.value.id
  const searchAtDelete = appliedSearch.value
  deleting.value = true
  try {
    await store.deletePerson(personId)
    deletingPerson.value = null
    invalidatedSearch.value = searchAtDelete
    paginationInvalidated.value = true
    await reloadFirstPage(searchAtDelete)
  } catch (error) {
    console.error(error)
  } finally {
    deleting.value = false
  }
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
      router.push(`/timeline/person/${created.id}`)
    }
    closeForm()
  } catch (e) {
    console.error(e)
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  void doSearch()
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
  font-weight: 500;
  color: var(--a-color-muted);
  margin-bottom: 0.5rem;
}
.person-link {
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0;
  color: var(--a-color-muted);
}

.form-group { margin-bottom: 1rem; }
.form-row { display: flex; gap: 1rem; margin-bottom: 1rem; }
.form-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0;
  margin-bottom: 0.4rem;
}
</style>
