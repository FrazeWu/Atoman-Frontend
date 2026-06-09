import { useRouter } from 'vue-router'
import type { ModuleRoomKey } from '@/config/moduleRooms'
import { resolveSiteContext } from '@/router/siteContext'
import { moduleUrl } from '@/router/siteUrls'
import { useAsyncNavigate } from '@/composables/useAsyncNavigate'

export { moduleUrl, userUrl, channelUrl, modulePathUrl } from '@/router/siteUrls'

export function subdomainDefaultPath() {
  const context = resolveSiteContext(window.location.hostname, window.location.search)
  return context.type === 'module' ? `/${context.module}` : null
}

export function useModuleNav() {
  const router = useRouter()
  const { navigateModuleWithShutter } = useAsyncNavigate()

  function navigateTo(module: ModuleRoomKey) {
    const context = resolveSiteContext(window.location.hostname, window.location.search)
    if (context.type === 'module' && context.module === module) {
      router.push('/')
      return
    }
    void navigateModuleWithShutter(moduleUrl(module))
  }

  return { navigateTo, moduleUrl }
}
