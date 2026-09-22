<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import PAvatar from '@/components/ui/PAvatar.vue'
import PCountryRegionField from '@/components/ui/PCountryRegionField.vue'
import PInput from '@/components/ui/PInput.vue'
import PMaskedDateInput from '@/components/ui/PMaskedDateInput.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import MusicSquareImageCropSheet from '@/components/music/MusicSquareImageCropSheet.vue'
import { createMusicArtist, listMusicArtists, uploadMusicAsset, type MusicArtistListItem } from '@/api/musicV1'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { useMusicCreationFlow } from './musicCreationFlowContext'
import { parsePartialDateParts, serializePartialDate } from '@/components/music/birthDateMask'
import { activeArtistRequiresFullProfile, activeMusicArtistDraft } from './musicCreationTypes'

const { state } = useMusicDrawers()

const creationFlowFallback = computed(() => state.value.creationFlow)
const creationFlow = useMusicCreationFlow(creationFlowFallback)
const artistDraft = computed(() => creationFlow.value ? activeMusicArtistDraft(creationFlow.value) : null)
const isGroup = computed(() => artistDraft.value?.kind === 'group')
const isEditMode = computed(() => creationFlow.value?.mode === 'edit')
const requiresFullProfile = computed(() => creationFlow.value ? activeArtistRequiresFullProfile(creationFlow.value) : true)
const isEditingContributor = computed(() => !!creationFlow.value?.editingContributorId)
const artistSearchRequired = computed(() => !!creationFlow.value?.artistBeforeMatch
  && !!artistDraft.value
  && !artistDraft.value.id
  && !artistSearchDraft.value)
const sourceFieldLabel = computed(() => isEditMode.value ? '修改原因*' : requiresFullProfile.value ? '来源*' : '来源')
const sourceFieldPlaceholder = computed(() => isEditMode.value ? '填写本次修改原因' : '填写来源')
const artistStepTitle = computed(() => isEditingContributor.value ? '新建创作者' : '新建艺术家')
const avatarUploading = ref(false)
const avatarErrorMessage = ref('')
const stageNameErrorMessage = ref('')
const groupErrorMessage = ref('')
const membersErrorMessage = ref('')
const personalErrorMessage = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)
const pendingAvatarFile = ref<File | null>(null)
const avatarPreviewUrl = ref('')
const memberResults = ref<Record<string, MusicArtistListItem[]>>({})
const memberBusyId = ref('')
const artistSearchQuery = ref('')
const artistSearchResults = ref<MusicArtistListItem[]>([])
const artistSearchBusy = ref(false)
const artistSearchError = ref('')
const artistSearchDraft = ref(false)
let artistSearchTimer: ReturnType<typeof setTimeout> | null = null
let memberSearchTimer: ReturnType<typeof setTimeout> | null = null
const artistKindOptions = [
  { label: '个人', value: 'person' as const, testid: 'artist-kind-person-button' },
  { label: '组合', value: 'group' as const, testid: 'artist-kind-group-button' },
]

function createEmptyDateParts() {
  return {
    year: '',
    month: '',
    day: '',
  }
}

function hasDatePartsValue(parts?: { year: string; month: string; day: string }) {
  if (!parts) return false
  return !!parts.year.trim() || !!parts.month.trim() || !!parts.day.trim()
}

function requiredLabel(label: string) {
  return `${label}*`
}

watch(
  artistDraft,
  (draft) => {
    if (!draft) return

    if (!draft.birthDateParts) {
      draft.birthDateParts = createEmptyDateParts()
    }

    if (!hasDatePartsValue(draft.birthDateParts) && draft.birthDate.trim()) {
      draft.birthDateParts = parsePartialDateParts(draft.birthDate)
    }

  },
  { immediate: true },
)

watch(
  () => artistDraft.value?.birthDateParts,
  (parts) => {
    if (!artistDraft.value) return
    artistDraft.value.birthDate = serializePartialDate(parts)
  },
  { deep: true, immediate: true },
)

const avatarDisplayUrl = computed(() => {
  if (avatarPreviewUrl.value) return avatarPreviewUrl.value
  return artistDraft.value?.avatarUrl || ''
})

function replaceAvatarPreviewUrl(file: File) {
  if (avatarPreviewUrl.value) {
    URL.revokeObjectURL(avatarPreviewUrl.value)
  }
  avatarPreviewUrl.value = URL.createObjectURL(file)
}

