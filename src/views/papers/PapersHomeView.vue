<template>
  <main class="a-page-md papers-home">
    <PPageHeader title="Papers" sub="私有 LaTeX 论文项目 · 仅受邀用户可使用" />
    <p v-if="loading" aria-live="polite">正在加载论文项目...</p>
    <section v-else-if="!allowed" class="papers-home__notice">
      <h2>尚未开通访问权限</h2>
      <p>Atoman Papers 目前仅向受邀用户开放。需要管理员为你的账号开通权限。</p>
      <p v-if="error" role="alert" class="papers-home__error">{{ error }}</p>
    </section>
    <section v-else class="papers-home__body">
      <form class="papers-home__create" @submit.prevent="create">
        <label for="paper-project-name">新建论文项目</label>
        <div class="papers-home__actions">
          <input id="paper-project-name" v-model.trim="projectName" maxlength="100" placeholder="例如：Jailbreak Defense" required :disabled="creating" />
          <PButton type="submit" :disabled="creating || !projectName">创建</PButton>
        </div>
      </form>
      <p v-if="error" role="alert" class="papers-home__error">{{ error }}</p>
      <h2>我的论文</h2>
      <p v-if="!projects.length" class="papers-home__empty">还没有论文项目。创建项目后会自动生成 main.tex。</p>
      <div v-else class="papers-home__grid">
        <RouterLink v-for="project in projects" :key="project.id" :to="'/papers/' + project.id" class="papers-home__card">
          <strong>{{ project.name }}</strong>
          <span>项目版本 {{ project.head_revision }}</span>
          <time :datetime="project.updated_at">{{ new Date(project.updated_at).toLocaleString() }}</time>
        </RouterLink>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PButton from '@/components/ui/PButton.vue'
import { paperAccess, listPaperProjects, createPaperProject, type PaperProject } from '@/api/papers'

const router = useRouter()
const loading = ref(true)
const allowed = ref(false)
const creating = ref(false)
const projectName = ref('')
const projects = ref<PaperProject[]>([])
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    allowed.value = (await paperAccess()).allowed
    if (allowed.value) projects.value = await listPaperProjects()
  } catch {
    allowed.value = false
    error.value = '无法确认 Papers 访问权限，请稍后重试。'
  } finally {
    loading.value = false
  }
}

async function create() {
  if (creating.value || !projectName.value) return
  creating.value = true
  error.value = ''
  try {
    const project = await createPaperProject(projectName.value)
    await router.push('/papers/' + project.id)
  } catch {
    error.value = '创建失败。请检查项目名称、访问权限或当前项目数量。'
  } finally {
    creating.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.papers-home { max-width: 1100px; margin-inline: auto; padding: 32px 24px 64px; }
.papers-home__body { display: grid; gap: 22px; }
.papers-home__body h2 { font-size: 1.1rem; font-weight: 650; margin-top: 12px; }
.papers-home__notice,.papers-home__create,.papers-home__card { border: 1px solid var(--border, #d9dce2); border-radius: 12px; padding: 20px; }
.papers-home__notice p,.papers-home__empty,.papers-home__card span,.papers-home__card time { color: var(--text-secondary, #697281); }
.papers-home__create label { display: block; font-weight: 650; margin-bottom: 10px; }
.papers-home__actions { display: flex; gap: 12px; }
.papers-home__actions input { flex: 1; min-width: 0; padding: 11px 13px; border: 1px solid var(--border, #d9dce2); border-radius: 8px; background: var(--surface, #fff); color: inherit; }
.papers-home__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 14px; }
.papers-home__card { display: flex; flex-direction: column; gap: 12px; color: inherit; text-decoration: none; }
.papers-home__card:hover { border-color: var(--text-primary, #4a5867); }
.papers-home__error { color: #b91c1c; }
@media (max-width: 600px) { .papers-home { padding: 20px 16px 48px; } .papers-home__actions { flex-direction: column; } }
</style>
