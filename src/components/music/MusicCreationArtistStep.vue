<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { CalendarDays } from 'lucide-vue-next'
import PAvatar from '@/components/ui/PAvatar.vue'
import PCountryRegionField from '@/components/ui/PCountryRegionField.vue'
import PInput from '@/components/ui/PInput.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import MusicSquareImageCropSheet from '@/components/music/MusicSquareImageCropSheet.vue'
import { formatBirthDateInput, getBirthDateCursorIndex, getBirthDateDigits } from '@/components/music/birthDateMask'
import { uploadMusicAsset } from '@/api/musicV1'
import { useMusicDrawers } from '@/composables/useMusicDrawers'

const { state, setMusicCreationStep } = useMusicDrawers()

const creationFlow = computed(() => state.value.creationFlow)
const artistDraft = computed(() => creationFlow.value?.draft.artist ?? null)
const isGroup = computed(() => artistDraft.value?.kind === 'group')
const avatarUploading = ref(false)
const avatarErrorMessage = ref('')
const stageNameErrorMessage = ref('')
const groupErrorMessage = ref('')
const membersErrorMessage = ref('')
const personalErrorMessage = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)
const birthDatePickerRef = ref<HTMLInputElement | null>(null)
const pendingAvatarFile = ref<File | null>(null)
const avatarPreviewUrl = ref('')
const birthDateDigits = ref('')

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

function normalizeDatePart(value: string, length: number) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return trimmed.padStart(length, '0')
}

function parseDateToParts(value: string) {
  const [year = '', month = '', day = ''] = value.trim().split(/[-/]/)
  return { year, month, day }
}

function formatDateParts(parts?: { year: string; month: string; day: string }) {
  if (!parts) return ''

  const year = parts.year.trim()
  const month = normalizeDatePart(parts.month, 2)
  const day = normalizeDatePart(parts.day, 2)

  if (!year || !month || !day) return ''
  return `${year}-${month}-${day}`
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
      draft.birthDateParts = parseDateToParts(draft.birthDate)
    }

    const formattedBirthDate = formatDateParts(draft.birthDateParts) || draft.birthDate.trim()
    birthDateDigits.value = getBirthDateDigits(formattedBirthDate)
  },
  { immediate: true },
)

watch(
  () => artistDraft.value?.birthDateParts,
  (parts) => {
    if (!artistDraft.value) return
    artistDraft.value.birthDate = formatDateParts(parts)
  },
  { deep: true, immediate: true },
)

const avatarDisplayUrl = computed(() => {
  if (avatarPreviewUrl.value) return avatarPreviewUrl.value
  return artistDraft.value?.avatarUrl || ''
})

const birthDateModel = computed({
  get: () => {
    return formatBirthDateInput(birthDateDigits.value)
  },
  set: (value: string) => {
    if (!artistDraft.value) return
    birthDateDigits.value = value.replace(/\D/g, '').slice(0, 8)
    artistDraft.value.birthDateParts = parseDateToParts(formatBirthDateInput(birthDateDigits.value))
  },
})

const birthDateNativeValue = computed(() => artistDraft.value?.birthDate.trim() || '')

function replaceAvatarPreviewUrl(file: File) {
  if (avatarPreviewUrl.value) {
    URL.revokeObjectURL(avatarPreviewUrl.value)
  }
  avatarPreviewUrl.value = URL.createObjectURL(file)
}

function triggerFileInput() {
  fileInputRef.value?.click()
}

function openBirthDatePicker() {
  birthDatePickerRef.value?.showPicker?.()
  birthDatePickerRef.value?.focus()
}

function onBirthDatePickerChange(event: Event) {
  const input = event.target as HTMLInputElement
  birthDateModel.value = input.value.replaceAll('-', '/')
}

function handleBirthDateInput(event: Event) {
  const input = event.target as HTMLInputElement
  const selectionStart = input.selectionStart ?? input.value.length
  const digitCountBeforeCursor = getBirthDateDigits(input.value.slice(0, selectionStart)).length

  birthDateModel.value = input.value

  void nextTick(() => {
    const cursorIndex = getBirthDateCursorIndex(digitCountBeforeCursor)
    input.setSelectionRange(cursorIndex, cursorIndex)
  })
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
  if (!artistDraft.value) return

  replaceAvatarPreviewUrl(file)
  avatarUploading.value = true
  avatarErrorMessage.value = ''

  try {
    const asset = await uploadMusicAsset(file, 'music.cover')
    artistDraft.value.avatarAsset = asset
    artistDraft.value.avatarUrl = asset.url
  } catch (error) {
    avatarErrorMessage.value = error instanceof Error ? error.message : '头像上传失败'
  } finally {
    avatarUploading.value = false
    clearPendingAvatarCrop()
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
    name: '',
    joinDateParts: createEmptyDateParts(),
    leaveDateParts: createEmptyDateParts(),
  })
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

