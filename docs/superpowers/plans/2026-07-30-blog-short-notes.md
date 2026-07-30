# 博客短话 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付独立的公开短话系统，支持 500 字正文、至多 9 张图片、点赞、评论、作者编辑与删除。

**Architecture:** 后端新增 `shortnote` 模块和独立数据表；通用评论注册表增加 `short_note` 目标解析器，点赞继续使用现有 `likes` 表。前端新增短话发布、时间线、详情页面和可复用卡片，沿用现有图片上传、认证、评论与互动组件。

**Tech Stack:** Go、Gin、GORM、PostgreSQL、Vue 3、TypeScript、Pinia、Vue Router、Vitest。

---

## 文件结构

- Backend create: `internal/model/short_note.go`，短话和图片模型。
- Backend create: `internal/modules/shortnote/{dto.go,http.go,service.go,http_test.go}`，短话 HTTP 契约与业务逻辑。
- Backend modify: `internal/migrationrunner/runner.go`、`internal/app/router.go`、`internal/modules/comment/{target.go,target_resolvers.go,target_test.go}`，注册模型、路由和评论目标。
- Frontend create: `src/components/shortnote/{ShortNoteCard.vue,ShortNoteComposer.vue}`，展示与编辑边界。
- Frontend create: `src/views/blog/{ShortNoteTimelineView.vue,ShortNoteComposerView.vue,ShortNoteDetailView.vue}`，列表、发布编辑、详情。
- Frontend modify: `src/{types.ts,composables/useApi.ts,composables/useInteractions.ts,router/routes/modules.ts,components/system/AppSidebar.vue}`，API、类型、互动和路由接入。
- Frontend modify: `src/api/comments.ts`，将短话注册为通用评论组件可接受的目标类型。
- Tests create: 后端模块测试及前端短话组件/页面测试。

### Task 1: 后端模型与迁移注册

**Files:**
- Create: `Atoman-Backend/internal/model/short_note.go`
- Modify: `Atoman-Backend/internal/migrationrunner/runner.go`
- Modify: `Atoman-Backend/internal/migrationrunner/runner_test.go`

- [ ] **Step 1: 写失败的迁移测试**

```go
func TestRunCreatesShortNoteSchema(t *testing.T) {
    db := testdb.Open(t)
    require.NoError(t, Run(db))
    require.True(t, db.Migrator().HasTable(&model.ShortNote{}))
    require.True(t, db.Migrator().HasTable(&model.ShortNoteMedia{}))
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `go test ./internal/migrationrunner -run TestRunCreatesShortNoteSchema -count=1`

Expected: FAIL，因为 `ShortNote` 与 `ShortNoteMedia` 尚未定义。

- [ ] **Step 3: 定义模型并注册到 schema**

```go
type ShortNote struct {
    Base
    UserID  uuid.UUID        `gorm:"type:uuid;not null;index"`
    User    *User            `gorm:"foreignKey:UserID;references:UUID"`
    Content string            `gorm:"type:text;not null"`
    Media   []ShortNoteMedia `gorm:"foreignKey:ShortNoteID"`
}

func (ShortNote) TableName() string { return "short_notes" }

type ShortNoteMedia struct {
    Base
    ShortNoteID uuid.UUID `gorm:"type:uuid;not null;index"`
    URL         string    `gorm:"type:text;not null"`
    Position    int       `gorm:"not null"`
}

func (ShortNoteMedia) TableName() string { return "short_note_media" }
```

将两个模型追加到 `MigrateSchema` 的 `models` 列表，并把测试模型追加到已有核心 schema 断言。

- [ ] **Step 4: 运行测试确认通过**

Run: `go test ./internal/migrationrunner -run 'TestRunCreates(CoreSchema|ShortNoteSchema)' -count=1`

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git -C Atoman-Backend add internal/model/short_note.go internal/migrationrunner
git -C Atoman-Backend commit -m "feat: add short note schema"
```

