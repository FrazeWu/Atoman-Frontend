# First Login Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为首次登录用户增加一个账号级、只出现一次、可跳过的模块引导，并引导用户在 Feed 中完成一次真实订阅。

**Architecture:** 后端在 `User` 上增加 `onboarding_completed_at`，并通过登录/会话响应下发给前端；前端基于现有登录态与 Feed 订阅能力新增一个轻量 onboarding store 和覆盖层组件，在登录后或恢复会话后按账号状态决定是否展示。完成订阅或点击跳过时，前端调用一个最小写回接口把账号状态标记为已完成，并立即关闭引导。

**Tech Stack:** Vue 3.5、Pinia、Vue Router 4、TypeScript、Go、Gin、GORM、Vitest、Go test

---

## 文件结构

### 后端

- Modify: `server/internal/model/user.go`
  负责给 `User` 增加 `onboarding_completed_at`
- Modify: `server/internal/handlers/auth_handler.go`
  负责在登录、注册、会话响应中返回 onboarding 完成态
- Modify: `server/internal/handlers/swagger_types.go`
  负责同步认证响应结构
- Modify: `server/cmd/migrate/main.go`
  负责把 `User` 纳入 `AutoMigrate`
- Modify: `server/cmd/start_server/main.go`
  负责启动时同步迁移 `User`
- Create: `server/internal/handlers/onboarding_handler.go`
  负责提供“标记首次引导完成”的最小接口
- Create: `server/internal/handlers/onboarding_handler_test.go`
  负责该接口和认证响应的后端测试

### 前端

- Modify: `web/src/types.ts`
  负责给 `User` 类型增加 onboarding 完成态
- Modify: `web/src/stores/auth.ts`
  负责持久化带 onboarding 状态的用户对象
- Create: `web/src/stores/onboarding.ts`
  负责管理当前步骤、展示/关闭状态、完成写回
- Create: `web/src/components/onboarding/FirstLoginOnboarding.vue`
  负责渲染逐步卡片、跳过按钮、模块介绍与真实高亮
- Modify: `web/src/components/AppTopbar.vue`
  负责给模块入口暴露可高亮锚点
- Modify: `web/src/views/feed/FeedView.vue`
  负责给 `+ 订阅` 和订阅抽屉暴露引导锚点，并在成功订阅后通知 onboarding store
- Modify: `web/src/App.vue`
  负责挂载全局 onboarding 覆盖层
- Modify: `web/src/router/guards.ts`
  负责在会话恢复后触发 onboarding 初始化判断
- Modify: `web/src/composables/useApi.ts`
  负责补 onboarding 完成接口地址
- Create: `web/tests/unit/stores/onboarding.spec.ts`
  负责 onboarding store 单测
- Modify: `web/tests/unit/router/router.guard.spec.ts`
  负责覆盖登录态恢复后的初始化行为

### 契约

- Modify: `docs/api-v1.md`
  负责同步新增认证响应字段与 onboarding 完成接口

## 任务拆分

### Task 1: 后端补齐账号级完成态字段

**Files:**
- Modify: `server/internal/model/user.go`
- Modify: `server/cmd/migrate/main.go`
- Modify: `server/cmd/start_server/main.go`

- [ ] **Step 1: 先写会失败的模型迁移测试**

```go
func TestUserModelHasOnboardingCompletedAt(t *testing.T) {
	var user model.User
	field, ok := reflect.TypeOf(user).FieldByName("OnboardingCompletedAt")
	if !ok {
		t.Fatal("expected OnboardingCompletedAt field")
	}
	if field.Type.String() != "*time.Time" {
		t.Fatalf("expected *time.Time, got %s", field.Type.String())
	}
}
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /Users/fafa/Downloads/projects/Atoman/server && go test ./internal/handlers ./internal/model -run TestUserModelHasOnboardingCompletedAt -v`

Expected: FAIL，提示 `OnboardingCompletedAt` 不存在