function validateStageNames() {
  if (!artistDraft.value) return false

  const hasInvalidAdditionalStage = artistDraft.value.stageNames.slice(1).some((item) => {
    return item.name.trim() && !item.startDateText.trim() && !item.endDateText.trim()
  })

  stageNameErrorMessage.value = hasInvalidAdditionalStage ? '请为追加艺名补充持续时间' : ''
  return !hasInvalidAdditionalStage
}

function validateGroupDraft() {
  if (!artistDraft.value) return false

  const hasGroupName = !!artistDraft.value.stageNames[0]?.name.trim()
  const hasStartYear = !!artistDraft.value.activeStartDateParts?.year.trim()
  const namedMembers = artistDraft.value.members.filter((member) => member.name.trim())
  const hasMissingJoinDate = namedMembers.some((member) => !member.joinDateParts.year.trim())

  groupErrorMessage.value = !hasGroupName
    ? '请填写组合名'
    : !hasStartYear
      ? '请填写组合成立时间'
      : ''
  membersErrorMessage.value = namedMembers.length < 2
    ? '组合至少需要 2 名成员'
    : hasMissingJoinDate
      ? '请为每位成员填写加入时间'
      : ''

  personalErrorMessage.value = !artistDraft.value.source.trim() ? '请填写来源' : ''

  return !groupErrorMessage.value && !membersErrorMessage.value && !personalErrorMessage.value
}

function validatePersonDraft() {
  if (!artistDraft.value) return false

  const hasAvatar = !!artistDraft.value.avatarUrl.trim()
  const hasLegalName = !!artistDraft.value.legalName.trim()
  const hasPrimaryStageName = !!artistDraft.value.stageNames[0]?.name.trim()
  const hasNationality = !!artistDraft.value.nationality.trim()
  const hasBirthDate = !!artistDraft.value.birthDate.trim()
  const hasSource = !!artistDraft.value.source.trim()

  personalErrorMessage.value = !hasAvatar
    ? '请上传头像'
    : !hasLegalName
      ? '请填写本名'
      : !hasPrimaryStageName
        ? '请填写主艺名'
        : !hasNationality
          ? '请填写国籍'
          : !hasBirthDate
            ? '请填写生日'
            : !hasSource
              ? '请填写来源'
              : ''

  return !personalErrorMessage.value && validateStageNames()
}

function goNext() {
  if (!artistDraft.value) return
  personalErrorMessage.value = ''
  if (isGroup.value) {
    if (!validateGroupDraft()) return
  } else {
    if (!validatePersonDraft()) return
  }
  setMusicCreationStep('albumImport')
}
</script>

