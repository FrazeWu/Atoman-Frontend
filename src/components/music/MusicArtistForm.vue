<template>
  <form class="music-artist-form" data-test="artist-form" @submit.prevent="handleSubmit">
    <!-- Studio 2-Column 布局 Header -->
    <div class="music-artist-form__studio-head">
      <!-- 左侧：头像上传 & 预览 -->
      <div class="music-artist-form__avatar-card">
        <label class="field-label">头像</label>

        <input
          ref="avatarInputRef"
          type="file"
          accept="image/*"
          style="display: none"
          @change="onAvatarFileChange"
        >

        <div
          class="artist-avatar-picker"
          :class="{ 'is-uploading': uploadingAvatar }"
          @click="avatarInputRef?.click()"
        >
          <div v-if="form.image_url" class="avatar-preview-box">
            <img :src="form.image_url" alt="头像预览" class="avatar-img" />
            <div class="avatar-overlay">
              <span>更换头像</span>
            </div>
          </div>
          <div v-else class="avatar-placeholder-box">
            <UserRound :size="32" class="avatar-placeholder-icon" />
            <span class="avatar-picker-tip">{{ uploadingAvatar ? '正在上传...' : '上传头像' }}</span>
          </div>
        </div>

        <!-- 图片 URL 输入框 (兼容备用/测试) -->
        <PInput
          v-model="form.image_url"
          data-test="artist-image-input"
          placeholder="或粘贴图片 URL"
          class="avatar-url-input"
        />
      </div>

      <!-- 右侧：属性输入列 -->
      <div class="music-artist-form__main-fields">
        <!-- 艺术家名称 -->
        <PInput
          v-model="form.name"
          data-test="artist-name-input"
          label="艺术家名称"
          placeholder="例如：Kanye West"
          :error="errors.name"
          required
        />

        <!-- 地区与出生日期同行 -->
        <div class="music-artist-form__inline-row" data-test="artist-location-row">
          <PCountryRegionField
            v-model="form.nationality"
            label="地区"
            placeholder="选择国家或地区"
            trigger-test-id="artist-country-input"
            option-prefix="artist-country-option-"
          />

          <div class="music-artist-form__birth-group">
            <label class="music-artist-form__birth-label" for="artist-birth-date-input">出生年月日</label>
            <div class="music-artist-form__birth-field">
              <input
                id="artist-birth-date-input"
                :value="birthDateText"
                data-test="artist-birth-date-input"
                type="text"
                inputmode="numeric"
                class="music-artist-form__birth-input"
                placeholder="yyyy/mm/dd"
                @input="handleBirthDateInput"
              >
              <button
                type="button"
                class="music-artist-form__birth-trigger"
                data-test="artist-birth-picker-button"
                aria-label="选择出生年月日"
                @click="openBirthDatePicker"
              >
                <CalendarDays :size="16" />
              </button>
              <input
                ref="birthDatePickerRef"
                :value="birthDateNativeValue"
                type="date"
                class="music-artist-form__birth-native"
                tabindex="-1"
                aria-hidden="true"
                @change="onBirthDatePickerChange"
              >
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 个人履历 / 简介 (全宽) -->
    <PTextarea
      v-model="form.bio"
      data-test="artist-bio-input"
      label="个人简介 / 履历"
      placeholder="输入艺术家的详细生平、音乐风格和主要成就..."
      :rows="5"
    />

    <div class="music-artist-form__actions">
      <PButton type="submit" :variant="submitVariant" class="music-artist-form__submit" :disabled="submitting">
        {{ submitting ? submittingLabel : submitLabel }}
      </PButton>
    </div>
  </form>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { CalendarDays, UserRound } from 'lucide-vue-next'
import PButton from '@/components/ui/PButton.vue'
import PCountryRegionField from '@/components/ui/PCountryRegionField.vue'
import PInput from '@/components/ui/PInput.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import { uploadMusicAsset } from '@/api/musicV1'
import { formatBirthDateInput, getBirthDateCursorIndex, getBirthDateDigits } from '@/components/music/birthDateMask'
import type { MusicArtistUpdateInput } from '@/api/musicV1'

const props = withDefaults(defineProps<{
  initialValue?: MusicArtistUpdateInput
  submitLabel: string
  submitting?: boolean
  submittingLabel?: string
  submitVariant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'warning'
}>(), {
  initialValue: () => ({}),
  submitting: false,
  submittingLabel: '提交中...',
  submitVariant: 'primary',
})

const emit = defineEmits<{
  (e: 'submit', value: MusicArtistUpdateInput): void
}>()

const form = reactive({
  name: '',
  bio: '',
  image_url: '',
  nationality: '',
  birth_date: '',
})

const errors = reactive({
  name: '',
})
const avatarInputRef = ref<HTMLInputElement | null>(null)
const uploadingAvatar = ref(false)
const birthDatePickerRef = ref<HTMLInputElement | null>(null)
const birthDateDigits = ref('')

function applyInitialValue(value: MusicArtistUpdateInput = {}) {
  form.name = value.name ?? ''
  form.bio = value.bio ?? ''
  form.image_url = value.image_url ?? ''
  form.nationality = value.nationality ?? ''
  form.birth_date = value.birth_date ?? ''
  birthDateDigits.value = getBirthDateDigits(form.birth_date)
}

