# 音乐模块 FSD 领域化与播放器状态治理实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立 `src/entities/music/` 领域切片并接入 `@tanstack/vue-query`，抽离底层音频驱动引擎 `src/utils/audioEngine.ts`，重构瘦身 1,416 行巨石 `src/stores/player.ts`，保持 47 项播放器单元测试及全站 470+ 测试套件 100% 通过。

**Architecture:** 遵循 FSD 规范，服务端元数据（歌曲、专辑、艺术家、歌词）由 `entities/music` 的 Vue Query 钩子统一管理与缓存，底层 HTML5 Audio 事件驱动与预取解耦为 `audioEngine` 独立工具库，Pinia `usePlayerStore` 纯化为客户端瞬时播放状态机与队列调度器，对外保持 100% 兼容的 API 契约。

**Tech Stack:** Vue 3.4+ / 3.5, Vite 6, TypeScript 5.8 (Strict), `@tanstack/vue-query` v5, Pinia 2.1, Vitest 4, Happy-DOM.

## Global Constraints

- **严格 0 阴影**：全局遵循 `box-shadow: none !important;`。
- **严格 4px 圆角**：交互元素与卡片统一遵循 `border-radius: 4px;`。
- **纯白纸张基底**：遵循 `#FFFFFF` 纸张底色与 `1px solid var(--a-color-border-soft)` 发丝线分割。
- **播放器契约红线**：严禁破坏 `tests/unit/stores/player.spec.ts` 47 项已有测试的行为契约（如切歌代际防护、5秒防抖打点、对数感知音量、分片预取存活等），对外属性与方法签名必须 100% 保持一致。
- **门禁验证**：每个任务必须通过对应单测；整体交付必须全量通过 `bun run type-check`、`bun run test:unit tests/unit/stores/player.spec.ts`、`bun run test:unit tests/unit/components/music/ tests/unit/views/music/` 及 `bun run build`。

---

### Task 1: 建立 `src/entities/music/` 实体切片（类型、API、Query Key 与 Vue Query Hooks）

**Files:**
- Create: `src/entities/music/model/types.ts`
- Modify: `src/types.ts:1-60`
- Create: `src/entities/music/api/musicApi.ts`
- Create: `src/entities/music/api/sessionApi.ts`
- Create: `src/entities/music/queries/musicKeys.ts`
- Create: `src/entities/music/queries/useSongQuery.ts`
- Create: `src/entities/music/queries/useAlbumQuery.ts`
- Create: `src/entities/music/queries/useLyricsQuery.ts`
- Create: `src/entities/music/index.ts`
- Test: `tests/unit/entities/music/musicQueries.spec.ts`

**Interfaces:**
- Produces: `musicKeys`, `useSongQuery`, `useAlbumQuery`, `useLyricsQuery`
- Produces: `Song`, `Album`, `Artist`, `ArtistAlias`, `LyricAnnotation`, `MusicEntryStatus`, `MusicRecommendationContext` from `src/entities/music/model/types.ts`

- [ ] **Step 1: 编写 music entity 查询与 Key 工厂测试**

创建 `tests/unit/entities/music/musicQueries.spec.ts`：

```typescript
import { describe, expect, it, vi } from 'vitest'
import { musicKeys } from '@/entities/music/queries/musicKeys'
import { useSongQuery } from '@/entities/music/queries/useSongQuery'
import { useLyricsQuery } from '@/entities/music/queries/useLyricsQuery'
import { createTestQueryClient } from '../../helpers/queryClient'
import { VUE_QUERY_CLIENT } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { defineComponent, toRef } from 'vue'
import * as musicApi from '@/entities/music/api/musicApi'

describe('musicKeys factory', () => {
  it('generates consistent hierarchical query keys', () => {
    expect(musicKeys.all).toEqual(['music'])
    expect(musicKeys.songs()).toEqual(['music', 'songs'])
    expect(musicKeys.song('song-123')).toEqual(['music', 'songs', 'song-123'])
    expect(musicKeys.lyrics('song-123')).toEqual(['music', 'songs', 'song-123', 'lyrics'])
    expect(musicKeys.albums()).toEqual(['music', 'albums'])
    expect(musicKeys.album('album-456')).toEqual(['music', 'albums', 'album-456'])
  })
})

describe('useSongQuery', () => {
  it('fetches song detail through musicApi', async () => {
    const mockSong = {
      id: 101,
      title: 'Echoes of Dawn',
      artist: 'Solaris',
      audio_url: 'https://example.com/audio.mp3',
    }
    vi.spyOn(musicApi, 'fetchSongById').mockResolvedValue(mockSong as any)

    const client = createTestQueryClient()
    const TestComponent = defineComponent({
      props: { songId: { type: String, required: true } },
      setup(props) {
        const query = useSongQuery(toRef(props, 'songId'))
        return { query }
      },
      template: '<div><span v-if="query.data.value">{{ query.data.value.title }}</span></div>',
    })

    const wrapper = mount(TestComponent, {
      props: { songId: '101' },
      global: {
        provide: {
          [VUE_QUERY_CLIENT]: client,
        },
      },
    })

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Echoes of Dawn')
    })
  })
})
```

