import path from 'node:path'
import { readFileSync } from 'node:fs'

const appShellSource = readFileSync(
  path.resolve(process.cwd(), 'src/App.vue'),
  'utf8',
)

describe('App shell loading', () => {
  it('keeps the audio player behind a conditional async boundary', () => {
    expect(appShellSource).not.toContain("import AudioPlayer from '@/components/music/AudioPlayer.vue'")
    expect(appShellSource).toContain("defineAsyncComponent(() => import('@/components/music/AudioPlayer.vue'))")
    expect(appShellSource).toContain('v-if="hasActiveTrack"')
  })
})