watch(() => props.initialValue, (value) => {
  applyInitialValue(value)
}, { immediate: true, deep: true })

const birthDateText = computed(() => formatBirthDateInput(birthDateDigits.value))
const birthDateNativeValue = computed(() => {
  const digits = birthDateDigits.value
  if (digits.length < 8) return ''
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
})

async function onAvatarFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  uploadingAvatar.value = true
  try {
    const uploaded = await uploadMusicAsset(file, 'music.cover')
    if (uploaded.url) {
      form.image_url = uploaded.url
    }
  } catch {
    // 允许本地创建 blob URL 预览
    form.image_url = URL.createObjectURL(file)
  } finally {
    uploadingAvatar.value = false
    input.value = ''
  }
}

function syncBirthDate(digits: string) {
  birthDateDigits.value = digits
  form.birth_date = digits.length === 8
    ? `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
    : ''
}

function handleBirthDateInput(event: Event) {
  const input = event.target as HTMLInputElement
  const selectionStart = input.selectionStart ?? input.value.length
  const digitCountBeforeCursor = getBirthDateDigits(input.value.slice(0, selectionStart)).length
  syncBirthDate(getBirthDateDigits(input.value))

  void nextTick(() => {
    const cursorIndex = getBirthDateCursorIndex(digitCountBeforeCursor)
    input.setSelectionRange(cursorIndex, cursorIndex)
  })
}

function openBirthDatePicker() {
  birthDatePickerRef.value?.showPicker?.()
  birthDatePickerRef.value?.focus()
}

function onBirthDatePickerChange(event: Event) {
  const input = event.target as HTMLInputElement
  syncBirthDate(getBirthDateDigits(input.value))
}

function handleSubmit() {
  errors.name = ''

  const name = form.name.trim()
  if (!name) {
    errors.name = '请输入艺术家名称'
    return
  }

  emit('submit', {
    name,
    bio: form.bio.trim() || undefined,
    image_url: form.image_url.trim() || undefined,
    nationality: form.nationality.trim() || undefined,
    birth_date: form.birth_date.trim() || undefined,
  })
}
</script>

<style scoped>
.music-artist-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.music-artist-form__studio-head {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  gap: 1.5rem;
  align-items: start;
}

.music-artist-form__avatar-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field-label {
  color: var(--a-color-muted);
  font-family: var(--a-font-sans);
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.artist-avatar-picker {
  aspect-ratio: 1 / 1;
  width: 100%;
  border: 1px dashed var(--a-color-border-soft);
  background: var(--a-color-bg);
  border-radius: var(--a-radius-card);
  cursor: pointer;
  overflow: hidden;
  position: relative;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.artist-avatar-picker:hover {
  border-color: var(--a-color-primary);
  background: var(--a-color-surface-muted);
}

.avatar-preview-box {
  position: relative;
  width: 100%;
  height: 100%;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  color: #ffffff;
  display: grid;
  place-items: center;
  font-size: 0.8125rem;
  font-weight: 500;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.avatar-preview-box:hover .avatar-overlay {
  opacity: 1;
}

.avatar-placeholder-box {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  color: var(--a-color-muted);
}

.avatar-placeholder-icon {
  color: var(--a-color-muted);
}

.avatar-picker-tip {
  font-size: 0.78rem;
  font-weight: 500;
}

.avatar-url-input {
  margin-top: 0.25rem;
}

.avatar-url-input :deep(.p-input) {
  min-height: 32px;
  font-size: 0.78rem;
  padding: 0.35rem 0.55rem;
}

.music-artist-form__main-fields {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.music-artist-form__inline-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  align-items: start;
}

.music-artist-form__birth-group {
  display: grid;
  gap: 0.45rem;
}

.music-artist-form__birth-label {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--a-color-muted);
  font-family: var(--a-font-sans);
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.05em;
}

.music-artist-form__birth-field {
  position: relative;
  display: flex;
  align-items: center;
  border-bottom: 1px solid color-mix(in srgb, var(--a-color-text) 22%, transparent);
  min-height: 2.75rem;
}

.music-artist-form__birth-field:focus-within {
  border-bottom-color: var(--a-color-accent-confirm);
}

.music-artist-form__birth-input {
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--a-color-text);
  padding: 0 2.75rem 0.72rem 0;
  font-size: 1rem;
  font-family: inherit;
  box-sizing: border-box;
}

.music-artist-form__birth-input:focus {
  outline: none;
}

.music-artist-form__birth-input::placeholder {
  color: color-mix(in srgb, var(--a-color-text) 28%, transparent);
}

.music-artist-form__birth-trigger {
  position: absolute;
  right: 0;
  bottom: 0.45rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: 0;
  background: transparent;
  color: color-mix(in srgb, var(--a-color-text) 72%, transparent);
  cursor: pointer;
}

.music-artist-form__birth-trigger:hover {
  color: var(--a-color-text);
}

.music-artist-form__birth-native {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
}

.music-artist-form__actions {
  margin-top: 0.5rem;
  display: flex;
  justify-content: flex-end;
}

.music-artist-form__submit {
  width: 100%;
}

@media (max-width: 768px) {
  .music-artist-form__studio-head {
    grid-template-columns: 1fr;
  }
  .music-artist-form__inline-row {
    grid-template-columns: 1fr;
  }
}
</style>
