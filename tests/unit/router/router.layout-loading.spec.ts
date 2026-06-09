import path from 'node:path'
import { readFileSync } from 'node:fs'

const routerSource = readFileSync(path.resolve(process.cwd(), 'src/router/routes/modules.ts'), 'utf8')

describe('router layout loading', () => {
  it('keeps top-level module layouts behind route-level dynamic imports', () => {
    expect(routerSource).not.toContain("import BlogLayout from '@/views/blog/BlogLayout.vue'")
    expect(routerSource).not.toContain("import FeedLayout from '@/views/feed/FeedLayout.vue'")
    expect(routerSource).not.toContain("import MusicLayout from '@/views/music/MusicLayout.vue'")
    expect(routerSource).not.toContain("import ForumLayout from '@/views/forum/ForumLayout.vue'")
    expect(routerSource).not.toContain("import DebateLayout from '@/views/debate/DebateLayout.vue'")
    expect(routerSource).not.toContain("import TimelineLayout from '@/views/timeline/TimelineLayout.vue'")
    expect(routerSource).not.toContain("import PodcastLayout from '@/views/podcast/PodcastLayout.vue'")
    expect(routerSource).not.toContain("import VideoLayout from '@/views/video/VideoLayout.vue'")

    expect(routerSource).toContain("component: () => import('@/views/blog/BlogLayout.vue')")
    expect(routerSource).toContain("component: () => import('@/views/feed/FeedLayout.vue')")
    expect(routerSource).toContain("component: () => import('@/views/music/MusicLayout.vue')")
    expect(routerSource).toContain("component: () => import('@/views/forum/ForumLayout.vue')")
    expect(routerSource).toContain("component: () => import('@/views/debate/DebateLayout.vue')")
    expect(routerSource).toContain("component: () => import('@/views/timeline/TimelineLayout.vue')")
    expect(routerSource).toContain("component: () => import('@/views/podcast/PodcastLayout.vue')")
    expect(routerSource).toContain("component: () => import('@/views/video/VideoLayout.vue')")
  })
})