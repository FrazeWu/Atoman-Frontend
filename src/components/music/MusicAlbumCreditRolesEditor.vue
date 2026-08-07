<script setup lang="ts">
import { ref } from 'vue'
import { Plus, X } from 'lucide-vue-next'
import PInput from '@/components/ui/PInput.vue'
import type { MusicAlbumArtistRole } from '@/api/musicV1'
import { albumArtistRoleLabels } from '@/utils/musicAlbumCredits'

type RoleDraft = { id: string; role: MusicAlbumArtistRole; label: string }

const props = defineProps<{ modelValue: RoleDraft[] }>()
const emit = defineEmits<{ (event: 'update:modelValue', value: RoleDraft[]): void }>()

const customRole = ref('')
const fixedRoles = Object.entries(albumArtistRoleLabels) as Array<[Exclude<MusicAlbumArtistRole, 'custom'>, string]>

function hasRole(role: MusicAlbumArtistRole) {
  return props.modelValue.some((item) => item.role === role)
}

function toggleRole(role: Exclude<MusicAlbumArtistRole, 'custom'>, checked: boolean) {
  if (checked && !hasRole(role)) {
    emit('update:modelValue', [...props.modelValue, { id: `role-${role}-${Date.now()}`, role, label: '' }])
    return
  }
  if (!checked) {
    emit('update:modelValue', props.modelValue.filter((item) => item.role !== role))
  }
}

function addCustomRole() {
  const label = customRole.value.trim()
  if (!label || props.modelValue.some((item) => item.role === 'custom' && item.label.trim().toLowerCase() === label.toLowerCase())) return
  emit('update:modelValue', [...props.modelValue, { id: `role-custom-${Date.now()}`, role: 'custom', label }])
  customRole.value = ''
}

function removeRole(id: string) {
  emit('update:modelValue', props.modelValue.filter((item) => item.id !== id))
}
</script>

<template>
  <div class="credit-roles" aria-label="创作者身份">
    <div class="credit-roles__fixed">
      <label v-for="[role, label] in fixedRoles" :key="role" class="credit-role-option">
        <input
          type="checkbox"
          :checked="hasRole(role)"
          :data-testid="`album-credit-role-${role}`"
          @change="toggleRole(role, ($event.target as HTMLInputElement).checked)"
        />
        <span>{{ label }}</span>
      </label>
    </div>

    <div v-if="modelValue.some((item) => item.role === 'custom')" class="credit-roles__custom-list">
      <span v-for="role in modelValue.filter((item) => item.role === 'custom')" :key="role.id" class="custom-role">
        {{ role.label }}
        <button type="button" :title="`移除${role.label}`" :aria-label="`移除${role.label}`" @click="removeRole(role.id)">
          <X :size="14" aria-hidden="true" />
        </button>
      </span>
    </div>

    <div class="credit-roles__custom-add">
      <PInput v-model="customRole" label="自定义身份" placeholder="输入身份" @keyup.enter.prevent="addCustomRole" />
      <button type="button" title="添加自定义身份" aria-label="添加自定义身份" @click="addCustomRole">
        <Plus :size="18" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.credit-roles { display: grid; gap: 0.65rem; }
.credit-roles__fixed { display: flex; flex-wrap: wrap; gap: 0.5rem 0.9rem; }
.credit-role-option { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; color: var(--a-color-text); cursor: pointer; }
.credit-role-option input { width: 1rem; height: 1rem; accent-color: var(--a-color-text); }
.credit-roles__custom-list { display: flex; flex-wrap: wrap; gap: 0.45rem; }
.custom-role { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.35rem 0.5rem; border: 1px solid var(--a-color-border-soft); font-size: 0.78rem; }
.custom-role button,
.credit-roles__custom-add > button { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border: 0; background: transparent; color: inherit; cursor: pointer; }
.custom-role button { width: 20px; height: 20px; }
.credit-roles__custom-add { display: grid; grid-template-columns: minmax(0, 16rem) 36px; gap: 0.4rem; align-items: end; }
</style>