- [ ] **Step 3: 最小实现字段与迁移接入**

`server/internal/model/user.go`

```go
type User struct {
	UUID                   uuid.UUID      `json:"uuid" gorm:"type:uuid;primaryKey"`
	ID                     uint           `json:"id" gorm:"unique;autoIncrement"`
	Username               string         `json:"username" gorm:"unique;not null;column:username"`
	Email                  string         `json:"email" gorm:"unique;not null;column:email"`
	Password               string         `json:"-" gorm:"not null;column:password"`
	Role                   string         `json:"role" gorm:"default:'user';column:role"`
	DisplayName            string         `json:"display_name" gorm:"column:display_name"`
	AvatarURL              string         `json:"avatar_url" gorm:"column:avatar_url"`
	Bio                    string         `json:"bio" gorm:"type:text;column:bio"`
	Website                string         `json:"website" gorm:"column:website"`
	Location               string         `json:"location" gorm:"column:location"`
	IsActive               bool           `json:"is_active" gorm:"default:true;column:is_active"`
	OnboardingCompletedAt  *time.Time     `json:"onboarding_completed_at" gorm:"column:onboarding_completed_at"`
	CreatedAt              time.Time      `json:"created_at" gorm:"column:created_at"`
	UpdatedAt              time.Time      `json:"updated_at" gorm:"column:updated_at"`
	DeletedAt              gorm.DeletedAt `json:"-" gorm:"index"`
}
```

`server/cmd/migrate/main.go`

```go
if err := db.AutoMigrate(
	&model.User{},
	&model.UserSettings{},
	&model.Channel{},
	// 其余保持原顺序
); err != nil {
	log.Fatalf("run migrations: %v", err)
}
```

`server/cmd/start_server/main.go`

```go
if err := db.AutoMigrate(
	&model.User{},
	&model.UserSettings{},
	&model.Channel{},
	// 其余保持原顺序
); err != nil {
	log.Fatalf("auto migrate: %v", err)
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd /Users/fafa/Downloads/projects/Atoman/server && go test ./internal/model -run TestUserModelHasOnboardingCompletedAt -v`

Expected: PASS

- [ ] **Step 5: 提交**

```bash
cd /Users/fafa/Downloads/projects/Atoman
git add server/internal/model/user.go server/cmd/migrate/main.go server/cmd/start_server/main.go
git commit -m "feat: add onboarding completion field to user"
```

### Task 2: 认证响应返回 onboarding 完成态

**Files:**
- Modify: `server/internal/handlers/auth_handler.go`
- Modify: `server/internal/handlers/swagger_types.go`
- Create: `server/internal/handlers/onboarding_handler_test.go`

- [ ] **Step 1: 先写认证响应测试**

```go
func TestUserAuthResponseIncludesOnboardingCompletedAt(t *testing.T) {
	now := time.Now().UTC().Truncate(time.Second)
	user := model.User{
		Username:              "alice",
		Email:                 "alice@example.com",
		OnboardingCompletedAt: &now,
	}

	payload := userAuthResponse(user, "token")
	userPayload := payload["user"].(gin.H)

	if userPayload["onboarding_completed_at"] != now {
		t.Fatalf("expected onboarding_completed_at in auth response")
	}
}
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /Users/fafa/Downloads/projects/Atoman/server && go test ./internal/handlers -run TestUserAuthResponseIncludesOnboardingCompletedAt -v`

Expected: FAIL，返回里没有该字段

- [ ] **Step 3: 最小实现认证响应字段**

`server/internal/handlers/auth_handler.go`

```go
func userAuthResponse(user model.User, tokenString string) gin.H {
	return gin.H{
		"token": tokenString,
		"user": gin.H{
			"uuid":                     user.UUID,
			"id":                       user.ID,
			"username":                 user.Username,
			"email":                    user.Email,
			"role":                     user.Role,
			"display_name":             user.DisplayName,
			"avatar_url":               user.AvatarURL,
			"is_active":                user.IsActive,
			"onboarding_completed_at":  user.OnboardingCompletedAt,
		},
	}
}
```

