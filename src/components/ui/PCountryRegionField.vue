<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { allCountries } from 'country-region-data'

type CountryTuple = [string, string, Array<[string, string]>]

type RegionOption = {
  id: string
  label: string
  value: string
  country: string
  region?: string
}

const props = withDefaults(defineProps<{
  modelValue: string
  label?: string
  placeholder?: string
  searchPlaceholder?: string
  disabled?: boolean
  triggerTestId?: string
  searchTestId?: string
  optionPrefix?: string
}>(), {
  label: '地区',
  placeholder: '选择国家或地区',
  searchPlaceholder: '搜索国家或地区',
  disabled: false,
  triggerTestId: 'artist-nationality-trigger',
  searchTestId: 'artist-nationality-search-input',
  optionPrefix: 'artist-nationality-option-',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const rootRef = ref<HTMLElement | null>(null)
const panelOpen = ref(false)
const search = ref('')

const options = computed<RegionOption[]>(() => {
  const normalized = allCountries as CountryTuple[]
  return normalized.flatMap(([countryName, countryCode, regions]) => {
    const baseOption: RegionOption = {
      id: `${countryCode}-country`,
      label: countryName,
      value: countryName,
      country: countryName,
    }
    const regionOptions = regions.map(([regionName, regionCode]) => ({
      id: `${countryCode}-${regionCode}`,
      label: `${countryName} / ${regionName}`,
      value: `${countryName} / ${regionName}`,
      country: countryName,
      region: regionName,
    }))
    return [baseOption, ...regionOptions]
  })
})

const selectedLabel = computed(() => props.modelValue.trim())

const filteredOptions = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return options.value.slice(0, 80)
  return options.value.filter((option) => option.label.toLowerCase().includes(query)).slice(0, 80)
})

function openPanel() {
  if (props.disabled) return
  panelOpen.value = true
}

function closePanel() {
  panelOpen.value = false
  search.value = ''
}

function togglePanel() {
  if (panelOpen.value) {
    closePanel()
    return
  }
  openPanel()
}

function chooseOption(option: RegionOption) {
  emit('update:modelValue', option.value)
  closePanel()
}

function optionTestId(option: RegionOption) {
  const token = option.region || option.country
  return `${props.optionPrefix}${token}`
}

function handleClickOutside(event: MouseEvent) {
  const target = event.target as Node
  if (rootRef.value && !rootRef.value.contains(target)) {
    closePanel()
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onBeforeUnmount(() => document.removeEventListener('click', handleClickOutside))
</script>

<template>
  <div ref="rootRef" class="paper-field" :class="{ 'paper-field--open': panelOpen }">
    <label class="paper-field-label">
      <span class="paper-field-dot" aria-hidden="true" />
      <span>{{ label }}</span>
    </label>

    <button
      :data-test="triggerTestId"
      type="button"
      class="paper-field-trigger"
      :class="{ 'paper-field-trigger--selected': !!selectedLabel }"
      :disabled="disabled"
      @click="togglePanel"
    >
      <span :class="{ 'paper-field-placeholder': !selectedLabel }">{{ selectedLabel || placeholder }}</span>
      <span class="paper-field-trigger-meta">{{ panelOpen ? '收起' : '选择' }}</span>
    </button>

    <div v-if="panelOpen" class="paper-field-panel">
      <div class="paper-field-search-row">
        <span class="paper-field-search-dot" aria-hidden="true" />
        <input
          :data-test="searchTestId"
          v-model="search"
          type="text"
          class="paper-field-search"
          :placeholder="searchPlaceholder"
        >
      </div>

      <div class="paper-field-options">
        <button
          v-for="option in filteredOptions"
          :key="option.id"
          :data-test="optionTestId(option)"
          type="button"
          class="paper-field-option"
          :class="{ 'paper-field-option--active': option.value === modelValue }"
          @click="chooseOption(option)"
        >
          <span class="paper-field-option-marker">{{ option.value === modelValue ? '•' : '' }}</span>
          <span>{{ option.label }}</span>
        </button>
        <p v-if="!filteredOptions.length" class="paper-field-empty">没有匹配的国家或地区</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.paper-field {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.paper-field-label {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--a-color-ink-soft);
  font-family: var(--a-font-meta);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.06em;
}

.paper-field-dot,
.paper-field-search-dot {
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--a-color-ink) 70%, transparent);
  opacity: 0.35;
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.paper-field--open .paper-field-dot,
.paper-field-trigger--selected + .paper-field-trigger-meta,
.paper-field--open .paper-field-search-dot {
  opacity: 1;
}

.paper-field-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0 0 0.7rem;
  border: 0;
  border-bottom: 1px solid color-mix(in srgb, var(--a-color-ink) 22%, transparent);
  background: transparent;
  color: var(--a-color-ink);
  text-align: left;
  font: inherit;
  cursor: pointer;
  transition: border-color 0.18s ease, color 0.18s ease;
}

.paper-field-trigger:hover,
.paper-field-trigger:focus-visible,
.paper-field--open .paper-field-trigger {
  outline: none;
  border-bottom-color: var(--a-color-accent-confirm);
}

.paper-field-placeholder,
.paper-field-trigger-meta {
  color: var(--a-color-ink-soft);
}

.paper-field-trigger-meta {
  font-family: var(--a-font-meta);
  font-size: 0.75rem;
  letter-spacing: 0.06em;
}

.paper-field-panel {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 1rem 1.05rem 1.05rem;
  border-radius: 0px;
  background: #ffffff; /* pure white */
  border: 1px solid var(--a-color-line-soft);
  box-shadow: 3px 3px 0px rgba(0, 0, 0, 0.15);
}

.paper-field-search-row {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding-bottom: 0.7rem;
  border-bottom: 1px solid color-mix(in srgb, var(--a-color-ink) 15%, transparent);
}

.paper-field-search {
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--a-color-ink);
  font: inherit;
  padding: 0;
}

.paper-field-search:focus {
  outline: none;
}

.paper-field-options {
  max-height: 17rem;
  overflow: auto;
  display: flex;
  flex-direction: column;
}

.paper-field-option {
  display: grid;
  grid-template-columns: 1rem 1fr;
  align-items: start;
  gap: 0.45rem;
  padding: 0.68rem 0;
  border: 0;
  border-bottom: 1px solid color-mix(in srgb, var(--a-color-ink) 10%, transparent);
  background: transparent;
  color: var(--a-color-ink);
  text-align: left;
  cursor: pointer;
  font: inherit;
}

.paper-field-option:hover,
.paper-field-option--active {
  color: var(--a-color-accent-confirm);
}

.paper-field-option-marker {
  color: var(--a-color-accent-confirm);
}

.paper-field-empty {
  margin: 0;
  padding: 0.5rem 0 0;
  color: var(--a-color-ink-soft);
  font-size: 0.92rem;
}
</style>
