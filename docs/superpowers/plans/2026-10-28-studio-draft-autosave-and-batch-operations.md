# 创作者工作台 Studio 自动保存状态与批量操作反馈标准化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 标准化长文编辑器草稿状态提示（收敛为极简用户态）、为短记编辑器接入防抖自动暂存，并为工作台内容表格提供通用的多选操作、批量删除二次确认弹窗与 Toast 反馈。

**Architecture:** 
- 编辑器端重构 `usePostEditorDraftSession.ts` 计算状态，清理冗长排障文案并收敛至统一状态字面量；
- 短记端在 `ShortNoteComposer.vue` 中接入 `useAutoSave`，实现 500ms 防抖本地暂存、页面挂载回填与发布成功自动销毁；
- 工作台端在 `StudioContentTable.vue` 扩展通用首列选择框（支持表头全选/半选与行单选），在 `StudioContentView.vue` 提供 0 阴影的批量操作工具条，联动 `PConfirm` 危险确认与 `useToast` 触发“已删除 X 项内容”。

**Tech Stack:** Vue 3.4, TypeScript 5.8, Pinia 2, Vitest, Vue Test Utils.

## Global Constraints

- 前端设计与 UI 实现时，不要在界面里写过多解释性说明；
- 前端用户可见文案默认收敛为简洁用户态，优先服务当前动作，不做品牌抒情或开发过程说明；
- 标题只写动作名或内容名，不补氛围句；副标题与说明只保留完成当前任务必需的信息；
- 禁止直接向普通用户暴露开发者视角词汇，如“内部”“System”“COMING SOON”“审核理由”“编辑说明”“投稿说明”“凭证设置”等；
- 坚守扁平化设计，严格声明 0 阴影（`box-shadow: none !important;`）与 4px 标准圆角；
- 用户特调的桌面端顶栏交互与视觉（`AppTopbarAuthControls.vue`）绝不修改任何 CSS/DOM；
- 遵循真数据原则，杜绝任何 Fake/Mock 数据；
- 任务完成前必须运行 `bun run type-check` 与 `bun run test:unit`。

---

### Task 1: 长文草稿状态指示器收敛

**Files:**
- Modify: `src/composables/blog/usePostEditorDraftSession.ts`
- Test: `tests/unit/composables/blog/usePostEditorDraftSession.spec.ts`

**Interfaces:**
- Produces: `draftStatus: ComputedRef<{ tone: 'ok' | 'warn' | 'muted'; text: string }>`

- [ ] **Step 1: Write failing unit test for concise draft status text**

In `tests/unit/composables/blog/usePostEditorDraftSession.spec.ts`, assert:
1. `draftStatus.value.text` maps to concise states: `'发布中…'`, `'保存中…'`, `'仅保存在本地'`, `'保存失败'`, `'检测到未保存草稿'`, `'已保存 HH:mm'`, `'自动保存'`.
2. Ensure verbose phrases like `'请检查浏览器存储权限'` and `'当前仅保存在本地'` are never present.

- [ ] **Step 2: Run test to observe failure**

Run: `bun run test:unit tests/unit/composables/blog/usePostEditorDraftSession.spec.ts`
Expected: FAIL due to existing verbose text mappings.

- [ ] **Step 3: Update `draftStatus` in `src/composables/blog/usePostEditorDraftSession.ts`**

Clean up text mappings:
```ts
	const draftStatus = computed<DraftStatus>(() => {
		if (saving.value === "published") return { tone: "warn", text: "发布中…" };
		if (saving.value === "draft") return { tone: "warn", text: "保存中…" };
		if (serverDraftState.value === "error") {
			return { tone: "warn", text: "仅保存在本地" };
		}
		if (autoSaveState.value === "error") {
			return { tone: "warn", text: "保存失败" };
		}
		if (
			autoSaveState.value === "saving" ||
			serverDraftState.value === "syncing"
		) {
			return { tone: "warn", text: "保存中…" };
		}
		if (deferredDraftCandidate.value) {
			return { tone: "warn", text: "检测到未保存草稿" };
		}
		if (lastSavedAt.value || serverDraftSavedAt.value) {
			const latestTime = Math.max(lastSavedAt.value || 0, serverDraftSavedAt.value || 0);
			return { tone: "ok", text: `已保存 ${formatSavedTime(latestTime)}` };
		}
		return { tone: "muted", text: "自动保存" };
	});
```

- [ ] **Step 4: Run test to confirm pass**

Run: `bun run test:unit tests/unit/composables/blog/usePostEditorDraftSession.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git commit -am "refactor(blog): streamline post editor draft status into concise user text"`

---

### Task 2: 短记自动防抖暂存

