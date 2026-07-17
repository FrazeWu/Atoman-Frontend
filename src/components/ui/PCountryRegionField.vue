<script setup lang="ts">
import { computed, ref } from 'vue'
import { allCountries } from 'country-region-data'

type ContinentCode = 'AF' | 'AN' | 'AS' | 'EU' | 'NA' | 'OC' | 'SA'

type CountryOption = {
  name: string
  code: string
  continentCode: ContinentCode
  continentLabel: string
}

const CONTINENT_CODE_BY_COUNTRY: Record<string, ContinentCode> = {
  AD: 'EU',
  AE: 'AS',
  AF: 'AS',
  AG: 'NA',
  AI: 'NA',
  AL: 'EU',
  AM: 'AS',
  AO: 'AF',
  AQ: 'AN',
  AR: 'SA',
  AS: 'OC',
  AT: 'EU',
  AU: 'OC',
  AW: 'NA',
  AX: 'EU',
  AZ: 'AS',
  BA: 'EU',
  BB: 'NA',
  BD: 'AS',
  BE: 'EU',
  BF: 'AF',
  BG: 'EU',
  BH: 'AS',
  BI: 'AF',
  BJ: 'AF',
  BL: 'NA',
  BM: 'NA',
  BN: 'AS',
  BO: 'SA',
  BQ: 'NA',
  BR: 'SA',
  BS: 'NA',
  BT: 'AS',
  BV: 'AN',
  BW: 'AF',
  BY: 'EU',
  BZ: 'NA',
  CA: 'NA',
  CC: 'AS',
  CD: 'AF',
  CF: 'AF',
  CG: 'AF',
  CH: 'EU',
  CI: 'AF',
  CK: 'OC',
  CL: 'SA',
  CM: 'AF',
  CN: 'AS',
  CO: 'SA',
  CR: 'NA',
  CU: 'NA',
  CV: 'AF',
  CW: 'NA',
  CX: 'AS',
  CY: 'EU',
  CZ: 'EU',
  DE: 'EU',
  DJ: 'AF',
  DK: 'EU',
  DM: 'NA',
  DO: 'NA',
  DZ: 'AF',
  EC: 'SA',
  EE: 'EU',
  EG: 'AF',
  EH: 'AF',
  ER: 'AF',
  ES: 'EU',
  ET: 'AF',
  FI: 'EU',
  FJ: 'OC',
  FK: 'SA',
  FM: 'OC',
  FO: 'EU',
  FR: 'EU',
  GA: 'AF',
  GB: 'EU',
  GD: 'NA',
  GE: 'AS',
  GF: 'SA',
  GG: 'EU',
  GH: 'AF',
  GI: 'EU',
  GL: 'NA',
  GM: 'AF',
  GN: 'AF',
  GP: 'NA',
  GQ: 'AF',
  GR: 'EU',
  GS: 'AN',
  GT: 'NA',
  GU: 'OC',
  GW: 'AF',
  GY: 'SA',
  HK: 'AS',
  HM: 'AN',
  HN: 'NA',
  HR: 'EU',
  HT: 'NA',
  HU: 'EU',
  ID: 'AS',
  IE: 'EU',
  IL: 'AS',
  IM: 'EU',
  IN: 'AS',
  IO: 'AS',
  IQ: 'AS',
  IR: 'AS',
  IS: 'EU',
  IT: 'EU',
  JE: 'EU',
  JM: 'NA',
  JO: 'AS',
  JP: 'AS',
  KE: 'AF',
  KG: 'AS',
  KH: 'AS',
  KI: 'OC',
  KM: 'AF',
  KN: 'NA',
  KP: 'AS',
  KR: 'AS',
  KW: 'AS',
  KY: 'NA',
  KZ: 'AS',
  LA: 'AS',
  LB: 'AS',
  LC: 'NA',
  LI: 'EU',
  LK: 'AS',
  LR: 'AF',
  LS: 'AF',
  LT: 'EU',
  LU: 'EU',
  LV: 'EU',
  LY: 'AF',
  MA: 'AF',
  MC: 'EU',
  MD: 'EU',
  ME: 'EU',
  MF: 'NA',
  MG: 'AF',
  MH: 'OC',
  MK: 'EU',
  ML: 'AF',
  MM: 'AS',
  MN: 'AS',
  MO: 'AS',
  MP: 'OC',
  MQ: 'NA',
  MR: 'AF',
  MS: 'NA',
  MT: 'EU',
  MU: 'AF',
  MV: 'AS',
  MW: 'AF',
  MX: 'NA',
  MY: 'AS',
  MZ: 'AF',
  NA: 'AF',
  NC: 'OC',
  NE: 'AF',
  NF: 'OC',
  NG: 'AF',
  NI: 'NA',
  NL: 'EU',
  NO: 'EU',
  NP: 'AS',
  NR: 'OC',
  NU: 'OC',
  NZ: 'OC',
  OM: 'AS',
  PA: 'NA',
  PE: 'SA',
  PF: 'OC',
  PG: 'OC',
  PH: 'AS',
  PK: 'AS',
  PL: 'EU',
  PM: 'NA',
  PN: 'OC',
  PR: 'NA',
  PS: 'AS',
  PT: 'EU',
  PW: 'OC',
  PY: 'SA',
  QA: 'AS',
  RE: 'AF',
  RO: 'EU',
  RS: 'EU',
  RU: 'EU',
  RW: 'AF',
  SA: 'AS',
  SB: 'OC',
  SC: 'AF',
  SD: 'AF',
  SE: 'EU',
  SG: 'AS',
  SH: 'AF',
  SI: 'EU',
  SJ: 'EU',
  SK: 'EU',
  SL: 'AF',
  SM: 'EU',
  SN: 'AF',
  SO: 'AF',
  SR: 'SA',
  SS: 'AF',
  ST: 'AF',
  SV: 'NA',
  SX: 'NA',
  SY: 'AS',
  SZ: 'AF',
  TC: 'NA',
  TD: 'AF',
  TF: 'AN',
  TG: 'AF',
  TH: 'AS',
  TJ: 'AS',
  TK: 'OC',
  TL: 'OC',
  TM: 'AS',
  TN: 'AF',
  TO: 'OC',
  TR: 'AS',
  TT: 'NA',
  TV: 'OC',
  TW: 'AS',
  TZ: 'AF',
  UA: 'EU',
  UG: 'AF',
  UM: 'OC',
  US: 'NA',
  UY: 'SA',
  UZ: 'AS',
  VA: 'EU',
  VC: 'NA',
  VE: 'SA',
  VG: 'NA',
  VI: 'NA',
  VN: 'AS',
  VU: 'OC',
  WF: 'OC',
  WS: 'OC',
  XK: 'EU',
  YE: 'AS',
  YT: 'AF',
  ZA: 'AF',
  ZM: 'AF',
  ZW: 'AF',
}