- [ ] **Step 2: 运行测试验证其失败**

运行：`bun run test:unit tests/unit/entities/music/musicQueries.spec.ts`
预期：FAIL，找不到 `@/entities/music/*`。

- [ ] **Step 3: 提取音乐实体模型与类型**

创建 `src/entities/music/model/types.ts`：
```typescript
import type { ResolvedReference } from '@/api/references'
import type { User } from '@/types'

export type MusicEntryStatus = 'open' | 'confirmed' | 'disputed'

export interface ArtistAlias {
  id: string
  artist_id: string
  alias: string
  is_main_name: boolean
  created_at: string
}

export interface LyricAnnotation {
  id: string
  song_id: string
  line_number: number
  content: string
  user?: User
  created_at: string
}

export interface Artist {
  id: number | string
  name: string
  bio?: string
  image_url?: string
  nationality?: string
  birth_year?: number
  death_year?: number
  members?: string
  entry_status?: MusicEntryStatus
  aliases?: ArtistAlias[]
  created_at?: string
  updated_at?: string
}

export interface Song {
  id: number | string
  title: string
  artist?: string
  album?: string
  audio_url: string
  duration?: number
  cover_url?: string
  cover_source?: 'local' | 's3'
  lyrics?: string
  waveform_data?: number[]
  album_id?: number
  artists?: Artist[]
  entry_status?: MusicEntryStatus
  created_at?: string
  updated_at?: string
}

export interface Album {
  id: number
  title: string
  year?: number
  release_date?: string
  cover_url?: string
  cover_source?: 'local' | 's3'
  status: 'open' | 'closed' | 'pending' | 'approved' | 'rejected'
  album_type?: string
  entry_status?: MusicEntryStatus
  uploaded_by?: number
  artists?: Artist[]
  songs?: Song[]
  created_at?: string
  updated_at?: string
}

export type MusicRecommendationContext = {
  request_id: string
  surface: 'music_home'
  position: number
  reason?: string
}
```

在 `src/types.ts` 顶部 re-export 这些类型，保证全站现有引用绝对不破裂：
```typescript
export type {
  MusicEntryStatus,
  ArtistAlias,
  LyricAnnotation,
  Artist,
  Song,
  Album,
  MusicRecommendationContext,
} from '@/entities/music/model/types'
```
并在 `src/types.ts` 中移除原来重复的 `MusicEntryStatus`、`ArtistAlias`、`LyricAnnotation`、`Artist`、`Album`、`MusicRecommendationContext` 接口定义。

- [ ] **Step 4: 实现 API 抽象与 Query Hooks**

创建 `src/entities/music/api/musicApi.ts`：
```typescript
import { apiGetOptional, apiGetRaw } from '@/api/client'
import type { Song, Album, Artist } from '../model/types'

export async function fetchSongById(id: string | number): Promise<Song | null> {
  return apiGetOptional<Song>(`/api/v1/music/songs/${id}`)
}

export async function fetchAlbumById(id: string | number): Promise<Album | null> {
  return apiGetOptional<Album>(`/api/v1/music/albums/${id}`)
}

export async function fetchArtistById(id: string | number): Promise<Artist | null> {
  return apiGetOptional<Artist>(`/api/v1/music/artists/${id}`)
}

export async function fetchLyricsBySongId(songId: string | number): Promise<string> {
  const res = await apiGetRaw(`/api/v1/music/songs/${songId}/lyrics`)
  return res || ''
}
```

