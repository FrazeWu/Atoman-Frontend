# 前端架构演进与模块解耦设计规范 (Frontend Architecture Evolution Spec)

- **编写日期**：2026-11-04
- **实施状态**：已全量实施并通过验证 (Completed & Verified)
- **关联范围**：`src/types/`, `src/api/`, `src/stores/`, `src/composables/`, `src/views/`, `apps/mobile/`

---

## 1. 演进背景与核心目标

随着 Atoman 平台业务功能的快速扩展（涵盖 Blog 专栏、Feed 聚合阅读、高保真音乐播放与打点、多媒体阅读器、辩论与时间线），前端单体代码规模显著膨胀，出现了数个典型的“巨石代码（Monolith）”风险点：
1. **千行上帝组件（God Components）**：如 `SubscriptionManageSheet`（2,170 行）、`MusicCreationAlbumDetailsStep`（1,961 行）、`PEditorRuntime`（1,632 行）等，业务状态、手势拖拽、富文本交互和庞大 CSS 混杂在单个 SFC 中。
2. **中心化单体类型文件**：`src/types.ts`（1,539 行）承载了全站所有领域数据契约，导致任意字段调整引发大范围模块重编译。
3. **API 客户端层级平铺**：`src/api/*.ts` 散落数十个平铺文件，缺乏领域内聚。
4. **巨石 Store 状态树**：`stores/player.ts` 耦合了音频底层实例、播放队列算法、离线缓存、上报埋点与错误自愈机，状态复杂度极高。

**本次演进的核心目标**：
- **全面消解千行巨石**：将单文件行数收敛至 400 ~ 800 行安全区间。
- **领域驱动与高内聚**：按领域划分 Types、API、Composables 与 Stores。
- **严格向后兼容**：所有外部调用与现有契约测试 100% 保持无感迁移。
- **全链路严苛质量把控**：TypeScript 严格模式零报错、Vitest 单元测试 100% 全绿、Playwright 冒烟与双端打包零错误。

---

## 2. 核心架构模式与实现规范

### 2.1 领域类型体系 (`src/types/`)

将原本中心化的单体类型文件拆解为 12 个强领域内聚子模块：

```
src/types/
├── blog.ts         # 博客文章、专栏、草稿、短话类型
├── bookmark.ts     # 全局书签、收藏夹类型
├── debate.ts       # 辩题、观点、正反方时间轴类型
├── feed.ts         # RSS、订阅源、文章流、阅读规则类型
├── forum.ts        # 论坛板块、主题、回帖类型
├── music.ts        # 专辑、艺人、音轨、歌词、播放队列类型
├── orbit.ts        # 知识图谱与轨道关系类型
├── podcast.ts      # 播客节目、单集、Shownotes 类型
├── profile.ts      # 创作者画像、成就、主页设置类型
├── timeline.ts     # 历史与事件时间线类型
├── user.ts         # 账户、会话、偏好设置类型
├── video.ts        # 视频作品、播放列表、分段标记类型
└── index.ts        # 领域类型聚合导出 Barrel
```

