# User Bootstrap Initialization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让新用户注册成功后自动拥有默认频道、默认合集、`internal_user` 语义的订阅自己，以及名为`默认收藏`的书签文件夹。

**Architecture:** 保持注册流程仍由 `auth_handler` 驱动，并在同一个事务里调用统一的新用户初始化入口。该入口复用现有默认频道与默认合集逻辑，补上默认订阅分组、`internal_user` 订阅自己和默认书签文件夹，同时移除默认频道创建过程中隐含的 `internal_channel` 自动订阅耦合。

**Tech Stack:** Go / Gin / GORM / SQLite 测试库

---

## 文件清单

| 文件 | 职责 |
|---|---|
| `server/internal/handlers/auth_handler.go` | 注册事务接入统一的新用户初始化入口 |
| `server/internal/handlers/auth_handler_test.go` | 覆盖注册后的默认初始化结果 |
| `server/internal/modules/blog/service.go` | 调整默认频道逻辑，移除默认频道自动订阅自己的频道耦合 |
| `server/internal/modules/blog/service_test.go` | 覆盖默认频道逻辑调整后的行为 |
| `server/internal/model/feed.go` | 复用 `BookmarkFolder`、`Subscription`、`FeedSource` 等现有模型，无需改结构 |
| `server/internal/...` 新初始化 service 文件 | 承载 ensure 默认订阅自己与 ensure 默认收藏逻辑 |

## Task 1: 先用测试卡住注册后的默认状态

**Files:**
- Modify: `server/internal/handlers/auth_handler_test.go`
- Test: `server/internal/handlers/auth_handler_test.go`

- [ ] **Step 1: 在测试库迁移中加入书签文件夹模型**

把 `newAuthHandlerTestDB` 的 `AutoMigrate` 补齐 `BookmarkFolder`：

```go
if err := db.AutoMigrate(
	&model.User{},
	&model.UserSettings{},
	&model.EmailVerificationCode{},
	&model.Channel{},
	&model.Collection{},
	&model.FeedSource{},
	&model.SubscriptionGroup{},
	&model.Subscription{},
	&model.BookmarkFolder{},
); err != nil {
	t.Fatalf("migrate: %v", err)
}
```

- [ ] **Step 2: 扩展注册测试，明确默认订阅必须是 internal_user，且存在默认收藏**

在 `TestRegisterCreatesDefaultChannel` 里把断言补成：

```go
var subscriptions []model.Subscription
if err := db.Preload("FeedSource").Where("user_id = ?", user.UUID).Find(&subscriptions).Error; err != nil {
	t.Fatalf("find subscriptions: %v", err)
}
if len(subscriptions) != 1 {
	t.Fatalf("expected one auto subscription, got %d", len(subscriptions))
}
if subscriptions[0].FeedSource == nil {
	t.Fatalf("expected feed source to be preloaded")
}
if subscriptions[0].FeedSource.SourceType != "internal_user" {
	t.Fatalf("expected internal_user subscription, got %s", subscriptions[0].FeedSource.SourceType)
}
if subscriptions[0].FeedSource.SourceID == nil || *subscriptions[0].FeedSource.SourceID != user.UUID {
	t.Fatalf("expected subscription source id to match user uuid")
}

var groups int64
if err := db.Model(&model.SubscriptionGroup{}).Where("user_id = ? AND name = ?", user.UUID, "默认分组").Count(&groups).Error; err != nil {
	t.Fatalf("count default subscription group: %v", err)
}
if groups != 1 {
	t.Fatalf("expected one default subscription group, got %d", groups)
}

var folders []model.BookmarkFolder
if err := db.Where("user_id = ?", user.UUID).Find(&folders).Error; err != nil {
	t.Fatalf("find bookmark folders: %v", err)
}
if len(folders) != 1 {
	t.Fatalf("expected one default bookmark folder, got %d", len(folders))
}
if folders[0].Name != "默认收藏" {
	t.Fatalf("expected default bookmark folder name 默认收藏, got %s", folders[0].Name)
}
```