`server/internal/handlers/swagger_types.go`

```go
type AuthUserResponse struct {
	UUID                   string `json:"uuid" format:"uuid" example:"018f6f6d-b0de-7b8f-bf91-43bc0b8f4c8a"`
	ID                     uint   `json:"id" example:"1"`
	Username               string `json:"username" example:"fafa"`
	Email                  string `json:"email" example:"fafa@example.com"`
	Role                   string `json:"role" example:"user"`
	DisplayName            string `json:"display_name" example:"Fafa"`
	AvatarURL              string `json:"avatar_url" example:"https://cdn.example.com/avatar.png"`
	IsActive               bool   `json:"is_active" example:"true"`
	OnboardingCompletedAt  string `json:"onboarding_completed_at,omitempty" format:"date-time" example:"2026-06-02T08:00:00Z"`
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd /Users/fafa/Downloads/projects/Atoman/server && go test ./internal/handlers -run TestUserAuthResponseIncludesOnboardingCompletedAt -v`

Expected: PASS

- [ ] **Step 5: 提交**

```bash
cd /Users/fafa/Downloads/projects/Atoman
git add server/internal/handlers/auth_handler.go server/internal/handlers/swagger_types.go server/internal/handlers/onboarding_handler_test.go
git commit -m "feat: expose onboarding status in auth responses"
```

### Task 3: 新增完成 onboarding 的最小后端接口

**Files:**
- Create: `server/internal/handlers/onboarding_handler.go`
- Create: `server/internal/handlers/onboarding_handler_test.go`

- [ ] **Step 1: 先写接口失败测试**

```go
func TestCompleteOnboardingMarksCurrentUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := newAuthTestDB(t)
	user := createAuthTestUser(t, db, "tour-user")

	r := gin.New()
	api := r.Group("/api")
	api.Use(func(c *gin.Context) {
		c.Set("user_id", user.UUID.String())
		c.Next()
	})
	api.POST("/auth/onboarding/complete", CompleteOnboardingHandler(db))

	req := httptest.NewRequest(http.MethodPost, "/api/auth/onboarding/complete", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var reloaded model.User
	if err := db.First(&reloaded, "uuid = ?", user.UUID).Error; err != nil {
		t.Fatalf("reload user: %v", err)
	}
	if reloaded.OnboardingCompletedAt == nil {
		t.Fatal("expected onboarding_completed_at to be set")
	}
}
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /Users/fafa/Downloads/projects/Atoman/server && go test ./internal/handlers -run TestCompleteOnboardingMarksCurrentUser -v`

Expected: FAIL，`CompleteOnboardingHandler` 未定义

- [ ] **Step 3: 最小实现接口**

`server/internal/handlers/onboarding_handler.go`

```go
package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"atoman/internal/platform/authctx"
)

func CompleteOnboardingHandler(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		currentUser, ok := authctx.Current(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
			return
		}

		now := time.Now().UTC()
		if err := db.Table("Users").
			Where("uuid = ?", currentUser.ID).
			Update("onboarding_completed_at", now).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to complete onboarding"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "ok",
			"data": gin.H{
				"onboarding_completed_at": now,
			},
		})
	}
}
```

在 `SetupAuthRoutes` 中注册：

```go
protected := auth.Group("/")
protected.Use(AuthMiddleware())
{
	protected.POST("/onboarding/complete", CompleteOnboardingHandler(db))
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd /Users/fafa/Downloads/projects/Atoman/server && go test ./internal/handlers -run TestCompleteOnboardingMarksCurrentUser -v`

Expected: PASS

- [ ] **Step 5: 提交**

```bash
cd /Users/fafa/Downloads/projects/Atoman
git add server/internal/handlers/auth_handler.go server/internal/handlers/onboarding_handler.go server/internal/handlers/onboarding_handler_test.go
git commit -m "feat: add onboarding completion endpoint"
```