<template>
  <div v-if="artistDraft" class="artist-step" data-testid="artist-step">
    <MusicSquareImageCropSheet
      :show="!!pendingAvatarFile"
      :source-file="pendingAvatarFile"
      title="裁剪头像"
      @cancel="clearPendingAvatarCrop"
      @confirm="confirmAvatarCrop"
    />

    <div class="artist-step-shell">
      <header class="artist-hero">
        <div class="artist-hero__meta">
          <p class="hero-step">第 1 步 / 艺术家信息</p>
        </div>
        <h4>新建艺术家</h4>
      </header>

      <section class="artist-card artist-card--primary">
        <div class="card-header">
          <div>
            <p class="card-kicker">基本信息</p>
          </div>
        </div>

        <div class="kind-switch">
          <button
            data-testid="artist-kind-person-button"
            type="button"
            class="kind-switch__button"
            :class="{ 'is-active': !isGroup }"
            @click="setArtistKind('person')"
          >
            个人
          </button>
          <button
            data-testid="artist-kind-group-button"
            type="button"
            class="kind-switch__button"
            :class="{ 'is-active': isGroup }"
            @click="setArtistKind('group')"
          >
            组合
          </button>
        </div>

        <div class="avatar-upload-section">
          <div v-if="!isGroup" class="field-group">
            <span class="field-label">{{ requiredLabel('头像') }}</span>
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

          <div class="avatar-upload-fields">
            <div v-if="!isGroup" class="field-group">
              <PInput
                v-model="artistDraft.legalName"
                data-testid="artist-legal-name-input"
                type="text"
                placeholder="例如 Kanye Omari West"
                :label="requiredLabel('本名')"
              />
            </div>
            <div v-if="artistDraft.stageNames.length" class="field-group">
              <PInput
                v-model="artistDraft.stageNames[0].name"
                :data-testid="isGroup ? 'artist-group-name-input' : 'artist-stage-name-input-0'"
                type="text"
                :label="isGroup ? requiredLabel('组合名') : requiredLabel('主艺名')"
                :placeholder="isGroup ? '例如 Daft Punk' : '例如 Kanye West / Ye'"
                @update:model-value="() => { stageNameErrorMessage = ''; groupErrorMessage = '' }"
              />
            </div>
            <div v-if="isGroup" class="field-grid field-grid--duo">
              <div class="field-group">
                <span class="field-label">{{ requiredLabel('成立时间') }}</span>
                <div class="date-parts-grid">
                  <PInput
                    v-model="artistDraft.activeStartDateParts.year"
                    data-testid="artist-group-start-year-input"
                    type="text"
                    inputmode="numeric"
                    placeholder="年"
                    label="年份"
                  />
                  <PInput
                    v-model="artistDraft.activeStartDateParts.month"
                    data-testid="artist-group-start-month-input"
                    type="text"
                    inputmode="numeric"
                    placeholder="月"
                    label="月份"
                  />
                  <PInput
                    v-model="artistDraft.activeStartDateParts.day"
                    data-testid="artist-group-start-day-input"
                    type="text"
                    inputmode="numeric"
                    placeholder="日"
                    label="日期"
                  />
                </div>
              </div>
              <div class="field-group">
                <span class="field-label">结束时间</span>
                <div class="date-parts-grid">
                  <PInput
                    v-model="artistDraft.activeEndDateParts.year"
                    data-testid="artist-group-end-year-input"
                    type="text"
                    inputmode="numeric"
                    placeholder="年"
                    label="年份"
                  />
                  <PInput
                    v-model="artistDraft.activeEndDateParts.month"
                    data-testid="artist-group-end-month-input"
                    type="text"
                    inputmode="numeric"
                    placeholder="月"
                    label="月份"
                  />
                  <PInput
                    v-model="artistDraft.activeEndDateParts.day"
                    data-testid="artist-group-end-day-input"
                    type="text"
                    inputmode="numeric"
                    placeholder="日"
                    label="日期"
                  />
                </div>
              </div>
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
            class="paper-action paper-action--inline"
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
              <PInput
                v-model="stageName.name"
                :data-testid="`artist-stage-name-input-${index}`"
                type="text"
                label="艺名"
                placeholder="例如 Kanye West / Ye"
                @update:model-value="stageNameErrorMessage = ''"
              />
              <div class="stage-name-dates">
                <PInput
                  v-model="stageName.startDateText"
                  :data-testid="`artist-stage-start-input-${index}`"
                  type="text"
                  label="开始时间"
                  placeholder="例如 2018"
                  @update:model-value="stageNameErrorMessage = ''"
                />
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
            class="paper-action paper-action--inline"
            @click="addMember"
          >
            添加成员
          </button>
        </div>

        <div class="field-stack">
          <div
            v-for="(member, index) in artistDraft.members"
            :key="member.id"
            class="stage-name-card"
          >
            <div class="member-card__header">
              <PInput
                v-model="member.name"
                :data-testid="`artist-member-name-input-${index}`"
                type="text"
                label="成员名"
                placeholder="例如 Thomas Bangalter"
                @update:model-value="membersErrorMessage = ''"
              />
              <button
                type="button"
                class="paper-action paper-action--inline"
                @click="removeMember(member.id)"
              >
                删除
              </button>
            </div>

            <div class="field-grid field-grid--duo">
              <div class="field-group">
                <span class="field-label">{{ requiredLabel('加入时间') }}</span>
                <div class="date-parts-grid">
                  <PInput
                    v-model="member.joinDateParts.year"
                    :data-testid="`artist-member-join-year-input-${index}`"
                    type="text"
                    inputmode="numeric"
                    placeholder="年"
                    label="年份"
                  />
                  <PInput
                    v-model="member.joinDateParts.month"
                    :data-testid="`artist-member-join-month-input-${index}`"
                    type="text"
                    inputmode="numeric"
                    placeholder="月"
                    label="月份"
                  />
                  <PInput
                    v-model="member.joinDateParts.day"
                    :data-testid="`artist-member-join-day-input-${index}`"
                    type="text"
                    inputmode="numeric"
                    placeholder="日"
                    label="日期"
                  />
                </div>
              </div>

              <div class="field-group">
                <span class="field-label">退出时间</span>
                <div class="date-parts-grid">
                  <PInput
                    v-model="member.leaveDateParts.year"
                    :data-testid="`artist-member-leave-year-input-${index}`"
                    type="text"
                    inputmode="numeric"
                    placeholder="年"
                    label="年份"
                  />
                  <PInput
                    v-model="member.leaveDateParts.month"
                    :data-testid="`artist-member-leave-month-input-${index}`"
                    type="text"
                    inputmode="numeric"
                    placeholder="月"
                    label="月份"
                  />
                  <PInput
                    v-model="member.leaveDateParts.day"
                    :data-testid="`artist-member-leave-day-input-${index}`"
                    type="text"
                    inputmode="numeric"
                    placeholder="日"
                    label="日期"
                  />
                </div>
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

        <div class="field-stack">
          <div v-if="!isGroup" class="field-grid field-grid--duo">
            <div class="field-group">
              <PCountryRegionField
                v-model="artistDraft.nationality"
                :label="requiredLabel('国籍')"
                placeholder="选择国家或地区"
                trigger-test-id="artist-country-trigger"
                search-test-id="artist-country-search"
                option-prefix="artist-country-option-"
              />
            </div>
            <div class="field-group">
              <label class="field-label" for="artist-birth-input">{{ requiredLabel('生日') }}</label>
              <div class="birth-date-field">
              <input
                id="artist-birth-input"
                :value="birthDateModel"
                data-testid="artist-birth-input"
                type="text"
                inputmode="numeric"
                class="birth-date-input"
                placeholder="yyyy/mm/dd"
                @input="handleBirthDateInput"
              >
                <button
                  type="button"
                  class="birth-date-trigger"
                  data-testid="artist-birth-picker-button"
                  aria-label="选择生日"
                  @click="openBirthDatePicker"
                >
                  <CalendarDays :size="18" />
                </button>
                <input
                  ref="birthDatePickerRef"
                  :value="birthDateNativeValue"
                  type="date"
                  class="birth-date-native"
                  tabindex="-1"
                  aria-hidden="true"
                  @change="onBirthDatePickerChange"
                >
              </div>
            </div>
          </div>

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
              placeholder="填写来源"
              :label="requiredLabel('来源')"
            />
          </div>
          <p
            v-if="personalErrorMessage && !isGroup"
            data-testid="artist-personal-error"
            class="state-line state-line--error"
          >
            {{ personalErrorMessage }}
          </p>
        </div>
      </section>

      <div class="step-actions">
        <button
          data-testid="artist-next-button"
          type="button"
          class="paper-submit"
          :disabled="avatarUploading"
          @click="goNext"
        >
          下一步
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
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

