<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import PChoiceField from '@/components/ui/PChoiceField.vue'
import PSheet from '@/components/ui/PSheet.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import {
  buildUpdateAlbumEdit,
  buildUpdateArtistEdit,
  submitMusicEdit,
  type MusicSource,
} from '@/api/musicV1'

const { state, closeNestedAction } = useMusicDrawers()
const isOpen = computed(() => (
  state.value.nestedAction === 'revise'
  || state.value.nestedAction === 'history'
  || state.value.nestedAction === 'discussion'
  || state.value.nestedAction === 'revise_artist'
))
const sheetIndex = computed(() => {
  let count = 0
  if (state.value.artistId !== null) count++
  if (state.value.albumId !== null) count++
  return count
})

const titleMap: Record<string, string> = {
  revise: '修订专辑',
  revise_artist: '修订艺术家',
  history: '版本历史',
  discussion: '社区讨论'
}

const displayTitle = computed(() => titleMap[state.value.nestedAction || ''] || 'Action')
const subtitleMap: Record<string, string> = {
  revise: '补充专辑条目，并保持来源信息清晰。',
  revise_artist: '以纸面编辑方式整理艺术家资料。',
  history: '查看当前条目的历史占位内容。',
  discussion: '查看当前条目的讨论占位内容。',
}

const artistDraft = reactive({
  name: '',
  bio: '',
  imageUrl: '',
  nationality: '',
  birthYear: '',
  reason: '',
})

const albumDraft = reactive({
  title: '',
  releaseDate: '',
  albumType: 'album',
  description: '',
  reason: '',
})

const sourceDraft = reactive({
  title: '',
  url: '',
})

const submitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const isArtistForm = computed(() => state.value.nestedAction === 'revise_artist')
const isAlbumForm = computed(() => state.value.nestedAction === 'revise')
const canSubmit = computed(() => !submitting.value && (isArtistForm.value || isAlbumForm.value))
const albumTypeOptions = [
  { label: 'Album', value: 'album' },
  { label: 'EP', value: 'ep' },
  { label: 'Single', value: 'single' },
]

watch(() => state.value.nestedAction, () => {
  errorMessage.value = ''
  successMessage.value = ''
  artistDraft.name = ''
  artistDraft.bio = ''
  artistDraft.imageUrl = ''
  artistDraft.nationality = ''
  artistDraft.birthYear = ''
  artistDraft.reason = ''
  albumDraft.title = ''
  albumDraft.releaseDate = ''
  albumDraft.albumType = 'album'
  albumDraft.description = ''
  albumDraft.reason = ''
  sourceDraft.title = ''
  sourceDraft.url = ''
})

function trimmed(value: string) {
  return value.trim()
}