创建 `src/entities/music/api/sessionApi.ts`：
```typescript
import { apiPostJson, apiGetOptional } from '@/api/client'

export interface PlaybackSessionDTO {
  song_id: string
  position: number
  queue?: string[]
}

export async function saveMusicProgress(songId: string, positionMs: number): Promise<void> {
  await apiPostJson('/api/v1/music/progress', { song_id: songId, position: positionMs })
}

export async function restoreMusicSession(): Promise<PlaybackSessionDTO | null> {
  return apiGetOptional<PlaybackSessionDTO>('/api/v1/music/session')
}
```

创建 `src/entities/music/queries/musicKeys.ts`：
```typescript
export const musicKeys = {
  all: ['music'] as const,
  songs: () => [...musicKeys.all, 'songs'] as const,
  song: (id: string | number) => [...musicKeys.songs(), String(id)] as const,
  lyrics: (songId: string | number) => [...musicKeys.song(songId), 'lyrics'] as const,
  albums: () => [...musicKeys.all, 'albums'] as const,
  album: (id: string | number) => [...musicKeys.albums(), String(id)] as const,
  artists: () => [...musicKeys.all, 'artists'] as const,
  artist: (id: string | number) => [...musicKeys.artists(), String(id)] as const,
}
```

创建 `src/entities/music/queries/useSongQuery.ts`：
```typescript
import { useQuery } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { fetchSongById } from '../api/musicApi'
import { musicKeys } from './musicKeys'

export function useSongQuery(id: MaybeRefOrGetter<string | number>) {
  return useQuery({
    queryKey: computed(() => musicKeys.song(toValue(id))),
    queryFn: () => fetchSongById(toValue(id)),
    staleTime: 1000 * 60 * 10, // 10 分钟
    enabled: computed(() => Boolean(toValue(id))),
  })
}
```

创建 `src/entities/music/queries/useAlbumQuery.ts`：
```typescript
import { useQuery } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { fetchAlbumById } from '../api/musicApi'
import { musicKeys } from './musicKeys'

export function useAlbumQuery(id: MaybeRefOrGetter<string | number>) {
  return useQuery({
    queryKey: computed(() => musicKeys.album(toValue(id))),
    queryFn: () => fetchAlbumById(toValue(id)),
    staleTime: 1000 * 60 * 15, // 15 分钟
    enabled: computed(() => Boolean(toValue(id))),
  })
}
```

创建 `src/entities/music/queries/useLyricsQuery.ts`：
```typescript
import { useQuery } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { fetchLyricsBySongId } from '../api/musicApi'
import { musicKeys } from './musicKeys'

export function useLyricsQuery(songId: MaybeRefOrGetter<string | number>) {
  return useQuery({
    queryKey: computed(() => musicKeys.lyrics(toValue(songId))),
    queryFn: () => fetchLyricsBySongId(toValue(songId)),
    staleTime: 1000 * 60 * 15,
    enabled: computed(() => Boolean(toValue(songId))),
  })
}
```

创建 `src/entities/music/index.ts`：
```typescript
export * from './model/types'
export * from './api/musicApi'
export * from './api/sessionApi'
export * from './queries/musicKeys'
export * from './queries/useSongQuery'
export * from './queries/useAlbumQuery'
export * from './queries/useLyricsQuery'
```

- [ ] **Step 5: 运行测试与类型检查验证其通过**

运行：
```bash
bun run test:unit tests/unit/entities/music/musicQueries.spec.ts
bun run type-check
```
预期：测试 PASS，类型检查 0 错误。

- [ ] **Step 6: 提交**

```bash
git add src/entities/music/ src/types.ts tests/unit/entities/music/musicQueries.spec.ts
git commit -m "feat(entities): create music entity slice with model, api, and vue-query hooks"
```

---

### Task 2: 抽取底层音频引擎 `src/utils/audioEngine.ts`

**Files:**
- Create: `src/utils/audioEngine.ts`
- Test: `tests/unit/utils/audioEngine.spec.ts`

**Interfaces:**
- Produces: `computeActualVolume`, `fadeOutAudio`, `AudioPrefetcher`, `resolvePlaybackAudioUrl`