.artist-hero {
  display: none !important;
  gap: 0.7rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--a-color-line-soft);
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
  color: var(--a-color-ink-soft);
  font-family: var(--a-font-meta);
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.artist-hero h4 {
  margin: 0;
  font-family: var(--a-font-serif);
  font-size: 2rem;
  line-height: 1.05;
}

.hero-copy,
.card-copy {
  margin: 0;
  color: var(--a-color-ink-soft);
  line-height: 1.7;
}

.artist-card {
  display: grid;
  gap: 1rem;
  padding: 1.15rem 1.2rem;
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper);
}

.artist-card--primary {
  background: color-mix(in srgb, var(--a-color-paper) 82%, var(--a-color-paper-soft));
}

.artist-card--soft {
  background: var(--a-color-paper-soft);
}

.card-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  flex-wrap: wrap;
}

.kind-switch {
  display: inline-flex;
  gap: 0.5rem;
}

.kind-switch__button {
  border: 1px solid var(--a-color-line-soft);
  border-radius: 0;
  padding: 0.55rem 0.9rem;
  background: var(--a-color-paper);
  color: var(--a-color-ink-soft);
  font-family: var(--a-font-meta);
  font-size: 0.78rem;
  font-weight: 800;
  cursor: pointer;
}

.kind-switch__button.is-active {
  border-color: var(--a-color-ink);
  background: var(--a-color-ink);
  color: var(--a-color-paper);
}

