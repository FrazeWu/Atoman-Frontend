import type { RouteRecordRaw } from 'vue-router'
import { buildBaseAppRoutes } from '@/router/buildBaseAppRoutes'

export function buildInitialRoutes(): RouteRecordRaw[] {
  return buildBaseAppRoutes()
}