const CONTINENT_META: Array<{ code: ContinentCode, label: string }> = [
  { code: 'AS', label: '亚洲' },
  { code: 'EU', label: '欧洲' },
  { code: 'NA', label: '北美洲' },
  { code: 'SA', label: '南美洲' },
  { code: 'OC', label: '大洋洲' },
  { code: 'AF', label: '非洲' },
  { code: 'AN', label: '南极洲' },
]

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

const panelOpen = ref(false)
const selectedContinentCode = ref<ContinentCode | null>(null)
const regionNamesInChinese = typeof Intl !== 'undefined' && typeof Intl.DisplayNames !== 'undefined'
  ? new Intl.DisplayNames(['zh-CN'], { type: 'region' })
  : null
const COMMON_COUNTRY_CODES = ['CN', 'US', 'GB', 'JP', 'KR', 'FR', 'DE', 'CA', 'AU', 'IT'] as const

function normalizeCountryEntry(entry: unknown) {
  if (!Array.isArray(entry)) return null

  const [countryName, countryShortCode] = entry
  if (typeof countryName !== 'string' || typeof countryShortCode !== 'string') return null

  const name = countryName.trim()
  const code = countryShortCode.trim().toUpperCase()
  if (!name || !code) return null

  return { name, code }
}

const countryOptions = computed<CountryOption[]>(() => {
  return allCountries
    .map(normalizeCountryEntry)
    .map((country) => {
      if (!country) return null

      const continentCode = CONTINENT_CODE_BY_COUNTRY[country.code]
      if (!continentCode) return null

      const continentLabel = CONTINENT_META.find((item) => item.code === continentCode)?.label ?? ''
      const localizedName = regionNamesInChinese?.of(country.code)?.trim() || country.name

      return {
        name: localizedName,
        code: country.code,
        continentCode,
        continentLabel,
      }
    })
    .filter((option): option is CountryOption => Boolean(option))
    .sort((left, right) => left.name.localeCompare(right.name))
})

const countryByName = computed(() => {
  const entries = countryOptions.value.flatMap((country) => {
    const localizedEntry: [string, CountryOption] = [country.name, country]
    const englishEntry = normalizeCountryEntry(
      allCountries.find((entry) => Array.isArray(entry) && entry[1] === country.code),
    )

    return englishEntry
      ? [localizedEntry, [englishEntry.name, country] as [string, CountryOption]]
      : [localizedEntry]
  })

  return new Map(entries)
})

const continentOptions = computed(() => {
  return CONTINENT_META.filter((continent) =>
    countryOptions.value.some((country) => country.continentCode === continent.code),
  )
})

const currentCountry = computed(() => countryByName.value.get(props.modelValue.trim()) ?? null)
const activeContinentCode = computed(() => selectedContinentCode.value ?? currentCountry.value?.continentCode ?? null)
const selectedLabel = computed(() => currentCountry.value?.name ?? props.modelValue.trim())
const commonCountryOptions = computed(() => {
  const commonCountryCodeSet = new Set<string>(COMMON_COUNTRY_CODES)
  return countryOptions.value.filter((country) => commonCountryCodeSet.has(country.code))
})

const countriesInActiveContinent = computed(() => {
  if (!activeContinentCode.value) return commonCountryOptions.value
  return countryOptions.value.filter((country) => country.continentCode === activeContinentCode.value)
})

