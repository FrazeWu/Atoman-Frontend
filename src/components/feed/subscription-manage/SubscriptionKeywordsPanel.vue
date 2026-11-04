<template>
  <section class="filter-rules-section">
    <div class="filter-rules-header">
      <h3 class="a-title-xs">过滤规则</h3>
      <p class="a-muted">在当前设备上隐藏特定来源或关键词命中的条目。</p>
    </div>

    <PField label="隐藏关键词">
      <div class="inline-form">
        <PInput
          v-model="newKeyword"
          data-test="filter-keyword-input"
          placeholder="例如：剧透、广告、促销"
          :disabled="busy"
          @keydown.enter.prevent="submitKeyword"
        />
        <PButton variant="secondary" label="添加关键词" :disabled="busy" @click="submitKeyword" />
      </div>
    </PField>

    <div v-if="hiddenKeywords.length" class="rule-chip-list">
      <button
        v-for="keyword in hiddenKeywords"
        :key="keyword"
        type="button"
        class="rule-chip"
        data-test="hidden-keyword-chip"
        @click="$emit('remove-keyword', keyword)"
      >
        <span>{{ keyword }}</span>
        <span class="a-font-meta">移除关键词</span>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import PButton from '@/components/ui/PButton.vue'
import PField from '@/components/ui/PField.vue'
import PInput from '@/components/ui/PInput.vue'

const props = defineProps<{
  hiddenKeywords: string[]
  busy?: boolean
}>()

const emit = defineEmits<{
  (e: 'add-keyword', keyword: string): void
  (e: 'remove-keyword', keyword: string): void
}>()

const newKeyword = ref('')

const submitKeyword = () => {
  const keyword = newKeyword.value.trim()
  if (!keyword) return
  emit('add-keyword', keyword)
  newKeyword.value = ''
}
</script>