onBeforeUnmount(() => {
  if (artistSearchTimer) clearTimeout(artistSearchTimer)
  if (memberSearchTimer) clearTimeout(memberSearchTimer)
  if (avatarPreviewUrl.value) URL.revokeObjectURL(avatarPreviewUrl.value)
})

watch(
  () => artistDraft.value?.id,
  (id) => {
    if (id) artistSearchDraft.value = false
  },
  { immediate: true },
)

watch(artistSearchQuery, (value) => {
  if (artistSearchTimer) clearTimeout(artistSearchTimer)
  const query = value.trim()
  artistSearchError.value = ''
  if (!query || !artistSearchRequired.value) {
    artistSearchResults.value = []
    artistSearchBusy.value = false
    return
  }
  artistSearchTimer = setTimeout(() => void searchPrimaryArtist(query), 250)
})

async function searchPrimaryArtist(query: string) {
  artistSearchBusy.value = true
  try {
    const result = await listMusicArtists({ q: query, page: 1, page_size: 8 })
    artistSearchResults.value = result.data
  } catch (error) {
    artistSearchResults.value = []
    artistSearchError.value = error instanceof Error ? error.message : '搜索艺术家失败'
  } finally {
    artistSearchBusy.value = false
  }
}

function artistSource(artist: MusicArtistListItem) {
  const source = artist.sources?.find((item) => item.url?.trim() || item.title?.trim())
  return source?.url?.trim() || source?.title?.trim() || ''
}

function artistStageNames(artist: MusicArtistListItem) {
  try {
    const parsed = artist.stage_names_json ? JSON.parse(artist.stage_names_json) : []
    if (Array.isArray(parsed)) {
      const names = parsed.filter((item): item is { name: string; is_primary?: boolean; start_date_text?: string; end_date_text?: string } => (
        !!item && typeof item.name === 'string' && item.name.trim().length > 0
      ))
      if (names.length) {
        return names.map((item, index) => ({
          id: `stage-name-${artist.id}-${index}`,
          name: item.name,
          isPrimary: item.is_primary === true || index === 0,
          startDateParts: createEmptyDateParts(),
          endDateParts: createEmptyDateParts(),
          startDateText: item.start_date_text ?? '',
          endDateText: item.end_date_text ?? '',
        }))
      }
    }
  } catch {
    // 使用列表接口的主名称作为回退。
  }
  return [{
    id: `stage-name-${artist.id}-0`,
    name: artist.display_name || artist.name,
    isPrimary: true,
    startDateParts: createEmptyDateParts(),
    endDateParts: createEmptyDateParts(),
    startDateText: '',
    endDateText: '',
  }]
}

function selectPrimaryArtist(artist: MusicArtistListItem) {
  const draft = artistDraft.value
  if (!draft) return
  draft.id = artist.id
  draft.kind = artist.artist_form === 'group' ? 'group' : 'person'
  draft.legalName = artist.legal_name ?? ''
  draft.stageNames = artistStageNames(artist)
  draft.nationality = artist.nationality ?? ''
  draft.birthPlace = artist.birth_place ?? ''
  draft.birthDateParts = parsePartialDateParts(artist.birth_date ?? (artist.birth_year ? String(artist.birth_year) : ''))
  draft.birthDate = serializePartialDate(draft.birthDateParts)
  draft.activeStartDateParts = parsePartialDateParts(artist.active_start_date ?? '')
  draft.activeEndDateParts = parsePartialDateParts(artist.active_end_date ?? '')
  draft.bio = artist.bio ?? ''
  draft.avatarUrl = artist.image_url ?? ''
  draft.source = artistSource(artist)
  artistSearchQuery.value = artist.display_name || artist.name
  artistSearchResults.value = []
  artistSearchError.value = ''
}

function createPrimaryArtistDraft() {
  const name = artistSearchQuery.value.trim()
  if (!name || !artistDraft.value) return
  artistDraft.value.stageNames[0].name = name
  artistSearchDraft.value = true
  artistSearchResults.value = []
  artistSearchError.value = ''
}

function triggerFileInput() {
  fileInputRef.value?.click()
}

async function onAvatarChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  pendingAvatarFile.value = file
  input.value = ''
}