.avatar-upload-section {
  display: flex;
  gap: 1.5rem;
  align-items: center;
}

.avatar-uploader {
  position: relative;
  cursor: pointer;
  border-radius: 0;
  overflow: hidden;
  border: 2px dashed var(--a-color-line-soft);
  padding: 4px;
  transition: border-color 0.2s ease, transform 0.1s ease;
}

.artist-avatar-frame {
  width: 8rem;
  height: 8rem;
  border-radius: 0;
  overflow: hidden;
  background: var(--a-color-paper-wash);
}

.artist-avatar-frame :deep(.p-avatar) {
  width: 100%;
  height: 100%;
  border-radius: 0;
}

.artist-avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.avatar-uploader:hover {
  border-color: var(--a-color-ink);
  transform: scale(1.02);
}

.avatar-uploader:active {
  transform: scale(0.98);
}

.avatar-uploader-hover {
  position: absolute;
  inset: 4px;
  border-radius: 0;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--a-font-meta);
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

.avatar-upload-fields {
  flex: 1;
  display: grid;
  gap: 1rem;
}

.birth-date-field {
  position: relative;
  display: flex;
  align-items: center;
  border: 1px solid color-mix(in srgb, var(--a-color-ink) 22%, transparent);
  background: var(--a-color-paper);
  min-height: 3.2rem;
}

.birth-date-field:focus-within {
  border-color: var(--a-color-accent-confirm);
}

.birth-date-input {
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--a-color-ink);
  padding: 0.85rem 3rem 0.85rem 0.95rem;
  font: inherit;
  box-sizing: border-box;
}

.birth-date-input:focus {
  outline: none;
}

.birth-date-input::placeholder {
  color: color-mix(in srgb, var(--a-color-ink) 28%, transparent);
}

.birth-date-trigger {
  position: absolute;
  right: 0.55rem;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: 0;
  background: transparent;
  color: color-mix(in srgb, var(--a-color-ink) 72%, transparent);
  cursor: pointer;
}

.birth-date-trigger:hover {
  color: var(--a-color-ink);
}

.birth-date-native {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
}

.field-stack { display: grid; gap: 1rem; }
.field-grid { display: grid; gap: 1rem; }
.field-grid--duo { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.field-group { display: grid; gap: 0.45rem; }
.field-group--narrow { max-width: 16rem; }
.date-parts-grid { display: grid; gap: 0.75rem; grid-template-columns: repeat(3, minmax(0, 1fr)); }

.stage-name-card {
  display: grid;
  gap: 0.75rem;
  padding: 0.95rem 1rem;
  border: 1px solid var(--a-color-line-soft);
  background: color-mix(in srgb, var(--a-color-paper-wash) 86%, var(--a-color-paper));
}

.stage-name-dates {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.member-card__header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.75rem;
  align-items: end;
}

:deep(.p-input:focus),
:deep(.p-textarea:focus) {
  border-bottom-color: var(--a-color-ink);
}

.state-line {
  margin: 0;
  color: var(--a-color-ink-soft);
  font-size: 0.9rem;
  line-height: 1.5;
}

.state-line--error {
  color: var(--a-color-accent-destructive);
}

.step-actions {
  display: none !important;
}

.paper-action,
.paper-submit {
  border: 0;
  border-radius: 0;
  padding: 0.85rem 1.2rem;
  font-family: var(--a-font-meta);
  font-weight: 800;
  cursor: pointer;
}

.paper-action {
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper);
  color: var(--a-color-ink);
  font-size: 0.78rem;
}

.paper-submit {
  background: var(--a-color-ink);
  color: var(--a-color-paper);
  transition: background-color 0.15s ease;
}

.paper-submit:hover {
  background: color-mix(in srgb, var(--a-color-ink) 86%, black);
}

@media (max-width: 720px) {
  .field-grid--duo,
  .stage-name-dates,
  .date-parts-grid {
    grid-template-columns: 1fr;
  }

  .avatar-upload-section {
    flex-direction: column;
  }
}
</style>
