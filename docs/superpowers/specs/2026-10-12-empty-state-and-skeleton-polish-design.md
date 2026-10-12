# Design Spec: Empty States and Skeleton Screens Polish

- **Date**: 2026-10-12
- **Scope**: `Atoman-Frontend`
- **Target Components**: `src/components/ui/PEmpty.vue`, `src/components/ui/PSkeleton.vue`, and consumer views across modules.

---

## 1. Problem Statement & Background

Across `Atoman-Frontend`, two foundational feedback primitives have visual and informational inconsistencies with the design system:
1. **`PEmpty.vue`**:
   - Defaults to `kicker: '暂无内容'`, causing an uppercase screaming redundant kicker to appear above already-descriptive titles (e.g. "暂无内容" above "暂无频道" or "暂无趋势数据"). Many views worked around this by passing `kicker=""`.
   - Typography and spacing were unaligned with the pure-white compact design tokens.
   - Missing layout flexibility (`align="center" | "start"`, `compact` mode) and optional icon slot for minimal visual hierarchy.
   - Several consumer pages contained verbose, conversational or developer-perspective copy violating `AGENTS.md` rules.
2. **`PSkeleton.vue`**:
   - Rect variant used hardcoded `border-radius: 6px` instead of the pure-white design token `var(--a-radius-card, 4px)`.
   - Shimmer animation had high-contrast harsh white flashes (`rgba(255, 255, 255, 0.5)`).
   - Did not support delicate line-art or bordered card skeletons, making loading states look like heavy solid gray blocks.
   - Did not respect `@media (prefers-reduced-motion: reduce)`.

---

## 2. Component Design & Contracts

### 2.1 `PEmpty.vue`

#### Props Contract
```typescript
interface PEmptyProps {
  title?: string
  description?: string
  text?: string          // Legacy alias mapped to title
  sub?: string           // Legacy alias mapped to description
  message?: string       // Legacy alias
  kicker?: string        // Defaults to '暂无内容' for backward compatibility, but rendered only if explicitly customized
  align?: 'start' | 'center' // Default: 'start'
  compact?: boolean      // Default: false
}
```

#### Behavior & Rendering Rules
- `computedTitle`: `props.title || props.text || props.message`
- `computedDescription`: `props.description || props.sub || (props.title ? props.message : '')`
- `computedKicker`: Only rendered when `props.kicker && props.kicker !== '暂无内容'`. This preserves compatibility with tests checking that `kicker: '暂无内容'` exists in the file, while stopping the component from redundantly outputting "暂无内容" in UI views when unprompted.
- Slots:
  - `#icon`: Minimalist stroke icon or graphic anchor.
  - `#action`: Call-to-action buttons (e.g. "创建频道", "去发现").
  - Default slot: Custom child content if title & description are omitted.

#### Visual Styling
- Container:
  - `align === 'center'`: `justify-items: center; text-align: center;`
  - `align === 'start'`: `justify-items: start; text-align: left;`
  - Gap: `8px`.
  - Padding: `32px 0` by default; `compact` mode reduces to `16px 0`.
- Title: `font-size: 1.0625rem; font-weight: 500; color: var(--a-color-text); line-height: 1.4;`
- Description: `font-size: 0.8125rem; color: var(--a-color-muted); line-height: 1.5; max-width: 48ch;`
- Kicker: `font-size: 11px; font-weight: 500; color: var(--a-color-muted);`
- Action: `margin-top: 6px;`

---

### 2.2 `PSkeleton.vue`

#### Props Contract
```typescript
interface PSkeletonProps {
  variant?: 'text' | 'rect' | 'circle' // Default: 'rect'
  width?: string                        // Default: '100%'
  height?: string                       // Default: '1rem'
  animated?: boolean                    // Default: true
  bordered?: boolean                    // Default: false
}
```

#### Visual Styling & Shimmer
- Rect variant: `border-radius: var(--a-radius-card, 4px);`
- Text variant: `border-radius: var(--a-radius-control, 4px); height: 0.85em;`
- Circle variant: `border-radius: 50%;`
- Line-art / Bordered mode (`p-skeleton--bordered`):
  - `border: 1px solid var(--a-color-border-soft);`
  - `background: var(--a-color-bg);`
- Standard background: `var(--a-color-surface-muted, #f1f5f9);`
- Shimmer gradient: Softened to `rgba(255, 255, 255, 0.35)` to avoid flashing.
- Motion: `@media (prefers-reduced-motion: reduce)` disables `animation` on `.p-skeleton--shimmer::after`.

---

## 3. Site-wide Copy & Quality Standardization

In compliance with `AGENTS.md`:
1. **Title Rules**: Only content name or action name (e.g., "暂无推荐文章", "暂无收藏内容", "暂无播放历史"). No atmospheric sentences.
2. **Description Rules**: At most one line containing hard requirements or high-value actionable guidance.
3. **No Developer Jargon**: Remove terms like "内部", "System", "后台识别", etc.
4. **Refined Modules**:
   - `FeedRecommendedView.vue`: Remove `kicker="文章"`, `kicker="频道"`. Use clean titles: "暂无推荐文章", "暂无推荐频道".
   - `FeedStatsView.vue`: Clean subtitle to "在订阅时间线中阅读文章后显示统计。"
   - `Music` Library & History: "这里还没有收藏内容" -> "暂无收藏内容"; "还没有播放历史" -> "暂无播放历史".

---

## 4. Verification Plan

1. **Unit Tests**:
   - `tests/unit/ui/PEmpty.spec.ts`: Test props mapping, default suppressed kicker, custom kicker rendering, slot rendering, `align`, and `compact`.
   - `tests/unit/ui/PSkeleton.spec.ts`: Test rect 4px radius, bordered line-art class, shimmer class, and reduced motion.
2. **Regression Contract Tests**:
   - `tests/unit/ui/ui-guidelines.spec.ts`: Verify contracts pass.
   - `tests/unit/ui/design-system-contract.spec.ts`: Verify design system tokens pass.
3. **Build & Typecheck**:
   - `bun run type-check` (0 errors)
   - `bun run build` (success)
   - `bun run test:unit` (all pass)
