# Music Lyrics Row Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two raw lyric textareas with a structured row editor that supports plain/LRC bilingual editing, validated two-file LRC import, separate LRC exports, and responsive desktop/mobile layouts.

**Architecture:** Frontend-only draft utilities convert the existing `content + translation + format` API contract into a unified `MusicLyricDraftRow[]`. Focused components edit and preview those rows, while `MusicLyricsPanel.vue` continues to own saving, request generations, versioning, and annotation-conflict handling.

**Tech Stack:** Vue 3.5, TypeScript 5.9 strict, Vitest, Vue Test Utils, Lucide Vue, Playwright/Chromium.

---

## File Structure

- Create `src/utils/musicLyricsDraft.ts`: row model, plain/LRC parsing, bilingual pairing, serialization, validation, sorting, and export text generation.
- Create `tests/unit/utils/musicLyricsDraft.spec.ts`: pure-function behavior and error-location coverage.
- Create `src/utils/textDownload.ts`: one browser download operation with filename sanitization.
- Create `tests/unit/utils/textDownload.spec.ts`: Blob/object URL/anchor cleanup contract.
- Create `src/components/music/MusicLyricsRowEditor.vue`: responsive row grid and immutable row operations.
- Create `tests/unit/components/music/MusicLyricsRowEditor.spec.ts`: edit/add/delete/move/time-column behavior.
- Create `src/components/music/MusicLyricsImportPreview.vue`: import result, issues, and replace confirmation.
- Create `tests/unit/components/music/MusicLyricsImportPreview.spec.ts`: confirm blocking and preview rendering.
- Modify `src/components/music/MusicLyricEditorDrawer.vue`: compose toolbar, row editor, import preview, validation, export, summary, and save payload.
- Modify `tests/unit/components/music/MusicLyricEditorDrawer.spec.ts`: lifecycle, import/export, validation, and payload tests.
- Modify `src/components/music/MusicLyricsPanel.vue`: pass song title only; retain existing save and 409 flow.
- Modify `tests/unit/components/music/MusicLyricsPanel.spec.ts`: verify title forwarding and existing conflict behavior.
- Create `tests/e2e/specs/music-lyrics-row-editor.real.spec.ts`: real file import, downloads, and desktop/mobile layout smoke using the existing authenticated fixture.

---

### Task 1: Unified Draft Rows and Plain Lyrics Round Trip

**Files:**
- Create: `src/utils/musicLyricsDraft.ts`
- Create: `tests/unit/utils/musicLyricsDraft.spec.ts`

- [ ] **Step 1: Write failing plain-row tests**

Create `tests/unit/utils/musicLyricsDraft.spec.ts` with the initial contract:

```ts
import { describe, expect, it } from 'vitest'
import {
  parseMusicLyricDraft,
  serializeMusicLyricDraft,
  type MusicLyricDraftRow,
} from '@/utils/musicLyricsDraft'

describe('musicLyricsDraft plain rows', () => {
  it('aligns translations by physical line and keeps empty positions', () => {
    const rows = parseMusicLyricDraft('Alpha\nBeta\nGamma', '甲\n\n丙', 'plain')

    expect(rows.map(({ original, translation, timeMs }) => ({ original, translation, timeMs }))).toEqual([
      { original: 'Alpha', translation: '甲', timeMs: null },
      { original: 'Beta', translation: '', timeMs: null },
      { original: 'Gamma', translation: '丙', timeMs: null },
    ])
    expect(new Set(rows.map(row => row.id)).size).toBe(3)
  })

  it('round-trips plain row order and trailing empty translations', () => {
    const rows: MusicLyricDraftRow[] = [
      { id: 'row-1', timeMs: null, original: 'Alpha', translation: '甲' },
      { id: 'row-2', timeMs: null, original: 'Beta', translation: '' },
    ]

    expect(serializeMusicLyricDraft(rows, 'plain')).toEqual({
      content: 'Alpha\nBeta',
      translation: '甲\n',
    })
  })
})
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
bun run test:unit -- tests/unit/utils/musicLyricsDraft.spec.ts
```

Expected: FAIL because `@/utils/musicLyricsDraft` does not exist.

- [ ] **Step 3: Implement the row type and plain conversion**

Create `src/utils/musicLyricsDraft.ts`:

```ts
import type { MusicLyricsFormat } from '@/api/musicV1'

export interface MusicLyricDraftRow {
  id: string
  timeMs: number | null
  original: string
  translation: string
}

let draftRowSequence = 0

export function createMusicLyricDraftRow(
  value: Partial<Omit<MusicLyricDraftRow, 'id'>> = {},
): MusicLyricDraftRow {
  draftRowSequence += 1
  return {
    id: `lyric-draft-${draftRowSequence}`,
    timeMs: value.timeMs ?? null,
    original: value.original ?? '',
    translation: value.translation ?? '',
  }
}

export function parseMusicLyricDraft(
  content: string,
  translation: string,
  format: MusicLyricsFormat,
): MusicLyricDraftRow[] {
  if (format === 'lrc') return parseBilingualLrcDraft(content, translation).rows

  const originals = content.split('\n')
  const translations = translation.split('\n')
  const rowCount = Math.max(originals.length, translations.length)
  return Array.from({ length: rowCount }, (_, index) => createMusicLyricDraftRow({
    original: originals[index] ?? '',
    translation: translations[index] ?? '',
  }))
}

export function serializeMusicLyricDraft(
  rows: MusicLyricDraftRow[],
  format: MusicLyricsFormat,
): { content: string; translation: string } {
  if (format === 'lrc') return serializeBilingualLrcDraft(rows)
  return {
    content: rows.map(row => row.original).join('\n'),
    translation: rows.map(row => row.translation).join('\n'),
  }
}
```

