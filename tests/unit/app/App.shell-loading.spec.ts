import path from 'node:path'
import { readFileSync } from 'node:fs'

const appShellSource = readFileSync(
  path.resolve(process.cwd(), 'src/App.vue'),
  'utf8',
)
const musicHomeSource = readFileSync(
  path.resolve(process.cwd(), 'src/views/music/HomeView.vue'),
  'utf8',
)

describe('App shell loading', () => {
  it('keeps the audio player behind a conditional async boundary', () => {
    expect(appShellSource).not.toContain("import AudioPlayer from '@/components/music/AudioPlayer.vue'")
    expect(appShellSource).toContain("defineAsyncComponent(() => import('@/components/music/AudioPlayer.vue'))")
    expect(appShellSource).toContain('v-if="hasActiveTrack"')
  })

  it('mounts one global music action drawer outside the music route', () => {
    expect(appShellSource).toContain("defineAsyncComponent(() => import('@/components/music/NestedActionDrawer.vue'))")
    expect(appShellSource.match(/<NestedActionDrawer\s*\/>/g)).toHaveLength(1)
    expect(musicHomeSource).not.toContain('NestedActionDrawer')
  })
})