function clearPendingAvatarCrop() {
  pendingAvatarFile.value = null
}

async function confirmAvatarCrop(file: File) {
  const flow = creationFlow.value
  const draft = artistDraft.value
  if (!flow || !draft) return

  replaceAvatarPreviewUrl(file)
  avatarUploading.value = true
  avatarErrorMessage.value = ''
  flow.assetUploading = true
  clearPendingAvatarCrop()

  try {
    const asset = await uploadMusicAsset(file, 'music.cover')
    draft.avatarAsset = asset
    draft.avatarUrl = asset.url
  } catch (error) {
    avatarErrorMessage.value = error instanceof Error ? error.message : '头像上传失败'
  } finally {
    avatarUploading.value = false
    flow.assetUploading = false
  }
}

function addStageName() {
  if (!artistDraft.value) return

  artistDraft.value.stageNames.push({
    id: `stage-name-${Date.now()}-${artistDraft.value.stageNames.length + 1}`,
    name: '',
    isPrimary: false,
    startDateParts: createEmptyDateParts(),
    endDateParts: createEmptyDateParts(),
    startDateText: '',
    endDateText: '',
  })
}

function addMember() {
  if (!artistDraft.value) return

  artistDraft.value.members.push({
    id: `member-${Date.now()}-${artistDraft.value.members.length + 1}`,
    artistId: null,
    name: '',
    joinDateParts: createEmptyDateParts(),
    leaveDateParts: createEmptyDateParts(),
  })
}

function updateMemberName(member: NonNullable<typeof artistDraft.value>['members'][number]) {
  member.artistId = null
  membersErrorMessage.value = ''
  if (memberSearchTimer) clearTimeout(memberSearchTimer)
  memberSearchTimer = setTimeout(() => void searchMember(member), 250)
}

async function searchMember(member: NonNullable<typeof artistDraft.value>['members'][number]) {
  const query = member.name.trim()
  if (!query) {
    memberResults.value[member.id] = []
    return
  }
  memberBusyId.value = member.id
  try {
    const result = await listMusicArtists({ q: query, page: 1, page_size: 8 })
    memberResults.value[member.id] = result.data.filter((item) => item.entry_status !== 'draft' || item.created_by)
  } catch (error) {
    membersErrorMessage.value = error instanceof Error ? error.message : '搜索成员失败'
  } finally {
    if (memberBusyId.value === member.id) memberBusyId.value = ''
  }
}

function selectMember(member: NonNullable<typeof artistDraft.value>['members'][number], artist: MusicArtistListItem) {
  member.artistId = artist.id
  member.name = artist.display_name || artist.name
  memberResults.value[member.id] = []
  membersErrorMessage.value = ''
}

async function createMemberDraft(member: NonNullable<typeof artistDraft.value>['members'][number]) {
  if (!member.name.trim()) return
  memberBusyId.value = member.id
  membersErrorMessage.value = ''
  try {
    const artist = await createMusicArtist({
      name: member.name.trim(),
      draft_context: 'member',
    })
    member.artistId = artist.id
    member.name = artist.display_name || artist.name
    memberResults.value[member.id] = []
  } catch (error) {
    membersErrorMessage.value = error instanceof Error ? error.message : '创建成员草稿失败'
  } finally {
    if (memberBusyId.value === member.id) memberBusyId.value = ''
  }
}

function removeMember(memberId: string) {
  if (!artistDraft.value) return
  artistDraft.value.members = artistDraft.value.members.filter((member) => member.id !== memberId)
}

function setArtistKind(kind: 'person' | 'group') {
  if (!artistDraft.value) return
  artistDraft.value.kind = kind
  stageNameErrorMessage.value = ''
  groupErrorMessage.value = ''
  membersErrorMessage.value = ''
  personalErrorMessage.value = ''
}

