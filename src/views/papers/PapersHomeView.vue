<template>
  <main class="a-page-md papers-home">
    <PPageHeader title="Papers" sub="在线 LaTeX 编辑与编译 · 申请审核制" />
    <p v-if="loading" aria-live="polite">正在加载论文项目...</p>
    <section v-else-if="!allowed" class="papers-home__notice">
      <h2>{{ application?.status === 'pending' ? '申请审核中' : application?.status === 'rejected' ? '申请未通过' : application?.status === 'approved' ? '访问权限暂未开放' : '申请使用 Atoman Papers' }}</h2>
      <p v-if="application?.status === 'pending'">申请已提交，请等待管理员审核。通过后会向你的 Atoman 账号邮箱发送通知。</p>
      <template v-else-if="application?.status === 'rejected'">
        <p>{{ application.review_note || '申请暂未通过。' }}</p>
        <p>审核完成七天后可重新申请。</p>
      </template>
      <p v-else-if="application?.status === 'approved'">请联系管理员恢复权限。</p>
      <p v-else>提交使用申请，审核通过后即可创建私有论文项目。通知邮件将发送到你当前账号绑定的邮箱。</p>
      <form v-if="canApply && !accessError" class="papers-home__apply" @submit.prevent="apply">
        <label for="paper-application-reason">申请理由</label>
        <textarea id="paper-application-reason" v-model.trim="reason" rows="4" maxlength="1000" minlength="5" required :disabled="applying" placeholder="简要说明你的科研、写作或 LaTeX 使用需求（至少 5 字）" />
        <PButton type="submit" :disabled="applying || reason.length < 5">提交申请</PButton>
      </form>
      <PButton v-else size="sm" variant="secondary" @click="load">刷新状态</PButton>
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
    <PaperApplicationReview v-if="canReview" />
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PButton from '@/components/ui/PButton.vue'
import { paperAccess, listPaperProjects, createPaperProject, getPaperApplication, submitPaperApplication, type PaperProject, type PaperApplication } from '@/api/papers'
import { useAuthStore } from '@/stores/auth'
import PaperApplicationReview from '@/components/papers/PaperApplicationReview.vue'

const router = useRouter()
const loading = ref(true)
const allowed = ref(false)
const creating = ref(false)
const projectName = ref('')
const projects = ref<PaperProject[]>([])
const error = ref('')
const auth = useAuthStore()
const canReview = computed(() => auth.user?.role === 'admin' || auth.user?.role === 'owner')
const application = ref<PaperApplication | null>(null)
const reason = ref('')
const applying = ref(false)
const accessError = ref(false)
const canApply = computed(() => !application.value || (application.value.status === 'rejected' && !!application.value.reviewed_at && Date.now() - new Date(application.value.reviewed_at).getTime() >= 7 * 86400000))
async function apply(){
  if (applying.value || reason.value.length < 5) return
  applying.value=true;error.value=''
  try {application.value=await submitPaperApplication(reason.value);reason.value=''}
  catch {error.value='提交申请失败，请刷新状态后重试。'}
  finally {applying.value=false}
}

async function load() {
  loading.value = true
  accessError.value = false
  error.value = ''
  try {
    allowed.value = (await paperAccess()).allowed
    if (allowed.value) projects.value = await listPaperProjects()
    else application.value = (await getPaperApplication()).application
  } catch {
    allowed.value = false
    accessError.value = true
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
.papers-home__apply {display:grid;gap:10px;margin-top:16px;max-width:620px}
.papers-home__apply textarea {padding:12px;border:1px solid var(--border,#d9dce2);border-radius:8px;background:var(--surface,#fff);color:inherit;width:100%;box-sizing:border-box;resize:vertical}
</style>
