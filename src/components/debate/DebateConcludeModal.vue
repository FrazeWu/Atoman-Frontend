<template>
  <PModal v-if="show" @close="$emit('close')">
    <div class="p-6">
      <h3 class="a-title-sm mb-6">结题</h3>
      <form @submit.prevent="$emit('submit')" class="space-y-4">
        <div class="a-field">
          <label class="a-field-label">结论</label>
          <div class="flex gap-4 mt-2">
            <label
              v-for="opt in conclusionOptions"
              :key="opt.value"
              class="flex items-center gap-2 cursor-pointer"
            >
              <input
                type="radio"
                :checked="modelValue.conclusion_type === opt.value"
                :value="opt.value"
                class="w-4 h-4"
                @change="$emit('update:modelValue', { ...modelValue, conclusion_type: opt.value })"
              />
              <span
                class="text-xs font-black px-3 py-1 border-2"
                :style="opt.style"
              >
                {{ opt.label }}
              </span>
            </label>
          </div>
        </div>
        <div class="a-field">
          <PTextarea
            :model-value="modelValue.conclusion_summary"
            :rows="3"
            placeholder="详细说明结论..."
            label="结论说明（可选）"
            @update:model-value="$emit('update:modelValue', { ...modelValue, conclusion_summary: $event })"
          />
        </div>
        <div class="flex justify-end gap-4 mt-6">
          <PButton outline type="button" @click="$emit('close')">取消</PButton>
          <PButton type="submit" :disabled="concluding || !modelValue.conclusion_type">
            {{ concluding ? '结题中...' : '确认结题' }}
          </PButton>
        </div>
      </form>
    </div>
  </PModal>
</template>

<script setup lang="ts">
import PButton from '@/components/ui/PButton.vue'
import PModal from '@/components/ui/PModal.vue'
import PTextarea from '@/components/ui/PTextarea.vue'

const props = defineProps<{
  show: boolean
  modelValue: { conclusion_type: 'yes' | 'no' | ''; conclusion_summary: string }
  concluding: boolean
  conclusionOptions: Array<{ label: string; value: 'yes' | 'no'; style: Record<string, string> }>
}>()

defineEmits<{
  (e: 'close'): void
  (e: 'submit'): void
  (e: 'update:modelValue', value: { conclusion_type: 'yes' | 'no' | ''; conclusion_summary: string }): void
}>()
</script>
