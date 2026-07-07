# Feed Subscription Rules Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为订阅模块实现后端托管的订阅规则中心，支持规则 CRUD、排序、对新增订阅自动应用，以及对已有订阅整套规则重算。

**Architecture:** 后端在 `subscriptions` 上补齐规则托管字段，并新增 `feed_subscription_rules` 作为规则定义表；规则计算统一放在 backend `subscription` 模块，新增订阅和手动 apply 复用同一套重算逻辑。前端继续以 [SubscriptionManageSheet.vue](/Users/fafa/projects/Atoman/Atoman-Frontend/src/components/feed/SubscriptionManageSheet.vue:1) 为管理入口，新增规则列表、编辑 Sheet、应用操作和结果摘要，并逐步从本地规则切到后端字段。

**Tech Stack:** Go, Gin, GORM, PostgreSQL, Vue 3.5, TypeScript 5.9, Pinia 3, Vitest

---

### Task 1: 后端订阅托管字段与迁移

**Files:**
- Modify: `/Users/fafa/projects/Atoman/Atoman-Backend/internal/model/feed.go`
- Create: `/Users/fafa/projects/Atoman/Atoman-Backend/internal/migrations/20260706_subscription_rule_managed_fields.go`
- Create: `/Users/fafa/projects/Atoman/Atoman-Backend/internal/migrations/20260706_subscription_rule_managed_fields_test.go`
- Test: `/Users/fafa/projects/Atoman/Atoman-Backend/internal/migrations/20260706_subscription_rule_managed_fields_test.go`

- [ ] **Step 1: 先写迁移测试，锁定订阅表新增字段**

```go
package migrations

import (
	"testing"

	"atoman/internal/testdb"
)

func TestSubscriptionRuleManagedFieldsMigrationAddsColumns(t *testing.T) {
	db := testdb.Open(t)

	if err := db.Exec(`
		CREATE TABLE subscriptions (
			id uuid primary key,
			created_at timestamptz,
			updated_at timestamptz,
			deleted_at timestamptz,
			user_id uuid,
			feed_source_id uuid,
			title text,
			subscription_group_id uuid
		)
	`).Error; err != nil {
		t.Fatalf("create subscriptions table: %v", err)
	}

	if err := (&SubscriptionRuleManagedFieldsMigration{}).Up(db); err != nil {
		t.Fatalf("run migration: %v", err)
	}

	assertColumnExists(t, db, "subscriptions", "is_muted")
	assertColumnExists(t, db, "subscriptions", "auto_mark_read")
	assertColumnExists(t, db, "subscriptions", "auto_add_reading_list")
}
```

- [ ] **Step 2: 跑迁移测试，先看到失败**

Run: `cd /Users/fafa/projects/Atoman/Atoman-Backend && go test ./internal/migrations -run TestSubscriptionRuleManagedFieldsMigrationAddsColumns -v`

Expected: FAIL，报 `SubscriptionRuleManagedFieldsMigration` 或新增列断言不存在。

- [ ] **Step 3: 补模型字段与迁移实现**

```go
type Subscription struct {
	Base
	UserID                  uuid.UUID          `json:"user_id" gorm:"type:uuid;not null;index;uniqueIndex:idx_subscriptions_user_source,priority:1,where:deleted_at IS NULL"`
	User                    *User              `json:"user,omitempty" gorm:"foreignKey:UserID;references:UUID"`
	FeedSourceID            uuid.UUID          `json:"feed_source_id" gorm:"type:uuid;not null;index;uniqueIndex:idx_subscriptions_user_source,priority:2,where:deleted_at IS NULL"`
	FeedSource              *FeedSource        `json:"feed_source,omitempty" gorm:"foreignKey:FeedSourceID"`
	Title                   string             `json:"title"`
	SubscriptionGroupID     *uuid.UUID         `json:"subscription_group_id" gorm:"type:uuid;index"`
	SubscriptionGroup       *SubscriptionGroup `json:"subscription,omitempty" gorm:"foreignKey:SubscriptionGroupID"`
	IsMuted                 bool               `json:"is_muted" gorm:"not null;default:false;index"`
	AutoMarkRead            bool               `json:"auto_mark_read" gorm:"not null;default:false;index"`
	AutoAddReadingList      bool               `json:"auto_add_reading_list" gorm:"not null;default:false;index"`
	HealthStatus            string             `json:"health_status" gorm:"default:'healthy'"`
	ErrorMessage            string             `json:"error_message" gorm:"type:text"`
	LastChecked             *time.Time         `json:"last_checked"`
}
```

