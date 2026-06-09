# Video Module Modern Grid Reconstruct Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconstruct the Video module into a modern 4-column grid layout with rounded thumbnails and "Dharma Hall" aligned typography.

**Architecture:**
- **Rebranding Navigation:** Align `VideoLayout.vue` sidebar with the Blog module (Explore, Subscriptions, Manage).
- **Modern Grid Card:** Redesign `VideoCard.vue` to remove hard borders, add 12px rounded corners, and implement data overlays (views, duration, hover-visible watch-later).
- **Master-Detail Manage:** Implement a new management view with collection-video linkage.
- **Consistency**: Use `PaperSidebar`, `PaperEntry` patterns, and `SFMono` meta fonts.

**Tech Stack:** Vue 3, TypeScript, Tailwind CSS (for grid/spacing), Vite.

---

### Task 1: Navigation & Routing Overhaul

**Files:**
- Modify: `web/src/views/video/VideoLayout.vue`
- Modify: `web/src/router/routes/modules.ts`
- Create: `web/src/views/video/VideoSubscriptionsView.vue`

- [ ] **Step 1: Create `VideoSubscriptionsView.vue` stub**

```vue
<template>
  <div class="a-page">
    <APageHeader :title="moduleRooms.video.name" sub="查看你关注的频道更新" accent />
    <AEmpty title="订阅功能即将上线" description="我们将在这里展示你关注的视频动态" />
  </div>
</template>

<script setup lang="ts">
import APageHeader from '@/components/ui/APageHeader.vue'
import AEmpty from '@/components/ui/AEmpty.vue'
import { moduleRooms } from '@/config/moduleRooms'
</script>
```

- [ ] **Step 2: Update `router/routes/modules.ts` for video section**

```typescript
// Inside video route array
    {
      path: '/',
      component: () => import('@/views/video/VideoLayout.vue'),
      meta: { hasSidebar: true },
      children: [
        { path: '', component: () => import('@/views/video/VideoHomeView.vue') },
        { path: 'subscriptions', component: () => import('@/views/video/VideoSubscriptionsView.vue'), meta: { requiresAuth: true } },
        { path: 'manage', component: () => import('@/views/video/VideoManageView.vue'), meta: { requiresAuth: true } },
        { path: 'upload', component: () => import('@/views/video/VideoEditorView.vue'), meta: { requiresAuth: true } },
        { path: 'edit/:id', component: () => import('@/views/video/VideoEditorView.vue'), meta: { requiresAuth: true } },
      ],
    },
```

- [ ] **Step 3: Update `VideoLayout.vue` to use `PaperSidebar`**

```vue
<template>
  <div class="a-module-layout">
    <PaperSidebar :label="moduleRooms.video.name" :helper="moduleRooms.video.helper">
      <PaperSidebarItem to="/" :index="1" exact>探索</PaperSidebarItem>
      <PaperSidebarItem to="/subscriptions" :index="2">订阅</PaperSidebarItem>
      <PaperSidebarItem to="/manage" :index="3">管理</PaperSidebarItem>
    </PaperSidebar>
    <main class="a-main-content">
      <router-view />
    </main>
  </div>
</template>
```

- [ ] **Step 4: Commit navigation overhaul**

```bash
git add web/src/views/video/VideoLayout.vue web/src/router/routes/modules.ts web/src/views/video/VideoSubscriptionsView.vue
git commit -m "feat: overhaul video navigation and sidebar to match Dharma Hall style"
```

---

### Task 2: VideoCard Redesign - Visuals & Overlays

**Files:**
- Modify: `web/src/components/shared/VideoCard.vue`

- [ ] **Step 1: Redesign template with rounded corners and overlays**

```vue
<template>
  <div class="vc-card" @mouseenter="isHovered = true" @mouseleave="isHovered = false">
    <RouterLink :to="`/watch/${video.id}`" class="vc-thumb-link">
      <div class="vc-thumb">
        <img v-if="video.thumbnail_url" :src="video.thumbnail_url" class="vc-img" />
        <div class="vc-overlay-bottom">
          <span class="vc-views">▶ {{ fmtViews(video.view_count) }}</span>
          <span class="vc-duration">{{ fmtDuration(video.duration_sec) }}</span>
        </div>
        <div v-show="isHovered" class="vc-watch-later" @click.prevent="toggleWatchLater">
          稍后看
        </div>
      </div>
    </RouterLink>
    <!-- Metadata area below -->
  </div>
</template>
```