function optionalNumber(value: string): number | undefined {
  const normalized = trimmed(value)
  if (!normalized) return undefined
  const parsed = Number.parseInt(normalized, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

function sourcesFromDraft(): MusicSource[] {
  const url = trimmed(sourceDraft.url)
  if (!url) return []
  return [{ type: 'url', url, title: trimmed(sourceDraft.title) || undefined }]
}

async function submitEdit() {
  errorMessage.value = ''
  successMessage.value = ''

  const action = state.value.nestedAction
  const reason = isArtistForm.value
    ? trimmed(artistDraft.reason)
    : trimmed(albumDraft.reason)
  if (!reason) {
    errorMessage.value = '请输入编辑摘要'
    return
  }

  submitting.value = true
  try {
    if (action === 'revise_artist') {
      if (!state.value.artistId) {
        throw new Error('缺少艺术家 ID')
      }
      await submitMusicEdit(buildUpdateArtistEdit(state.value.artistId, {
        name: trimmed(artistDraft.name) || undefined,
        bio: trimmed(artistDraft.bio) || undefined,
        image_url: trimmed(artistDraft.imageUrl) || undefined,
        nationality: trimmed(artistDraft.nationality) || undefined,
        birth_year: optionalNumber(artistDraft.birthYear),
        reason,
        sources: sourcesFromDraft(),
      }))
    } else if (action === 'revise') {
      if (!state.value.albumId) {
        throw new Error('缺少专辑 ID')
      }
      await submitMusicEdit(buildUpdateAlbumEdit(state.value.albumId, {
        title: trimmed(albumDraft.title) || undefined,
        release_date: trimmed(albumDraft.releaseDate) || undefined,
        description: trimmed(albumDraft.description) || undefined,
        album_type: albumDraft.albumType,
        reason,
        sources: sourcesFromDraft(),
      }))
    }

    successMessage.value = '已保存到音乐档案库。'
    closeNestedAction()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '提交失败，请稍后重试'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <PSheet
    :show="isOpen"
    @close="closeNestedAction"
    width="500px"
    :index="sheetIndex"
  >
    <div class="drawer-header">
      <p class="eyebrow">Music Wiki</p>
      <h3 class="title">{{ displayTitle }}</h3>
      <p class="subtitle">{{ subtitleMap[state.nestedAction || ''] || '编辑当前条目。' }}</p>
    </div>

    <div class="drawer-body">
      <form v-if="isArtistForm" data-test="music-edit-submit" class="wiki-form" @submit.prevent="submitEdit">
        <section class="paper-section">
          <div class="section-heading">
            <span class="section-dot" aria-hidden="true" />
            <div>
              <p class="section-kicker">Basic</p>
              <h4>基本信息</h4>
            </div>
          </div>

          <div class="paper-form-grid">
            <div class="paper-input-group">
              <label class="paper-label" for="music-artist-name">
                <span class="paper-label-dot" aria-hidden="true" />
                名字
              </label>
              <input id="music-artist-name" v-model="artistDraft.name" data-test="artist-name-input" type="text" class="paper-input">
            </div>

            <div class="paper-input-group paper-input-group--wide">
              <label class="paper-label" for="music-artist-bio">
                <span class="paper-label-dot" aria-hidden="true" />
                个人简介
              </label>
              <textarea id="music-artist-bio" v-model="artistDraft.bio" data-test="artist-bio-input" class="paper-input paper-textarea" rows="5" />
            </div>
          </div>
        </section>

        <section class="paper-section">
          <div class="section-heading">
            <span class="section-dot" aria-hidden="true" />
            <div>
              <p class="section-kicker">Portrait</p>
              <h4>形象信息</h4>
            </div>
          </div>

          <div class="paper-input-group">
            <label class="paper-label" for="music-artist-image">
              <span class="paper-label-dot" aria-hidden="true" />
              头像链接
            </label>
            <input id="music-artist-image" v-model="artistDraft.imageUrl" type="url" class="paper-input">
          </div>
        </section>

        <section class="paper-section">
          <div class="section-heading">
            <span class="section-dot" aria-hidden="true" />
            <div>
              <p class="section-kicker">Archive</p>
              <h4>档案信息</h4>
            </div>
          </div>

          <div class="paper-form-grid">
            <div class="paper-input-group">
              <label class="paper-label" for="music-artist-nationality">
                <span class="paper-label-dot" aria-hidden="true" />
                地区
              </label>
              <input id="music-artist-nationality" v-model="artistDraft.nationality" type="text" class="paper-input">
            </div>

            <div class="paper-input-group">
              <label class="paper-label" for="music-artist-birth-year">
                <span class="paper-label-dot" aria-hidden="true" />
                出生年月日
              </label>
              <input id="music-artist-birth-year" v-model="artistDraft.birthYear" type="number" class="paper-input">
            </div>
          </div>
        </section>

        <section class="paper-section">
          <div class="section-heading">
            <span class="section-dot" aria-hidden="true" />
            <div>
              <p class="section-kicker">Source</p>
              <h4>来源信息</h4>
            </div>
          </div>

          <div class="source-row">
            <div class="paper-input-group">
              <label class="paper-label">
                <span class="paper-label-dot" aria-hidden="true" />
                来源标题
              </label>
              <input v-model="sourceDraft.title" type="text" class="paper-input" placeholder="来源标题">
            </div>
            <div class="paper-input-group">
              <label class="paper-label">
                <span class="paper-label-dot" aria-hidden="true" />
                来源链接
              </label>
              <input v-model="sourceDraft.url" type="url" class="paper-input" placeholder="https://...">
            </div>
          </div>
        </section>

        <div class="paper-input-group">
          <label class="paper-label" for="music-edit-reason">
            <span class="paper-label-dot" aria-hidden="true" />
            编辑摘要
          </label>
          <textarea id="music-edit-reason" v-model="artistDraft.reason" data-test="edit-reason-input" class="paper-input paper-textarea" rows="3" required />
        </div>

        <p v-if="errorMessage" class="form-error">{{ errorMessage }}</p>
        <p v-if="successMessage" class="form-success">{{ successMessage }}</p>
        <button class="paper-submit" type="submit" :disabled="!canSubmit">{{ submitting ? '提交中...' : '提交 wiki 编辑' }}</button>
      </form>

      <form v-else-if="isAlbumForm" data-test="music-edit-submit" class="wiki-form" @submit.prevent="submitEdit">
        <section class="paper-section">
          <div class="section-heading">
            <span class="section-dot" aria-hidden="true" />
            <div>
              <p class="section-kicker">Basic</p>
              <h4>基本信息</h4>
            </div>
          </div>

          <div class="paper-form-grid">
            <div class="paper-input-group">
              <label class="paper-label" for="music-album-title">
                <span class="paper-label-dot" aria-hidden="true" />
                名字
              </label>
              <input id="music-album-title" v-model="albumDraft.title" data-test="album-title-input" type="text" class="paper-input">
            </div>
            <div class="paper-input-group paper-input-group--wide">
              <label class="paper-label" for="music-album-description">
                <span class="paper-label-dot" aria-hidden="true" />
                专辑简介
              </label>
              <textarea id="music-album-description" v-model="albumDraft.description" class="paper-input paper-textarea" rows="5" />
            </div>
          </div>
        </section>

        <section class="paper-section">
          <div class="section-heading">
            <span class="section-dot" aria-hidden="true" />
            <div>
              <p class="section-kicker">Archive</p>
              <h4>档案信息</h4>
            </div>
          </div>

          <div class="paper-form-grid">
            <div class="paper-input-group">
              <label class="paper-label" for="music-album-release-date">
                <span class="paper-label-dot" aria-hidden="true" />
                发行时间
              </label>
              <input id="music-album-release-date" v-model="albumDraft.releaseDate" data-test="album-release-date-input" type="date" class="paper-input">
            </div>
            <PChoiceField
              v-model="albumDraft.albumType"
              label="专辑类型"
              :options="albumTypeOptions"
              trigger-test-id="album-type-trigger"
              option-prefix="album-type-option-"
            />
          </div>
        </section>

        <section class="paper-section">
          <div class="section-heading">
            <span class="section-dot" aria-hidden="true" />
            <div>
              <p class="section-kicker">Source</p>
              <h4>来源信息</h4>
            </div>
          </div>

          <div class="source-row">
            <div class="paper-input-group">
              <label class="paper-label">
                <span class="paper-label-dot" aria-hidden="true" />
                来源标题
              </label>
              <input v-model="sourceDraft.title" type="text" class="paper-input" placeholder="来源标题">
            </div>
            <div class="paper-input-group">
              <label class="paper-label">
                <span class="paper-label-dot" aria-hidden="true" />
                来源链接
              </label>
              <input v-model="sourceDraft.url" type="url" class="paper-input" placeholder="https://...">
            </div>
          </div>
        </section>

        <div class="paper-input-group">
          <label class="paper-label" for="music-album-reason">
            <span class="paper-label-dot" aria-hidden="true" />
            编辑摘要
          </label>
          <textarea id="music-album-reason" v-model="albumDraft.reason" data-test="edit-reason-input" class="paper-input paper-textarea" rows="3" required />
        </div>

        <p v-if="errorMessage" class="form-error">{{ errorMessage }}</p>
        <p v-if="successMessage" class="form-success">{{ successMessage }}</p>
        <button class="paper-submit" type="submit" :disabled="!canSubmit">{{ submitting ? '提交中...' : '提交 wiki 编辑' }}</button>
      </form>

      <!-- History placeholder -->
      <div v-else-if="state.nestedAction === 'history'">
        <div class="history-item">
          <div><strong>v8 (PENDING)</strong></div>
          <div>修改简介</div>
        </div>
      </div>

      <div v-else-if="state.nestedAction === 'discussion'" class="history-item">
        <div><strong>Discussion</strong></div>
        <div>社区讨论占位内容。</div>
      </div>
    </div>
  </PSheet>
</template>

<style scoped>
.drawer-header { padding: 1.8rem 2rem 1rem; border-bottom: none; background: linear-gradient(180deg, color-mix(in srgb, var(--a-color-paper-wash) 82%, white), transparent); }
.eyebrow { margin: 0 0 0.45rem; color: var(--a-color-ink-soft); font-family: var(--a-font-meta); font-size: 0.78rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
.title { font-family: var(--a-font-serif); font-size: 1.7rem; margin: 0; }
.subtitle { margin: 0.55rem 0 0; color: var(--a-color-ink-soft); line-height: 1.6; max-width: 28rem; }
.drawer-body { padding: 1.6rem 2rem 2rem; }

.wiki-form { display: flex; flex-direction: column; gap: 1.1rem; }
.paper-section {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  padding: 1.1rem 1.15rem 1.2rem;
  border-radius: 8px;
  background: color-mix(in srgb, var(--a-color-paper-wash) 74%, white);
}
.section-heading { display: flex; align-items: flex-start; gap: 0.75rem; }
.section-dot,
.paper-label-dot,
.upload-trigger-dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--a-color-ink) 70%, transparent);
  flex-shrink: 0;
}
.section-kicker { margin: 0 0 0.2rem; color: var(--a-color-ink-soft); font-family: var(--a-font-meta); font-size: 0.74rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
.section-heading h4 { margin: 0; font-size: 1.05rem; font-family: var(--a-font-serif); }
.paper-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.1rem 1.4rem; }
.paper-input-group { display: flex; flex-direction: column; gap: 0.5rem; }
.paper-input-group--wide { grid-column: 1 / -1; }
.paper-label {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-family: var(--a-font-meta);
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  color: var(--a-color-ink-soft);
}
.paper-input {
  width: 100%;
  border: 0;
  border-bottom: 1px solid color-mix(in srgb, var(--a-color-ink) 22%, transparent);
  background: transparent;
  color: var(--a-color-ink);
  padding: 0 0 0.72rem;
  font-size: 1rem;
  font-family: inherit;
  transition: border-color 0.18s ease;
}
.paper-input:focus {
  outline: none;
  border-bottom-color: color-mix(in srgb, var(--a-color-ink) 58%, transparent);
}
.paper-textarea { resize: vertical; min-height: 6rem; line-height: 1.65; }
.source-row { display: grid; grid-template-columns: 1fr 1.35fr; gap: 1rem; }
.form-error { margin: 0; color: #b42318; font-weight: 800; font-size: 0.9rem; }
.form-success { margin: 0; color: #047857; font-weight: 800; font-size: 0.9rem; }
.paper-submit {
  width: 100%;
  border: 0;
  border-radius: 0px;
  padding: 0.95rem 1.5rem;
  font-weight: 800;
  background: color-mix(in srgb, var(--a-color-ink) 92%, #6b4f3a 8%);
  color: white;
  cursor: pointer;
  font-family: var(--a-font-meta);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.paper-submit:disabled { opacity: 0.55; cursor: not-allowed; }
.a-btn-secondary { border: 1.5px solid var(--a-color-ink); padding: 0.75rem 1rem; font-weight: bold; background: var(--a-color-paper); cursor: pointer; font-family: var(--a-font-meta); }
.a-btn-secondary:disabled { opacity: 0.55; cursor: not-allowed; }

.history-item { margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px dashed var(--a-color-line-soft); }

@media (max-width: 640px) {
  .paper-form-grid,
  .artist-search-row,
  .source-row { grid-template-columns: 1fr; }
}
</style>