```go
type SubscriptionRuleManagedFieldsMigration struct{}

func (m *SubscriptionRuleManagedFieldsMigration) Name() string {
	return "20260706_subscription_rule_managed_fields"
}

func (m *SubscriptionRuleManagedFieldsMigration) Up(db *gorm.DB) error {
	statements := []string{
		`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS is_muted boolean NOT NULL DEFAULT false`,
		`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS auto_mark_read boolean NOT NULL DEFAULT false`,
		`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS auto_add_reading_list boolean NOT NULL DEFAULT false`,
		`CREATE INDEX IF NOT EXISTS idx_subscriptions_is_muted ON subscriptions (is_muted)`,
		`CREATE INDEX IF NOT EXISTS idx_subscriptions_auto_mark_read ON subscriptions (auto_mark_read)`,
		`CREATE INDEX IF NOT EXISTS idx_subscriptions_auto_add_reading_list ON subscriptions (auto_add_reading_list)`,
	}
	for _, stmt := range statements {
		if err := db.Exec(stmt).Error; err != nil {
			return err
		}
	}
	return nil
}
```

- [ ] **Step 4: 重跑迁移测试并全量编译 backend**

Run: `cd /Users/fafa/projects/Atoman/Atoman-Backend && go test ./internal/migrations -run TestSubscriptionRuleManagedFieldsMigrationAddsColumns -v && go build ./...`

Expected: 测试 PASS，`go build ./...` 无报错。

- [ ] **Step 5: 提交这一小步**

```bash
cd /Users/fafa/projects/Atoman/Atoman-Backend
git add internal/model/feed.go internal/migrations/20260706_subscription_rule_managed_fields.go internal/migrations/20260706_subscription_rule_managed_fields_test.go
git commit -m "feat: add subscription rule managed fields"
```

### Task 2: 后端规则表、DTO、Repo 与 CRUD

**Files:**
- Modify: `/Users/fafa/projects/Atoman/Atoman-Backend/internal/model/feed.go`
- Create: `/Users/fafa/projects/Atoman/Atoman-Backend/internal/migrations/20260706_feed_subscription_rules.go`
- Modify: `/Users/fafa/projects/Atoman/Atoman-Backend/internal/modules/subscription/dto.go`
- Modify: `/Users/fafa/projects/Atoman/Atoman-Backend/internal/modules/subscription/repo.go`
- Modify: `/Users/fafa/projects/Atoman/Atoman-Backend/internal/modules/subscription/service.go`
- Modify: `/Users/fafa/projects/Atoman/Atoman-Backend/internal/modules/subscription/http.go`
- Modify: `/Users/fafa/projects/Atoman/Atoman-Backend/internal/modules/subscription/http_test.go`
- Modify: `/Users/fafa/projects/Atoman/Atoman-Backend/internal/modules/subscription/service_test.go`
- Test: `/Users/fafa/projects/Atoman/Atoman-Backend/internal/modules/subscription/service_test.go`

- [ ] **Step 1: 先写 service 测试，锁定规则 CRUD 与排序**

```go
func TestSubscriptionRuleCRUDAndReorder(t *testing.T) {
	db := testdb.Open(t)
	testdb.Migrate(t, db,
		&model.User{},
		&model.SubscriptionGroup{},
		&model.FeedSubscriptionRule{},
	)

	service := NewService(db)
	user := createSubscriptionTestUser(t, db)
	currentUser := authctx.CurrentUser{ID: user.UUID, Username: user.Username, Role: authctx.RoleUser}

	first, err := service.CreateSubscriptionRule(currentUser, CreateSubscriptionRuleRequest{
		Name:      "播客整理",
		Enabled:   true,
		MatchType: "source_category",
		Conditions: json.RawMessage(`{"categories":["podcast"]}`),
	})
	if err != nil {
		t.Fatalf("create first rule: %v", err)
	}

	second, err := service.CreateSubscriptionRule(currentUser, CreateSubscriptionRuleRequest{
		Name:      "AI 来源",
		Enabled:   true,
		MatchType: "keywords",
		Conditions: json.RawMessage(`{"keywords":["AI"]}`),
	})
	if err != nil {
		t.Fatalf("create second rule: %v", err)
	}

	if err := service.ReorderSubscriptionRules(currentUser, ReorderSubscriptionRulesRequest{
		RuleIDs: []uuid.UUID{second.ID, first.ID},
	}); err != nil {
		t.Fatalf("reorder rules: %v", err)
	}

	rules, err := service.ListSubscriptionRules(currentUser)
	if err != nil {
		t.Fatalf("list rules: %v", err)
	}
	if len(rules) != 2 || rules[0].ID != second.ID || rules[1].ID != first.ID {
		t.Fatalf("unexpected rule order: %#v", rules)
	}
}
```