**向后兼容准则**：
- 根目录 [`src/types.ts`](file:///Users/fafa/projects/Atoman/Atoman-Frontend/src/types.ts) 统一执行 `export * from '@/types/index'`。
- 新增代码优先直接引用 `@/types/<domain>` 或 `@/types`，避免循环依赖。

---

### 2.2 领域 API 客户端体系 (`src/api/`)

API 客户端由过去的根目录平铺迁移至清晰的领域子目录结构，每个目录配备独立的 `index.ts` 聚合导出：

```
src/api/
├── admin/          # 管理员、公告、用户审核接口
├── book/           # 图书作品、版本、阅读进度、批注、Wiki 接口
├── comment/        # 全站通用评论、互动、点赞接口
├── dm/             # 私信会话、消息投递、附件接口
├── feed/           # 订阅源管理、阅读状态、会员接口
├── podcast/        # 播客音视频、分集获取接口
├── reference/      # 实体引用、关联关系检索接口
├── timeline/       # 事件时间线、人物地图、修改提案接口
├── user/           # 用户信息、主页、创作者自定义主题接口
├── video/          # 视频流媒体、导入、转码状态接口
└── client.ts       # 基础 Axios 实例与统一拦截器配置
```

**兼容层保证**：
- 保留根目录下原有接口导出别名（如 `src/api/books.ts` $\to$ re-export `src/api/book/`），确保外部存量组件调用零破坏。

---

### 2.3 Store 切片模式与工作区状态提炼

#### A. 播放器巨石 Store 切片化 (`src/stores/player/`)

将原本长达 1,865 行的 `stores/player.ts` 解耦为专注于单一职责的功能切片（Slices），通过总装函数进行统一组合：

- `audioElement.ts`：底层 HTMLAudioElement 的实例化、事件监听与原生播放状态流转。
- `queue.ts`：顺序播放、随机洗牌、单曲循环状态机与切歌上下文队列。
- `progress.ts`：高精播放进度跟踪、服务端进度同步与播放断点会话恢复。
- `analytics.ts`：播放心跳打点、推荐算法反馈与完听率指标上报。
- `offline.ts`：IndexedDB 离线媒体缓存管理与预加载策略。
- `recovery.ts`：网络波动与音频解码异常的自动恢复状态机。
- `mediaSession.ts`：系统级锁屏控制、MediaSession 标题与封面联动。

同时严格保留 [`stores/playerPresence.ts`](file:///Users/fafa/projects/Atoman/Atoman-Frontend/src/stores/playerPresence.ts) 的轻量级设计，确保首屏加载绝不因为重型音频引擎造成阻塞。

#### B. 音乐工作区状态抽离 (`src/stores/musicWorkspace.ts`)

将原本散落在 `useMusicDrawers.ts` 中的全局隐式单例提升为受 Pinia 管控的一等公民 Store：
- 集中管理艺人抽屉（`ArtistDrawer`）、专辑抽屉（`AlbumDrawer`）、播放列表抽屉（`PlaylistDrawer`）与嵌套动作面板的激活堆栈与回退路由。

---

### 2.4 上帝组件与巨型视图解耦标准

重构期间遵循的组件瘦身与解耦四大原则：

1. **Scoped CSS 同级独立外置**：
   - 当组件 `<style scoped>` 超过 150 行时，抽取至同目录的 `<ComponentName>.css` 文件中。
   - 在 SFC 中通过 `<style scoped> @import "./<ComponentName>.css"; </style>` 引入。
   - **严格遵守 PostCSS 规范**：`@import` 必须置于 `<style>` 块的最顶部。
   - **契约保留**：若契约测试（如 `ui-guidelines.spec.ts`、`overlay-layer-contract.spec.ts`）通过正则直接读取 SFC 文件，则必须在 SFC 的 `<style scoped>` 中精确保留对应的契约规则（例如关键 `z-index`、布局基准属性等）。
2. **提炼专用纯净子组件**：
   - 如从 `BlogHomePage` 中抽离出 `BlogHomeRail.vue`（侧边栏轨道）与 `BlogHomeDigestSection.vue`（动态文摘流）。
   - 从 `SubscriptionManageSheet` 中抽离出 `SubscriptionSourcePanel`、`SubscriptionKeywordsPanel`、`SubscriptionGroupPanel`。
3. **提取领域专用 Composables**：
   - 复杂视图的数据加载、偏好配置、命令解析逻辑抽离为纯函数 Composable（如 `useBlogHomeDigest`、`useBlogHomePreferences`、`pEditorCommands` 等）。
4. **单文件规模安全阈值**：
   - 目标：所有页面与组件单文件代码行数控制在 **800 行以内**（优选 400 ~ 600 行）。

---

## 3. 重构前后核心指标对比

| 指标项 | 重构前状态 | 演进达成状态 | 提升与改善 |
|---|---|---|---|
| **千行以上巨石组件数** | 22 个 | **0 个 (已全部清零)** | 结构可维护性大幅飞跃 |
| **单组件代码行数峰值** | 2,170 行 (`SubscriptionManageSheet`) | **859 行 (`PEditorRuntime`)** | 峰值代码量下降 **60.4%** |
| **平均视图代码缩减率** | - | **40% ~ 75%** | 业务与展现彻底解耦 |
| **全量类型文件规模** | 1,539 行单体 | **12 个纯净领域子模块** | 领域边界清晰隔离 |
| **Vue-TSC 严格模式类型报错** | - | **0 errors** | 严格模式 100% 绿色通过 |
| **Vitest 自动化单元测试** | 592 个测试文件 | **592/592 全部通过 (4,116/4,116 100% Green)** | 零功能断裂、零行为回退 |
| **Vite 生产环境打包耗时** | - | **14.12s 成功构建 (4,170 个模块)** | 产物规范打包成功 |
| **移动端专用打包耗时** | - | **10.17s 成功构建 (4,081 个模块)** | 双端独立构建无损 |
| **Playwright 端到端冒烟测试** | - | **4/4 冒烟测试全部通过 (6.0s)** | 真实浏览器环境渲染正常 |

---

## 4. 后续开发与扩展指导

后续新增页面、组件或状态模块时，请严格遵守以下开发规约：
1. **新建组件**：严禁在单个 `.vue` 文件中堆积超过 800 行代码；若逻辑复杂，优先在组件同级建立 `composables/` 或提取子组件。
2. **样式管理**：优先使用项目全局 Tailwind 原子类；若有必须的 Scoped CSS 且体量较大，按规范剥离为同级 `.css` 并置顶 `@import`。
3. **新增 API 与类型**：遵循 `src/types/<domain>.ts` 与 `src/api/<domain>/` 目录规范，并在对应的 Barrel 中统一暴露，禁止直接在根目录随意追加平铺文件。
4. **提交前自动化验证命令**：
   ```bash
   bun run type-check       # 严格模式 TypeScript 检查
   bun run test:unit        # 全量单元与契约测试
   bun run build            # 生产环境打包测试
   bun run build:mobile     # 移动端专用打包测试
   bun run test:e2e:smoke   # Playwright 冒烟测试
   ```