- [ ] **Step 3: 运行测试确认当前行为不满足目标**

运行：

```bash
cd /Users/fafa/Downloads/projects/Atoman/server && go test ./internal/handlers -run TestRegisterCreatesDefaultChannel -v
```

预期：

1. FAIL
2. 失败点应落在 `BookmarkFolder` 未创建，或默认订阅仍是 `internal_channel`

## Task 2: 拆出统一的新用户初始化入口

**Files:**
- Create: `server/internal/service/user_bootstrap_service.go`
- Test: `server/internal/service/user_bootstrap_service_test.go`

- [ ] **Step 1: 先写新用户初始化 service 的重复执行测试**

在 `server/internal/service/user_bootstrap_service_test.go` 新增一个幂等性测试：

```go
func TestUserBootstrapServiceEnsureDefaultsIsIdempotent(t *testing.T) {
	db := newServiceTestDB(t)
	user := model.User{Username: "alice", Email: "alice@example.com", Password: "hashed", Role: "user", IsActive: true}
	require.NoError(t, db.Create(&user).Error)

	svc := NewUserBootstrapService(db)

	require.NoError(t, svc.EnsureDefaults(user.UUID, user.Username))
	require.NoError(t, svc.EnsureDefaults(user.UUID, user.Username))

	var channelCount int64
	require.NoError(t, db.Model(&model.Channel{}).Where("user_id = ? AND is_default = ?", user.UUID, true).Count(&channelCount).Error)
	require.Equal(t, int64(1), channelCount)

	var collectionCount int64
	require.NoError(t, db.Model(&model.Collection{}).Where("is_default = ?", true).Count(&collectionCount).Error)
	require.Equal(t, int64(1), collectionCount)

	var groupCount int64
	require.NoError(t, db.Model(&model.SubscriptionGroup{}).Where("user_id = ? AND name = ?", user.UUID, "默认分组").Count(&groupCount).Error)
	require.Equal(t, int64(1), groupCount)

	var subscriptionCount int64
	require.NoError(t, db.Model(&model.Subscription{}).Where("user_id = ?", user.UUID).Count(&subscriptionCount).Error)
	require.Equal(t, int64(1), subscriptionCount)

	var folderCount int64
	require.NoError(t, db.Model(&model.BookmarkFolder{}).Where("user_id = ? AND name = ?", user.UUID, "默认收藏").Count(&folderCount).Error)
	require.Equal(t, int64(1), folderCount)
}
```

- [ ] **Step 2: 运行该测试确认当前 service 还不存在**

运行：

```bash
cd /Users/fafa/Downloads/projects/Atoman/server && go test ./internal/service -run TestUserBootstrapServiceEnsureDefaultsIsIdempotent -v
```

预期：

1. FAIL
2. 失败原因是 `NewUserBootstrapService` 或 `EnsureDefaults` 尚未定义

- [ ] **Step 3: 实现最小的新用户初始化 service**

在 `server/internal/service/user_bootstrap_service.go` 新建：