- [ ] **Step 2: Implement styling for the modern look**

```css
.vc-thumb {
  position: relative;
  aspect-ratio: 16/9;
  border-radius: 12px;
  overflow: hidden;
  background: var(--a-color-surface);
}
.vc-overlay-bottom {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  padding: 0.5rem;
  display: flex; justify-content: space-between;
  background: linear-gradient(to top, rgba(0,0,0,0.6), transparent);
  color: #fff; font-size: 0.65rem; font-family: var(--a-font-meta);
}
.vc-watch-later {
  position: absolute; top: 0.5rem; right: 0.5rem;
  background: #fff; border: 1.5px solid #000;
  padding: 0.2rem 0.5rem; font-size: 0.65rem; font-weight: 900;
  box-shadow: 3px 3px 0 0 #000;
}
```

- [ ] **Step 3: Commit VideoCard visuals**

```bash
git add web/src/components/shared/VideoCard.vue
git commit -m "feat: redesign VideoCard with rounded corners and immersive overlays"
```

---

### Task 3: VideoCard Redesign - Typography & Interaction

**Files:**
- Modify: `web/src/components/shared/VideoCard.vue`

- [ ] **Step 1: Update metadata section with channel avatar and SFMono fonts**

```vue
<div class="vc-info">
  <div class="vc-avatar">
    <img :src="video.channel?.cover_url || defaultAvatar" />
  </div>
  <div class="vc-text">
    <h3 class="vc-title">{{ video.title }}</h3>
    <div class="vc-meta">
      <span class="vc-channel">《{{ video.channel?.name }}》</span>
      <span class="vc-date">{{ formatDate(video.created_at) }}</span>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Implement hover underline for title**

```css
.vc-title {
  font-weight: 900;
  transition: text-decoration 0.2s;
}
.vc-card:hover .vc-title {
  text-decoration: underline;
  text-decoration-thickness: 2px;
}
.vc-meta {
  font-family: var(--a-font-meta);
  color: var(--a-color-muted-soft);
}
```

- [ ] **Step 3: Commit VideoCard typography**

```bash
git add web/src/components/shared/VideoCard.vue
git commit -m "feat: align VideoCard typography and hover effects with Blog module"
```

---

### Task 4: VideoHomeView 4-Column Grid

**Files:**
- Modify: `web/src/views/video/VideoHomeView.vue`

- [ ] **Step 1: Adjust grid CSS to 4 columns on large screens**

```css
.vh-grid {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: 2rem 1.5rem;
}
@media (min-width: 768px) { .vh-grid { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 1024px) { .vh-grid { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 1280px) { .vh-grid { grid-template-columns: repeat(4, 1fr); } }
```

- [ ] **Step 2: Remove inner card wrappers if any to allow "borderless" flow**

- [ ] **Step 3: Commit HomeView layout**

```bash
git add web/src/views/video/VideoHomeView.vue
git commit -m "feat: implement responsive 4-column grid for video home"
```

---

### Task 5: Management View Implementation

**Files:**
- Create: `web/src/views/video/VideoManageView.vue`

- [ ] **Step 1: Implement two-stage linkage (Collections -> Videos)**

```vue
<template>
  <div class="a-page">
    <div class="collection-selector">
      <!-- Horizontal list of video collections -->
    </div>
    <div class="video-list-flow">
      <!-- List of videos in selected collection with Sort/Edit/Delete -->
    </div>
  </div>
</template>
```

- [ ] **Step 2: Commit Manage view**

```bash
git add web/src/views/video/VideoManageView.vue
git commit -m "feat: implement two-stage video management view"
```

---

### Task 6: Final Polish & Visual Check

**Files:**
- Modify: `web/src/style.css` (if needed)

- [ ] **Step 1: Verify all video views for visual consistency**

- [ ] **Step 2: Ensure "Watch Later" logic is connected to store**

- [ ] **Step 3: Commit final polish**

```bash
git commit -m "chore: final visual polish for video module"
```