### Task 4: 前端登录态接入 onboarding 完成态

**Files:**
- Modify: `web/src/types.ts`
- Modify: `web/src/stores/auth.ts`

- [ ] **Step 1: 先写用户类型与持久化测试**

```ts
it('keeps onboarding completion timestamp in stored user', async () => {
  const { useAuthStore } = await import('@/stores/auth')
  const store = useAuthStore()
  const now = '2026-06-02T08:00:00Z'

  localStorage.setItem('token', 'header.payload.signature')
  localStorage.setItem('user', JSON.stringify({
    username: 'alice',
    email: 'alice@example.com',
    onboarding_completed_at: now,
  }))

  const restored = useAuthStore()
  expect(restored.user?.onboarding_completed_at).toBe(now)
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /Users/fafa/Downloads/projects/Atoman/web && bun run vitest web/tests/unit/stores/auth.spec.ts -t "keeps onboarding completion timestamp in stored user"`

Expected: FAIL，类型或持久化断言不成立

- [ ] **Step 3: 最小实现类型**

`web/src/types.ts`

```ts
export interface User {
  id?: number
  uuid?: string
  username: string
  email: string
  role?: 'user' | 'admin' | 'owner'
  display_name?: string
  avatar_url?: string
  bio?: string
  website?: string
  location?: string
  is_active?: boolean
  onboarding_completed_at?: string | null
  created_at?: string
  updated_at?: string
}
```

`web/src/stores/auth.ts`

```ts
function loadStoredUser(): User | null {
  const rawUser = localStorage.getItem('user')
  if (!rawUser) return null

  try {
    return JSON.parse(rawUser) as User
  } catch {
    localStorage.removeItem('user')
    return null
  }
}
```

这里主要保持现有逻辑不变，只让新字段通过类型和存储流转。

- [ ] **Step 4: 跑测试确认通过**

Run: `cd /Users/fafa/Downloads/projects/Atoman/web && bun run vitest web/tests/unit/stores/auth.spec.ts -t "keeps onboarding completion timestamp in stored user"`

Expected: PASS

- [ ] **Step 5: 提交**

```bash
cd /Users/fafa/Downloads/projects/Atoman
git add web/src/types.ts web/src/stores/auth.ts web/tests/unit/stores/auth.spec.ts
git commit -m "feat: persist onboarding status in auth store"
```

### Task 5: 新增前端 onboarding store

**Files:**
- Create: `web/src/stores/onboarding.ts`
- Create: `web/tests/unit/stores/onboarding.spec.ts`
- Modify: `web/src/composables/useApi.ts`

- [ ] **Step 1: 先写 store 失败测试**

```ts
it('opens onboarding for authenticated user without completion timestamp', async () => {
  const { useOnboardingStore } = await import('@/stores/onboarding')
  const { useAuthStore } = await import('@/stores/auth')
  const auth = useAuthStore()
  auth.isAuthenticated = true
  auth.user = {
    username: 'alice',
    email: 'alice@example.com',
    onboarding_completed_at: null,
  } as never

  const store = useOnboardingStore()
  store.initialize()

  expect(store.visible).toBe(true)
  expect(store.step).toBe('overview')
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /Users/fafa/Downloads/projects/Atoman/web && bun run vitest web/tests/unit/stores/onboarding.spec.ts -t "opens onboarding for authenticated user without completion timestamp"`

Expected: FAIL，`useOnboardingStore` 不存在

- [ ] **Step 3: 最小实现 store**

`web/src/composables/useApi.ts`

```ts
auth: {
  login: `${apiUrl}/auth/login`,
  register: `${apiUrl}/auth/register`,
  session: `${apiUrl}/auth/session`,
  logout: `${apiUrl}/auth/logout`,
  sendVerification: `${apiUrl}/auth/send-verification`,
  completeOnboarding: `${apiUrl}/auth/onboarding/complete`,
}
```

`web/src/stores/onboarding.ts`

