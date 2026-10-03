import type { RouteRecordRaw } from 'vue-router'
import { buildBaseAppRoutes } from '@/router/buildBaseAppRoutes'
import { studioRoutes } from '@/router/routes/studio'

export function buildAppRoutes(): RouteRecordRaw[] {
  return buildBaseAppRoutes(studioRoutes)
}
