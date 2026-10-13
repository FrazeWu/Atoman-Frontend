# Design Spec: UI Copy Restraint and Developer Framing Cleanup

- **Date**: 2026-10-13
- **Scope**: `Atoman-Frontend`
- **Target Views/Components**: `PortalView.vue`, `ProfileView.vue`, `VideoImportsView.vue`, `MusicCreationAlbumSeedStep.vue`, `MusicCreationAlbumPreviewStep.vue`, and associated contract tests in `ui-guidelines.spec.ts`.

---

## 1. Problem Statement & Background

Under `AGENTS.md`:
1. **Developer Framing Prohibition**:
   - Never expose developer-perspective jargon ("内部", "System", "后台", "审核理由", etc.) directly to end users.
   - Mechanism explanations should be converted into clear, natural user states or removed.
   - For example:
     - `MusicCreationAlbumSeedStep.vue`: "无法在本地读取的格式将由后台解析后匹配。" -> exposes backend architecture.
     - `MusicCreationAlbumPreviewStep.vue`: "后续音频处理会在后台继续。" -> exposes backend execution flow.
     - `VideoImportsView.vue`: "视频已发布，后台会继续生成播放预览" -> exposes backend background workers.
2. **Copy Restraint & Clarity**:
   - Titles and actions should only state content or action names; avoid atmospheric or artificial framing.
   - `PortalView.vue`: Action button label "查看真实内容" frames content artificially as "real vs mock".
   - `ProfileView.vue`: Empty state title "暂无此类型内容" should be concise: "暂无所选内容".

---

## 2. Detailed Copy Refinements

### 2.1 `src/views/portal/PortalView.vue`
- Hero action button text:
  - From: `查看真实内容`
  - To: `浏览模块内容`

### 2.2 `src/components/music/MusicCreationAlbumSeedStep.vue`
- Archive format hint:
  - From: `推荐 ZIP。无法在本地读取的格式将由后台解析后匹配。`
  - To: `推荐 ZIP。无法在本地读取的格式将在上传后自动解析并匹配。`

### 2.3 `src/components/music/MusicCreationAlbumPreviewStep.vue`
- Processing tip:
  - From: `文件已上传，后续音频处理会在后台继续。`
  - To: `文件已上传，音频处理将自动继续完成。`

### 2.4 `src/views/video/VideoImportsView.vue`
- Task published status message:
  - From: `视频已发布，后台会继续生成播放预览`
  - To: `视频已发布，正在自动生成播放预览`

### 2.5 `src/views/blog/ProfileView.vue`
- Empty state title:
  - From: `暂无此类型内容`
  - To: `暂无所选内容`

### 2.6 `tests/unit/views/portal/PortalView.spec.ts`
- Fix test data fixture so `featured.slice(0, 3)` only populates blog items in `featured`, eliminating mock pollution for the music album backend test.

---

## 3. Automated Guidelines Contract Tests

In `tests/unit/ui/ui-guidelines.spec.ts`:
- Add assertions verifying that `MusicCreationAlbumSeedStep.vue`, `MusicCreationAlbumPreviewStep.vue`, `VideoImportsView.vue`, and `PortalView.vue` do not contain backend/developer framing (`后台解析`, `会在后台继续`, `后台会继续`, `查看真实内容`).

---

## 4. Verification Plan

- `bun run type-check`: 0 errors.
- `bun run test:unit tests/unit/ui/ tests/unit/views/portal/PortalView.spec.ts`: All tests pass.
- `bun run build`: Production build succeeds.
- `git diff --check`: Clean formatting.