- [ ] **Step 2: 跑 service / http 测试，先看到失败**

Run: `cd /Users/fafa/projects/Atoman/Atoman-Backend && go test ./internal/modules/subscription -run "TestSubscriptionRuleCRUDAndReorder|TestSubscriptionRuleHTTPCRUD" -v`

Expected: FAIL，缺少 `FeedSubscriptionRule`、CRUD DTO、路由或 service 方法。

- [ ] **Step 3: 增加规则模型、迁移、DTO、repo 和 CRUD 路由**

```go
type FeedSubscriptionRule struct {
	Base
	UserID                   uuid.UUID       `json:"user_id" gorm:"type:uuid;not null;index"`
	Name                     string          `json:"name" gorm:"not null"`
	Enabled                  bool            `json:"enabled" gorm:"not null;default:true"`
	Position                 int             `json:"position" gorm:"not null;index"`
	MatchType                string          `json:"match_type" gorm:"not null"`
	ConditionsJSON           datatypes.JSON  `json:"conditions_json" gorm:"type:jsonb;not null"`
	ActionGroupID            *uuid.UUID      `json:"action_group_id" gorm:"type:uuid"`
	ActionMuted              *bool           `json:"action_muted"`
	ActionAutoMarkRead       *bool           `json:"action_auto_mark_read"`
	ActionAutoAddReadingList *bool           `json:"action_auto_add_reading_list"`
}
```

```go
type CreateSubscriptionRuleRequest struct {
	Name                     string          `json:"name"`
	Enabled                  bool            `json:"enabled"`
	MatchType                string          `json:"match_type"`
	Conditions               json.RawMessage `json:"conditions_json"`
	ActionGroupID            *uuid.UUID      `json:"action_group_id"`
	ActionMuted              *bool           `json:"action_muted"`
	ActionAutoMarkRead       *bool           `json:"action_auto_mark_read"`
	ActionAutoAddReadingList *bool           `json:"action_auto_add_reading_list"`
}
```

```go
protected.GET("/subscription-rules", h.listSubscriptionRules)
protected.POST("/subscription-rules", h.createSubscriptionRule)
protected.PUT("/subscription-rules/:id", h.updateSubscriptionRule)
protected.DELETE("/subscription-rules/:id", h.deleteSubscriptionRule)
protected.PUT("/subscription-rules/reorder", h.reorderSubscriptionRules)
```

- [ ] **Step 4: 跑模块测试与 backend 编译**

Run: `cd /Users/fafa/projects/Atoman/Atoman-Backend && go test ./internal/modules/subscription -v && go build ./...`

Expected: `subscription` 包测试 PASS，backend 编译通过。

- [ ] **Step 5: 提交这一小步**

```bash
cd /Users/fafa/projects/Atoman/Atoman-Backend
git add internal/model/feed.go internal/migrations/20260706_feed_subscription_rules.go internal/modules/subscription/dto.go internal/modules/subscription/repo.go internal/modules/subscription/service.go internal/modules/subscription/http.go internal/modules/subscription/http_test.go internal/modules/subscription/service_test.go
git commit -m "feat: add subscription rule crud"
```

### Task 3: 后端统一规则重算与新增订阅自动应用

**Files:**
- Modify: `/Users/fafa/projects/Atoman/Atoman-Backend/internal/modules/subscription/service.go`
- Modify: `/Users/fafa/projects/Atoman/Atoman-Backend/internal/modules/subscription/repo.go`
- Modify: `/Users/fafa/projects/Atoman/Atoman-Backend/internal/modules/subscription/dto.go`
- Modify: `/Users/fafa/projects/Atoman/Atoman-Backend/internal/modules/subscription/http.go`
- Modify: `/Users/fafa/projects/Atoman/Atoman-Backend/internal/modules/subscription/service_test.go`
- Modify: `/Users/fafa/projects/Atoman/Atoman-Backend/internal/modules/subscription/http_test.go`
- Test: `/Users/fafa/projects/Atoman/Atoman-Backend/internal/modules/subscription/service_test.go`