### Task 2: 后端短话 CRUD、时间线与点赞

**Files:**
- Create: `Atoman-Backend/internal/modules/shortnote/dto.go`
- Create: `Atoman-Backend/internal/modules/shortnote/service.go`
- Create: `Atoman-Backend/internal/modules/shortnote/http.go`
- Create: `Atoman-Backend/internal/modules/shortnote/http_test.go`
- Modify: `Atoman-Backend/internal/app/router.go`

- [ ] **Step 1: 写失败的 HTTP 行为测试**

```go
func TestShortNotesCreateListUpdateAndDelete(t *testing.T) {
    router, owner, other := newShortNoteRouter(t)
    created := postJSON(t, router, owner, "/api/v1/short-notes", map[string]any{
        "content": "公开短话", "media_urls": []string{"https://cdn.example/1.jpg"},
    })
    require.Equal(t, http.StatusCreated, created.Code)
    require.Equal(t, http.StatusOK, get(router, "/api/v1/short-notes?page=1&page_size=20").Code)
    require.Equal(t, http.StatusForbidden, putJSON(t, router, other, notePath(created), map[string]any{"content": "篡改"}).Code)
    require.Equal(t, http.StatusNoContent, deleteAs(t, router, owner, notePath(created)).Code)
}
```

另加表驱动用例，分别断言空白正文、501 字和 10 个图片 URL 返回 `400`；列表按 `created_at DESC`；`POST /api/v1/short-notes/:id/like` 幂等；详情 DTO 的 `edited` 在更新后为真。

- [ ] **Step 2: 运行测试确认失败**

Run: `go test ./internal/modules/shortnote -run TestShortNotesCreateListUpdateAndDelete -count=1`

Expected: FAIL，因为模块和路由未注册。

- [ ] **Step 3: 实现最小 API 契约**

在 `dto.go` 定义：

```go
type UpsertInput struct {
    Content   string   `json:"content"`
    MediaURLs []string `json:"media_urls"`
}

type NoteDTO struct {
    ID            uuid.UUID `json:"id"`
    UserID        uuid.UUID `json:"user_id"`
    User          *model.User `json:"user,omitempty"`
    Content       string `json:"content"`
    MediaURLs     []string `json:"media_urls"`
    LikesCount    int64 `json:"likes_count"`
    CommentsCount int `json:"comments_count"`
    Liked         bool `json:"liked"`
    Edited        bool `json:"edited"`
    CreatedAt     time.Time `json:"created_at"`
    UpdatedAt     time.Time `json:"updated_at"`
}
```

在 `http.go` 注册：

```go
group.GET("", h.list)
group.POST("", requireAuth, h.create)
group.GET("/:id", h.get)
group.PUT("/:id", requireAuth, h.update)
group.DELETE("/:id", requireAuth, h.delete)
group.POST("/:id/like", requireAuth, h.like)
group.DELETE("/:id/like", requireAuth, h.unlike)
```

`service.go` 以 rune 数量校验 500 字、以 URL 数量校验 9 张；创建、更新与图片行写入同一个事务；更新只更新作者自己的记录；删除使用 GORM soft delete。列表与详情汇总 `likes(target_type = 'short_note')` 和 `DiscussionTarget(kind = 'short_note')`，并预加载 `User` 与按 `position` 排序的图片。

在 `internal/app/router.go` 导入模块并注册：

```go
shortnote.RegisterRoutes(group.Group("/short-notes"), shortnote.NewService(db))
```

- [ ] **Step 4: 运行模块测试确认通过**