function validateAndExpose() {
  const draft = artistDraft.value
  if (!draft) return false

  stageNameErrorMessage.value = ''
  groupErrorMessage.value = ''
  membersErrorMessage.value = ''
  personalErrorMessage.value = ''

  if (draft.stageNames.length > 1) {
    for (let i = 1; i < draft.stageNames.length; i++) {
      const item = draft.stageNames[i]
      if (item.name.trim() && (!item.startDateText.trim() || !item.endDateText.trim())) {
        stageNameErrorMessage.value = '请为追加艺名补充持续时间'
        return false
      }
    }
  }

  if (!requiresFullProfile.value) {
    if (!draft.stageNames[0]?.name.trim()) {
      stageNameErrorMessage.value = '请填写创作者名称'
      return false
    }
  } else if (draft.kind === 'group') {
    const namedMembers = draft.members.filter((member) => member.name.trim())
    if (namedMembers.length < 2) {
      membersErrorMessage.value = '组合至少需要 2 名成员'
      return false
    }
    if (namedMembers.some((member) => !member.joinDateParts?.year.trim())) {
      membersErrorMessage.value = '请为每位成员填写加入时间'
      return false
    }
    if (
      !draft.stageNames[0]?.name.trim() ||
      !hasDatePartsValue(draft.activeStartDateParts) ||
      !draft.source.trim()
    ) {
      return false
    }
  } else {
    if (
      !draft.legalName.trim() ||
      !draft.stageNames[0]?.name.trim() ||
      !draft.nationality.trim() ||
      !hasDatePartsValue(draft.birthDateParts) ||
      !draft.source.trim() ||
      !draft.avatarUrl.trim()
    ) {
      return false
    }
  }

  const { setMusicCreationStep } = useMusicDrawers()
  setMusicCreationStep('albumDetails')
  return true
}

defineExpose({
  validateAndExpose,
})
</script>

