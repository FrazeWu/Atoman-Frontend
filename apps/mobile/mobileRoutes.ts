import type { RouteRecordRaw } from 'vue-router'

const requiresAuth = { requiresAuth: true }

export const MOBILE_MODULES = ['feed', 'blog'] as const

export const mobileRoutes: RouteRecordRaw[] = [
  { path: '/', redirect: '/feed' },
  {
    path: '/login',
    component: () => import('@/views/auth/LoginView.vue'),
    meta: { authLayout: true },
  },
  {
    path: '/register',
    component: () => import('@/views/auth/LoginView.vue'),
    meta: { authLayout: true },
  },
  {
    path: '/forgot-password',
    component: () => import('@/views/auth/ForgotPasswordView.vue'),
    meta: { authLayout: true },
  },
  {
    path: '/feed',
    component: () => import('@/views/feed/FeedRecommendedView.vue'),
  },
  {
    path: '/feed/subscriptions',
    component: () => import('@/views/feed/FeedView.vue'),
    meta: requiresAuth,
  },
  {
    path: '/feed/reading-list',
    component: () => import('@/views/feed/FeedReadingListView.vue'),
    meta: requiresAuth,
  },
  {
    path: '/feed/starred',
    component: () => import('@/views/feed/FeedStarredView.vue'),
    meta: requiresAuth,
  },
  {
    path: '/feed/item/:id',
    component: () => import('@/views/feed/FeedItemDetailView.vue'),
  },
  {
    path: '/posts',
    component: () => import('@/views/blog/BlogHomeView.vue'),
  },
  {
    path: '/posts/notes',
    component: () => import('@/views/blog/ShortNoteTimelineView.vue'),
  },
  {
    path: '/posts/notes/:id',
    component: () => import('@/views/blog/ShortNoteDetailView.vue'),
  },
  {
    path: '/posts/subscriptions',
    component: () => import('@/views/blog/BlogSubscriptionsView.vue'),
    meta: requiresAuth,
  },
  {
    path: '/posts/bookmarks',
    component: () => import('@/views/blog/BookmarkView.vue'),
    meta: requiresAuth,
  },
  {
    path: '/channel/:slug',
    component: () => import('@/views/blog/ChannelView.vue'),
  },
  {
    path: '/collection/:id',
    component: () => import('@/views/blog/CollectionView.vue'),
  },
  {
    path: '/post/:id',
    component: () => import('@/views/blog/PostDetailView.vue'),
  },
  {
    path: '/:pathMatch(.*)*',
    component: () => import('@/views/system/NotFoundView.vue'),
  },
]