function openPanel() {
  if (props.disabled) return
  selectedContinentCode.value = currentCountry.value?.continentCode ?? null
  panelOpen.value = true
}

function closePanel() {
  panelOpen.value = false
}

function togglePanel() {
  if (panelOpen.value) {
    closePanel()
    return
  }

  openPanel()
}

function chooseContinent(code: ContinentCode) {
  selectedContinentCode.value = code
}

function chooseCountry(country: CountryOption) {
  emit('update:modelValue', country.name)
  closePanel()
}
</script>

<template>
  <div class="paper-field" :class="{ 'paper-field--open': panelOpen }">
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

    <div
      v-if="panelOpen"
      data-test="artist-nationality-dialog"
      class="paper-field-dialog-backdrop"
      @click.self="closePanel"
    >
      <div class="paper-field-dialog">
        <div class="paper-field-dialog-header">
          <div>
            <p class="paper-field-dialog-kicker">国籍选择</p>
            <h3 class="paper-field-dialog-title">先选洲，再选国家或地区</h3>
          </div>

          <button type="button" class="paper-field-dialog-close" @click="closePanel">
            关闭
          </button>
        </div>

        <div class="paper-field-dialog-grid">
          <section class="paper-field-dialog-section">
            <p class="paper-field-section-title">选择洲</p>
            <div class="paper-field-continent-list">
              <button
                v-for="continent in continentOptions"
                :key="continent.code"
                :data-test="`artist-nationality-continent-${continent.code === 'AS' ? 'Asia' : continent.label}`"
                type="button"
                class="paper-field-continent"
                :class="{ 'paper-field-continent--active': continent.code === activeContinentCode }"
                @click="chooseContinent(continent.code)"
              >
                <span>{{ continent.label }}</span>
              </button>
            </div>
          </section>

          <section class="paper-field-dialog-section">
            <p class="paper-field-section-title">
              {{ activeContinentCode ? '选择国家或地区' : '请选择国家' }}
            </p>
            <div class="paper-field-country-list">
              <button
                v-for="country in countriesInActiveContinent"
                :key="country.code"
                :data-test="`${optionPrefix}${country.name}`"
                type="button"
                class="paper-field-country"
                :class="{ 'paper-field-country--active': country.name === selectedLabel }"
                @click="chooseCountry(country)"
              >
                <span>{{ country.name }}</span>
              </button>
              <p v-if="!countriesInActiveContinent.length" class="paper-field-empty">
                请先从左侧选择洲
              </p>
            </div>
          </section>
        </div>
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

.paper-field-dot {
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--a-color-ink) 70%, transparent);
  opacity: 0.35;
  transition: opacity 0.18s ease;
}

.paper-field--open .paper-field-dot {
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

.paper-field-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: rgba(16, 18, 20, 0.24);
}

.paper-field-dialog {
  width: min(56rem, 100%);
  max-height: min(44rem, calc(100vh - 3rem));
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.4rem;
  border: 1px solid var(--a-color-line-soft);
  background: #fff;
  box-shadow: 8px 8px 0 rgba(0, 0, 0, 0.16);
}

.paper-field-dialog-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.paper-field-dialog-kicker {
  margin: 0 0 0.25rem;
  color: var(--a-color-ink-soft);
  font-family: var(--a-font-meta);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.paper-field-dialog-title {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--a-color-ink);
}

.paper-field-dialog-close {
  border: 1px solid var(--a-color-line-soft);
  background: #fff;
  color: var(--a-color-ink-soft);
  font: inherit;
  padding: 0.45rem 0.8rem;
  cursor: pointer;
}

.paper-field-dialog-grid {
  display: grid;
  grid-template-columns: minmax(12rem, 14rem) minmax(0, 1fr);
  gap: 1rem;
  min-height: 24rem;
}

.paper-field-dialog-section {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.paper-field-section-title {
  margin: 0 0 0.85rem;
  color: var(--a-color-ink-soft);
  font-family: var(--a-font-meta);
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.paper-field-continent-list,
.paper-field-country-list {
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  border-top: 1px solid color-mix(in srgb, var(--a-color-ink) 10%, transparent);
}

.paper-field-continent,
.paper-field-country {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.82rem 0;
  border: 0;
  border-bottom: 1px solid color-mix(in srgb, var(--a-color-ink) 10%, transparent);
  background: transparent;
  color: var(--a-color-ink);
  text-align: left;
  cursor: pointer;
  font: inherit;
}

.paper-field-continent:hover,
.paper-field-continent--active,
.paper-field-country:hover,
.paper-field-country--active {
  color: var(--a-color-accent-confirm);
}

.paper-field-empty {
  margin: 0;
  padding: 1rem 0;
  color: var(--a-color-ink-soft);
}

@media (max-width: 720px) {
  .paper-field-dialog-backdrop {
    padding: 0.75rem;
  }

  .paper-field-dialog {
    max-height: calc(100vh - 1.5rem);
    padding: 1rem;
  }

  .paper-field-dialog-grid {
    grid-template-columns: 1fr;
    min-height: auto;
  }
}
</style>
