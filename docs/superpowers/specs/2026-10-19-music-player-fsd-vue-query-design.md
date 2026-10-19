# 音乐模块 FSD 领域化与播放器状态治理设计规范

## 一、概述与背景

在 Atoman 前端（`Atoman-Frontend`）的第一阶段架构重构中，成功确立了 Feature-Sliced Design (FSD) 分层体系，并基于 `@tanstack/vue-query` 完成了 Blog（博客）模块的打样与验证。

在当前全站中，复杂度最高、状态耦合最严重的核心技术资产为音乐模块与音频流媒体体系：
- [`src/stores/player.ts`](file:///Users/fafa/projects/Atoman/Atoman-Frontend/src/stores/player.ts) 代码量达 **1,416 行**，并拥有 **47 个高覆盖率单元测试**；
- 当前播放器 Store 混杂了三个正交关注点：**原生 HTMLAudioElement 硬件驱动与分段预取**、**前端播放队列调度与状态机**、**后端 REST API 曲库拉取/歌词解析/云端会话持久化**；
- `src/components/music/` 拥有 **53 个组件**，`src/views/music/` 拥有 **19 个视图**，多个抽屉（如 `SongDrawer`、`AlbumDrawer`、`ArtistDrawer`、`MusicLyricsPanel`）存在独立手写 API 请求，未能享受声明式缓存。

### 本阶段重构目标
1. 建立标准的 **`src/entities/music/`** 领域模型切片，基于 `@tanstack/vue-query` 封装曲库核心实体（歌曲、专辑、艺术家、歌词）的声明式缓存查询；
2. 剥离并封装底层音频引擎 **`src/utils/audioEngine.ts`**（包含音量对数感知、平滑淡出、首切片并发预取）；
3. 重构并精简 **`src/stores/player.ts`**，剥离服务端网络逻辑，使其专注于客户端播放队列与交互调度；
4. 保持 `usePlayerStore` 对外 API 100% 向后兼容，确保原有的 47 个单元测试零改动 100% 绿色通过，且 53 个音乐组件正常运行。

---

## 二、架构原则与分层职责划分

遵循 Feature-Sliced Design 单向依赖契约：
**`app` ➔ `pages` ➔ `widgets` ➔ `features` ➔ `entities` ➔ `shared`**

```text
[ 顶层业务界面 / 抽屉组件 (widgets/music, components/music) ]
       │ 消费：useSongQuery / useAlbumQuery / usePlayerStore
       ▼
[ 播放器状态调度 (Pinia: usePlayerStore) ] 
       │ 管理：当前音轨指针、活动播放队列、乱序/单曲循环模式、面板展开收起
       ├── 委托底层音频流 ──► [ 音频引擎驱动 (src/utils/audioEngine.ts) ]
       │                      │ 原生 Audio Element、对数音量映射、分片预取
       └── 消费领域模型与会话 ─► [ 音乐领域实体 (src/entities/music/) ]
                              │ Vue Query 缓存 (Song/Album/Artist/Lyrics)
                              │ 云端会话同步 (Session & Progress API)
```

---

## 三、`src/entities/music/` 领域切片详细设计

### 1. 目录结构
```text
src/entities/music/
├── model/
│   ├── types.ts              # Song, Album, Artist, Lyric, PlayEvent 等领域核心类型
│   └── index.ts
├── api/
│   ├── musicApi.ts           # 纯函数 API 抽象：获取歌曲/专辑/艺术家/歌词详情
│   ├── sessionApi.ts         # 云端播放进度、会话保存与恢复 API
│   ├── metricsApi.ts         # 播放合规打点与匿名访客统计上报
│   └── index.ts
├── queries/
│   ├── musicKeys.ts          # 层级化 Query Key 工厂
│   ├── useSongQuery.ts       # 歌曲详情与音频波形 Query Hook (staleTime: 10m)
│   ├── useAlbumQuery.ts      # 专辑信息与完整曲目 Query Hook (staleTime: 15m)
│   ├── useArtistQuery.ts     # 艺术家信息与专辑作品集 Query Hook (staleTime: 15m)
│   ├── useLyricsQuery.ts     # 歌词解析与时间戳行数据 Query Hook (staleTime: 10m)
│   └── index.ts
└── index.ts                  # 领域聚合导出桶
```

### 2. 模型抽离与向下兼容
从 `src/types.ts` 中提取 `Song`、`Album`、`Artist`、`ArtistAlias`、`LyricAnnotation`、`MusicEntryStatus`、`MusicRecommendationContext` 至 `src/entities/music/model/types.ts`。在 `src/types.ts` 顶部保持统一 re-export：
```typescript
export type {
  Song,
  Album,
  Artist,
  ArtistAlias,
  LyricAnnotation,
  MusicEntryStatus,
  MusicRecommendationContext,
} from '@/entities/music'
```
保证全站其他 18 个模块中现有的 `import type { Song } from '@/types'` 完全不受影响。

### 3. Query Key 工厂
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

---

## 四、底层音频引擎抽取（`src/utils/audioEngine.ts`）

将硬件级的原生 HTML5 Audio 控制与分段预取彻底解耦，形成独立的工具库：

### 1. 对数音量感知映射与平滑淡出
```typescript
// 对数感知曲线：人耳对声压级的感知是对数曲线，平方向上缩放提供自然渐进音量
export const computeActualVolume = (v: number): number => {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(v) ? v : 1))
  return Math.pow(clamped, 2)
}

// 毫秒级步进平滑淡出，支持切歌或暂停前的优雅静音过渡
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
```

### 2. 音频切片预取器（`AudioChunkPrefetcher`）
- 保持 512KB 首块切片预取策略（`audioStartPrefetchBytes = 512 * 1024`）；
- 维护 `AbortController`，在队列切换时安全取消未完成的非活跃切片请求，并保留已预取 URL 的 `Set<string>` 缓存字典。

---

## 五、`player.ts` 播放器重塑方案

### 1. 瘦身后的职责边界
Pinia Store `usePlayerStore` 将精简为纯粹的客户端状态与交互控制器：
- **瞬时播放状态**：`currentSong`、`isPlaying`、`isLoading`、`currentTime`、`duration`、`volume`、`playbackError`；
- **队列调度状态**：`queue`、`currentIndex`、`playbackMode`（loop/single/random）、`shuffledIndices`；
- **UI 交互控制**：`lyricsOpen`、`queueOpen`、`isPinned`、`lyricsLock`。

### 2. 外部 API 契约保持 100% 兼容
保留全部既有属性与方法签名，确保外部组件无需任何适配：
- `playSong(song, options?)`
- `togglePlay()`
- `seekTo(seconds)`
- `setVolume(v)`
- `playNext(autoAdvance?)`
- `playPrevious()`
- `toggleLyrics()`
- `requestLyricsClose()`
- `restoreMusicPlayback()`
- `clearPlaybackState()`

### 3. 时序与竞态控制保障
- **概要歌曲即刻播放**：当外部传入只有 id/title 的简略歌曲对象时，播放器立即启动音频播放并显示标题，同时异步调用 `getSongById` 补全完整的歌词与波形数据；
- **切歌代际防护（Play Generation）**：维护单调递增的代际计数器，如果用户在 200ms 内连续切歌，较早发出的异步歌词/波形补全响应在到达时自动被废弃，绝不覆盖当前播放歌曲。

---

## 六、测试保障与验证策略

### 1. 播放器既有 47 项单测 100% 零修改通过
`tests/unit/stores/player.spec.ts` 必须作为核心回归门禁：
- 5 秒防抖打点测试；
- 生产环境 R2 音频 CORS 缓存地址解析；
- 播客与音乐同 ID 隔离测试；
- 队列循环与随机乱序算法；
- 失败重试与错误暴露；
- 对数音量与平滑淡出测试。

### 2. 新增单元测试套件
1. `tests/unit/utils/audioEngine.spec.ts`：专项测试音量对数映射、淡出步进和预取控制；
2. `tests/unit/entities/music/musicQueries.spec.ts`：基于 `createTestQueryClient` 测试歌曲、专辑、艺术家的 Query Key 与异步缓存回显。

---

## 七、实施路线图（Implementation Roadmap）

1. **Task 1: 建立 `src/entities/music/` 实体切片**（模型抽离、API 抽象、Query Key 工厂与 Vue Query Hooks）
2. **Task 2: 抽取 `src/utils/audioEngine.ts` 底层音频引擎**（音量对数算法、淡出控制、分片预取）并编写单测
3. **Task 3: 重构 `src/stores/player.ts` 并对接新实体与音频引擎**，保障 47 个测试 100% PASS
4. **Task 4: 全量类型检查、相关视图/组件单测回归与构建验证**
