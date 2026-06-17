<template>
  <section class="timeline-event-form">
    <div class="form-group">
      <label class="form-label">标题 *</label>
      <PInput :model-value="form.title" placeholder="事件标题" @update:model-value="(value) => updateField('title', value)" />
    </div>

    <div class="form-row">
      <div class="form-group form-group-grow">
        <label class="form-label">事件时间 *</label>
        <PDatetimePicker :model-value="form.event_date" placeholder="选择事件时间" @update:model-value="(value) => updateField('event_date', value)" />
      </div>
      <div class="form-group form-group-grow">
        <label class="form-label">结束时间 (可选)</label>
        <PDatetimePicker :model-value="form.end_date" placeholder="选择结束时间" @update:model-value="(value) => updateField('end_date', value)" />
      </div>
    </div>

    <div class="form-row">
      <div class="form-group form-group-grow">
        <label class="form-label">所在位置 *</label>
        <PInput :model-value="form.location" placeholder="如 巴黎, 法国" @update:model-value="(value) => updateField('location', value)" />
      </div>
      <div class="form-group form-group-grow">
        <label class="form-label">分类</label>
        <PInput :model-value="form.category" placeholder="如 政治、科技、文化" @update:model-value="(value) => updateField('category', value)" />
      </div>
    </div>

    <div class="form-row">
      <div class="form-group form-group-grow">
        <label class="form-label">纬度</label>
        <PInput :model-value="displayLatitude" type="number" placeholder="48.8566" @update:model-value="(value) => updateNumberField('latitude', value)" />
      </div>
      <div class="form-group form-group-grow">
        <label class="form-label">经度</label>
        <PInput :model-value="displayLongitude" type="number" placeholder="2.3522" @update:model-value="(value) => updateNumberField('longitude', value)" />
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">来源 *</label>
      <PInput :model-value="form.source" placeholder="如 《法国大革命史》第3章 / https://..." @update:model-value="(value) => updateField('source', value)" />
    </div>

    <div class="form-group">
      <label class="form-label">摘要</label>
      <PTextarea :model-value="form.description" :rows="2" placeholder="一句话简介" @update:model-value="(value) => updateField('description', value)" />
    </div>

    <div class="form-group">
      <label class="form-label">内容</label>
      <PTextarea :model-value="form.content" :rows="5" placeholder="详细描述（支持 Markdown）" @update:model-value="(value) => updateField('content', value)" />
    </div>

    <div class="form-group">
      <label class="form-label">标签</label>
      <PInput :model-value="tagsInput" placeholder="战争, 革命, 法国" @update:model-value="(value) => $emit('update:tagsInput', value)" />
    </div>

    <label class="timeline-event-form__public-toggle">
      <input type="checkbox" :checked="form.is_public" @change="togglePublic" />
      <span>{{ form.is_public ? '所有人可见' : '仅自己可见' }}</span>
    </label>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PInput from '@/components/ui/PInput.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import PDatetimePicker from '@/components/ui/PDatetimePicker.vue'

type TimelineEventFormDraft = {
  title: string
  event_date: string
  end_date: string
  location: string
  latitude: number | null
  longitude: number | null
  source: string
  category: string
  description: string
  content: string
  is_public: boolean
}

const props = defineProps<{
  form: TimelineEventFormDraft
  tagsInput: string
}>()

const emit = defineEmits<{
  (e: 'update:form', value: TimelineEventFormDraft): void
  (e: 'update:tagsInput', value: string): void
}>()

const displayLatitude = computed(() => (props.form.latitude == null ? '' : String(props.form.latitude)))
const displayLongitude = computed(() => (props.form.longitude == null ? '' : String(props.form.longitude)))

function updateField<K extends keyof TimelineEventFormDraft>(field: K, value: TimelineEventFormDraft[K]) {
  emit('update:form', { ...props.form, [field]: value })
}

function updateNumberField(field: 'latitude' | 'longitude', value: string) {
  emit('update:form', {
    ...props.form,
    [field]: value === '' ? null : Number(value),
  })
}

function togglePublic(event: Event) {
  updateField('is_public', (event.target as HTMLInputElement).checked)
}
</script>

<style scoped>
.timeline-event-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-row {
  display: flex;
  gap: 1rem;
}

.form-group-grow {
  flex: 1;
}

.timeline-event-form__public-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--a-color-muted);
}

@media (max-width: 720px) {
  .form-row {
    flex-direction: column;
  }
}
</style>