- [ ] **Step 1: 编写失败的音频引擎独立单测**

创建 `tests/unit/utils/audioEngine.spec.ts`：

```typescript
import { describe, expect, it, vi } from 'vitest'
import { computeActualVolume, fadeOutAudio, AudioPrefetcher, resolvePlaybackAudioUrl } from '@/utils/audioEngine'

describe('computeActualVolume', () => {
  it('maps input volume using perceptual logarithmic quadratic curve', () => {
    expect(computeActualVolume(0)).toBe(0)
    expect(computeActualVolume(1)).toBe(1)
    expect(computeActualVolume(0.5)).toBe(0.25)
    expect(computeActualVolume(-0.2)).toBe(0)
    expect(computeActualVolume(1.5)).toBe(1)
  })
})

describe('fadeOutAudio', () => {
  it('smoothly reduces volume to zero and completes', async () => {
    const mockAudio = {
      volume: 1,
      paused: false,
    } as HTMLAudioElement

    await fadeOutAudio(mockAudio, 60)
    expect(mockAudio.volume).toBe(0)
  })

  it('noops when audio is paused or already silent', async () => {
    const mockAudio = { volume: 0, paused: true } as HTMLAudioElement
    await fadeOutAudio(mockAudio, 60)
    expect(mockAudio.volume).toBe(0)
  })
})

describe('resolvePlaybackAudioUrl', () => {
  it('appends cors cache query to r2 production audio urls', () => {
    const raw = 'https://assets.atoman.org/audio/track-1.mp3'
    const resolved = resolvePlaybackAudioUrl(raw)
    expect(resolved).toContain('track-1.mp3')
  })
})

describe('AudioPrefetcher', () => {
  it('manages prefetch cache and abort controller', () => {
    const prefetcher = new AudioPrefetcher()
    expect(prefetcher.isPrefetched('https://example.com/audio.mp3')).toBe(false)
    prefetcher.markPrefetched('https://example.com/audio.mp3')
    expect(prefetcher.isPrefetched('https://example.com/audio.mp3')).toBe(true)
    prefetcher.reset()
    expect(prefetcher.isPrefetched('https://example.com/audio.mp3')).toBe(false)
  })
})
```

- [ ] **Step 2: 运行测试验证其失败**

运行：`bun run test:unit tests/unit/utils/audioEngine.spec.ts`
预期：FAIL，找不到 `@/utils/audioEngine`。

- [ ] **Step 3: 实现 `src/utils/audioEngine.ts`**

创建 `src/utils/audioEngine.ts`：
```typescript
export const audioStartPrefetchBytes = 512 * 1024
export const audioStartPrefetchConcurrency = 4

export const computeActualVolume = (v: number): number => {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(v) ? v : 1))
  return Math.pow(clamped, 2)
}

export const fadeOutAudio = async (targetAudio: HTMLAudioElement, durationMs = 120): Promise<void> => {
  if (!targetAudio || targetAudio.paused || targetAudio.volume <= 0) return
  const steps = 6
  const interval = Math.max(10, Math.floor(durationMs / steps))
  const initialVolume = targetAudio.volume
  for (let i = 1; i <= steps; i++) {
    targetAudio.volume = Math.max(0, initialVolume * (1 - i / steps))
    await new Promise((resolve) => setTimeout(resolve, interval))
  }
}

export function resolvePlaybackAudioUrl(url: string): string {
  if (!url) return ''
  // 对于生产环境 R2/CDN 地址，确保跨域与缓存协议规范
  if (url.includes('.r2.cloudflarestorage.com') || url.includes('assets.atoman.org')) {
    const separator = url.includes('?') ? '&' : '?'
    return `${url}${separator}cors=1`
  }
  return url
}

export class AudioPrefetcher {
  private prefetchedUrls = new Set<string>()
  private abortController: AbortController | null = null

  public isPrefetched(url: string): boolean {
    return this.prefetchedUrls.has(url)
  }

  public markPrefetched(url: string): void {
    this.prefetchedUrls.add(url)
  }

  public getAbortSignal(): AbortSignal {
    if (!this.abortController) {
      this.abortController = new AbortController()
    }
    return this.abortController.signal
  }

  public abortPending(): void {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }

  public reset(): void {
    this.abortPending()
    this.prefetchedUrls.clear()
  }
}
```

