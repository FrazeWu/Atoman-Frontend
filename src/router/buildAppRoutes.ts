import type { RouteRecordRaw } from 'vue-router'
import { channelRoutes, userRoutes } from '@/router/routes/entities'
import { moduleRoutes } from '@/router/routes/modules'
import { portalRoutes } from '@/router/routes/portal'
import { settingRoutes } from '@/router/routes/settings'
import { studioRoutes } from '@/router/routes/studio'
import { moduleRooms } from '@/config/moduleRooms'

function scopedModuleRoutes(module: keyof typeof moduleRoutes): RouteRecordRaw[] {
  const publicPrefix = `/${moduleRooms[module].publicPathSegment}`

  return moduleRoutes[module]
    .filter((route) => !(
      route.path === '/login'
      || route.path === '/register'
      || route.path === '/:pathMatch(.*)*'
      || route.path === '/site/setting'
    ))
    .map((route) => {
      if (route.path === '/') {
        return {
          ...route,
          path: publicPrefix,
        }
      }

      return {
        ...route,
        path: `${publicPrefix}${route.path}`,
      }
    })
}

export function buildAppRoutes(): RouteRecordRaw[] {
  return [
    ...portalRoutes.filter((route) => route.path !== '/:pathMatch(.*)*'),
    ...settingRoutes,
    ...scopedModuleRoutes('feed'),
    ...scopedModuleRoutes('music'),
    ...scopedModuleRoutes('forum'),
    ...scopedModuleRoutes('debate'),
    ...scopedModuleRoutes('timeline'),
    ...scopedModuleRoutes('blog'),
    ...scopedModuleRoutes('podcast'),
    ...scopedModuleRoutes('video'),
	...studioRoutes,
    ...userRoutes,
    ...channelRoutes,
    {
      path: '/post/:id',
      redirect: to => ({
        path: `/posts/post/${String(to.params.id)}`,
        query: to.query,
        hash: to.hash,
      }),
    },
    { path: '/notes', redirect: '/posts/notes' },
    { path: '/inbox', component: () => import('@/views/feed/InboxPage.vue'), meta: { requiresAuth: true } },
    { path: '/bookmarks', redirect: '/posts/bookmarks' },
    { path: '/dev/showcase', component: () => import('@/views/dev/InteractionShowcaseView.vue') },
    { path: '/dev/album-creation', component: () => import('@/views/dev/AlbumCreationShowcaseView.vue') },
    { path: '/dev/blog-template', component: () => import('@/views/dev/BlogTemplateView.vue'), meta: { hasSidebar: true } },
    { path: '/dev/blog-explore-template', component: () => import('@/views/dev/BlogExploreTemplateView.vue'), meta: { hasSidebar: true } },
    { path: '/dev/feed-card-preview', component: () => import('@/views/dev/FeedCardPreviewView.vue') },
    {
      path: '/dev/comment-style/github',
      component: () => import('@/views/dev/CommentStylePreviewView.vue'),
      props: { variant: 'github' },
    },
    {
      path: '/dev/comment-style/linear',
      component: () => import('@/views/dev/CommentStylePreviewView.vue'),
      props: { variant: 'linear' },
    },
    {
      path: '/dev/comment-style/stream',
      component: () => import('@/views/dev/CommentStylePreviewView.vue'),
      props: { variant: 'stream' },
    },
    { path: '/__disabled__', component: () => import('@/views/system/ModuleUnavailableView.vue') },
    { path: '/__not_found__', component: () => import('@/views/system/NotFoundView.vue') },
    { path: '/:pathMatch(.*)*', component: () => import('@/views/system/NotFoundView.vue') },
  ]
}