**Files:**
- Modify: `src/components/shortnote/ShortNoteComposer.vue`
- Test: `tests/unit/components/shortnote/ShortNoteComposer.spec.ts`

**Interfaces:**
- Consumes: `useAutoSave<ShortNoteDraft>`
- Produces: Persistent `content` and `mediaUrls` in `localStorage` under `atoman:short_note_composer_draft`

- [ ] **Step 1: Write unit tests for ShortNoteComposer autosave and restore**

In `tests/unit/components/shortnote/ShortNoteComposer.spec.ts`:
1. Test that typing in content triggers debounced `localStorage.setItem` for key `atoman:short_note_composer_draft`.
2. Test that mounting `ShortNoteComposer` when a saved draft exists automatically restores `content` and `mediaUrls`.
3. Test that submitting successfully removes the draft from `localStorage`.

- [ ] **Step 2: Run test to observe failure**

Run: `bun run test:unit tests/unit/components/shortnote/ShortNoteComposer.spec.ts`
Expected: FAIL since autosave is not yet integrated.

- [ ] **Step 3: Integrate `useAutoSave` in `src/components/shortnote/ShortNoteComposer.vue`**

```ts
interface ShortNoteDraftPayload {
  content: string
  mediaUrls: string[]
}

const { autoSaveState, triggerAutoSave, loadDraft, clearDraft } = useAutoSave<ShortNoteDraftPayload>({
  getDraftKey: () => 'atoman:short_note_composer_draft',
  getPayload: () => ({
    content: content.value,
    mediaUrls: mediaUrls.value,
  }),
  shouldPersist: (payload) => Boolean(payload.content.trim() || payload.mediaUrls.length > 0),
})

onMounted(() => {
  const saved = loadDraft()
  if (saved?.payload) {
    if (saved.payload.content && !content.value) {
      content.value = saved.payload.content
    }
    if (Array.isArray(saved.payload.mediaUrls) && saved.payload.mediaUrls.length > 0 && mediaUrls.value.length === 0) {
      mediaUrls.value = [...saved.payload.mediaUrls]
    }
  }
})

watch([content, mediaUrls], () => {
  triggerAutoSave()
}, { deep: true })
```
In `submit()` after successful creation, call `clearDraft()`.

- [ ] **Step 4: Run unit tests**

Run: `bun run test:unit tests/unit/components/shortnote/ShortNoteComposer.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git commit -am "feat(shortnote): add automatic debounce draft persistence to ShortNoteComposer"`

---

### Task 3: 工作台内容表格多选列扩展

**Files:**
- Modify: `src/components/studio/StudioContentTable.vue`
- Test: `tests/unit/components/studio/StudioContentTable.spec.ts`

**Interfaces:**
- Consumes: `props.selectedIds: string[]`
- Emits: `(e: 'toggleSelect', id: string): void`, `(e: 'toggleSelectAll', selectAll: boolean): void`

- [ ] **Step 1: Write unit tests for table selection events and state**

In `tests/unit/components/studio/StudioContentTable.spec.ts`:
1. Checkbox in header reflects `checked` when all items are in `selectedIds`.
2. Checkbox in header reflects `indeterminate` when some items are selected.
3. Clicking header checkbox emits `toggleSelectAll`.
4. Clicking row checkbox emits `toggleSelect` with item id.
5. Conflict resolution select input still functions correctly.

- [ ] **Step 2: Run test to observe failure**

Run: `bun run test:unit tests/unit/components/studio/StudioContentTable.spec.ts`
Expected: FAIL since general multi-select props/emits are missing.

- [ ] **Step 3: Update `src/components/studio/StudioContentTable.vue`**

Add `selectedIds` prop:
```ts
const props = withDefaults(defineProps<{
  // ...
  selectedIds?: string[]
}>(), {
  selectedIds: () => [],
})
```
Compute:
```ts
const isAllSelected = computed(() => props.items.length > 0 && props.items.every(item => props.selectedIds.includes(item.id)))
const isIndeterminate = computed(() => {
  if (isAllSelected.value) return false
  return props.items.some(item => props.selectedIds.includes(item.id))
})
```
Add table header checkbox:
```html
<th>
  <input
    type="checkbox"
    :checked="isAllSelected"
    :indeterminate="isIndeterminate"
    aria-label="全选本页内容"
    @change="emit('toggleSelectAll', !isAllSelected)"
  />
</th>
```
Add row checkbox:
```html
<td data-label="选择">
  <input
    type="checkbox"
    :checked="selectedIds.includes(item.id)"
    :aria-label="`选择《${item.title || config.itemLabel}》`"
    @change="emit('toggleSelect', item.id)"
  />
</td>
```

- [ ] **Step 4: Run unit tests**

