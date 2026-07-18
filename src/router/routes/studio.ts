import type { RouteRecordRaw } from 'vue-router'

export const studioRoutes: RouteRecordRaw[] = [{
  path: '/studio',
  component: () => import('@/views/studio/StudioLayout.vue'),
  meta: { requiresAuth: true },
  children: [
    { path: '', name: 'studio-dashboard', component: () => import('@/views/studio/StudioDashboardView.vue') },
    { path: 'channel', name: 'studio-channel', component: () => import('@/views/studio/StudioChannelView.vue') },
    { path: 'blog/new', name: 'studio-blog-new', component: () => import('@/views/blog/PostEditorView.vue'), meta: { featureGate: { module: 'blog', feature: 'post.create' } } },
    { path: 'blog/:id/edit', name: 'studio-blog-edit', component: () => import('@/views/blog/PostEditorView.vue'), meta: { featureGate: { module: 'blog', feature: 'post.create' } } },
    { path: 'podcast/new', name: 'studio-podcast-new', component: () => import('@/views/podcast/PodcastEditorView.vue'), meta: { featureGate: { module: 'podcast', feature: 'podcast.publish' } } },
    { path: 'podcast/:id/edit', name: 'studio-podcast-edit', component: () => import('@/views/podcast/PodcastEditorView.vue'), meta: { featureGate: { module: 'podcast', feature: 'podcast.publish' } } },
    { path: 'video/new', name: 'studio-video-new', component: () => import('@/views/video/VideoEditorView.vue'), meta: { featureGate: { module: 'video', feature: 'video.publish' } } },
    { path: 'video/:id/edit', name: 'studio-video-edit', component: () => import('@/views/video/VideoEditorView.vue'), meta: { featureGate: { module: 'video', feature: 'video.publish' } } },
    {
      path: ':module(blog|podcast|video)',
      component: () => import('@/views/studio/StudioModuleLayout.vue'),
      children: [
        { path: '', redirect: to => `/studio/${String(to.params.module)}/content` },
        { path: 'content', name: 'studio-content', component: () => import('@/views/studio/StudioContentView.vue') },
        { path: 'analytics', name: 'studio-analytics', component: () => import('@/views/studio/StudioAnalyticsView.vue') },
        { path: 'interactions', name: 'studio-interactions', component: () => import('@/views/studio/StudioInteractionsView.vue') },
        { path: 'settings', name: 'studio-settings', component: () => import('@/views/studio/StudioSettingsView.vue') },
      ],
    },
  ],
}]