Add temporary exported declarations at the bottom so Task 1 compiles before Task 2 fills them in:

```ts
export interface MusicLyricDraftIssue {
  severity: 'error' | 'warning'
  code: string
  message: string
  rowIndex?: number
  sourceLine?: number
}

export interface MusicLyricDraftParseResult {
  rows: MusicLyricDraftRow[]
  issues: MusicLyricDraftIssue[]
}

export function parseBilingualLrcDraft(_content = '', _translation = ''): MusicLyricDraftParseResult {
  return { rows: [], issues: [] }
}

export function serializeBilingualLrcDraft(_rows: MusicLyricDraftRow[]): { content: string; translation: string } {
  return { content: '', translation: '' }
}
```

- [ ] **Step 4: Run the plain-row tests and type-check**

Run:

```bash
bun run test:unit -- tests/unit/utils/musicLyricsDraft.spec.ts
bun run type-check
```

Expected: both PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/utils/musicLyricsDraft.ts tests/unit/utils/musicLyricsDraft.spec.ts
git commit -m "feat(music): add structured lyric draft rows"
```

---

### Task 2: LRC Parsing, Pairing, Validation, Sorting, and Export Text

**Files:**
- Modify: `src/utils/musicLyricsDraft.ts`
- Modify: `tests/unit/utils/musicLyricsDraft.spec.ts`

- [ ] **Step 1: Add failing LRC parsing and pairing tests**

Append tests that prove multi-tag expansion, duplicate occurrence pairing, and unmatched translation errors:

```ts
import {
  formatMusicLyricTime,
  parseBilingualLrcDraft,
  parseMusicLyricTime,
  sortMusicLyricDraftRows,
  validateMusicLyricDraft,
} from '@/utils/musicLyricsDraft'

describe('musicLyricsDraft LRC rows', () => {
  it('expands multiple timestamps and pairs duplicate translations by occurrence', () => {
    const result = parseBilingualLrcDraft(
      '[00:01.00][00:03.000]Alpha\n[00:03.00]Beta',
      '[00:01.00]甲\n[00:03.00]乙一\n[00:03.00]乙二',
    )

    expect(result.issues).toEqual([])
    expect(result.rows.map(row => [row.timeMs, row.original, row.translation])).toEqual([
      [1000, 'Alpha', '甲'],
      [3000, 'Alpha', '乙一'],
      [3000, 'Beta', '乙二'],
    ])
  })

  it('reports source lines and unmatched translation timestamps', () => {
    const result = parseBilingualLrcDraft(
      '[00:01.00]Alpha\nnot-lrc',
      '[00:02.00]无匹配',
    )

    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ severity: 'error', code: 'invalid_lrc_line', sourceLine: 2 }),
      expect.objectContaining({ severity: 'error', code: 'unmatched_translation_time', sourceLine: 1 }),
    ]))
  })
})
```

- [ ] **Step 2: Add failing validation, stable-sort, and serialization tests**

```ts
describe('musicLyricsDraft validation and export', () => {
  const rows: MusicLyricDraftRow[] = [
    { id: 'a', timeMs: 2000, original: 'Two', translation: '二' },
    { id: 'b', timeMs: 1000, original: 'One A', translation: '一甲' },
    { id: 'c', timeMs: 1000, original: 'One B', translation: '' },
  ]

  it('blocks descending time, warns duplicate time, and sorts stably', () => {
    const issues = validateMusicLyricDraft(rows, 'lrc')
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ severity: 'error', code: 'descending_time' }),
      expect.objectContaining({ severity: 'warning', code: 'duplicate_time' }),
    ]))
    expect(sortMusicLyricDraftRows(rows).map(row => row.id)).toEqual(['b', 'c', 'a'])
  })

  it('blocks empty originals and missing LRC time', () => {
    expect(validateMusicLyricDraft([
      { id: 'a', timeMs: null, original: '', translation: '' },
    ], 'lrc')).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'empty_original' }),
      expect.objectContaining({ code: 'missing_time' }),
    ]))
  })

  it('serializes separate original and translation LRC text', () => {
    expect(serializeMusicLyricDraft(sortMusicLyricDraftRows(rows), 'lrc')).toEqual({
      content: '[00:01.00]One A\n[00:01.00]One B\n[00:02.00]Two',
      translation: '[00:01.00]一甲\n[00:02.00]二',
    })
  })

  it('parses and formats supported time precision', () => {
    expect(parseMusicLyricTime('01:02.345')).toBe(62345)
    expect(formatMusicLyricTime(62345)).toBe('01:02.35')
    expect(parseMusicLyricTime('bad')).toBeNull()
  })
})
```

- [ ] **Step 3: Run tests and verify RED**

Run:

```bash
bun run test:unit -- tests/unit/utils/musicLyricsDraft.spec.ts
```

Expected: FAIL because LRC parsing, validation, and formatting are not implemented.

- [ ] **Step 4: Implement the LRC functions**

Replace the temporary Task 1 stubs with these concrete helpers:

```ts
type ParsedLrcLine = {
  timeMs: number
  text: string
  sourceLine: number
}