- [ ] **Step 1: 先写规则应用测试，锁定“后者覆盖前者”和 apply 摘要**

```go
func TestApplySubscriptionRulesRecomputesManagedFields(t *testing.T) {
	db := testdb.Open(t)
	testdb.Migrate(t, db,
		&model.User{},
		&model.SubscriptionGroup{},
		&model.FeedSource{},
		&model.Subscription{},
		&model.FeedSubscriptionRule{},
	)

	service := NewService(db)
	user := createSubscriptionTestUser(t, db)
	currentUser := authctx.CurrentUser{ID: user.UUID, Username: user.Username, Role: authctx.RoleUser}
	podcastGroup := createSubscriptionGroupRecord(t, db, user.UUID, "播客")
	aiGroup := createSubscriptionGroupRecord(t, db, user.UUID, "AI")
	source := createFeedSourceRecord(t, db, "播客 AI 周报", "podcast")
	subscription := createSubscriptionRecord(t, db, user.UUID, source.ID, "AI 播客")

	_, _ = service.CreateSubscriptionRule(currentUser, CreateSubscriptionRuleRequest{
		Name:      "播客分组",
		Enabled:   true,
		MatchType: "source_category",
		Conditions: json.RawMessage(`{"categories":["podcast"]}`),
		ActionGroupID: &podcastGroup.ID,
	})
	_, _ = service.CreateSubscriptionRule(currentUser, CreateSubscriptionRuleRequest{
		Name:      "AI 覆盖",
		Enabled:   true,
		MatchType: "keywords",
		Conditions: json.RawMessage(`{"keywords":["AI"]}`),
		ActionGroupID: &aiGroup.ID,
		ActionMuted: ptrBool(true),
		ActionAutoMarkRead: ptrBool(true),
	})

	result, err := service.ApplySubscriptionRules(currentUser, ApplySubscriptionRulesRequest{All: true})
	if err != nil {
		t.Fatalf("apply rules: %v", err)
	}
	if result.UpdatedCount != 1 || result.GroupChangedCount != 1 || result.MutedChangedCount != 1 {
		t.Fatalf("unexpected apply summary: %#v", result)
	}

	var reloaded model.Subscription
	if err := db.First(&reloaded, "id = ?", subscription.ID).Error; err != nil {
		t.Fatalf("reload subscription: %v", err)
	}
	if reloaded.SubscriptionGroupID == nil || *reloaded.SubscriptionGroupID != aiGroup.ID || !reloaded.IsMuted || !reloaded.AutoMarkRead {
		t.Fatalf("rule result not applied: %#v", reloaded)
	}
}
```

- [ ] **Step 2: 跑规则应用测试，先看到失败**

Run: `cd /Users/fafa/projects/Atoman/Atoman-Backend && go test ./internal/modules/subscription -run "TestApplySubscriptionRulesRecomputesManagedFields|TestCreateSubscriptionAppliesRulesOnInsert" -v`

Expected: FAIL，缺少 `ApplySubscriptionRules`、摘要 DTO 或新增订阅自动应用逻辑。

- [ ] **Step 3: 实现统一重算逻辑与新增订阅接入**

```go
type ApplySubscriptionRulesResult struct {
	ScannedCount                int `json:"scanned_count"`
	UpdatedCount                int `json:"updated_count"`
	GroupChangedCount           int `json:"group_changed_count"`
	MutedChangedCount           int `json:"muted_changed_count"`
	AutoMarkReadChangedCount    int `json:"auto_mark_read_changed_count"`
	AutoAddReadingListChangedCount int `json:"auto_add_reading_list_changed_count"`
}
```