```go
package service

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"

	blog "atoman/internal/modules/blog"
	"atoman/internal/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

const (
	defaultSubscriptionGroupName = "默认分组"
	defaultBookmarkFolderName    = "默认收藏"
)

type UserBootstrapService struct {
	db *gorm.DB
}

func NewUserBootstrapService(db *gorm.DB) *UserBootstrapService {
	return &UserBootstrapService{db: db}
}

func (s *UserBootstrapService) EnsureDefaults(userID uuid.UUID, username string) error {
	if _, err := blog.NewService(s.db).CreateDefaultChannelForUser(userID, username); err != nil {
		return err
	}
	group, err := s.ensureDefaultSubscriptionGroup(userID)
	if err != nil {
		return err
	}
	if err := s.ensureSelfSubscription(userID, username, group.ID); err != nil {
		return err
	}
	if err := s.ensureDefaultBookmarkFolder(userID); err != nil {
		return err
	}
	return nil
}

func (s *UserBootstrapService) ensureDefaultSubscriptionGroup(userID uuid.UUID) (*model.SubscriptionGroup, error) {
	var group model.SubscriptionGroup
	if err := s.db.Where("user_id = ? AND name = ?", userID, defaultSubscriptionGroupName).First(&group).Error; err == nil {
		return &group, nil
	} else if err != nil && err != gorm.ErrRecordNotFound {
		return nil, err
	}

	group = model.SubscriptionGroup{UserID: userID, Name: defaultSubscriptionGroupName}
	if err := s.db.Create(&group).Error; err != nil {
		return nil, err
	}
	return &group, nil
}

func (s *UserBootstrapService) ensureSelfSubscription(userID uuid.UUID, username string, groupID uuid.UUID) error {
	hashSource := fmt.Sprintf("%s:%s", "internal_user", userID.String())
	sum := sha256.Sum256([]byte(hashSource))
	hash := hex.EncodeToString(sum[:])

	var source model.FeedSource
	if err := s.db.Where("hash = ?", hash).First(&source).Error; err != nil {
		if err != gorm.ErrRecordNotFound {
			return err
		}
		source = model.FeedSource{
			SourceType: "internal_user",
			SourceID:   &userID,
			Title:      username,
			Hash:       hash,
		}
		if err := s.db.Create(&source).Error; err != nil {
			return err
		}
	}

	var subscription model.Subscription
	if err := s.db.Where("user_id = ? AND feed_source_id = ?", userID, source.ID).First(&subscription).Error; err == nil {
		return nil
	} else if err != nil && err != gorm.ErrRecordNotFound {
		return err
	}

	subscription = model.Subscription{
		UserID:              userID,
		FeedSourceID:        source.ID,
		SubscriptionGroupID: &groupID,
		Title:               source.Title,
	}
	return s.db.Create(&subscription).Error
}

func (s *UserBootstrapService) ensureDefaultBookmarkFolder(userID uuid.UUID) error {
	var folder model.BookmarkFolder
	if err := s.db.Where("user_id = ? AND name = ?", userID, defaultBookmarkFolderName).First(&folder).Error; err == nil {
		return nil
	} else if err != nil && err != gorm.ErrRecordNotFound {
		return err
	}

	return s.db.Create(&model.BookmarkFolder{
		UserID: userID,
		Name:   defaultBookmarkFolderName,
	}).Error
}
```

- [ ] **Step 4: 运行 service 测试确认通过**

运行：

```bash
cd /Users/fafa/Downloads/projects/Atoman/server && go test ./internal/service -run TestUserBootstrapServiceEnsureDefaultsIsIdempotent -v
```

预期：

1. PASS

## Task 3: 去掉默认频道创建时的频道级自动订阅耦合

**Files:**
- Modify: `server/internal/modules/blog/service.go`
- Modify: `server/internal/modules/blog/service_test.go`

- [ ] **Step 1: 先写一个默认频道测试，明确它不负责自动创建订阅**

在 `server/internal/modules/blog/service_test.go` 新增：

```go
func TestCreateDefaultChannelForUserDoesNotCreateSubscription(t *testing.T) {
	db := newTestDB(t)
	svc := NewService(db)

	user := model.User{Username: "alice", Email: "alice@example.com", Password: "hashed", Role: "user", IsActive: true}
	require.NoError(t, db.Create(&user).Error)

	_, err := svc.CreateDefaultChannelForUser(user.ID, "Alice")
	require.NoError(t, err)

	var count int64
	require.NoError(t, db.Model(&model.Subscription{}).Where("user_id = ?", user.ID).Count(&count).Error)
	require.Equal(t, int64(0), count)
}
```

- [ ] **Step 2: 运行测试确认当前逻辑仍会创建频道订阅**

运行：

```bash
cd /Users/fafa/Downloads/projects/Atoman/server && go test ./internal/modules/blog -run TestCreateDefaultChannelForUserDoesNotCreateSubscription -v
```

预期：

1. FAIL
2. 当前会查到 1 条 `internal_channel` 订阅

- [ ] **Step 3: 删除默认频道逻辑中的自动订阅调用**