```ts
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useApi } from '@/composables/useApi'

export type OnboardingStep = 'overview' | 'modules' | 'feed-entry' | 'feed-subscribe'

export const useOnboardingStore = defineStore('onboarding', () => {
  const authStore = useAuthStore()
  const api = useApi()

  const visible = ref(false)
  const step = ref<OnboardingStep>('overview')
  const completing = ref(false)

  const shouldShow = computed(() =>
    !!authStore.isAuthenticated &&
    !!authStore.user &&
    !authStore.user.onboarding_completed_at,
  )

  const initialize = () => {
    if (!shouldShow.value) return
    visible.value = true
    step.value = 'overview'
  }

  const next = () => {
    if (step.value === 'overview') step.value = 'modules'
    else if (step.value === 'modules') step.value = 'feed-entry'
    else if (step.value === 'feed-entry') step.value = 'feed-subscribe'
  }

  const complete = async () => {
    if (!authStore.token) return
    completing.value = true
    const response = await fetch(api.auth.completeOnboarding, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authStore.token}` },
    })
    if (!response.ok) throw new Error('完成引导失败')
    const now = new Date().toISOString()
    authStore.user = {
      ...authStore.user!,
      onboarding_completed_at: now,
    }
    localStorage.setItem('user', JSON.stringify(authStore.user))
    visible.value = false
    completing.value = false
  }

  const skip = async () => {
    await complete()
  }

  return { visible, step, completing, initialize, next, complete, skip }
})
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd /Users/fafa/Downloads/projects/Atoman/web && bun run vitest web/tests/unit/stores/onboarding.spec.ts`

Expected: PASS

- [ ] **Step 5: 提交**

```bash
cd /Users/fafa/Downloads/projects/Atoman
git add web/src/composables/useApi.ts web/src/stores/onboarding.ts web/tests/unit/stores/onboarding.spec.ts
git commit -m "feat: add onboarding state store"
```

### Task 6: 挂载 onboarding 覆盖层与模块介绍 UI

**Files:**
- Create: `web/src/components/onboarding/FirstLoginOnboarding.vue`
- Modify: `web/src/App.vue`
- Modify: `web/src/components/AppTopbar.vue`

- [ ] **Step 1: 先写组件渲染测试**

```ts
it('renders module step with skip action', async () => {
  const wrapper = mount(FirstLoginOnboarding, {
    global: { plugins: [createPinia()] },
  })

  const store = useOnboardingStore()
  store.visible = true
  store.step = 'modules'

  expect(wrapper.text()).toContain('Blog')
  expect(wrapper.text()).toContain('Feed')
  expect(wrapper.text()).toContain('跳过')
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /Users/fafa/Downloads/projects/Atoman/web && bun run vitest web/tests/unit/components/FirstLoginOnboarding.spec.ts -t "renders module step with skip action"`

Expected: FAIL，组件不存在

- [ ] **Step 3: 最小实现组件与挂载**

`web/src/components/onboarding/FirstLoginOnboarding.vue`

```vue
<template>
  <div v-if="store.visible" class="onboarding-layer">
    <ASurface class="onboarding-card">
      <p class="a-label">FIRST LOGIN</p>
      <h2 class="a-title-lg">{{ stepTitle }}</h2>
      <p class="a-muted">{{ stepBody }}</p>

      <div v-if="store.step === 'modules'" class="onboarding-modules">
        <div v-for="item in modules" :key="item.key" class="onboarding-module">
          <strong>{{ item.name }}</strong>
          <span>{{ item.description }}</span>
        </div>
      </div>

      <div class="onboarding-actions">
        <PaperPress variant="secondary" label="跳过" @click="store.skip()" />
        <PaperPress :label="primaryLabel" @click="handlePrimary" />
      </div>
    </ASurface>
  </div>
</template>
```

`web/src/App.vue`

```vue
<template>
  <div>
    <AppTopbar />
    <RouterView />
    <FirstLoginOnboarding />
  </div>
</template>
```

`web/src/components/AppTopbar.vue`

```vue
<nav class="app-topbar-nav" data-onboarding-anchor="module-nav">
  <!-- 保持现有模块导航内容 -->
</nav>
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd /Users/fafa/Downloads/projects/Atoman/web && bun run vitest web/tests/unit/components/FirstLoginOnboarding.spec.ts`

Expected: PASS

- [ ] **Step 5: 提交**

```bash
cd /Users/fafa/Downloads/projects/Atoman
git add web/src/components/onboarding/FirstLoginOnboarding.vue web/src/components/AppTopbar.vue web/src/App.vue web/tests/unit/components/FirstLoginOnboarding.spec.ts
git commit -m "feat: add first login onboarding overlay"
```

### Task 7: 把 Feed 真正接入 onboarding 闭环

**Files:**
- Modify: `web/src/views/feed/FeedView.vue`
- Modify: `web/src/stores/onboarding.ts`

- [ ] **Step 1: 先写完成订阅后关闭引导的测试**

```ts
it('completes onboarding after first successful subscription', async () => {
  const store = useOnboardingStore()
  store.visible = true
  store.step = 'feed-subscribe'
  vi.spyOn(store, 'complete').mockResolvedValue()

  await store.handleSubscriptionCreated()

  expect(store.complete).toHaveBeenCalled()
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /Users/fafa/Downloads/projects/Atoman/web && bun run vitest web/tests/unit/stores/onboarding.spec.ts -t "completes onboarding after first successful subscription"`

Expected: FAIL，`handleSubscriptionCreated` 不存在

- [ ] **Step 3: 最小实现 Feed 联动**

`web/src/stores/onboarding.ts`

```ts
const handleSubscriptionCreated = async () => {
  if (step.value !== 'feed-subscribe' || !visible.value) return
  await complete()
}

return {
  visible,
  step,
  completing,
  initialize,
  next,
  complete,
  skip,
  handleSubscriptionCreated,
}
```

`web/src/views/feed/FeedView.vue`

```ts
import { useOnboardingStore } from '@/stores/onboarding'

const onboardingStore = useOnboardingStore()

const addSubscription = async (payload: { rss_url: string; title?: string; group_id?: string }) => {
  // 保持现有订阅逻辑
  const response = await fetch(`${API_URL}/feed/subscriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    // 保持现有错误处理
    return
  }

  await feedStore.fetchSubscriptions()
  await onboardingStore.handleSubscriptionCreated()
}
```

并给真实入口加锚点：

```vue
<div data-onboarding-anchor="feed-add-trigger">
  <PaperPress
    v-if="authStore.isAuthenticated"
    @click="showAddModal = !showAddModal"
    :label="showAddModal ? '取消添加' : '+ 订阅'"
    :variant="showAddModal ? 'secondary' : 'primary'"
  />
</div>
```

`SubscriptionAddSheet` 包裹层补：

```vue
<div data-onboarding-anchor="feed-add-sheet">
  <SubscriptionAddSheet ... />
</div>
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd /Users/fafa/Downloads/projects/Atoman/web && bun run vitest web/tests/unit/stores/onboarding.spec.ts`

Expected: PASS

- [ ] **Step 5: 提交**

```bash
cd /Users/fafa/Downloads/projects/Atoman
git add web/src/views/feed/FeedView.vue web/src/stores/onboarding.ts web/tests/unit/stores/onboarding.spec.ts
git commit -m "feat: complete onboarding after first subscription"
```

### Task 8: 登录后初始化引导与路由联动

**Files:**
- Modify: `web/src/router/guards.ts`
- Modify: `web/tests/unit/router/router.guard.spec.ts`

- [ ] **Step 1: 先写 guard 行为测试**

```ts
it('initializes onboarding after restoring authenticated session', async () => {
  const router = await importRouter('blog')
  const auth = useAuthStore()
  const onboarding = useOnboardingStore()
  vi.spyOn(onboarding, 'initialize')

  auth.token = makeToken(3600)
  auth.user = {
    username: 'alice',
    email: 'alice@example.com',
    onboarding_completed_at: null,
  } as never
  auth.isAuthenticated = true

  await router.push('/')

  expect(onboarding.initialize).toHaveBeenCalled()
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /Users/fafa/Downloads/projects/Atoman/web && bun run vitest web/tests/unit/router/router.guard.spec.ts -t "initializes onboarding after restoring authenticated session"`

Expected: FAIL，guard 还没触发 onboarding 初始化

- [ ] **Step 3: 最小实现 guard 调用**

`web/src/router/guards.ts`

```ts
import { useOnboardingStore } from '@/stores/onboarding'

export function installRouteGuards(router: Router) {
  router.beforeEach(async (to, from) => {
    // 保持现有逻辑
    const authStore = useAuthStore()
    const onboardingStore = useOnboardingStore()
    const hasValidSession = authStore.validateSession() || await authStore.restoreSession()

    if (hasValidSession) {
      onboardingStore.initialize()
    }

    // 保持其余判断不变
  })
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd /Users/fafa/Downloads/projects/Atoman/web && bun run vitest web/tests/unit/router/router.guard.spec.ts`

Expected: PASS

- [ ] **Step 5: 提交**

```bash
cd /Users/fafa/Downloads/projects/Atoman
git add web/src/router/guards.ts web/tests/unit/router/router.guard.spec.ts
git commit -m "feat: initialize onboarding from auth guard"
```

### Task 9: 更新 API 契约并做整体验证

**Files:**
- Modify: `docs/api-v1.md`

- [ ] **Step 1: 补文档测试清单**

在计划执行前，先把需要同步的契约列出来：

```text
GET /api/auth/session 响应 user 新增 onboarding_completed_at
POST /api/auth/login 响应 user 新增 onboarding_completed_at
POST /api/auth/register 响应 user 新增 onboarding_completed_at
POST /api/auth/onboarding/complete 新增
```

- [ ] **Step 2: 更新 API 契约**

在 `docs/api-v1.md` 增加：

```md
### POST /api/auth/onboarding/complete

Permission: `user` and above.

Response:

```json
{
  "data": {
    "onboarding_completed_at": "2026-06-02T08:00:00Z"
  }
}
```
```

并同步登录/会话返回用户结构中的：

```json
"onboarding_completed_at": "2026-06-02T08:00:00Z"
```

- [ ] **Step 3: 跑后端验证**

Run: `cd /Users/fafa/Downloads/projects/Atoman/server && go test ./...`

Expected: PASS

- [ ] **Step 4: 跑前端验证**

Run: `cd /Users/fafa/Downloads/projects/Atoman/web && bun run type-check && bun run lint && bun run vitest`

Expected: PASS

- [ ] **Step 5: 提交**

```bash
cd /Users/fafa/Downloads/projects/Atoman
git add -f docs/superpowers/specs/2026-06-01-first-login-onboarding-design.md docs/superpowers/plans/2026-06-02-first-login-onboarding-implementation.md docs/api-v1.md
git add server web
git commit -m "feat: add first login onboarding flow"
```

## 自检

### Spec 覆盖

- 账号级只出现一次：Task 1、Task 2、Task 3、Task 4、Task 8
- 任意一步可跳过：Task 5、Task 6
- 模块介绍：Task 6
- 引导完成一次真实订阅：Task 7
- API/契约同步：Task 2、Task 9

没有遗漏的主需求。

### 占位符检查

- 没有 `TBD`、`TODO`、`implement later`
- 每个任务都有明确文件路径、命令、预期结果
- 文档同步点已明确写出

### 一致性检查

- 后端字段统一使用 `onboarding_completed_at`
- 前端类型和 store 也统一使用 `onboarding_completed_at`
- 完成接口统一使用 `POST /api/auth/onboarding/complete`

