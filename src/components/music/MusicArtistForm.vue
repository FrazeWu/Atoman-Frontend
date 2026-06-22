<template>
  <form class="music-artist-form" data-test="artist-form" @submit.prevent="handleSubmit">
    <div class="music-artist-form__fields">
      <PInput
        v-model="form.name"
        data-test="artist-name-input"
        label="艺术家名称"
        placeholder="例如：Kanye West"
        :error="errors.name"
        required
      />

      <PTextarea
        v-model="form.bio"
        data-test="artist-bio-input"
        label="个人简介 / 履历"
        placeholder="输入艺术家的详细生平、音乐风格和主要成就..."
        :rows="6"
      />

      <PInput
        v-model="form.image_url"
        data-test="artist-image-input"
        label="头像链接"
        placeholder="https://example.com/artist.jpg"
      />

      <PInput
        v-model="form.nationality"
        data-test="artist-country-input"
        label="地区"
        placeholder="例如：US"
      />

      <PInput
        v-model="form.birth_date"
        data-test="artist-birth-date-input"
        label="出生年月日"
        placeholder="YYYY-MM-DD"
      />
    </div>

    <div class="music-artist-form__actions">
      <PButton type="submit" class="music-artist-form__submit" :disabled="submitting">
        {{ submitting ? submittingLabel : submitLabel }}
      </PButton>
    </div>
  </form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import type { MusicArtistUpdateInput } from '@/api/musicV1'

const props = withDefaults(defineProps<{
  initialValue?: MusicArtistUpdateInput
  submitLabel: string
  submitting?: boolean
  submittingLabel?: string
}>(), {
  initialValue: () => ({}),
  submitting: false,
  submittingLabel: '提交中...',
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

function applyInitialValue(value: MusicArtistUpdateInput = {}) {
  form.name = value.name ?? ''
  form.bio = value.bio ?? ''
  form.image_url = value.image_url ?? ''
  form.nationality = value.nationality ?? ''
  form.birth_date = value.birth_date ?? ''
}

watch(() => props.initialValue, (value) => {
  applyInitialValue(value)
}, { immediate: true, deep: true })

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
  gap: 2rem;
}

.music-artist-form__fields {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.music-artist-form__actions {
  margin-top: 1rem;
  display: flex;
  justify-content: flex-end;
}

.music-artist-form__submit {
  width: 100%;
}
</style>
