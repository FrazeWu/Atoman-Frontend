<template>
  <div class="a-page">
    <PPageHeader title="添加/补全艺术家" sub="向音乐档案库添加新的艺术家资料。" accent />

    <PSurface class="form-surface" tone="soft" :layer="1">
      <MusicArtistForm
        :initial-value="initialValue"
        :submitting="submitting"
        submit-label="创建艺术家"
        submitting-label="正在创建..."
        @submit="handleSubmit"
      />
    </PSurface>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { buildCreateArtistEdit, submitMusicEdit, type MusicArtistUpdateInput } from '@/api/musicV1'
import MusicArtistForm from '@/components/music/MusicArtistForm.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PSurface from '@/components/ui/PSurface.vue'

const router = useRouter()
const route = useRoute()

const submitting = ref(false)

const initialValue = computed(() => ({
  name: route.query.name ? String(route.query.name) : '',
}))

async function handleSubmit(value: MusicArtistUpdateInput) {
  submitting.value = true
  try {
    const result = await submitMusicEdit(buildCreateArtistEdit({
      ...value,
      reason: 'Create artist from wiki flow',
      sources: [],
    }))
    if (result.entity_id) {
      await router.push(`/artist/${result.entity_id}`)
      return
    }
    await router.push('/')
  } catch (error) {
    console.error('Failed to create artist:', error)
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.form-surface {
  max-width: 36rem;
  margin: 2rem auto;
  padding: 2.5rem;
  border: 1px solid var(--a-color-line-soft);
  box-shadow: 4px 4px 0 0 rgba(0, 0, 0, 0.15);
}
</style>