Run: `go test ./internal/modules/shortnote -count=1`

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git -C Atoman-Backend add internal/modules/shortnote internal/app/router.go
git -C Atoman-Backend commit -m "feat: add short note API"
```

### Task 3: 复用通用评论目标

**Files:**
- Modify: `Atoman-Backend/internal/modules/comment/target.go`
- Modify: `Atoman-Backend/internal/modules/comment/target_resolvers.go`
- Modify: `Atoman-Backend/internal/modules/comment/target_test.go`

- [ ] **Step 1: 写失败的目标可见性测试**

```go
func TestTargetRegistryResolvesPublicShortNote(t *testing.T) {
    registry, db := newTargetTestRegistry(t)
    owner := createTargetTestUser(t, db, "short-note-owner")
    note := model.ShortNote{UserID: owner.UUID, Content: "公开"}
    require.NoError(t, db.Create(&note).Error)
    resolved, err := registry.Resolve(Viewer{}, TargetRef{Kind: TargetKindShortNote, ResourceID: note.ID})
    require.NoError(t, err)
    require.True(t, resolved.Visible)
    require.Equal(t, &owner.UUID, resolved.OwnerID)
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `go test ./internal/modules/comment -run TestTargetRegistryResolvesPublicShortNote -count=1`

Expected: FAIL，因为 `short_note` 尚未注册。

- [ ] **Step 3: 注册短话解析器**

```go
const TargetKindShortNote = "short_note"

func (r *databaseTargetResolvers) resolveShortNote(_ Viewer, resourceID uuid.UUID) (ResolvedTarget, error) {
    var note model.ShortNote
    if err := r.db.First(&note, "id = ?", resourceID).Error; err != nil {
        return ResolvedTarget{}, targetLookupError(TargetKindShortNote, resourceID, err)
    }
    return ownedTarget(TargetKindShortNote, note.ID, note.UserID, true, 0, markLabelPinned), nil
}
```

将 `TargetKindShortNote` 加入 `NewTargetRegistry` 与“全部支持类型”测试，同时让测试迁移 `model.ShortNote`。

- [ ] **Step 4: 运行评论模块测试确认通过**

Run: `go test ./internal/modules/comment -run 'TestTargetRegistry(RegistersExactlySupportedKinds|ResolvesPublicShortNote)' -count=1`

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git -C Atoman-Backend add internal/modules/comment
git -C Atoman-Backend commit -m "feat: support short note discussions"
```

### Task 4: 前端 API、类型和路由

**Files:**
- Modify: `Atoman-Frontend/src/types.ts`
- Modify: `Atoman-Frontend/src/composables/useApi.ts`
- Modify: `Atoman-Frontend/src/composables/useInteractions.ts`
- Modify: `Atoman-Frontend/src/api/comments.ts`
- Modify: `Atoman-Frontend/src/router/routes/modules.ts`
- Modify: `Atoman-Frontend/src/components/system/AppSidebar.vue`
- Create: `Atoman-Frontend/tests/unit/router/shortNoteRoutes.spec.ts`

- [ ] **Step 1: 写失败的路由与 API 契约测试**

```ts
it('maps the short-note pages inside the blog module', () => {
  expect(blogPaths).toEqual(expect.arrayContaining(['notes', 'notes/new', 'notes/:id', 'notes/:id/edit']))
})

it('exposes short note API endpoints', () => {
  expect(api.shortNotes).toContain('/short-notes')
  expect(api.shortNote('note-1')).toContain('/short-notes/note-1')
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `bunx vitest run tests/unit/router/shortNoteRoutes.spec.ts`

Expected: FAIL，因为路由和 API 字段尚不存在。

- [ ] **Step 3: 添加前端契约**

在 `types.ts` 增加：

```ts
export interface ShortNote {
  id: string
  user_id: string
  user?: User
  content: string
  media_urls: string[]
  likes_count: number
  comments_count: number
  liked: boolean
  edited: boolean
  created_at: string
  updated_at: string
}
```

在 `useApi.ts` 的 `blog` 段增加 `shortNotes`、`shortNote(id)`、`shortNoteLike(id)`，在 `interactions` 段增加 `shortNoteComments(id): /discussions/short_note/:id/comments`；将 `InteractionTargetType` 扩展为 `'short_note'`，使 `useInteractions('blog', 'short_note', id)` 选择短话点赞与评论端点。将 `src/api/comments.ts` 的 `CommentTargetKind` 扩展为 `'short_note'`，使通用 `CommentSection` 接受 `{ kind: 'short_note', resourceId: noteId }`。

在 blog 子路由中注册：

```ts
{ path: 'notes', component: () => import('@/views/blog/ShortNoteTimelineView.vue') },
{ path: 'notes/new', component: () => import('@/views/blog/ShortNoteComposerView.vue'), meta: { requiresAuth: true } },
{ path: 'notes/:id', component: () => import('@/views/blog/ShortNoteDetailView.vue') },
{ path: 'notes/:id/edit', component: () => import('@/views/blog/ShortNoteComposerView.vue'), meta: { requiresAuth: true } },
```

把现有临时“写短话”入口更新为 `/posts/notes/new`，并添加“短话”到 `/posts/notes`。

- [ ] **Step 4: 运行测试确认通过**

Run: `bunx vitest run tests/unit/router/shortNoteRoutes.spec.ts && bun run type-check`

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git -C Atoman-Frontend add src/types.ts src/composables/useApi.ts src/composables/useInteractions.ts src/api/comments.ts src/router/routes/modules.ts src/components/system/AppSidebar.vue tests/unit/router/shortNoteRoutes.spec.ts
git -C Atoman-Frontend commit -m "feat: add short note frontend contracts"
```

### Task 5: 发布编辑器和图片九宫格

**Files:**
- Create: `Atoman-Frontend/src/components/shortnote/ShortNoteComposer.vue`
- Create: `Atoman-Frontend/src/views/blog/ShortNoteComposerView.vue`
- Create: `Atoman-Frontend/tests/unit/components/shortnote/ShortNoteComposer.spec.ts`

- [ ] **Step 1: 写失败的组件测试**

```ts
it('blocks a tenth image and a body longer than 500 characters', async () => {
  const wrapper = mount(ShortNoteComposer, { props: { initialContent: '', initialMediaUrls: [], submitting: false } })
  await wrapper.find('textarea').setValue('字'.repeat(501))
  expect(wrapper.get('[data-testid="publish-short-note"]').attributes('disabled')).toBeDefined()
  await wrapper.vm.addMediaUrls(Array.from({ length: 10 }, (_, i) => `https://cdn/${i}.jpg`))
  expect(wrapper.emitted('validation-error')?.[0]).toEqual(['最多可添加 9 张图片'])
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `bunx vitest run tests/unit/components/shortnote/ShortNoteComposer.spec.ts`

Expected: FAIL，因为组件不存在。

- [ ] **Step 3: 实现发布与编辑表单**

```vue
<PTextarea v-model="content" :maxlength="500" placeholder="分享此刻" />
<input type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple @change="uploadFiles" />
<PButton data-testid="publish-short-note" :disabled="!canSubmit" :loading="submitting" @click="emitSubmit">发布</PButton>
```

组件维护 `content` 和有序 `mediaUrls`，上传每个文件到 `api.blog.uploadImage`，在新增前截断并报告超过 9 张的输入；编辑页按 route `id` 加载短话，非作者显示无权限；创建 `POST`、更新 `PUT`，成功后跳转 `/posts/notes/:id`。上传错误只移除失败项，保留其他图片和文本。

- [ ] **Step 4: 运行测试确认通过**

Run: `bunx vitest run tests/unit/components/shortnote/ShortNoteComposer.spec.ts`

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git -C Atoman-Frontend add src/components/shortnote/ShortNoteComposer.vue src/views/blog/ShortNoteComposerView.vue tests/unit/components/shortnote/ShortNoteComposer.spec.ts
git -C Atoman-Frontend commit -m "feat: add short note composer"
```

### Task 6: 公开时间线、详情和互动

**Files:**
- Create: `Atoman-Frontend/src/components/shortnote/ShortNoteCard.vue`
- Create: `Atoman-Frontend/src/views/blog/ShortNoteTimelineView.vue`
- Create: `Atoman-Frontend/src/views/blog/ShortNoteDetailView.vue`
- Create: `Atoman-Frontend/tests/unit/views/blog/ShortNoteTimelineView.spec.ts`
- Create: `Atoman-Frontend/tests/unit/components/shortnote/ShortNoteCard.spec.ts`

- [ ] **Step 1: 写失败的展示与分页测试**

```ts
it('renders edited state and requests the next page', async () => {
  server.use(http.get('/api/v1/short-notes', ({ request }) => {
    expect(new URL(request.url).searchParams.get('page')).toBe('2')
    return HttpResponse.json({ data: { items: [editedNote], page: 2, has_more: false } })
  }))
  await wrapper.get('[data-testid="load-more-short-notes"]').trigger('click')
  expect(wrapper.text()).toContain('已编辑')
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `bunx vitest run tests/unit/views/blog/ShortNoteTimelineView.spec.ts tests/unit/components/shortnote/ShortNoteCard.spec.ts`

Expected: FAIL，因为卡片和页面不存在。

- [ ] **Step 3: 实现卡片、时间线和详情**

`ShortNoteCard` 以 CSS grid 显示最多九张图片，显示作者、相对发布时间、`edited` 标记、点赞和评论计数。作者可见编辑和删除命令；删除确认后调用 `DELETE api.blog.shortNote(id)` 并触发 `deleted(id)`。

`ShortNoteTimelineView` 初次请求 `GET api.blog.shortNotes?page=1&page_size=20`，加载更多时追加新页；点击卡片进入详情。`ShortNoteDetailView` 获取单项，在卡片下渲染通用 `CommentSection`，目标为 `short_note`，并通过 `useInteractions('blog', 'short_note', noteId)` 完成点赞、取消点赞和评论计数同步。

- [ ] **Step 4: 运行测试确认通过**

Run: `bunx vitest run tests/unit/views/blog/ShortNoteTimelineView.spec.ts tests/unit/components/shortnote/ShortNoteCard.spec.ts && bun run type-check`

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git -C Atoman-Frontend add src/components/shortnote src/views/blog/ShortNoteTimelineView.vue src/views/blog/ShortNoteDetailView.vue tests/unit/views/blog/ShortNoteTimelineView.spec.ts
git -C Atoman-Frontend commit -m "feat: add short note timeline"
```

### Task 7: 全量验证

**Files:**
- Modify: 仅因验证失败而需要修复的文件。

- [ ] **Step 1: 运行后端验证**

Run: `cd Atoman-Backend && go test ./internal/modules/shortnote ./internal/modules/comment ./internal/migrationrunner && go build ./...`

Expected: PASS。

- [ ] **Step 2: 运行前端验证**

Run: `cd Atoman-Frontend && bun run type-check && bunx vitest run tests/unit/router/shortNoteRoutes.spec.ts tests/unit/components/shortnote/ShortNoteComposer.spec.ts tests/unit/components/shortnote/ShortNoteCard.spec.ts tests/unit/views/blog/ShortNoteTimelineView.spec.ts`

Expected: PASS。

- [ ] **Step 3: 手工验证主流程**

Run: `cd Atoman-Frontend && bun run dev`

Expected: 登录用户可从“写短话”发布 500 字内、9 图内的内容；公开时间线可见，点赞评论成功；编辑显示“已编辑”，删除后不再出现。

## 自检

- 规格的公开时间线、500 字、9 张图、点赞、评论、编辑标记、删除、路由和权限均有对应任务。
- 所有接口、类型和目标标识统一使用 `short_note`；前端路径统一使用 `/posts/notes`。
- 计划没有占位项；Task 7 的验证修复仅在测试暴露缺陷时执行。