<template>
  <div v-if="artistDraft" class="artist-step" data-testid="artist-step">
    <MusicSquareImageCropSheet
      :show="!!pendingAvatarFile"
      :source-file="pendingAvatarFile"
      title="裁剪-头像"
      @cancel="clearPendingAvatarCrop"
      @confirm="confirmAvatarCrop"
    />

    <div class="artist-step-shell">
      <header class="artist-hero">
        <div class="artist-hero__meta">
          <p class="hero-step">第 1 步 / 艺术家信息</p>
        </div>
        <h4>{{ artistStepTitle }}</h4>
      </header>

      <section v-if="artistSearchRequired" class="artist-card artist-search-card" data-testid="artist-primary-search">
        <div class="card-header">
          <div>
            <p class="card-kicker">关联已有艺术家</p>
            <p class="card-copy">先搜索已有艺术家；找不到时可以创建一个艺术家草稿。</p>
          </div>
        </div>
        <PInput
          v-model="artistSearchQuery"
          data-testid="artist-primary-search-input"
          type="search"
          label="艺术家名称"
          placeholder="搜索艺术家"
        />
        <div v-if="artistSearchQuery.trim()" class="artist-search-results">
          <p v-if="artistSearchBusy" class="state-line">搜索中…</p>
          <p v-else-if="artistSearchError" class="state-line state-line--error">{{ artistSearchError }}</p>
          <template v-else-if="artistSearchResults.length">
            <button
              v-for="artist in artistSearchResults"
              :key="artist.id"
              :data-testid="`artist-primary-search-option-${artist.id}`"
              type="button"
              class="artist-search-result"
              @mousedown.prevent="selectPrimaryArtist(artist)"
            >
              <PAvatar :src="artist.image_url || undefined" :name="artist.display_name || artist.name" size="sm" />
              <span>{{ artist.display_name || artist.name }}</span>
              <small>{{ artist.artist_form === 'group' ? '组合' : '个人' }}</small>
            </button>
          </template>
          <div v-else class="artist-search-empty">
            <p class="state-line">没有找到匹配的艺术家</p>
            <button
              data-testid="artist-primary-create-draft"
              type="button"
              class="ui-action ui-action--inline"
              @click="createPrimaryArtistDraft"
            >
              创建“{{ artistSearchQuery.trim() }}”草稿
            </button>
          </div>
        </div>
      </section>

      <section v-if="creationFlow?.artistBeforeMatch && artistDraft.id && !artistSearchRequired" class="artist-card artist-selected-card" data-testid="artist-primary-selected">
        <PAvatar :src="artistDraft.avatarUrl || undefined" :name="artistDraft.stageNames[0]?.name || artistDraft.legalName" size="lg" />
        <div>
          <p class="card-kicker">已关联艺术家</p>
          <strong>{{ artistDraft.stageNames[0]?.name || artistDraft.legalName }}</strong>
          <p class="card-copy">将使用这个艺术家进行专辑匹配</p>
        </div>
      </section>

      <template v-if="!artistSearchRequired && !(creationFlow?.artistBeforeMatch && artistDraft.id)">

      <section class="artist-card artist-kind-card" data-testid="artist-kind-section">
        <p class="card-kicker">类型</p>
        <PSegmentedControl
          :model-value="artistDraft.kind"
          :options="artistKindOptions"
          aria-label="艺术家类型"
          @update:model-value="setArtistKind"
        />
      </section>

      <section class="artist-card artist-card--primary">
        <div class="card-header">
          <div>
            <p class="card-kicker">基本信息</p>
          </div>
        </div>

        <div class="artist-profile-grid">
          <div class="avatar-upload-section">
            <div class="field-group avatar-label-group">
              <span class="field-label">{{ requiresFullProfile && !isGroup ? requiredLabel('头像') : '头像' }}</span>
              <span class="field-hint">建议大于 600×600</span>
            </div>
            <div
              data-testid="artist-avatar-preview"
              class="avatar-uploader"
              :class="{ 'is-uploading': avatarUploading, 'is-square': true }"
              title="点击添加头像"
              @click="triggerFileInput"
            >
              <div class="artist-avatar-frame">
                <img
                  v-if="avatarDisplayUrl"
                  data-testid="artist-avatar-preview-image"
                  :src="avatarDisplayUrl"
                  :alt="artistDraft.stageNames[0]?.name || artistDraft.legalName || 'Artist'"
                  class="artist-avatar-image"
                >
                <PAvatar
                  v-else
                  :name="artistDraft.stageNames[0]?.name || artistDraft.legalName || 'Artist'"
                  size="xl"
                />
              </div>
              <div class="avatar-uploader-hover">
                <span v-if="avatarUploading">上传中...</span>
                <span v-else>{{ avatarDisplayUrl ? '修改头像' : '添加头像' }}</span>
              </div>
            </div>
            <input
              ref="fileInputRef"
              data-testid="artist-avatar-input"
              type="file"
              accept="image/*"
              style="display: none"
              :disabled="avatarUploading"
              @click.stop
              @change="onAvatarChange"
            />
          </div>

          <div class="artist-basic-fields" data-testid="artist-basic-fields">
            <div v-if="!isGroup" class="field-group single-line-field">
              <PInput
                v-model="artistDraft.legalName"
                data-testid="artist-legal-name-input"
                type="text"
                placeholder="例如 Kanye Omari West"
                :label="requiresFullProfile ? requiredLabel('本名') : '本名'"
              />
            </div>
            <div v-if="artistDraft.stageNames.length" class="field-group single-line-field">
              <PInput
                v-model="artistDraft.stageNames[0].name"
                :data-testid="isGroup ? 'artist-group-name-input' : 'artist-stage-name-input-0'"
                type="text"
                :label="isGroup ? (requiresFullProfile ? requiredLabel('组合名') : '组合名') : requiredLabel('主艺名')"
                :placeholder="isGroup ? '例如 Daft Punk' : '例如 Kanye West / Ye'"
                @update:model-value="() => { stageNameErrorMessage = ''; groupErrorMessage = '' }"
              />
            </div>
            <div v-if="!isGroup" class="field-group single-line-field">
              <PCountryRegionField
                v-model="artistDraft.nationality"
                :label="requiresFullProfile ? requiredLabel('国籍') : '国籍'"
                placeholder="选择国家或地区"
                trigger-test-id="artist-country-trigger"
                search-test-id="artist-country-search"
                option-prefix="artist-country-option-"
              />
            </div>
            <div v-if="!isGroup" class="single-line-field">
              <PMaskedDateInput v-model="artistDraft.birthDateParts" :label="requiresFullProfile ? requiredLabel('生日') : '生日'" testId="artist-birth-input" />
            </div>
            <div v-if="isGroup" class="single-line-field">
              <PMaskedDateInput
                v-model="artistDraft.activeStartDateParts"
                :label="requiresFullProfile ? requiredLabel('成立时间') : '成立时间'"
                testId="artist-group-start-date-input"
              />
            </div>
            <div v-if="isGroup" class="single-line-field">
              <PMaskedDateInput
                v-model="artistDraft.activeEndDateParts"
                label="结束时间"
                testId="artist-group-end-date-input"
                present-when-empty
              />
            </div>
          </div>
        </div>
        <div v-if="avatarErrorMessage" class="state-line state-line--error" style="margin-top: 0.5rem">{{ avatarErrorMessage }}</div>
        <p
          v-if="groupErrorMessage"
          data-testid="artist-group-error"
          class="state-line state-line--error"
        >
          {{ groupErrorMessage }}
        </p>
        <p
          v-if="personalErrorMessage && isGroup"
          data-testid="artist-source-error"
          class="state-line state-line--error"
        >
          {{ personalErrorMessage }}
        </p>
      </section>

      <section v-if="!isGroup" class="artist-card artist-card--soft">
        <div class="card-header">
          <div>
            <p class="card-kicker">艺名</p>
          </div>
          <button
            data-testid="artist-add-stage-name-button"
            type="button"
            class="ui-action ui-action--inline"
            @click="addStageName"
          >
            添加艺名
          </button>
        </div>

        <div class="field-stack">
          <template
            v-for="(stageName, index) in artistDraft.stageNames"
            :key="stageName.id"
          >
            <div
              v-if="index > 0"
              class="stage-name-card"
            >
              <div class="single-line-field">
                <PInput
                  v-model="stageName.name"
                  :data-testid="`artist-stage-name-input-${index}`"
                  type="text"
                  label="艺名"
                  placeholder="例如 Kanye West / Ye"
                  @update:model-value="stageNameErrorMessage = ''"
                />
              </div>
              <div class="stage-name-dates">
                <div class="single-line-field">
                  <PInput
                    v-model="stageName.startDateText"
                    :data-testid="`artist-stage-start-input-${index}`"
                    type="text"
                    label="开始时间"
                    placeholder="例如 2018"
                    @update:model-value="stageNameErrorMessage = ''"
                  />
                </div>
                <div class="single-line-field">
                  <PInput
                    v-model="stageName.endDateText"
                    :data-testid="`artist-stage-end-input-${index}`"
                    type="text"
                    label="结束时间"
                    placeholder="例如 2021 / 至今"
                    @update:model-value="stageNameErrorMessage = ''"
                  />
                </div>
              </div>
            </div>
          </template>

          <p
            v-if="stageNameErrorMessage"
            data-testid="artist-stage-name-error"
            class="state-line state-line--error"
          >
            {{ stageNameErrorMessage }}
          </p>
        </div>
      </section>

      <section v-if="isGroup" class="artist-card artist-card--soft">
        <div class="card-header">
          <div>
            <p class="card-kicker">组合成员</p>
          </div>
          <button
            data-testid="artist-add-member-button"
            type="button"
            class="ui-action ui-action--inline"
            @click="addMember"
          >
            添加成员
          </button>
        </div>

        <div class="field-stack">
          <div
            v-for="(member, index) in artistDraft.members"
            :key="member.id"
            class="stage-name-card member-card"
          >
            <div class="member-card__header">
              <span class="member-card__title">成员 {{ String(index + 1).padStart(2, '0') }}</span>
              <div class="member-card__actions">
                <button
                  v-if="!member.artistId"
                  type="button"
                  class="ui-action ui-action--inline"
                  :disabled="memberBusyId === member.id || !member.name.trim()"
                  @click="createMemberDraft(member)"
                >
                  {{ memberBusyId === member.id ? '处理中…' : '创建草稿' }}
                </button>
                <button
                  type="button"
                  class="ui-action ui-action--inline"
                  @click="removeMember(member.id)"
                >
                  删除
                </button>
              </div>
            </div>

            <div class="member-card__name single-line-field">
              <PInput
                v-model="member.name"
                :data-testid="`artist-member-name-input-${index}`"
                type="text"
                label="成员名"
                placeholder="例如 Thomas Bangalter"
                @update:model-value="updateMemberName(member)"
              />
            </div>

            <div v-if="memberResults[member.id]?.length" class="member-search-results">
              <button
                v-for="result in memberResults[member.id]"
                :key="result.id"
                type="button"
                class="member-search-result"
                @click="selectMember(member, result)"
              >
                {{ result.display_name || result.name }}
              </button>
            </div>

            <div class="member-card__dates">
              <div class="single-line-field">
                <PMaskedDateInput
                  v-model="member.joinDateParts"
                  :label="requiresFullProfile ? requiredLabel('加入时间') : '加入时间'"
                  :testId="`artist-member-join-input-${index}`"
                />
              </div>
              <div class="single-line-field">
                <PMaskedDateInput v-model="member.leaveDateParts" label="退出时间" :testId="`artist-member-leave-input-${index}`" present-when-empty />
              </div>
            </div>
          </div>

          <p
            v-if="membersErrorMessage"
            data-testid="artist-members-error"
            class="state-line state-line--error"
          >
            {{ membersErrorMessage }}
          </p>
        </div>
      </section>

      <section class="artist-card">
        <div class="card-header">
          <div>
            <p class="card-kicker">补充信息</p>
          </div>
        </div>

        <div class="supplementary-grid">
          <div class="field-group">
            <PTextarea
              v-model="artistDraft.bio"
              data-testid="artist-bio-input"
              :rows="4"
              placeholder="简要描述艺术家背景"
              label="简介"
            />
          </div>

          <div class="field-group">
            <PTextarea
              v-model="artistDraft.source"
              data-testid="artist-source-input"
              :rows="4"
              :placeholder="sourceFieldPlaceholder"
              :label="sourceFieldLabel"
            />
          </div>
          <p
            v-if="personalErrorMessage && !isGroup"
            data-testid="artist-personal-error"
            class="state-line state-line--error"
          >
            {{ personalErrorMessage }}
          </p>
          <button
            type="button"
            data-testid="artist-next-button"
            style="display: none"
            @click="validateAndExpose"
          />
        </div>
      </section>

      </template>

    </div>
  </div>