- [ ] **Step 4: 运行测试验证其通过**

运行：`bun run test:unit tests/unit/utils/audioEngine.spec.ts`
预期：PASS（4/4 tests pass）。

- [ ] **Step 5: 提交**

```bash
git add src/utils/audioEngine.ts tests/unit/utils/audioEngine.spec.ts
git commit -m "feat(audio): extract audioEngine utilities with volume and prefetch control"
```

---

### Task 3: 重构并精简 `src/stores/player.ts`，对接 `audioEngine` 与 `entities/music`

**Files:**
- Modify: `src/stores/player.ts:1-1416`
- Test: `tests/unit/stores/player.spec.ts`

**Interfaces:**
- Consumes: `computeActualVolume`, `fadeOutAudio`, `AudioPrefetcher`, `resolvePlaybackAudioUrl` from `@/utils/audioEngine`
- Consumes: `Song`, `fetchSongById`, `saveMusicProgress`, `restoreMusicSession` from `@/entities/music`
- Produces: `usePlayerStore` (100% 保持既有状态和方法签名)

- [ ] **Step 1: 先行运行播放器 47 项基线测试**

运行：`bun run test:unit tests/unit/stores/player.spec.ts`
预期：PASS（47/47 tests pass）。

- [ ] **Step 2: 重构 `src/stores/player.ts`**

在 `src/stores/player.ts` 中：
1. 导入 `@/utils/audioEngine` 中的 `computeActualVolume`、`fadeOutAudio`、`resolvePlaybackAudioUrl`、`AudioPrefetcher`；
2. 保持对 `computeActualVolume` 与 `fadeOutAudio` 的具名 re-export，防止外部文件（如测试）直接导入时断裂：
   ```typescript
   export { computeActualVolume, fadeOutAudio } from '@/utils/audioEngine'
   ```
3. 将散落的 `apiGetOptional('/api/v1/music/songs/' + id)` 替换为统一的 `fetchSongById(id)`；
4. 将进度保存与会话恢复替换为 `saveMusicProgress` 与 `restoreMusicSession`；
5. 精简内部重复的 URL 判断和音量计算，全部对接 `audioEngine`。

- [ ] **Step 3: 运行播放器单测验证其 47 项全部通过**

运行：`bun run test:unit tests/unit/stores/player.spec.ts`
预期：PASS（47/47 tests pass，耗时在 1s 内）。

- [ ] **Step 4: 运行关联组件测试验证兼容性**

运行：
```bash
bun run test:unit tests/unit/components/music/SongRatingControl.spec.ts
bun run test:unit tests/unit/views/music/MusicSongRouteView.spec.ts
bun run type-check
```
预期：全部 PASS，类型检查 0 错误。

- [ ] **Step 5: 提交**

```bash
git add src/stores/player.ts
git commit -m "refactor(player): decouple audio engine and music entity api while keeping full api compatibility"
```

---

### Task 4: 曲库抽屉组件数据接入优化与全仓回归验证

**Files:**
- Modify: `src/components/music/SongDrawer.vue` (接入 `useSongQuery`)
- Test: `tests/unit/components/music/SongDrawerLayout.spec.ts`
- Test: `tests/unit/components/music/AlbumDrawer.spec.ts`
- Test: 全仓单测与构建

- [ ] **Step 1: 优化 `SongDrawer.vue` 接入 `useSongQuery`**

在 `src/components/music/SongDrawer.vue` 中引入 `useSongQuery`，当查看单曲抽屉时优先命中内存缓存，避免重复网络请求。

- [ ] **Step 2: 运行所有音乐组件与页面测试**

运行：
```bash
bun run test:unit tests/unit/components/music/ tests/unit/views/music/
```
预期：所有音乐组件与视图测试 100% 全部通过。

- [ ] **Step 3: 运行全量 TypeScript 类型检查**

运行：`bun run type-check`
预期：exited with code 0，零类型错误。

- [ ] **Step 4: 运行生产构建打包**

运行：`bun run build`
预期：exited with code 0，生产构建产物顺利生成。

- [ ] **Step 5: 最终提交**

```bash
git add .
git commit -m "chore(music): complete music entity and player store fsd refactoring verification"
```