```go
func (s *Service) ApplySubscriptionRules(user authctx.CurrentUser, req ApplySubscriptionRulesRequest) (ApplySubscriptionRulesResult, error) {
	rules, err := s.repo.ListEnabledSubscriptionRules(user.ID)
	if err != nil {
		return ApplySubscriptionRulesResult{}, err
	}
	targets, err := s.repo.ListRuleApplyTargets(user.ID, req.RuleID, req.All)
	if err != nil {
		return ApplySubscriptionRulesResult{}, err
	}

	result := ApplySubscriptionRulesResult{ScannedCount: len(targets)}
	for _, sub := range targets {
		next := evaluateSubscriptionRuleResult(sub, rules)
		changed, delta, err := s.repo.UpdateSubscriptionRuleManagedFields(user.ID, sub.ID, next)
		if err != nil {
			return ApplySubscriptionRulesResult{}, err
		}
		if changed {
			result.UpdatedCount++
			result.GroupChangedCount += delta.Group
			result.MutedChangedCount += delta.Muted
			result.AutoMarkReadChangedCount += delta.AutoMarkRead
			result.AutoAddReadingListChangedCount += delta.AutoAddReadingList
		}
	}
	return result, nil
}
```

```go
created = model.Subscription{
	UserID:              user.ID,
	FeedSourceID:        source.ID,
	Title:               title,
	SubscriptionGroupID: &group.ID,
}
inserted, err := repo.CreateSubscriptionIfNotExists(&created)
if err != nil {
	return err
}
if !inserted {
	return apperr.Conflict("subscription.already_exists", "Already subscribed to this source")
}
applied, err := s.ApplySubscriptionRules(authctx.CurrentUser{ID: user.ID, Username: user.Username, Role: user.Role}, ApplySubscriptionRulesRequest{
	SubscriptionIDs: []uuid.UUID{created.ID},
})
_ = applied
return err
```

- [ ] **Step 4: 跑规则应用测试、模块测试与 backend 编译**

Run: `cd /Users/fafa/projects/Atoman/Atoman-Backend && go test ./internal/modules/subscription -v && go build ./...`

Expected: `subscription` 包测试 PASS，`go build ./...` PASS。

- [ ] **Step 5: 提交这一小步**

```bash
cd /Users/fafa/projects/Atoman/Atoman-Backend
git add internal/modules/subscription/dto.go internal/modules/subscription/repo.go internal/modules/subscription/service.go internal/modules/subscription/http.go internal/modules/subscription/service_test.go internal/modules/subscription/http_test.go
git commit -m "feat: apply subscription rules on subscriptions"
```

### Task 4: 前端类型、store API 与规则状态接线

**Files:**
- Modify: `/Users/fafa/projects/Atoman/Atoman-Frontend/src/types.ts`
- Modify: `/Users/fafa/projects/Atoman/Atoman-Frontend/src/stores/feed.ts`
- Modify: `/Users/fafa/projects/Atoman/Atoman-Frontend/tests/unit/views/feed/FeedView.spec.ts`
- Create: `/Users/fafa/projects/Atoman/Atoman-Frontend/tests/unit/stores/feed.rules.spec.ts`
- Test: `/Users/fafa/projects/Atoman/Atoman-Frontend/tests/unit/stores/feed.rules.spec.ts`

- [ ] **Step 1: 先写 store 测试，锁定规则列表 / apply API 与订阅托管字段**

```ts
it('fetches subscription rules and stores apply summary', async () => {
  setActivePinia(createPinia())
  const authStore = useAuthStore()
  authStore.token = 'token'
  authStore.isAuthenticated = true

  vi.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(new Response(JSON.stringify({
      data: [{ id: 'rule-1', name: '播客整理', enabled: true, position: 1, match_type: 'source_category', conditions_json: { categories: ['podcast'] } }],
    }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      data: { scanned_count: 12, updated_count: 4, group_changed_count: 2, muted_changed_count: 1, auto_mark_read_changed_count: 1, auto_add_reading_list_changed_count: 0 },
    }), { status: 200 }))

  const store = useFeedStore()
  await store.fetchSubscriptionRules()
  await store.applySubscriptionRules({ all: true })

  expect(store.subscriptionRules).toHaveLength(1)
  expect(store.ruleApplySummary?.updated_count).toBe(4)
})
```

- [ ] **Step 2: 跑前端单测，先看到失败**

Run: `cd /Users/fafa/projects/Atoman/Atoman-Frontend && bun run test:unit -- tests/unit/stores/feed.rules.spec.ts`

Expected: FAIL，缺少 `subscriptionRules`、`applySubscriptionRules` 或新的类型字段。

- [ ] **Step 3: 补类型和 store 方法**

