<script setup lang="ts">
import { ref } from 'vue'
import { IconPlus as Plus, IconX as X } from '@tabler/icons-vue'
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

    <div class="credit-roles__custom-add">
      <PInput v-model="customRole" label="自定义身份" placeholder="输入身份" @keyup.enter.prevent="addCustomRole" />
      <button type="button" title="添加自定义身份" aria-label="添加自定义身份" @click="addCustomRole">
        <Plus :size="18" aria-hidden="true" />
      </button>
    </div>

    <div v-if="modelValue.some((item) => item.role === 'custom')" class="credit-roles__custom-list">
      <span v-for="role in modelValue.filter((item) => item.role === 'custom')" :key="role.id" class="custom-role">
        {{ role.label }}
        <button type="button" :title="`移除${role.label}`" :aria-label="`移除${role.label}`" @click="removeRole(role.id)">
          <X :size="14" aria-hidden="true" />
        </button>
      </span>
    </div>

  </div>
</template>

<style scoped>
.credit-roles {
  container: credit-roles / inline-size;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 8rem), 1fr));
  align-items: start;
  gap: 0.5rem 0.75rem;
}
.credit-roles__fixed { display: contents; }
.credit-role-option { display: inline-flex; min-width: 0; min-height: 44px; align-items: center; gap: 0.4rem; font-size: 0.8rem; color: var(--a-color-text); cursor: pointer; white-space: nowrap; }
.credit-role-option span { min-width: 0; }
.credit-role-option input { width: 1rem; height: 1rem; flex: 0 0 auto; accent-color: var(--a-color-text); }
.credit-roles__custom-list { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 0.45rem; }
.custom-role { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.35rem 0.5rem; border: 1px solid var(--a-color-border-soft); font-size: 0.78rem; }
.custom-role button,
.credit-roles__custom-add > button { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border: 0; background: transparent; color: inherit; cursor: pointer; }
.custom-role button { width: 20px; height: 20px; }
.credit-roles__custom-add { grid-column: 1 / -1; display: grid; grid-template-columns: minmax(0, 22rem) auto; justify-content: start; align-items: center; gap: 0.5rem; }
.credit-roles__custom-add :deep(.p-field) { display: grid; grid-template-columns: max-content minmax(0, 1fr); align-items: center; gap: 0.75rem; }
.credit-roles__custom-add :deep(.p-field-label) { margin: 0; white-space: nowrap; }
.credit-roles__custom-add :deep(.p-field-label)::after { content: '：'; }
.credit-roles__custom-add :deep(.p-input) { width: 100%; }
.credit-roles__custom-add > button { border: 1px solid var(--a-color-border-soft); background: var(--a-color-bg); }

@container credit-roles (max-width: 24rem) {
  .credit-roles__custom-add {
    grid-template-columns: minmax(0, 1fr) auto;
    justify-content: stretch;
  }

  .credit-roles__custom-add :deep(.p-field) {
    grid-template-columns: minmax(0, 1fr);
    align-items: stretch;
    gap: 0.35rem;
  }
}
</style>