</template>

<style scoped>
.avatar-label-group {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}
.field-hint {
  color: var(--a-color-muted);
  font-size: 0.75rem;
}
.artist-step {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 1rem;
}

.artist-step-shell {
  display: grid;
  gap: 1rem;
}

.artist-search-card,
.artist-selected-card {
  grid-template-columns: minmax(0, 1fr);
}

.artist-search-results {
  display: grid;
  gap: 0.5rem;
  border-top: 1px solid var(--a-color-border-soft);
  padding-top: 0.75rem;
}

.artist-search-result {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.75rem;
  align-items: center;
  width: 100%;
  border: 1px solid var(--a-color-border-soft);
  padding: 0.7rem 0.8rem;
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
  text-align: left;
  cursor: pointer;
}

.artist-search-result:hover {
  border-color: var(--a-color-text);
}

.artist-search-result small {
  color: var(--a-color-muted);
}

.artist-selected-card {
  display: flex;
  gap: 0.9rem;
  align-items: center;
}

.artist-selected-card strong {
  display: block;
  margin-top: 0.35rem;
  font-size: 1.05rem;
}

.artist-search-empty {
  display: grid;
  gap: 0.65rem;
  justify-items: start;
}

.member-search-results {
  display: grid;
  border: 1px solid var(--a-color-border-soft);
}
.member-search-result {
  border: 0;
  border-bottom: 1px solid var(--a-color-border-soft);
  padding: 0.7rem;
  background: var(--a-color-bg);
  color: var(--a-color-text);
  text-align: left;
  cursor: pointer;
}
.member-search-result:last-child {
  border-bottom: 0;
}
.artist-hero {
  display: none !important;
  gap: 0.7rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.artist-hero__meta {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.hero-kicker,
.hero-step,
.card-kicker,
.field-label {
  margin: 0;
  color: var(--a-color-muted);
  font-family: var(--a-font-sans);
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.artist-hero h4 {
  margin: 0;
  font-family: var(--a-font-sans);
  font-size: 2rem;
  line-height: 1.05;
}

.hero-copy,
.card-copy {
  margin: 0;
  color: var(--a-color-muted);
  line-height: 1.7;
}

.artist-card {
  display: grid;
  gap: 1rem;
  padding: 1.15rem 1.2rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 4px;
  background: var(--a-color-bg);
}

.artist-card--primary {
  background: color-mix(in srgb, var(--a-color-bg) 82%, var(--a-color-surface));
}

.artist-card--soft {
  background: var(--a-color-surface);
}

.card-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  flex-wrap: wrap;
}

.artist-kind-card {
  grid-template-columns: max-content max-content;
  justify-content: start;
  align-items: center;
}

.artist-kind-card :deep(.p-segmented-control) {
  justify-self: start;
  width: fit-content;
  max-width: 100%;
}

.artist-profile-grid {
  display: grid;
  grid-template-columns: 10rem minmax(0, 1fr);
  gap: 1.5rem;
  align-items: start;
}

.avatar-upload-section {
  display: grid;
  gap: 0.75rem;
  align-content: start;
}

.avatar-uploader {
  position: relative;
  justify-self: start;
  cursor: pointer;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid var(--a-color-border-soft);
  padding: 4px;
  transition: border-color 0.2s ease, transform 0.1s ease;
}

.artist-avatar-frame {
  width: 8rem;
  height: 8rem;
  border-radius: 4px;
  overflow: hidden;
  background: var(--a-color-surface-muted);
}

.artist-avatar-frame :deep(.p-avatar) {
  width: 100%;
  height: 100%;
  border-radius: 4px;
}

.artist-avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.avatar-uploader:hover {
  border-color: var(--a-color-text);
  transform: translateY(1px);
}

.avatar-uploader:active {
  transform: translateY(2px);
}

.avatar-uploader-hover {
  position: absolute;
  inset: 4px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--a-font-sans);
  font-size: 0.72rem;
  font-weight: 800;
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}

.avatar-uploader:hover .avatar-uploader-hover,
.avatar-uploader.is-uploading .avatar-uploader-hover {
  opacity: 1;
}

.artist-basic-fields {
  display: grid;
  gap: 1rem;
  min-width: 0;
}

.field-stack { display: grid; gap: 1rem; }
.field-group { display: grid; gap: 0.45rem; }
.field-group--narrow { max-width: 16rem; }
.single-line-field :deep(.p-field),
.single-line-field :deep(.p-date-input-container),
.single-line-field :deep(.country-field) {
  display: grid;
  grid-template-columns: 5rem minmax(0, 1fr);
  align-items: center;
  gap: 0.75rem;
}
.single-line-field :deep(.p-field-label),
.single-line-field :deep(.field-label-row),
.single-line-field :deep(.country-field-label) {
  margin: 0;
  white-space: nowrap;
}
.single-line-field :deep(.p-field-error),
.single-line-field :deep(.p-field-hint) {
  grid-column: 2;
}
.stage-name-card {
  display: grid;
  gap: 0.75rem;
  padding: 0.95rem 1rem;
  border: 1px solid var(--a-color-border-soft);
  background: color-mix(in srgb, var(--a-color-surface-muted) 86%, var(--a-color-bg));
}

.stage-name-dates {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.member-card__header {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: center;
}

.member-card__title {
  color: var(--a-color-muted);
  font-size: 0.8rem;
  font-weight: 800;
}

.member-card__actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.member-card__dates,
.supplementary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

:deep(.p-input:focus),
:deep(.p-textarea:focus) {
  border-bottom-color: var(--a-color-text);
}

.state-line {
  margin: 0;
  color: var(--a-color-muted);
  font-size: 0.9rem;
  line-height: 1.5;
}

.state-line--error {
  color: var(--a-color-accent-destructive);
}

.step-actions {
  display: none !important;
}

.ui-action,
.primary-action {
  border: 0;
  border-radius: 0;
  padding: 0.85rem 1.2rem;
  font-family: var(--a-font-sans);
  font-weight: 800;
  cursor: pointer;
}

.ui-action {
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  color: var(--a-color-text);
  font-size: 0.78rem;
}

.primary-action {
  background: var(--a-color-text);
  color: var(--a-color-bg);
  transition: background-color 0.15s ease;
}

.primary-action:hover {
  background: color-mix(in srgb, var(--a-color-text) 86%, black);
}

@media (max-width: 720px) {
  .stage-name-dates,
  .member-card__dates,
  .supplementary-grid {
    grid-template-columns: 1fr;
  }

  .artist-profile-grid {
    grid-template-columns: 1fr;
  }

  .avatar-upload-section {
    justify-items: start;
  }

  .single-line-field :deep(.p-field),
  .single-line-field :deep(.p-date-input-container),
  .single-line-field :deep(.country-field) {
    grid-template-columns: 5rem minmax(0, 1fr);
  }

  .member-card__header {
    align-items: flex-start;
  }
}
</style>