```ts
export interface Subscription {
  id: string
  user_id: string
  feed_source_id: string
  feed_source?: FeedSource
  title?: string
  subscription_group_id?: string
  subscription_group?: SubscriptionGroup
  is_muted?: boolean
  auto_mark_read?: boolean
  auto_add_reading_list?: boolean
  health_status?: 'healthy' | 'warning' | 'error'
  error_message?: string
  last_checked?: string
  created_at: string
}

export interface FeedSubscriptionRule {
  id: string
  name: string
  enabled: boolean
  position: number
  match_type: 'source_category' | 'source_ids' | 'keywords'
  conditions_json: Record<string, unknown>
  action_group_id?: string | null
  action_muted?: boolean | null
  action_auto_mark_read?: boolean | null
  action_auto_add_reading_list?: boolean | null
}
```

```ts
const subscriptionRules = ref<FeedSubscriptionRule[]>([])
const ruleApplySummary = ref<FeedSubscriptionRuleApplySummary | null>(null)

const fetchSubscriptionRules = async () => {
  const authStore = useAuthStore()
  const res = await fetch(`${api.url}/feed/subscription-rules`, {
    headers: { Authorization: `Bearer ${authStore.token}` },
  })
  const payload = await res.json()
  subscriptionRules.value = payload.data || []
}

const applySubscriptionRules = async (payload: { rule_id?: string; all?: boolean }) => {
  const authStore = useAuthStore()
  const res = await fetch(`${api.url}/feed/subscription-rules/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  ruleApplySummary.value = data.data || null
  await fetchSubscriptions()
  return Boolean(data.data)
}
```

- [ ] **Step 4: 跑单测、type-check**

Run: `cd /Users/fafa/projects/Atoman/Atoman-Frontend && bun run test:unit -- tests/unit/stores/feed.rules.spec.ts && bun run type-check`

Expected: 新增 store 测试 PASS，type-check PASS。

- [ ] **Step 5: 提交这一小步**

```bash
cd /Users/fafa/projects/Atoman/Atoman-Frontend
git add src/types.ts src/stores/feed.ts tests/unit/stores/feed.rules.spec.ts tests/unit/views/feed/FeedView.spec.ts
git commit -m "feat: wire frontend subscription rule store"
```

### Task 5: 前端规则列表、编辑 Sheet 与管理面板集成

**Files:**
- Modify: `/Users/fafa/projects/Atoman/Atoman-Frontend/src/components/feed/SubscriptionManageSheet.vue`
- Create: `/Users/fafa/projects/Atoman/Atoman-Frontend/src/components/feed/SubscriptionRuleEditorSheet.vue`
- Modify: `/Users/fafa/projects/Atoman/Atoman-Frontend/src/views/feed/FeedView.vue`
- Modify: `/Users/fafa/projects/Atoman/Atoman-Frontend/tests/unit/views/feed/FeedLayout.spec.ts`
- Modify: `/Users/fafa/projects/Atoman/Atoman-Frontend/tests/unit/views/feed/FeedView.spec.ts`
- Create: `/Users/fafa/projects/Atoman/Atoman-Frontend/tests/unit/components/feed/SubscriptionManageSheet.rules.spec.ts`
- Test: `/Users/fafa/projects/Atoman/Atoman-Frontend/tests/unit/components/feed/SubscriptionManageSheet.rules.spec.ts`

- [ ] **Step 1: 先写组件测试，锁定规则区展示和交互事件**

```ts
it('renders rule cards and emits apply / reorder actions', async () => {
  const wrapper = mount(SubscriptionManageSheet, {
    props: {
      show: true,
      subscriptions: [],
      groups: [{ id: 'g-1', user_id: 'user-1', name: '默认分组', created_at: '', updated_at: '' }],
      filterRules: { mutedSourceIds: [], hiddenKeywords: [] },
      automationRules: { autoMarkReadSourceIds: [], autoAddReadingListSourceIds: [] },
      subscriptionRules: [{
        id: 'rule-1',
        name: '播客整理',
        enabled: true,
        position: 1,
        match_type: 'source_category',
        conditions_json: { categories: ['podcast'] },
        action_group_id: 'g-1',
      }],
      ruleApplySummary: null,
    },
  })

  expect(wrapper.text()).toContain('规则')
  expect(wrapper.text()).toContain('播客整理')

  await wrapper.get('[data-test="rule-apply-rule-1"]').trigger('click')
  expect(wrapper.emitted('apply-subscription-rule')?.[0]).toEqual(['rule-1'])
})
```

- [ ] **Step 2: 跑组件测试，先看到失败**

Run: `cd /Users/fafa/projects/Atoman/Atoman-Frontend && bun run test:unit -- tests/unit/components/feed/SubscriptionManageSheet.rules.spec.ts`

Expected: FAIL，缺少 `subscriptionRules` props、规则区 DOM 或 editor sheet。

- [ ] **Step 3: 实现规则列表与编辑 Sheet**

```vue
<section class="subscription-rules-section">
  <div class="manage-toolbar">
    <PPress label="新建规则" variant="secondary" @click="openRuleEditor()" />
    <PPress label="重算全部订阅" variant="secondary" @click="$emit('apply-all-subscription-rules')" />
  </div>

  <p v-if="ruleApplySummary" class="a-muted">
    已检查 {{ ruleApplySummary.scanned_count }} 个订阅，更新 {{ ruleApplySummary.updated_count }} 个。
  </p>

  <div v-for="rule in subscriptionRules" :key="rule.id" class="subscription-rule-card">
    <div class="subscription-rule-card__title">{{ rule.name }}</div>
    <div class="subscription-rule-card__meta">{{ summarizeRule(rule) }}</div>
    <div class="subscription-rule-card__actions">
      <PPress :data-test="`rule-apply-${rule.id}`" label="应用到已有订阅" variant="secondary" @click="$emit('apply-subscription-rule', rule.id)" />
      <PPress :data-test="`rule-up-${rule.id}`" label="上移" variant="secondary" @click="$emit('move-subscription-rule-up', rule.id)" />
      <PPress :data-test="`rule-down-${rule.id}`" label="下移" variant="secondary" @click="$emit('move-subscription-rule-down', rule.id)" />
    </div>
  </div>