const timedLinePattern = /^((?:\[\d{1,3}:\d{2}(?:\.\d{2,3})?\])+)(.*)$/
const timeTagPattern = /\[(\d{1,3}):(\d{2})(?:\.(\d{2,3}))?\]/g
const metadataPattern = /^\[(ar|al|ti|by|re|ve):/i

function parseLrcLines(source: string): { lines: ParsedLrcLine[]; issues: MusicLyricDraftIssue[] } {
  const lines: ParsedLrcLine[] = []
  const issues: MusicLyricDraftIssue[] = []

  source.split('\n').forEach((rawLine, index) => {
    const sourceLine = index + 1
    const value = rawLine.trimEnd()
    if (!value.trim() || metadataPattern.test(value.trim())) return
    const match = timedLinePattern.exec(value)
    if (!match) {
      issues.push({ severity: 'error', code: 'invalid_lrc_line', message: `第 ${sourceLine} 行不是有效 LRC`, sourceLine })
      return
    }
    const tags = match[1]
    const text = match[2]
    for (const tag of tags.matchAll(timeTagPattern)) {
      const fraction = tag[3] ?? '00'
      const millis = fraction.length === 2 ? Number(fraction) * 10 : Number(fraction)
      lines.push({
        timeMs: Number(tag[1]) * 60_000 + Number(tag[2]) * 1_000 + millis,
        text,
        sourceLine,
      })
    }
  })
  return { lines, issues }
}

function occurrenceKey(timeMs: number, occurrence: number) {
  return `${timeMs}:${occurrence}`
}

export function parseBilingualLrcDraft(content = '', translation = ''): MusicLyricDraftParseResult {
  const originalResult = parseLrcLines(content)
  const translationResult = parseLrcLines(translation)
  const translationOccurrences = new Map<number, number>()
  const translationByOccurrence = new Map<string, ParsedLrcLine>()

  for (const line of translationResult.lines) {
    const occurrence = translationOccurrences.get(line.timeMs) ?? 0
    translationOccurrences.set(line.timeMs, occurrence + 1)
    translationByOccurrence.set(occurrenceKey(line.timeMs, occurrence), line)
  }

  const originalOccurrences = new Map<number, number>()
  const consumed = new Set<string>()
  const rows = originalResult.lines.map(line => {
    const occurrence = originalOccurrences.get(line.timeMs) ?? 0
    originalOccurrences.set(line.timeMs, occurrence + 1)
    const key = occurrenceKey(line.timeMs, occurrence)
    const translated = translationByOccurrence.get(key)
    if (translated) consumed.add(key)
    return createMusicLyricDraftRow({
      timeMs: line.timeMs,
      original: line.text,
      translation: translated?.text ?? '',
    })
  })

  const unmatched = [...translationByOccurrence.entries()]
    .filter(([key]) => !consumed.has(key))
    .map(([, line]) => ({
      severity: 'error' as const,
      code: 'unmatched_translation_time',
      message: `翻译第 ${line.sourceLine} 行没有对应原文`,
      sourceLine: line.sourceLine,
    }))

  return { rows, issues: [...originalResult.issues, ...translationResult.issues, ...unmatched] }
}

export function parseMusicLyricTime(value: string): number | null {
  const match = /^(\d{1,3}):(\d{2})(?:\.(\d{2,3}))?$/.exec(value.trim())
  if (!match || Number(match[2]) > 59) return null
  const fraction = match[3] ?? '00'
  return Number(match[1]) * 60_000 + Number(match[2]) * 1_000
    + (fraction.length === 2 ? Number(fraction) * 10 : Number(fraction))
}

export function formatMusicLyricTime(timeMs: number): string {
  const totalHundredths = Math.round(timeMs / 10)
  const minutes = Math.floor(totalHundredths / 6000)
  const seconds = Math.floor((totalHundredths % 6000) / 100)
  const hundredths = totalHundredths % 100
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`
}

export function validateMusicLyricDraft(rows: MusicLyricDraftRow[], format: MusicLyricsFormat): MusicLyricDraftIssue[] {
  const issues: MusicLyricDraftIssue[] = []
  rows.forEach((row, rowIndex) => {
    if (!row.original.trim()) issues.push({ severity: 'error', code: 'empty_original', message: `第 ${rowIndex + 1} 行缺少原文`, rowIndex })
    if (format === 'lrc' && row.timeMs === null) issues.push({ severity: 'error', code: 'missing_time', message: `第 ${rowIndex + 1} 行缺少时间`, rowIndex })
    if (format === 'lrc' && rowIndex > 0 && row.timeMs !== null && rows[rowIndex - 1]?.timeMs !== null && row.timeMs < rows[rowIndex - 1]!.timeMs!) {
      issues.push({ severity: 'error', code: 'descending_time', message: `第 ${rowIndex + 1} 行时间早于上一行`, rowIndex })
    }
  })
  if (format === 'lrc') {
    const counts = new Map<number, number>()
    rows.forEach(row => {
      if (row.timeMs !== null) counts.set(row.timeMs, (counts.get(row.timeMs) ?? 0) + 1)
    })
    for (const [timeMs, count] of counts) {
      if (count > 1) issues.push({ severity: 'warning', code: 'duplicate_time', message: `${formatMusicLyricTime(timeMs)} 出现 ${count} 次` })
    }
  }
  return issues
}

export function sortMusicLyricDraftRows(rows: MusicLyricDraftRow[]): MusicLyricDraftRow[] {
  return rows.map((row, index) => ({ row, index }))
    .sort((left, right) => (left.row.timeMs ?? Number.MAX_SAFE_INTEGER) - (right.row.timeMs ?? Number.MAX_SAFE_INTEGER) || left.index - right.index)
    .map(item => item.row)
}

export function serializeBilingualLrcDraft(rows: MusicLyricDraftRow[]): { content: string; translation: string } {
  return {
    content: rows.map(row => `[${formatMusicLyricTime(row.timeMs ?? 0)}]${row.original}`).join('\n'),
    translation: rows.filter(row => row.translation.length > 0)
      .map(row => `[${formatMusicLyricTime(row.timeMs ?? 0)}]${row.translation}`).join('\n'),
  }
}
```

- [ ] **Step 5: Run utility tests and type-check**

```bash
bun run test:unit -- tests/unit/utils/musicLyricsDraft.spec.ts tests/unit/utils/musicLyrics.spec.ts
bun run type-check
```

Expected: PASS with no unhandled errors.

- [ ] **Step 6: Commit Task 2**

```bash
git add src/utils/musicLyricsDraft.ts tests/unit/utils/musicLyricsDraft.spec.ts
git commit -m "feat(music): parse and validate lyric draft rows"
```

---

### Task 3: Responsive Row Editor Component

**Files:**
- Create: `src/components/music/MusicLyricsRowEditor.vue`
- Create: `tests/unit/components/music/MusicLyricsRowEditor.spec.ts`

- [ ] **Step 1: Write failing row-operation tests**

Create tests using stable test IDs and real emitted row arrays:

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MusicLyricsRowEditor from '@/components/music/MusicLyricsRowEditor.vue'
import type { MusicLyricDraftRow } from '@/utils/musicLyricsDraft'

const rows: MusicLyricDraftRow[] = [
  { id: 'a', timeMs: 1000, original: 'Alpha', translation: '甲' },
  { id: 'b', timeMs: 2000, original: 'Beta', translation: '乙' },
]

describe('MusicLyricsRowEditor', () => {
  it('edits a row without mutating the prop', async () => {
    const source = structuredClone(rows)
    const wrapper = mount(MusicLyricsRowEditor, { props: { rows: source, format: 'lrc' } })
    await wrapper.get('[data-testid="lyric-original-a"]').setValue('Alpha edited')
    expect(source).toEqual(rows)
    expect(wrapper.emitted('update:rows')?.[0]?.[0]).toEqual([
      { ...rows[0], original: 'Alpha edited' }, rows[1],
    ])
  })

  it('moves and removes rows while respecting boundaries', async () => {
    const wrapper = mount(MusicLyricsRowEditor, { props: { rows, format: 'lrc' } })
    expect(wrapper.get('[data-testid="lyric-move-up-a"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-testid="lyric-move-up-b"]').trigger('click')
    expect(wrapper.emitted('update:rows')?.[0]?.[0].map((row: MusicLyricDraftRow) => row.id)).toEqual(['b', 'a'])
    await wrapper.get('[data-testid="lyric-delete-b"]').trigger('click')
    expect(wrapper.emitted('update:rows')?.[1]?.[0].map((row: MusicLyricDraftRow) => row.id)).toEqual(['a'])
  })

  it('shows time only for LRC and parses supported input', async () => {
    const wrapper = mount(MusicLyricsRowEditor, { props: { rows, format: 'plain' } })
    expect(wrapper.find('[data-testid="lyric-time-a"]').exists()).toBe(false)
    await wrapper.setProps({ format: 'lrc' })
    await wrapper.get('[data-testid="lyric-time-a"]').setValue('00:03.25')
    expect(wrapper.emitted('update:rows')?.at(-1)?.[0][0].timeMs).toBe(3250)
  })
})
```

- [ ] **Step 2: Run tests and verify RED**

```bash
bun run test:unit -- tests/unit/components/music/MusicLyricsRowEditor.spec.ts
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the row editor**

Create a component with this public interface and immutable update helpers:

```vue
<script setup lang="ts">
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-vue-next'
import type { MusicLyricsFormat } from '@/api/musicV1'
import { formatMusicLyricTime, parseMusicLyricTime, type MusicLyricDraftIssue, type MusicLyricDraftRow } from '@/utils/musicLyricsDraft'

const props = withDefaults(defineProps<{
  rows: MusicLyricDraftRow[]
  format: MusicLyricsFormat
  issues?: MusicLyricDraftIssue[]
  disabled?: boolean
}>(), { issues: () => [], disabled: false })

const emit = defineEmits<{ 'update:rows': [rows: MusicLyricDraftRow[]] }>()

function updateRow(index: number, patch: Partial<MusicLyricDraftRow>) {
  emit('update:rows', props.rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row))
}

function updateTime(index: number, value: string) {
  updateRow(index, { timeMs: value.trim() ? parseMusicLyricTime(value) : null })
}

function moveRow(index: number, direction: -1 | 1) {
  const target = index + direction
  if (target < 0 || target >= props.rows.length) return
  const next = [...props.rows]
  ;[next[index], next[target]] = [next[target]!, next[index]!]
  emit('update:rows', next)
}

function removeRow(index: number) {
  emit('update:rows', props.rows.filter((_, rowIndex) => rowIndex !== index))
}

function rowErrors(index: number) {
  return props.issues.filter(issue => issue.rowIndex === index && issue.severity === 'error')
}
</script>
```

The template must use one stable grid row per draft row, native inputs for dense editing, Lucide icon buttons with `title` and `aria-label`, and the test IDs above. Use these grid constraints:

```css
.music-lyrics-row-editor__head,
.music-lyrics-row-editor__row {
  display: grid;
  grid-template-columns: 3rem 7.5rem minmax(12rem, 1fr) minmax(12rem, 1fr) 7rem;
  align-items: start;
}

@media (max-width: 767px) {
  .music-lyrics-row-editor__head { display: none; }
  .music-lyrics-row-editor__row {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .music-lyrics-row-editor__original,
  .music-lyrics-row-editor__translation { grid-column: 1 / -1; }
}
```

- [ ] **Step 4: Run component tests, utility tests, and type-check**

```bash
bun run test:unit -- tests/unit/components/music/MusicLyricsRowEditor.spec.ts tests/unit/utils/musicLyricsDraft.spec.ts
bun run type-check
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

```bash
git add src/components/music/MusicLyricsRowEditor.vue tests/unit/components/music/MusicLyricsRowEditor.spec.ts
git commit -m "feat(music): add responsive lyric row editor"
```

---

### Task 4: Import Preview Component

**Files:**
- Create: `src/components/music/MusicLyricsImportPreview.vue`
- Create: `tests/unit/components/music/MusicLyricsImportPreview.spec.ts`

- [ ] **Step 1: Write failing preview tests**

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MusicLyricsImportPreview from '@/components/music/MusicLyricsImportPreview.vue'

describe('MusicLyricsImportPreview', () => {
  it('shows paired rows and confirms a valid replacement', async () => {
    const wrapper = mount(MusicLyricsImportPreview, {
      props: {
        show: true,
        originalFileName: 'song.lrc',
        translationFileName: 'song-translation.lrc',
        rows: [{ id: 'a', timeMs: 1000, original: 'Alpha', translation: '甲' }],
        issues: [],
      },
    })
    expect(wrapper.text()).toContain('Alpha')
    expect(wrapper.text()).toContain('甲')
    await wrapper.get('[data-testid="lyrics-import-confirm"]').trigger('click')
    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })

  it('blocks confirmation when parsing has an error', () => {
    const wrapper = mount(MusicLyricsImportPreview, {
      props: {
        show: true,
        originalFileName: 'broken.lrc',
        rows: [],
        issues: [{ severity: 'error', code: 'invalid_lrc_line', message: '第 2 行不是有效 LRC', sourceLine: 2 }],
      },
    })
    expect(wrapper.get('[data-testid="lyrics-import-confirm"]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('第 2 行不是有效 LRC')
  })
})
```

- [ ] **Step 2: Run tests and verify RED**

```bash
bun run test:unit -- tests/unit/components/music/MusicLyricsImportPreview.spec.ts
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the modal preview**

Use `PModal above-player size="lg"`, a compact file summary, an issue list, and a scrollable table of time/original/translation. The footer must contain:

```vue
<template #footer>
  <PButton variant="secondary" @click="emit('cancel')">取消</PButton>
  <PButton
    data-testid="lyrics-import-confirm"
    :disabled="hasErrors || rows.length === 0"
    @click="emit('confirm')"
  >
    替换草稿
  </PButton>
</template>
```

The component contract is:

```ts
const props = withDefaults(defineProps<{
  show: boolean
  originalFileName: string
  translationFileName?: string
  rows: MusicLyricDraftRow[]
  issues: MusicLyricDraftIssue[]
}>(), { translationFileName: '' })

const emit = defineEmits<{ confirm: []; cancel: [] }>()
const hasErrors = computed(() => props.issues.some(issue => issue.severity === 'error'))
```

- [ ] **Step 4: Run preview and overlay tests**

```bash
bun run test:unit -- tests/unit/components/music/MusicLyricsImportPreview.spec.ts tests/unit/system/PModal.spec.ts tests/unit/ui/overlay-layer-contract.spec.ts
bun run type-check
```

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

```bash
git add src/components/music/MusicLyricsImportPreview.vue tests/unit/components/music/MusicLyricsImportPreview.spec.ts
git commit -m "feat(music): preview bilingual LRC imports"
```

---

### Task 5: Text Download Utility and Drawer Integration

**Files:**
- Create: `src/utils/textDownload.ts`
- Create: `tests/unit/utils/textDownload.spec.ts`
- Modify: `src/components/music/MusicLyricEditorDrawer.vue`
- Modify: `tests/unit/components/music/MusicLyricEditorDrawer.spec.ts`

- [ ] **Step 1: Write a failing browser download contract test**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadTextFile } from '@/utils/textDownload'

describe('downloadTextFile', () => {
  afterEach(() => vi.restoreAllMocks())

  it('downloads UTF-8 text and revokes the object URL', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:lyrics')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    downloadTextFile('A/B', '歌词', '.lrc')

    expect(create).toHaveBeenCalledWith(expect.any(Blob))
    expect(click).toHaveBeenCalledOnce()
    expect(revoke).toHaveBeenCalledWith('blob:lyrics')
  })
})
```

- [ ] **Step 2: Implement the download utility**

```ts
export function sanitizeDownloadName(value: string) {
  return value.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ') || 'lyrics'
}

export function downloadTextFile(baseName: string, content: string, suffix: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${sanitizeDownloadName(baseName)}${suffix}`
  anchor.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 3: Replace drawer textarea tests with failing row workflow tests**

Update `MusicLyricEditorDrawer.spec.ts` to stub only `PSheet` and use the real row editor/import preview. Cover:

```ts
it('saves edited rows through the existing payload contract', async () => {
  const wrapper = mountDrawer({
    content: 'Alpha\nBeta',
    translation: '甲\n乙',
    songTitle: 'Example Song',
  })
  await wrapper.findAll('[data-testid^="lyric-original-"]')[0]!.setValue('Alpha edited')
  await wrapper.get('[data-testid="lyrics-edit-summary"]').setValue('逐行修正')
  await wrapper.get('[data-testid="lyrics-save"]').trigger('click')
  expect(wrapper.emitted('save')?.[0]?.[0]).toMatchObject({
    content: 'Alpha edited\nBeta',
    translation: '甲\n乙',
    format: 'plain',
    editSummary: '逐行修正',
  })
})

it('does not save empty originals or descending LRC time', async () => {
  const wrapper = mountDrawer({ content: '[00:02.00]Two\n[00:01.00]One', format: 'lrc' })
  await wrapper.get('[data-testid="lyrics-edit-summary"]').setValue('调整')
  await wrapper.get('[data-testid="lyrics-save"]').trigger('click')
  expect(wrapper.emitted('save')).toBeUndefined()
  expect(wrapper.text()).toContain('时间早于上一行')
})
```

Add tests that set `File` objects on original/translation inputs, click preview, cancel without changing rows, then confirm and assert replacement. Add export tests by mocking `downloadTextFile` and asserting `.lrc` and `-translation.lrc` calls.

- [ ] **Step 4: Run drawer tests and verify RED**

```bash
bun run test:unit -- tests/unit/components/music/MusicLyricEditorDrawer.spec.ts tests/unit/utils/textDownload.spec.ts
```

Expected: FAIL because the drawer still renders raw textareas and lacks import/export actions.

- [ ] **Step 5: Integrate the row editor into the drawer**

Replace raw draft strings with:

```ts
const rows = ref<MusicLyricDraftRow[]>([])
const draftFormat = ref<MusicLyricsFormat>('plain')
const originalImportFile = ref<File | null>(null)
const translationImportFile = ref<File | null>(null)
const importPreview = ref<MusicLyricDraftParseResult | null>(null)
const importError = ref('')

const validationIssues = computed(() => validateMusicLyricDraft(rows.value, draftFormat.value))
const blockingIssues = computed(() => validationIssues.value.filter(issue => issue.severity === 'error'))
const canSave = computed(() => rows.value.length > 0 && blockingIssues.value.length === 0 && draftEditSummary.value.trim() && !props.saving)

watch(
  () => [props.show, props.content, props.translation, props.format] as const,
  ([show, content, translation, format]) => {
    if (!show) return
    draftFormat.value = format ?? 'plain'
    rows.value = parseMusicLyricDraft(content ?? '', translation ?? '', draftFormat.value)
    draftEditSummary.value = ''
    originalImportFile.value = null
    translationImportFile.value = null
    importPreview.value = null
    importError.value = ''
  },
  { immediate: true },
)
```

Implement import preview without mutating rows:

```ts
async function previewImport() {
  if (!originalImportFile.value) return
  try {
    const original = await originalImportFile.value.text()
    const translation = translationImportFile.value ? await translationImportFile.value.text() : ''
    importPreview.value = parseBilingualLrcDraft(original, translation)
    importError.value = ''
  } catch {
    importPreview.value = null
    importError.value = '读取 LRC 文件失败'
  }
}

function confirmImport() {
  if (!importPreview.value || importPreview.value.issues.some(issue => issue.severity === 'error')) return
  rows.value = importPreview.value.rows
  draftFormat.value = 'lrc'
  importPreview.value = null
}
```

Save using the existing payload:

```ts
function handleSave() {
  const editSummary = draftEditSummary.value.trim()
  if (!canSave.value || !editSummary) return
  const serialized = serializeMusicLyricDraft(rows.value, draftFormat.value)
  emit('save', { ...serialized, format: draftFormat.value, editSummary })
}
```

Render a toolbar with `PSegmentedControl` for plain/LRC mode, two accessible `.lrc` file inputs, preview button, separate export buttons, add-row button, and LRC-only stable-sort button. Render `MusicLyricsRowEditor` and `MusicLyricsImportPreview`. Pass `saving` to all mutating controls.

- [ ] **Step 6: Run drawer, component, utility, and type tests**

```bash
bun run test:unit -- \
  tests/unit/utils/musicLyricsDraft.spec.ts \
  tests/unit/utils/textDownload.spec.ts \
  tests/unit/components/music/MusicLyricsRowEditor.spec.ts \
  tests/unit/components/music/MusicLyricsImportPreview.spec.ts \
  tests/unit/components/music/MusicLyricEditorDrawer.spec.ts
bun run type-check
```

Expected: PASS.

- [ ] **Step 7: Commit Task 5**

```bash
git add \
  src/utils/textDownload.ts \
  tests/unit/utils/textDownload.spec.ts \
  src/components/music/MusicLyricEditorDrawer.vue \
  tests/unit/components/music/MusicLyricEditorDrawer.spec.ts
git commit -m "feat(music): integrate lyric row import and export"
```

---

### Task 6: Panel Contract and Regression Coverage

**Files:**
- Modify: `src/components/music/MusicLyricsPanel.vue`
- Modify: `tests/unit/components/music/MusicLyricsPanel.spec.ts`

- [ ] **Step 1: Add a failing title-forwarding assertion**

Update the drawer stub to expose `songTitle`, then assert:

```ts
expect(wrapper.get('[data-testid="lyrics-editor-drawer"]').attributes('data-song-title')).toBe('Neon Song')
```

Keep existing tests for conflict cancel, multi-round 409 resolution merging, busy state, and cross-song request generations unchanged.

- [ ] **Step 2: Run panel tests and verify RED**

```bash
bun run test:unit -- tests/unit/components/music/MusicLyricsPanel.spec.ts
```

Expected: FAIL because `songTitle` is not passed to the editor.

- [ ] **Step 3: Pass the title without changing save ownership**

Add one prop binding:

```vue
<MusicLyricEditorDrawer
  v-if="isAuthenticated"
  :show="isLyricEditorOpen"
  :song-title="songTitle"
  :content="lyrics?.content ?? ''"
  :translation="lyrics?.translation ?? ''"
  :format="lyrics?.format ?? 'plain'"
  :saving="saving || reverting"
  @close="isLyricEditorOpen = false"
  @save="handleSaveLyrics"
/>
```

- [ ] **Step 4: Run all lyrics unit tests and type-check**

```bash
bun run test:unit -- \
  tests/unit/utils/musicLyrics.spec.ts \
  tests/unit/utils/musicLyricsDraft.spec.ts \
  tests/unit/utils/textDownload.spec.ts \
  tests/unit/api/musicV1.lyrics.spec.ts \
  tests/unit/components/music/MusicLyricsLine.spec.ts \
  tests/unit/components/music/MusicAnnotationPanel.spec.ts \
  tests/unit/components/music/MusicLyricsRowEditor.spec.ts \
  tests/unit/components/music/MusicLyricsImportPreview.spec.ts \
  tests/unit/components/music/MusicLyricEditorDrawer.spec.ts \
  tests/unit/components/music/MusicLyricsPanel.spec.ts \
  tests/unit/composables/useMusicLyrics.spec.ts
bun run type-check
```

Expected: all PASS.

- [ ] **Step 5: Commit Task 6**

```bash
git add src/components/music/MusicLyricsPanel.vue tests/unit/components/music/MusicLyricsPanel.spec.ts
git commit -m "feat(music): connect song metadata to lyric row editor"
```

---

### Task 7: Real Browser Import, Download, and Responsive Smoke

**Files:**
- Create: `tests/e2e/specs/music-lyrics-row-editor.real.spec.ts`

- [ ] **Step 1: Add the failing browser scenario**

Create `tests/e2e/specs/music-lyrics-row-editor.real.spec.ts` with the existing authenticated fixture and explicit prepared-fixture environment:

```ts
import { test, expect } from '../fixtures/base'

const enabled = process.env.MUSIC_LYRICS_ROW_EDITOR_E2E === '1'
const albumId = process.env.MUSIC_LYRICS_E2E_ALBUM_ID ?? ''
const songTitle = process.env.MUSIC_LYRICS_E2E_SONG_TITLE ?? ''

test.describe('Music lyrics row editor real workflow', () => {
  test.skip(!enabled || !albumId || !songTitle, 'requires prepared music lyric e2e fixture')

  test('imports bilingual LRC, validates rows, exports files, and saves', async ({ authenticatedPage }) => {
    const page = authenticatedPage
    const consoleErrors: string[] = []
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })

    await page.goto(`/?album=${encodeURIComponent(albumId)}`)
    await page.getByText(songTitle, { exact: true }).click()
    await page.getByRole('button', { name: '播放' }).click()
    await page.getByText('歌词', { exact: true }).click()
    await page.getByRole('button', { name: '编辑歌词' }).click()

    await page.getByLabel('原文 LRC').setInputFiles({
      name: 'song.lrc',
      mimeType: 'text/plain',
      buffer: Buffer.from('[00:02.00]Two\n[00:01.00]One A\n[00:01.00]One B'),
    })
    await page.getByLabel('翻译 LRC').setInputFiles({
      name: 'song-translation.lrc',
      mimeType: 'text/plain',
      buffer: Buffer.from('[00:02.00]二\n[00:01.00]一甲\n[00:01.00]一乙'),
    })
    await page.getByRole('button', { name: '预览导入' }).click()
    await expect(page.getByText('One A')).toBeVisible()
    await page.getByRole('button', { name: '取消' }).click()
    await page.getByRole('button', { name: '预览导入' }).click()
    await page.getByRole('button', { name: '替换草稿' }).click()

    await expect(page.getByText('时间早于上一行')).toBeVisible()
    await page.getByRole('button', { name: '按时间排序' }).click()
    await expect(page.getByText(/出现 2 次/)).toBeVisible()

    const originalDownload = page.waitForEvent('download')
    await page.getByRole('button', { name: '导出原文' }).click()
    expect((await originalDownload).suggestedFilename()).toMatch(/\.lrc$/)
    const translationDownload = page.waitForEvent('download')
    await page.getByRole('button', { name: '导出翻译' }).click()
    expect((await translationDownload).suggestedFilename()).toMatch(/-translation\.lrc$/)

    await page.getByLabel('摘要').fill('导入逐行歌词')
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await expect(page.getByText('One A')).toBeVisible()
    await expect(page.getByText('一甲')).toBeVisible()
    expect(consoleErrors.filter(message => /lyrics|lyric/i.test(message))).toEqual([])
  })
})
```

The prepared fixture setup must provide a playable album and song. The test must additionally:

1. Log in with the existing e2e authenticated fixture or create an isolated test user through test setup.
2. Open a playable song and the lyrics panel.
3. Open the editor and verify desktop column headers.
4. Upload an original LRC and translation LRC using `setInputFiles`.
5. Verify preview rows, cancel once, preview again, and confirm replacement.
6. Verify duplicate timestamp warning does not disable save.
7. Introduce descending time, verify save disabled, click sort, then save.
8. Capture original and translation downloads and verify filenames/text.
9. Save through the real API and verify bilingual display.
10. Repeat layout assertions at 390x844: row controls, editor content, and player controls do not overlap.
11. Assert lyric-related console errors, failed requests, 404, and 500 responses are empty; allow the expected 409 only in the existing conflict-specific smoke.

- [ ] **Step 2: Run once and verify RED**

Start the latest local Backend and Frontend using the repository development conventions, prepare the isolated song fixture, then run:

```bash
MUSIC_LYRICS_ROW_EDITOR_E2E=1 \
MUSIC_LYRICS_E2E_ALBUM_ID="$ALBUM_ID" \
MUSIC_LYRICS_E2E_SONG_TITLE="$SONG_TITLE" \
bunx playwright test tests/e2e/specs/music-lyrics-row-editor.real.spec.ts --project=chromium
```

Expected: FAIL until selectors and final responsive behavior are complete.

- [ ] **Step 3: Make only browser-discovered accessibility/layout fixes**

Allowed fixes are limited to:

- Stable `data-testid` hooks already named in unit tests.
- Missing `aria-label`/`title` on icon buttons.
- Grid overflow, fixed control sizes, and 390px responsive rules.
- Focus order and modal overlay layer defects.

Do not add new product behavior in this step.

- [ ] **Step 4: Run final verification**

```bash
bun run test:unit
bun run type-check
bun run build
MUSIC_LYRICS_ROW_EDITOR_E2E=1 \
MUSIC_LYRICS_E2E_ALBUM_ID="$ALBUM_ID" \
MUSIC_LYRICS_E2E_SONG_TITLE="$SONG_TITLE" \
bunx playwright test tests/e2e/specs/music-lyrics-row-editor.real.spec.ts --project=chromium
git diff --check
```

Expected:

- All unit tests PASS.
- Type-check exits 0.
- Production build exits 0.
- Chromium smoke PASS on desktop and 390x844 assertions.
- No lyric-related unexpected console/network errors.

- [ ] **Step 5: Commit Task 7**

```bash
git add tests/e2e/specs/music-lyrics-row-editor.real.spec.ts src/components/music
git commit -m "test(music): cover lyric row editor workflow"
```

---

## Completion Checklist

- [ ] Every task used RED before production implementation.
- [ ] Plain and LRC rows share one draft type.
- [ ] Duplicate translation timestamps pair by occurrence, not a single-value map.
- [ ] Import preview never mutates the current draft before confirmation.
- [ ] Local validation blocks empty originals and descending/missing time.
- [ ] Duplicate time is a warning only.
- [ ] Original and translation exports are separate and round-trip through import.
- [ ] Existing save, version, 409 conflict, and request-generation tests still pass.
- [ ] Desktop and 390px Chromium screenshots have no overlap.
- [ ] Feature worktree is clean after the final commit.