修改 `server/internal/modules/blog/service.go`，删除：

```go
if err := s.autoSubscribeToOwnChannel(userID, channel.ID, channel.Name); err != nil {
	return model.Channel{}, err
}
```

并删除不再使用的 `autoSubscribeToOwnChannel` 方法及其相关导入。

- [ ] **Step 4: 运行 blog service 测试确认默认频道职责恢复单一**

运行：

```bash
cd /Users/fafa/Downloads/projects/Atoman/server && go test ./internal/modules/blog -run TestCreateDefaultChannelForUserDoesNotCreateSubscription -v
```

预期：

1. PASS

## Task 4: 把注册事务切换到统一初始化入口

**Files:**
- Modify: `server/internal/handlers/auth_handler.go`
- Test: `server/internal/handlers/auth_handler_test.go`

- [ ] **Step 1: 将注册事务中的默认频道调用替换为统一初始化调用**

把 `RegisterHandler` 事务内这段：

```go
if _, err := blog.NewService(tx).CreateDefaultChannelForUser(user.UUID, user.Username); err != nil {
	return err
}
```

替换为：

```go
if err := service.NewUserBootstrapService(tx).EnsureDefaults(user.UUID, user.Username); err != nil {
	return err
}
```

并删除 `auth_handler.go` 中不再需要的 `blog` import。

- [ ] **Step 2: 运行注册测试确认完整初始化通过**

运行：

```bash
cd /Users/fafa/Downloads/projects/Atoman/server && go test ./internal/handlers -run TestRegisterCreatesDefaultChannel -v
```

预期：

1. PASS
2. 默认订阅类型为 `internal_user`
3. 默认收藏存在

## Task 5: 做最小回归验证

**Files:**
- Modify: 无
- Test: `server/internal/handlers/auth_handler_test.go`
- Test: `server/internal/modules/blog/service_test.go`
- Test: `server/internal/service/user_bootstrap_service_test.go`

- [ ] **Step 1: 运行三个相关测试入口**

运行：

```bash
cd /Users/fafa/Downloads/projects/Atoman/server && go test ./internal/handlers -run TestRegisterCreatesDefaultChannel -v
cd /Users/fafa/Downloads/projects/Atoman/server && go test ./internal/modules/blog -run TestCreateDefaultChannelForUserDoesNotCreateSubscription -v
cd /Users/fafa/Downloads/projects/Atoman/server && go test ./internal/service -run TestUserBootstrapServiceEnsureDefaultsIsIdempotent -v
```

预期：

1. 三组测试全部 PASS

- [ ] **Step 2: 运行后端构建验证**

运行：

```bash
cd /Users/fafa/Downloads/projects/Atoman/server && go build ./...
```

预期：

1. PASS
2. 无编译错误

- [ ] **Step 3: 提交改动**

运行：

```bash
git add server/internal/handlers/auth_handler.go \
	server/internal/handlers/auth_handler_test.go \
	server/internal/modules/blog/service.go \
	server/internal/modules/blog/service_test.go \
	server/internal/service/user_bootstrap_service.go \
	server/internal/service/user_bootstrap_service_test.go \
	docs/superpowers/specs/2026-06-01-user-bootstrap-design.md \
	docs/superpowers/plans/2026-06-01-user-bootstrap-init.md
git commit -m "feat: bootstrap new users with default subscriptions and bookmarks"
```

预期：

1. commit 成功

---

## 自检结果

### Spec 覆盖

本计划已覆盖以下需求：

1. 注册后默认频道
2. 注册后默认合集
3. `internal_user` 语义的订阅自己
4. 默认订阅分组
5. 名为`默认收藏`的书签文件夹
6. 幂等初始化
7. 去除旧的 `internal_channel` 自动订阅耦合

### Placeholder 扫描

已检查，无 `TODO`、`TBD`、`稍后实现` 一类占位描述。

### 类型一致性

计划中统一使用：

1. `UserBootstrapService`
2. `EnsureDefaults`
3. `internal_user`
4. `默认收藏`

未混用其他命名。