Run: `bun run test:unit tests/unit/components/studio/StudioContentTable.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git commit -am "feat(studio): add universal selection column and toggleSelectAll to StudioContentTable"`

---

### Task 4: 工作台批量操作栏与二次确认弹窗

**Files:**
- Modify: `src/views/studio/StudioContentView.vue`
- Test: `tests/unit/views/studio/StudioContentView.spec.ts`

**Interfaces:**
- Consumes: `selectedIDs: Ref<Set<string>>`
- Produces: `PConfirm` batch delete confirmation modal and `useToast().success` upon deletion.

- [ ] **Step 1: Write unit tests for batch delete flow**

In `tests/unit/views/studio/StudioContentView.spec.ts`:
1. Selecting items displays the batch action bar with `已选择 X 项`.
2. Clicking "批量删除" opens `PConfirm` with text `确定删除选中的 X 项内容吗？此操作不可恢复。`.
3. Confirming triggers deletion of all selected items, resets `selectedIDs`, and calls `toast.success('已删除 X 项内容')`.
4. Changing filter or page resets `selectedIDs`.

- [ ] **Step 2: Run test to observe failure**

Run: `bun run test:unit tests/unit/views/studio/StudioContentView.spec.ts`
Expected: FAIL since batch deletion bar and modal are not yet implemented.

- [ ] **Step 3: Update `src/views/studio/StudioContentView.vue`**

Add state and handlers:
```ts
const selectedIDs = ref(new Set<string>())
const batchDeleteConfirmVisible = ref(false)

function handleToggleSelect(id: string) {
  if (selectedIDs.value.has(id)) {
    selectedIDs.value.delete(id)
  } else {
    selectedIDs.value.add(id)
  }
}

function handleToggleSelectAll(selectAll: boolean) {
  if (selectAll) {
    studio.contents[module.value].forEach(item => selectedIDs.value.add(item.id))
  } else {
    selectedIDs.value.clear()
  }
}

function clearSelection() {
  selectedIDs.value.clear()
}

async function confirmBatchDelete() {
  const idsToDelete = [...selectedIDs.value]
  if (idsToDelete.length === 0) return
  await runMutation(async () => {
    for (const id of idsToDelete) {
      await studio.deleteContent(module.value, id)
    }
  }, `已删除 ${idsToDelete.length} 项内容`)
  selectedIDs.value.clear()
  batchDeleteConfirmVisible.value = false
}
```
Mount batch bar:
```html
<div v-if="selectedIDs.size > 0" class="studio-content__batch-bar" role="toolbar" aria-label="批量操作">
  <span class="studio-content__batch-count">已选择 {{ selectedIDs.size }} 项</span>
  <div class="studio-content__batch-actions">
    <PButton variant="danger" size="sm" :disabled="mutationBusy" @click="batchDeleteConfirmVisible = true">
      批量删除
    </PButton>
    <PButton variant="ghost" size="sm" @click="clearSelection">
      取消
    </PButton>
  </div>
</div>
```
Mount `PConfirm`:
```html
<PConfirm
  :show="batchDeleteConfirmVisible"
  title="批量删除内容"
  :message="`确定删除选中的 ${selectedIDs.size} 项内容吗？此操作不可恢复。`"
  confirm-text="删除"
  danger
  :loading="mutationBusy"
  @confirm="confirmBatchDelete"
  @cancel="batchDeleteConfirmVisible = false"
/>
```
Add clean styles with `box-shadow: none !important;` and 4px border-radius.

- [ ] **Step 4: Run unit tests**

Run: `bun run test:unit tests/unit/views/studio/StudioContentView.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git commit -am "feat(studio): implement batch action toolbar and PConfirm batch deletion flow"`

---

### Task 5: 全站质量验证与双端打包交付

**Files:**
- Documentation: `docs/superpowers/plans/2026-10-28-studio-draft-autosave-and-batch-operations.md`
- Kanban: `<appDataDir>/brain/72e9f847-045b-4790-a46f-1fe17ce2f1c1/frontend-refactor-status.md`

- [x] **Step 1: Run TypeScript strict check**

Run: `cd Atoman-Frontend && bun run type-check`
Expected: 0 errors.

- [x] **Step 2: Run affected and full test suites**

Run: `cd Atoman-Frontend && bun run test:unit`
Expected: 100% pass across all test suites.

- [x] **Step 3: Run desktop and mobile production builds**

Run: `cd Atoman-Frontend && bun run build && bun run build:mobile`
Expected: Both builds succeed with 0 errors.

- [x] **Step 4: Update plan and kanban status**

Mark all tasks as completed in plan and update status board.

- [x] **Step 5: Final commit & push**

Run: `git commit -am "chore: complete studio draft autosave and batch operations standardization" && git push origin main`