</section>
```

```vue
<SubscriptionRuleEditorSheet
  :show="showRuleEditor"
  :groups="groups"
  :model-value="editingRule"
  @close="showRuleEditor = false"
  @submit="submitRuleEditor"
/>
```

- [ ] **Step 4: 跑组件测试、FeedView 相关单测、type-check**

Run: `cd /Users/fafa/projects/Atoman/Atoman-Frontend && bun run test:unit -- tests/unit/components/feed/SubscriptionManageSheet.rules.spec.ts tests/unit/views/feed/FeedView.spec.ts && bun run type-check`

Expected: 组件与视图测试 PASS，type-check PASS。

- [ ] **Step 5: 提交这一小步**

```bash
cd /Users/fafa/projects/Atoman/Atoman-Frontend
git add src/components/feed/SubscriptionManageSheet.vue src/components/feed/SubscriptionRuleEditorSheet.vue src/views/feed/FeedView.vue tests/unit/components/feed/SubscriptionManageSheet.rules.spec.ts tests/unit/views/feed/FeedView.spec.ts tests/unit/views/feed/FeedLayout.spec.ts
git commit -m "feat: add subscription rule management ui"
```

### Task 6: 前端从本地规则切到后端托管字段并完成验收

**Files:**
- Modify: `/Users/fafa/projects/Atoman/Atoman-Frontend/src/views/feed/FeedView.vue`
- Modify: `/Users/fafa/projects/Atoman/Atoman-Frontend/src/stores/feed.ts`
- Modify: `/Users/fafa/projects/Atoman/Atoman-Frontend/src/components/feed/SubscriptionManageSheet.vue`
- Modify: `/Users/fafa/projects/Atoman/Atoman-Frontend/tests/unit/views/feed/FeedView.spec.ts`
- Modify: `/Users/fafa/projects/Atoman/Atoman-Frontend/tests/unit/components/feed/SubscriptionManageSheet.rules.spec.ts`
- Test: `/Users/fafa/projects/Atoman/Atoman-Frontend/tests/unit/views/feed/FeedView.spec.ts`

- [ ] **Step 1: 先写回归测试，锁定时间线消费后端托管字段**

```ts
it('filters muted subscriptions and auto-enqueues managed reading list items from backend fields', async () => {
  vi.mocked(globalThis.fetch).mockResolvedValue(new Response(JSON.stringify({
    data: [
      {
        type: 'feed_item',
        feed_item: {
          id: 'feed-item-1',
          feed_source_id: 'source-1',
          feed_source: { id: 'source-1', title: '静音来源' },
          guid: 'feed-item-1',
          title: '被静音条目',
          link: 'https://example.com/item',
          summary: '摘要',
          author: '作者',
          published_at: '2026-06-16T00:00:00Z',
          fetched_at: '2026-06-16T00:00:00Z',
        },
        is_read: false,
      },
    ],
    meta: { page: 1, page_size: 20, total: 1, has_more: false },
  }), { status: 200 }))

  const feedStore = useFeedStore()
  feedStore.subscriptions = [{
    id: 'sub-1',
    user_id: 'user-1',
    feed_source_id: 'source-1',
    title: '静音来源',
    is_muted: true,
    auto_mark_read: false,
    auto_add_reading_list: true,
    created_at: '2026-01-01T00:00:00Z',
  }]

  const wrapper = mount(FeedView, { global: { stubs: { PEmpty: true, PPageHeader: true, PPress: true, PBadge: true, PClip: true, SubscriptionAddSheet: true, SubscriptionManageSheet: true, FeedArticleSheet: true } } })
  await flushPromises()

  expect(wrapper.text()).not.toContain('被静音条目')
})
```

- [ ] **Step 2: 跑回归测试，先看到失败**

Run: `cd /Users/fafa/projects/Atoman/Atoman-Frontend && bun run test:unit -- tests/unit/views/feed/FeedView.spec.ts`

Expected: FAIL，当前视图仍然只读本地 `filterRules` / `automationRules`。

- [ ] **Step 3: 改成以后端托管字段为主，并保留本地关键词隐藏的独立边界**

```ts
const subscriptionsBySourceId = computed(() => new Map(
  subscriptions.value.map((sub) => [sub.feed_source_id, sub]),
))

