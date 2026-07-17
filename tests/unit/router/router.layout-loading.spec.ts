import path from 'node:path'
import { readFileSync } from 'node:fs'

const routerSource = readFileSync(path.resolve(process.cwd(), 'src/router/routes/modules.ts'), 'utf8')

const layouts = [
  ['MediaLayout', 'media'], ['BlogLayout', 'blog'], ['MusicLayout', 'music'],
  ['FeedLayout', 'feed'], ['ForumLayout', 'forum'], ['DebateLayout', 'debate'],
  ['TimelineLayout', 'timeline'], ['PodcastLayout', 'podcast'], ['VideoLayout', 'video'],
] as const

describe('router layout loading', () => {
  it('loads module layouts synchronously so navigation chrome renders immediately', () => {
    for (const [component, directory] of layouts) {
      expect(routerSource).toContain(`import ${component} from '@/views/${directory}/${component}.vue'`)
      expect(routerSource).toContain(`component: ${component}`)
    }
  })

  it('loads module content through the shared asynchronous wrapper', () => {
    expect(routerSource).toContain("import { asyncRouteView } from '@/router/asyncRouteView'")
    expect(routerSource).toContain("component: asyncRouteView(() => import('@/views/music/HomeView.vue'))")
    expect(routerSource).toContain("component: asyncRouteView(() => import('@/views/feed/FeedView.vue'))")
    expect(routerSource).toContain("component: asyncRouteView(() => import('@/views/forum/ForumHomeView.vue'))")
  })
})
