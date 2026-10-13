# UI Copy Restraint and Developer Framing Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip developer-perspective framing ("后台解析", "在后台继续", "查看真实内容") and tighten user copy across target views and components in strict accordance with `AGENTS.md`, and lock down the changes with automated contract tests.

**Architecture:** Update targeted copy in `PortalView.vue`, `MusicCreationAlbumSeedStep.vue`, `MusicCreationAlbumPreviewStep.vue`, `VideoImportsView.vue`, and `ProfileView.vue`. Add negative assertions in `ui-guidelines.spec.ts` to prevent developer-perspective terms from recurring.

**Tech Stack:** Vue 3.5, TypeScript 5.9, Vitest.

## Global Constraints

- Never expose developer jargon or execution mechanisms ("后台", "System", "查看真实内容", "审核理由") to end users.
- Actions and titles must concisely reflect the user task or content name.
- Descriptions must be at most one line of high-value instruction or status.
- Zero type errors (`vue-tsc`).

---

### Task 1: Refactor Copy and Remove Developer Framing in Views and Components

**Files:**
- Modify: `src/views/portal/PortalView.vue`
- Modify: `src/components/music/MusicCreationAlbumSeedStep.vue`
- Modify: `src/components/music/MusicCreationAlbumPreviewStep.vue`
- Modify: `src/views/video/VideoImportsView.vue`
- Modify: `src/views/blog/ProfileView.vue`

**Interfaces:**
- Produces: Natural, user-focused copy adhering to `AGENTS.md`.

- [x] **Step 1: Update `PortalView.vue`**

In `src/views/portal/PortalView.vue`:
Replace line 20:
```vue
          <a href="#sections" class="portal-hot__secondary-btn">
            查看真实内容
          </a>
```
with:
```vue
          <a href="#sections" class="portal-hot__secondary-btn">
            浏览模块内容
          </a>
```

- [x] **Step 2: Update `MusicCreationAlbumSeedStep.vue`**

In `src/components/music/MusicCreationAlbumSeedStep.vue`:
Replace line 59:
```vue
      <p class="archive-hint">推荐 ZIP。无法在本地读取的格式将由后台解析后匹配。</p>
```
with:
```vue
      <p class="archive-hint">推荐 ZIP。无法在本地读取的格式将在上传后自动解析并匹配。</p>
```

- [x] **Step 3: Update `MusicCreationAlbumPreviewStep.vue`**

In `src/components/music/MusicCreationAlbumPreviewStep.vue`:
Replace line 94:
```ts
提交后会继续处理，可在导入中心查看进度。{{ uploadsPending ? '文件尚未上传完成，请保持页面打开；关闭或刷新浏览器会中断上传。' : '文件已上传，后续音频处理会在后台继续。' }}
```
with:
```ts
提交后会继续处理，可在导入中心查看进度。{{ uploadsPending ? '文件尚未上传完成，请保持页面打开；关闭或刷新浏览器会中断上传。' : '文件已上传，音频处理将自动继续完成。' }}
```

- [x] **Step 4: Update `VideoImportsView.vue`**

In `src/views/video/VideoImportsView.vue`:
Replace line 71:
```ts
if (task.status === 'published') return '视频已发布，后台会继续生成播放预览'
```
with:
```ts
if (task.status === 'published') return '视频已发布，正在自动生成播放预览'
```

- [x] **Step 5: Update `ProfileView.vue`**

In `src/views/blog/ProfileView.vue`:
Replace line 185:
```vue
:title="contentItems.length ? '暂无此类型内容' : '暂无内容'"
```
with:
```vue
:title="contentItems.length ? '暂无所选内容' : '暂无内容'"
```

- [x] **Step 6: Run component tests to verify no regressions**

Run: `bun run test:unit tests/unit/components/music/MusicCreationAlbumPreviewStep.spec.ts tests/unit/views/blog/ProfileView.spec.ts tests/unit/views/video/VideoImportsView.spec.ts`
Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add src/views/portal/PortalView.vue src/components/music/MusicCreationAlbumSeedStep.vue src/components/music/MusicCreationAlbumPreviewStep.vue src/views/video/VideoImportsView.vue src/views/blog/ProfileView.vue
git commit -m "style(ui): clean developer framing and tighten copy across portal and media views"
```

---

### Task 2: Add Automated Guidelines Contract Tests & Stabilize PortalView Test

**Files:**
- Modify: `tests/unit/ui/ui-guidelines.spec.ts`
- Modify: `tests/unit/views/portal/PortalView.spec.ts`

- [x] **Step 1: Update `tests/unit/views/portal/PortalView.spec.ts`**

In `tests/unit/views/portal/PortalView.spec.ts`:
Line 225-231:
Ensure `featured: featured.slice(0, 3)` is used in `it('使用后端返回的艺人和真实统计渲染热门音乐')` so the mocked music section items are tested without mock collision from `featured`.

- [x] **Step 2: Add negative assertions in `tests/unit/ui/ui-guidelines.spec.ts`**

In `tests/unit/ui/ui-guidelines.spec.ts`:
In test `空状态和管理界面不暴露英文内部文案`:
Add:
```typescript
		expect(
			read("src/components/music/MusicCreationAlbumSeedStep.vue"),
		).not.toContain("由后台解析");
		expect(
			read("src/components/music/MusicCreationAlbumPreviewStep.vue"),
		).not.toContain("在后台继续");
		expect(read("src/views/video/VideoImportsView.vue")).not.toContain(
			"后台会继续",
		);
		expect(read("src/views/portal/PortalView.vue")).not.toContain(
			"查看真实内容",
		);
```

- [x] **Step 3: Run contract test and portal test**

Run: `bun run test:unit tests/unit/ui/ui-guidelines.spec.ts tests/unit/views/portal/PortalView.spec.ts`
Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add tests/unit/ui/ui-guidelines.spec.ts tests/unit/views/portal/PortalView.spec.ts
git commit -m "test(ui): add guidelines assertions prohibiting developer perspective terms"
```

---

### Task 3: Full Verification and Regression Gate

**Files:**
- All modified files

- [x] **Step 1: Run type checking**

Run: `bun run type-check`
Expected: 0 errors.

- [x] **Step 2: Run all UI and modified tests**

Run: `bun run test:unit tests/unit/ui/ tests/unit/views/portal/PortalView.spec.ts`
Expected: All tests pass.

- [x] **Step 3: Run production build**

Run: `bun run build`
Expected: Build succeeds with 0 errors.

- [x] **Step 4: Check git diff**

Run: `git diff --check`
Expected: Clean.