const visibleTimeline = computed(() => {
  const hiddenKeywords = feedStore.filterRules.hiddenKeywords.map((keyword) => keyword.toLocaleLowerCase())
  return timeline.value.filter((item) => {
    const sourceId = item.feed_item?.feed_source_id || item.post?.channel_id || ''
    const subscription = subscriptionsBySourceId.value.get(sourceId)
    if (subscription?.is_muted) return false

    if (!hiddenKeywords.length) return true
    const haystack = [item.feed_item?.title, item.post?.title, item.feed_item?.feed_source?.title]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase()
    return !hiddenKeywords.some((keyword) => haystack.includes(keyword))
  })
})
```

```ts
const autoReadSourceIds = new Set(
  subscriptions.value.filter((sub) => sub.auto_mark_read).map((sub) => sub.feed_source_id),
)
const autoReadingListSourceIds = new Set(
  subscriptions.value.filter((sub) => sub.auto_add_reading_list).map((sub) => sub.feed_source_id),
)
```

- [ ] **Step 4: 跑最终验证**

Run: `cd /Users/fafa/projects/Atoman/Atoman-Frontend && bun run test:unit -- tests/unit/views/feed/FeedView.spec.ts tests/unit/components/feed/SubscriptionManageSheet.rules.spec.ts tests/unit/stores/feed.rules.spec.ts && bun run type-check`

Run: `cd /Users/fafa/projects/Atoman/Atoman-Backend && go test ./internal/modules/subscription -v && go build ./...`

Expected: 前端相关单测 PASS，`bun run type-check` PASS，backend 测试与编译 PASS。

- [ ] **Step 5: 提交最终收口**

```bash
cd /Users/fafa/projects/Atoman/Atoman-Frontend
git add src/views/feed/FeedView.vue src/stores/feed.ts src/components/feed/SubscriptionManageSheet.vue tests/unit/views/feed/FeedView.spec.ts tests/unit/components/feed/SubscriptionManageSheet.rules.spec.ts
git commit -m "feat: consume backend subscription rule state"
```

## 自检

- Spec coverage:
  - 规则条件三类：Task 2、Task 5
  - 规则动作四类：Task 1、Task 3、Task 4、Task 5
  - 顺序覆盖：Task 3
  - 新增订阅自动应用：Task 3
  - 已有订阅批量重算：Task 3、Task 5
  - 前端规则中心挂在订阅管理面板：Task 5
  - 本地规则向后端托管收口：Task 6
- Placeholder scan:
  - 没有 `TODO` / `TBD` / “稍后实现” 一类占位词。
- Type consistency:
  - 统一使用 `FeedSubscriptionRule`、`ApplySubscriptionRulesRequest`、`ApplySubscriptionRulesResult`、`subscriptionRules`、`ruleApplySummary`。

Plan complete and saved to `/Users/fafa/projects/Atoman/Atoman-Frontend/docs/superpowers/plans/2026-07-06-feed-subscription-rules-center.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
