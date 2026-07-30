# 辩题 Wiki 与正文关系实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将辩论模块改造成正文驱动关系的 Wiki 系统，支持社区持续投票、动态结论、只读辩论树与关系图。

**Architecture:** 复用通用 `revisions` 与 `content_protections` 表保存辩题 Wiki 版本和保护状态，在 debate 模块内维护引用快照、活动关系投影、投票和结论事件。全站 `@type:id[:qualifier]` 只提供共享语法解析与编辑器呈现，资源合法性由业务服务校验；前端以正文为主视图，树和图按深度只读加载。

**Tech Stack:** Go、Gin、GORM、PostgreSQL/SQLite 测试、Vue 3、TypeScript、Pinia、CodeMirror 6、Vue Flow、Vitest、Playwright、Bun。

---

## 执行约定

- 工作区根目录：`/root/Atoman`
- 后端仓库：`Atoman-Backend`
- 前端仓库：`Atoman-Frontend`
- 后端和前端是独立 Git 仓库，每个任务只在对应仓库提交。
- 不提交两个仓库中现有的 Feed、音乐、发布脚本等无关改动。
- API 变化后更新 `Atoman-Backend/docs/docs.go`、`swagger.json`、`swagger.yaml`。
- 任务 1 和任务 8 是共享资源引用契约。若另一个窗口已提交同等实现，先逐项核对类型、语法和测试，再复用该实现；不要创建第二套解析器。

## 文件边界

### 后端

- `internal/platform/resourceref/`：纯语法解析与资源类型注册，不访问数据库。
- `internal/model/debate.go`：辩题、活动关系、直接投票、结论事件、版本引用快照。
- `internal/modules/debate/wiki.go`：版本保存、回退、冲突、归档与保护。
- `internal/modules/debate/references.go`：资源校验、关系投影、循环检测和重新确认。
- `internal/modules/debate/graph.go`：限定深度的树和图查询。
- `internal/modules/debate_voting/service.go`：一人一票及结论状态机。
- `internal/migrations/debate_wiki.go`：删除旧数据并建立版本 1。

### 前端

- `src/utils/resourceReferences.ts`：与后端一致的纯解析函数和类型。
- `src/components/shared/editor/resourceReferenceExtension.ts`：CodeMirror 行内引用块。
- `src/components/debate/DebateWikiEditor.vue`：辩题搜索、关系选择和引用插入。
- `src/components/debate/DebateVotePanel.vue`：当前投票与结论。
- `src/components/debate/DebateRevisionSheet.vue`：版本、差异和回退。
- `src/components/debate/DebateDiscussionSheet.vue`：通用评论侧层。
- `src/views/debate/DebateTopicView.vue`：聚焦式标签页面，只负责组合。

## Task 1: 建立共享资源引用语法

**Files:**
- Create: `Atoman-Backend/internal/platform/resourceref/parser.go`
- Create: `Atoman-Backend/internal/platform/resourceref/parser_test.go`
- Create: `Atoman-Backend/internal/platform/resourceref/registry.go`
- Create: `Atoman-Backend/internal/platform/resourceref/registry_test.go`

- [ ] **Step 1: 写解析器失败测试**

```go
package resourceref

import "testing"

func TestParseRecognizesRegisteredResourcesAndIgnoresUserMentions(t *testing.T) {
	refs, err := Parse("由 @alice 补充，参考 @album:01900000-0000-7000-8000-000000000001 和 @debate:01900000-0000-7000-8000-000000000002:support。")
	if err != nil {
		t.Fatal(err)
	}
	if len(refs) != 2 || refs[0].Kind != "album" || refs[1].Qualifier != "support" {
		t.Fatalf("refs = %#v", refs)
	}
}

func TestParseRejectsUnknownKindAndInvalidDebateQualifier(t *testing.T) {
	for _, content := range []string{
		"@topic:01900000-0000-7000-8000-000000000001",
		"@debate:01900000-0000-7000-8000-000000000001:neutral",
		"@album:not-a-uuid",
	} {
		if _, err := Parse(content); err == nil {
			t.Fatalf("Parse(%q) succeeded", content)
		}
	}
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /root/Atoman/Atoman-Backend && go test ./internal/platform/resourceref -count=1`

Expected: FAIL，提示包或 `Parse` 不存在。

- [ ] **Step 3: 实现稳定语法和类型注册**

```go
package resourceref

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/google/uuid"
)

var candidatePattern = regexp.MustCompile(`@[a-z]+:[^\s，。！？；、<>]+`)

var Kinds = map[string]struct{}{
	"post": {}, "thread": {}, "debate": {}, "feed": {}, "article": {},
	"artist": {}, "album": {}, "song": {}, "playlist": {}, "podcast": {},
	"episode": {}, "video": {}, "person": {}, "event": {}, "channel": {},
	"collection": {}, "comment": {},
}

type Reference struct {
	Raw       string
	Kind      string
	ResourceID uuid.UUID
	Qualifier string
	Start     int
	End       int
}

func Parse(content string) ([]Reference, error) {
	matches := candidatePattern.FindAllStringIndex(content, -1)
	refs := make([]Reference, 0, len(matches))
	for _, span := range matches {
		raw := strings.TrimRight(content[span[0]:span[1]], ".,!?;)]}")
		parts := strings.Split(strings.TrimPrefix(raw, "@"), ":")
		if len(parts) < 2 || len(parts) > 3 {
			return nil, fmt.Errorf("invalid resource reference %q", raw)
		}
		if _, ok := Kinds[parts[0]]; !ok {
			return nil, fmt.Errorf("unknown resource kind %q", parts[0])
		}
		id, err := uuid.Parse(parts[1])
		if err != nil {
			return nil, fmt.Errorf("invalid resource id in %q", raw)
		}
		qualifier := ""
		if len(parts) == 3 {
			qualifier = parts[2]
		}
		if parts[0] == "debate" && qualifier != "support" && qualifier != "oppose" {
			return nil, fmt.Errorf("debate reference requires support or oppose")
		}
		if parts[0] != "debate" && qualifier != "" {
			return nil, fmt.Errorf("resource kind %q does not accept a qualifier", parts[0])
		}
		refs = append(refs, Reference{Raw: raw, Kind: parts[0], ResourceID: id, Qualifier: qualifier, Start: span[0], End: span[0] + len(raw)})
	}
	return refs, nil
}
```

- [ ] **Step 4: 补充标点、重复标记和 Unicode 正文测试并运行**

Run: `cd /root/Atoman/Atoman-Backend && go test ./internal/platform/resourceref -count=1`

Expected: PASS。

- [ ] **Step 5: 定义业务无关的资源解析注册表**

`registry.go` 只定义解析契约，不依赖 GORM。业务模块注册自己的 resolver：

```go
type Viewer struct { UserID uuid.UUID }
type Resolved struct { Kind string; ID uuid.UUID; Title string; Visible bool; Referenceable bool }
type Resolver func(context.Context, Viewer, uuid.UUID) (Resolved, error)
type Registry struct { resolvers map[string]Resolver }
func NewRegistry() *Registry { return &Registry{resolvers: map[string]Resolver{}} }
func (r *Registry) Register(kind string, resolver Resolver) { r.resolvers[kind] = resolver }
func (r *Registry) Resolve(ctx context.Context, viewer Viewer, kind string, id uuid.UUID) (Resolved, error) {
	resolver, ok := r.resolvers[kind]
	if !ok { return Resolved{}, fmt.Errorf("resource kind %q has no resolver", kind) }
	return resolver(ctx, viewer, id)
}
```

测试必须覆盖未注册类型、不可见资源和已注册 resolver 的成功结果。

- [ ] **Step 6: 提交后端解析器**

```bash
cd /root/Atoman/Atoman-Backend
git add internal/platform/resourceref/parser.go internal/platform/resourceref/parser_test.go internal/platform/resourceref/registry.go internal/platform/resourceref/registry_test.go
git commit -m "feat(references): add resource reference parser"
```

## Task 2: 迁移辩题领域模型并建立初始版本

**Files:**
- Modify: `Atoman-Backend/internal/model/debate.go`
- Modify: `Atoman-Backend/internal/model/comment_extensions.go`
- Create: `Atoman-Backend/internal/migrations/debate_wiki.go`
- Create: `Atoman-Backend/internal/migrations/debate_wiki_test.go`
- Modify: `Atoman-Backend/cmd/migrate/main.go`
- Modify: `Atoman-Backend/cmd/migrate/main_test.go`
- Modify: `Atoman-Backend/cmd/start_server/main.go`
- Modify: `Atoman-Backend/cmd/start_server/main_test.go`

- [ ] **Step 1: 写迁移失败测试**

```go
func TestRunDebateWikiMigrationDropsLegacyDataAndSeedsRevisionOne(t *testing.T) {
	db := testdb.Open(t)
	testdb.Migrate(t, db, &model.User{}, &model.Debate{}, &model.DebateRelation{}, &model.DebateVote{}, &model.Revision{})
	user := model.User{Username: "editor", Email: "editor@example.com", Password: "hash", IsActive: true}
	if err := db.Create(&user).Error; err != nil { t.Fatal(err) }
	debate := model.Debate{UserID: user.UUID, Title: "是否采用四天工作制？", Content: "旧正文", Status: "open"}
	if err := db.Create(&debate).Error; err != nil { t.Fatal(err) }
	if err := RunDebateWikiMigration(db); err != nil { t.Fatal(err) }
	var revision model.Revision
	if err := db.Where("content_type = ? AND content_id = ? AND version_number = 1", "debate", debate.ID).First(&revision).Error; err != nil { t.Fatal(err) }
	if !revision.IsCurrent || revision.EditorID != user.UUID { t.Fatalf("revision = %#v", revision) }
	if db.Migrator().HasTable("debate_argument_details") { t.Fatal("legacy argument table still exists") }
	vote := model.DebateVote{DebateID: debate.ID, UserID: user.UUID, Direction: model.DebateVoteYes}
	if err := db.Create(&vote).Error; err != nil { t.Fatal(err) }
	relation := model.DebateRelation{SourceDebateID: uuid.New(), TargetDebateID: debate.ID, Stance: model.DebateRelationSupport, TargetRevisionID: revision.ID, SourceConclusionEventID: uuid.New(), Status: model.DebateReferenceActive}
	if err := db.Create(&relation).Error; err != nil { t.Fatal(err) }
	if err := RunDebateWikiMigration(db); err != nil { t.Fatal(err) }
	var voteCount, relationCount int64
	db.Model(&model.DebateVote{}).Where("id = ?", vote.ID).Count(&voteCount)
	db.Model(&model.DebateRelation{}).Where("id = ?", relation.ID).Count(&relationCount)
	if voteCount != 1 || relationCount != 1 { t.Fatalf("second migration removed new data: votes=%d relations=%d", voteCount, relationCount) }
}
```

- [ ] **Step 2: 运行迁移测试确认失败**

Run: `cd /root/Atoman/Atoman-Backend && go test ./internal/migrations ./cmd/migrate ./cmd/start_server -run DebateWiki -count=1`

Expected: FAIL，提示迁移函数和新模型不存在。

- [ ] **Step 3: 将模型改成 Wiki、直接投票和结论事件**

在 `internal/model/debate.go` 保留 `Debate`，移除 Argument DTO、Argument 投票字段和结题投票模型，并加入：

```go
const (
	DebateStatusActive = "active"
	DebateStatusArchived = "archived"
	DebateVoteYes = "yes"
	DebateVoteNo = "no"
	DebateReferenceActive = "active"
	DebateReferenceStale = "stale"
	DebateReferenceUnavailable = "unavailable"
)

type DebateVote struct {
	Base
	DebateID uuid.UUID `json:"debate_id" gorm:"type:uuid;not null;uniqueIndex:idx_debate_vote_user,priority:1"`
	UserID uuid.UUID `json:"user_id" gorm:"type:uuid;not null;uniqueIndex:idx_debate_vote_user,priority:2"`
	Direction string `json:"direction" gorm:"type:varchar(8);not null"`
}

type Debate struct {
	Base
	UserID uuid.UUID `json:"user_id" gorm:"type:uuid;not null;index"`
	User *User `json:"user,omitempty" gorm:"foreignKey:UserID;references:UUID"`
	Title string `json:"title" gorm:"not null"`
	Description string `json:"description" gorm:"type:text"`
	Content string `json:"content" gorm:"type:text"`
	Status string `json:"status" gorm:"type:varchar(16);not null;default:'active'"`
	Tags pq.StringArray `json:"tags" gorm:"type:text[]" swaggertype:"array,string"`
	ViewCount int `json:"view_count" gorm:"default:0"`
	ConclusionType string `json:"conclusion_type" gorm:"type:varchar(8);not null;default:''"`
	// 始终指向当前 content_type=debate 的版本。
	CurrentRevisionID *uuid.UUID `json:"current_revision_id" gorm:"type:uuid;index"`
	CurrentConclusionEventID *uuid.UUID `json:"current_conclusion_event_id" gorm:"type:uuid;index"`
}

type DebateConclusionEvent struct {
	Base
	DebateID uuid.UUID `json:"debate_id" gorm:"type:uuid;not null;index"`
	Direction string `json:"direction" gorm:"type:varchar(8);not null"`
	YesVotes int `json:"yes_votes"`
	NoVotes int `json:"no_votes"`
	TotalVotes int `json:"total_votes"`
}

type DebateRevisionReference struct {
	Base
	RevisionID uuid.UUID `json:"revision_id" gorm:"type:uuid;not null;index"`
	TargetKind string `json:"target_kind" gorm:"type:varchar(24);not null"`
	TargetID uuid.UUID `json:"target_id" gorm:"type:uuid;not null"`
	Qualifier string `json:"qualifier" gorm:"type:varchar(16);not null;default:''"`
	Occurrence int `json:"occurrence" gorm:"not null"`
	ConclusionEventID *uuid.UUID `json:"conclusion_event_id" gorm:"type:uuid"`
	State string `json:"state" gorm:"type:varchar(16);not null"`
}

type DebateRelation struct {
	Base
	SourceDebateID uuid.UUID `json:"source_debate_id" gorm:"type:uuid;not null;uniqueIndex:idx_debate_relation_pair,priority:1"`
	TargetDebateID uuid.UUID `json:"target_debate_id" gorm:"type:uuid;not null;uniqueIndex:idx_debate_relation_pair,priority:2"`
	Stance string `json:"stance" gorm:"type:varchar(16);not null"`
	TargetRevisionID uuid.UUID `json:"target_revision_id" gorm:"type:uuid;not null"`
	SourceConclusionEventID uuid.UUID `json:"source_conclusion_event_id" gorm:"type:uuid;not null"`
	Status string `json:"status" gorm:"type:varchar(16);not null;index"`
}
```

扩展 `DebateRelation` 为正文投影：增加 `TargetRevisionID`、`SourceConclusionEventID`、`Status`，删除 `UserID` 所有权语义。`Debate` 的 `Status` 只允许 `active/archived`，保留 `ConclusionType` 作为当前方向缓存，并增加 `CurrentConclusionEventID`。

- [ ] **Step 4: 实现幂等迁移**

`RunDebateWikiMigration` 必须在事务中执行以下顺序：

```go
func RunDebateWikiMigration(db *gorm.DB) error {
	return db.Transaction(func(tx *gorm.DB) error {
		legacySchema := tx.Migrator().HasTable("debate_argument_details") || tx.Migrator().HasColumn(&model.Debate{}, "conclude_threshold")
		var argumentIDs []uuid.UUID
		if tx.Migrator().HasTable("debate_argument_details") {
			if err := tx.Table("debate_argument_details").Pluck("comment_id", &argumentIDs).Error; err != nil { return err }
		}
		if len(argumentIDs) > 0 {
			for _, target := range []any{&model.CommentMention{}, &model.CommentAttachment{}, &model.CommentLike{}, &model.CommentReport{}} {
				if err := tx.Unscoped().Where("comment_id IN ?", argumentIDs).Delete(target).Error; err != nil { return err }
			}
			if err := tx.Unscoped().Where("id IN ?", argumentIDs).Delete(&model.CommentEntry{}).Error; err != nil { return err }
		}
		legacyTables := []string{"argument_debate_refs", "debate_argument_refs", "debate_argument_details", "vote_histories", "debate_conclude_votes"}
		for _, table := range legacyTables {
			if tx.Migrator().HasTable(table) {
				if err := tx.Migrator().DropTable(table); err != nil { return err }
			}
		}
		// debate_votes 和 debate_relations 与新表同名，只在仍是旧结构时删除。
		if tx.Migrator().HasColumn("debate_votes", "argument_id") {
			if err := tx.Migrator().DropTable("debate_votes"); err != nil { return err }
		}
		if tx.Migrator().HasTable("debate_relations") && !tx.Migrator().HasColumn("debate_relations", "target_revision_id") {
			if err := tx.Migrator().DropTable("debate_relations"); err != nil { return err }
		}
		if err := tx.AutoMigrate(&model.Debate{}, &model.DebateVote{}, &model.DebateConclusionEvent{}, &model.DebateRevisionReference{}, &model.DebateRelation{}); err != nil { return err }
		for _, column := range []string{"argument_count", "vote_count", "conclusion_summary", "conclude_vote_count", "conclude_threshold", "concluded_at"} {
			if tx.Migrator().HasColumn(&model.Debate{}, column) {
				if err := tx.Migrator().DropColumn(&model.Debate{}, column); err != nil { return err }
			}
		}
		var debates []model.Debate
		if err := tx.Find(&debates).Error; err != nil { return err }
		for _, debate := range debates {
			var count int64
			if err := tx.Model(&model.Revision{}).Where("content_type = ? AND content_id = ?", "debate", debate.ID).Count(&count).Error; err != nil { return err }
			if count > 0 { continue }
			snapshot, err := json.Marshal(debateSnapshotFromModel(debate))
			if err != nil { return err }
			revision := model.Revision{ContentType: "debate", ContentID: debate.ID, VersionNumber: 1, ContentSnapshot: snapshot, EditorID: debate.UserID, EditSummary: "创建辩题", EditType: "creation", Status: "approved", IsCurrent: true, CreatedAt: debate.CreatedAt}
			if err := tx.Create(&revision).Error; err != nil { return err }
			if err := tx.Model(&model.Debate{}).Where("id = ?", debate.ID).Update("current_revision_id", revision.ID).Error; err != nil { return err }
		}
		if legacySchema {
			if err := tx.Model(&model.Debate{}).Where("status IN ?", []string{"open", "concluded"}).Update("status", model.DebateStatusActive).Error; err != nil { return err }
			if err := tx.Model(&model.Debate{}).Where("1 = 1").Updates(map[string]any{"conclusion_type": "", "current_conclusion_event_id": nil}).Error; err != nil { return err }
		}
		return nil
	})
}
```

- [ ] **Step 5: 注册迁移和模型并运行测试**

Run: `cd /root/Atoman/Atoman-Backend && go test ./internal/migrations ./cmd/migrate ./cmd/start_server -run DebateWiki -count=1`

Expected: PASS；重复运行迁移仍只有一个版本 1，并且第二次运行不会删除迁移后新增的 DebateVote 或 DebateRelation。

- [ ] **Step 6: 提交模型与迁移**

```bash
cd /root/Atoman/Atoman-Backend
git add internal/model/debate.go internal/model/comment_extensions.go internal/migrations/debate_wiki.go internal/migrations/debate_wiki_test.go cmd/migrate/main.go cmd/migrate/main_test.go cmd/start_server/main.go cmd/start_server/main_test.go
git commit -m "refactor(debate): migrate debates to wiki domain"
```

## Task 3: 实现 Wiki 保存、冲突、回退与保护

**Files:**
- Create: `Atoman-Backend/internal/modules/debate/wiki.go`
- Create: `Atoman-Backend/internal/modules/debate/wiki_test.go`
- Modify: `Atoman-Backend/internal/modules/debate/dto.go`
- Modify: `Atoman-Backend/internal/modules/debate/service.go`
- Modify: `Atoman-Backend/internal/modules/debate/repo.go`

- [ ] **Step 1: 写版本冲突和回退失败测试**

```go
func TestSaveWikiRejectsStaleBaseRevisionWithoutChangingContent(t *testing.T) {
	service, user, debate, current := seededWikiService(t)
	_, err := service.SaveWiki(user, debate.ID, UpdateDebateRequest{Title: debate.Title, Content: "新正文", EditSummary: "补充来源", BaseRevisionID: uuid.New()})
	if apperr.Code(err) != "debate.edit_conflict" { t.Fatalf("err = %v", err) }
	got, _ := service.GetDebate(debate.ID)
	if got.Content != debate.Content || got.CurrentRevisionID == nil || *got.CurrentRevisionID != current.ID { t.Fatalf("debate changed: %#v", got) }
}

func TestRevertWikiCreatesANewCurrentRevision(t *testing.T) {
	service, user, debate, first := seededWikiService(t)
	second, err := service.SaveWiki(user, debate.ID, UpdateDebateRequest{Title: debate.Title, Content: "第二版", EditSummary: "修改", BaseRevisionID: first.ID})
	if err != nil { t.Fatal(err) }
	reverted, err := service.RevertWiki(user, debate.ID, first.ID, *second.CurrentRevisionID, "恢复首版")
	if err != nil { t.Fatal(err) }
	if reverted.Content != debate.Content || reverted.CurrentRevisionID == nil || *reverted.CurrentRevisionID == first.ID { t.Fatalf("reverted = %#v", reverted) }
}

func TestCreateDebateCreatesRevisionOneInTheSameTransaction(t *testing.T) {
	service, user := emptyWikiService(t)
	created, err := service.CreateDebate(user, CreateDebateRequest{Title: "公共场所是否应该全面禁烟？", Content: "背景资料"})
	if err != nil { t.Fatal(err) }
	if created.CurrentRevisionID == nil { t.Fatal("current revision is nil") }
	var revision model.Revision
	if err := service.db.First(&revision, "id = ? AND content_type = ? AND version_number = 1", *created.CurrentRevisionID, "debate").Error; err != nil { t.Fatal(err) }
	if revision.EditType != "creation" || !revision.IsCurrent { t.Fatalf("revision = %#v", revision) }
}

func emptyWikiService(t *testing.T) (*Service, authctx.CurrentUser) {
	t.Helper()
	db := testdb.Open(t)
	testdb.Migrate(t, db,
		&model.User{}, &model.Debate{}, &model.Revision{}, &model.ContentProtection{},
		&model.DebateVote{}, &model.DebateConclusionEvent{}, &model.DebateRevisionReference{}, &model.DebateRelation{},
	)
	owner := model.User{Username: "wiki-editor", Email: "wiki-editor@example.com", Password: "hash", Role: authctx.RoleUser, IsActive: true}
	if err := db.Create(&owner).Error; err != nil { t.Fatal(err) }
	return NewService(db), authctx.CurrentUser{ID: owner.UUID, Username: owner.Username, Role: owner.Role}
}

func seededWikiService(t *testing.T) (*Service, authctx.CurrentUser, model.Debate, model.Revision) {
	t.Helper()
	service, user := emptyWikiService(t)
	debate, err := service.CreateDebate(user, CreateDebateRequest{Title: "公共场所是否应该全面禁烟？", Content: "初始正文"})
	if err != nil { t.Fatal(err) }
	var revision model.Revision
	if err := service.db.First(&revision, "id = ?", *debate.CurrentRevisionID).Error; err != nil { t.Fatal(err) }
	return service, user, debate, revision
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /root/Atoman/Atoman-Backend && go test ./internal/modules/debate -run 'SaveWiki|RevertWiki' -count=1`

Expected: FAIL，提示方法或 DTO 不存在。

- [ ] **Step 3: 定义请求与快照**

```go
type UpdateDebateRequest struct {
	Title string `json:"title"`
	Description string `json:"description"`
	Content string `json:"content"`
	Tags []string `json:"tags"`
	EditSummary string `json:"edit_summary"`
	BaseRevisionID uuid.UUID `json:"base_revision"`
}

type debateRevisionSnapshot struct {
	Title string `json:"title"`
	Description string `json:"description"`
	Content string `json:"content"`
	Tags []string `json:"tags"`
}
```

- [ ] **Step 4: 实现单事务乐观锁保存**

`CreateDebate` 必须在同一事务创建 Debate 和 `version_number=1/edit_type=creation/is_current=true` 的初始 Revision，再回写 `CurrentRevisionID`。`SaveWiki` 必须锁定 `debates` 行和当前 `revisions` 行，比较 `BaseRevisionID`，创建 approved/current 新版本，取消旧 `is_current`，更新 Debate 当前快照。所有登录且活跃的用户均可编辑；归档或有效 `ContentProtection{ContentType:"debate", ProtectionLevel:"full"}` 时只允许管理员。

```go
if req.BaseRevisionID != current.ID {
	return model.Debate{}, newEditConflict(current, req.BaseRevisionID)
}
if strings.TrimSpace(req.Title) == "" || strings.TrimSpace(req.EditSummary) == "" {
	return model.Debate{}, apperr.BadRequest("validation.invalid_request", "title and edit_summary are required")
}
```

HTTP 层把 `newEditConflict` 固定编码为 409：

```json
{
  "code": "debate.edit_conflict",
  "error": "辩题已被其他人更新",
  "data": {
    "base_revision_id": "01900000-0000-7000-8000-000000000001",
    "current_revision_id": "01900000-0000-7000-8000-000000000002"
  }
}
```

前端用这两个 ID 拉取基础版和当前版，并把仍在本地的草稿作为第三方差异，不要求服务端回传草稿。

- [ ] **Step 5: 实现版本列表、差异和回退**

复用 `model.Revision`，限定 `content_type = 'debate'`。差异响应固定为 `title/description/content/tags` 四个字段；回退读取目标快照并通过与 `SaveWiki` 相同的事务入口生成 `edit_type='revert'` 新版本。

- [ ] **Step 6: 实现归档和临时保护**

归档仅管理员可执行，设置 `status='archived'`；保护复用 `model.ContentProtection`，写入 `content_type='debate'`、`protection_level='full'` 和可选 `expires_at`。保护不阻止阅读、投票和评论。

- [ ] **Step 7: 运行 Wiki 服务测试**

Run: `cd /root/Atoman/Atoman-Backend && go test ./internal/modules/debate -run 'Wiki|Archive|Protection' -count=1`

Expected: PASS。

- [ ] **Step 8: 提交 Wiki 服务**

```bash
cd /root/Atoman/Atoman-Backend
git add internal/modules/debate/wiki.go internal/modules/debate/wiki_test.go internal/modules/debate/dto.go internal/modules/debate/service.go internal/modules/debate/repo.go
git commit -m "feat(debate): add wiki revision workflow"
```

## Task 4: 从正文同步关系并阻止循环

**Files:**
- Create: `Atoman-Backend/internal/modules/debate/references.go`
- Create: `Atoman-Backend/internal/modules/debate/references_test.go`
- Create: `Atoman-Backend/internal/modules/debate/resource_resolvers.go`
- Create: `Atoman-Backend/internal/modules/debate/resource_resolvers_test.go`
- Modify: `Atoman-Backend/internal/modules/debate/wiki.go`

- [ ] **Step 1: 写引用校验、去重、冲突和循环失败测试**

```go
func TestSaveWikiProjectsDebateReferencesFromBody(t *testing.T) {
	service, user, target, current := seededWikiService(t)
	source := seedConcludedDebate(t, service, user, model.DebateVoteYes)
	content := fmt.Sprintf("依据 @debate:%s:support，再次参考 @debate:%s:support。", source.ID, source.ID)
	_, err := service.SaveWiki(user, target.ID, UpdateDebateRequest{Title: target.Title, Content: content, EditSummary: "加入论据", BaseRevisionID: current.ID})
	if err != nil { t.Fatal(err) }
	var relations []model.DebateRelation
	if err := service.db.Where("target_debate_id = ? AND status = ?", target.ID, model.DebateReferenceActive).Find(&relations).Error; err != nil { t.Fatal(err) }
	if len(relations) != 1 || relations[0].SourceDebateID != source.ID { t.Fatalf("relations = %#v", relations) }
}

func TestSaveWikiRejectsOppositeDuplicateAndDirectedCycle(t *testing.T) {
	service, user, a, aRevision := seededWikiService(t)
	concludeDebateForTest(t, service.db, &a, model.DebateVoteYes)
	b := seedConcludedDebate(t, service, user, model.DebateVoteYes)
	conflict := fmt.Sprintf("@debate:%s:support @debate:%s:oppose", b.ID, b.ID)
	if _, err := service.SaveWiki(user, a.ID, UpdateDebateRequest{Title: a.Title, Content: conflict, EditSummary: "冲突", BaseRevisionID: aRevision.ID}); apperr.Code(err) != "debate.reference_conflict" { t.Fatalf("err = %v", err) }
	seedActiveRelation(t, service.db, a, b, model.DebateRelationSupport)
	cycle := fmt.Sprintf("@debate:%s:support", b.ID)
	if _, err := service.SaveWiki(user, a.ID, UpdateDebateRequest{Title: a.Title, Content: cycle, EditSummary: "循环", BaseRevisionID: aRevision.ID}); apperr.Code(err) != "debate.reference_cycle" { t.Fatalf("err = %v", err) }
}

func seedConcludedDebate(t *testing.T, service *Service, user authctx.CurrentUser, direction string) model.Debate {
	t.Helper()
	debate, err := service.CreateDebate(user, CreateDebateRequest{Title: "来源辩题 " + uuid.NewString(), Content: "已有证据"})
	if err != nil { t.Fatal(err) }
	concludeDebateForTest(t, service.db, &debate, direction)
	return debate
}

func concludeDebateForTest(t *testing.T, db *gorm.DB, debate *model.Debate, direction string) {
	t.Helper()
	event := model.DebateConclusionEvent{DebateID: debate.ID, Direction: direction, YesVotes: 8, NoVotes: 2, TotalVotes: 10}
	if direction == model.DebateVoteNo { event.YesVotes, event.NoVotes = 2, 8 }
	if err := db.Create(&event).Error; err != nil { t.Fatal(err) }
	if err := db.Model(debate).Updates(map[string]any{"conclusion_type": direction, "current_conclusion_event_id": event.ID}).Error; err != nil { t.Fatal(err) }
	debate.ConclusionType = direction
	debate.CurrentConclusionEventID = &event.ID
}

func seedActiveRelation(t *testing.T, db *gorm.DB, source, target model.Debate, stance string) model.DebateRelation {
	t.Helper()
	relation := model.DebateRelation{
		SourceDebateID: source.ID, TargetDebateID: target.ID, Stance: stance,
		TargetRevisionID: *target.CurrentRevisionID, SourceConclusionEventID: *source.CurrentConclusionEventID,
		Status: model.DebateReferenceActive,
	}
	if err := db.Create(&relation).Error; err != nil { t.Fatal(err) }
	return relation
}
```

- [ ] **Step 2: 运行引用测试确认失败**

Run: `cd /root/Atoman/Atoman-Backend && go test ./internal/modules/debate -run 'Reference|Cycle' -count=1`

Expected: FAIL。

- [ ] **Step 3: 注册全部已确认资源类型的 resolver**

`resource_resolvers.go` 构造 `resourceref.Registry`，为 `post/thread/debate/feed/article/artist/album/song/playlist/podcast/episode/video/person/event/channel/collection/comment` 分别注册查询。resolver 使用对应 model 或表查询 ID 和显示标题，并执行现有可见性规则；`podcast` 映射节目频道，`episode` 映射 `PodcastEpisode`，`comment` 只允许状态可见的 `CommentEntry`。测试逐一断言 17 个类型均已注册，并至少覆盖一个公开资源、一个私有资源和一个不存在资源。

```go
func newResourceRegistry(db *gorm.DB) *resourceref.Registry {
	registry := resourceref.NewRegistry()
	registerContentResolvers(registry, db)
	registerMusicResolvers(registry, db)
	registerTimelineResolvers(registry, db)
	registerDiscussionResolvers(registry, db)
	return registry
}
```

- [ ] **Step 4: 实现资源校验与引用快照**

先调用 `resourceref.Parse(req.Title)`，只要标题含资源标记就返回 `debate.title_reference_forbidden`；再解析 `req.Content`。所有新增普通资源必须存在且对目标辩题的公开读者可见；新增辩题资源还必须满足：状态不是 archived、有当前结论事件、不是当前辩题本身。按 `(kind,id,qualifier)` 保存每个出现位置到 `DebateRevisionReference`。

校验时同时读取基础版本引用快照。基础版本中已有的 stale/unavailable 标记只要相同 `(kind,id,qualifier)` 出现次数没有增加，就允许随其他正文一起保存并继承原状态；新增的无效标记仍阻止保存。

- [ ] **Step 5: 实现关系投影差异同步**

对辩题引用按来源 ID 聚合：同一方向多次只产生一条 `DebateRelation`；双方向返回 `debate.reference_conflict`。以新版本引用集合为准创建、更新或删除目标辩题的关系投影。真正新增或改变方向的引用绑定来源当前事件；从基础版本继承的 stale/unavailable 引用继续绑定原事件和原状态，普通保存不得将它重新激活。

- [ ] **Step 6: 实现有向循环检测**

在写入前加载全部 `active` 关系，先排除当前目标的旧入边，再加入候选边。对每条 `source -> target` 候选边，从 `target` 深度优先搜索 `source`；可达即返回包含节点 ID 的 `debate.reference_cycle`。

- [ ] **Step 7: 实现失效引用重新确认**

`ReconfirmReference(user, targetDebateID, relationID, baseRevisionID)` 必须创建正文不变的新 Revision 和引用快照，将指定 stale 关系绑定来源最新结论事件；其他 stale 引用保持 stale。普通正文保存不得隐式重新激活 stale 关系。

- [ ] **Step 8: 运行引用与 Wiki 事务测试**

Run: `cd /root/Atoman/Atoman-Backend && go test ./internal/modules/debate -run 'Reference|Cycle|Reconfirm|SaveWiki' -count=1`

Expected: PASS，故意制造投影写入错误时正文版本也回滚。

- [ ] **Step 9: 提交引用投影**

```bash
cd /root/Atoman/Atoman-Backend
git add internal/modules/debate/references.go internal/modules/debate/references_test.go internal/modules/debate/resource_resolvers.go internal/modules/debate/resource_resolvers_test.go internal/modules/debate/wiki.go
git commit -m "feat(debate): derive relations from wiki content"
```

## Task 5: 实现社区投票和动态结论

**Files:**
- Modify: `Atoman-Backend/internal/modules/debate_voting/service.go`
- Modify: `Atoman-Backend/internal/modules/debate_voting/service_test.go`
- Modify: `Atoman-Backend/internal/modules/debate_voting/http.go`
- Modify: `Atoman-Backend/internal/modules/debate_voting/http_test.go`

- [ ] **Step 1: 用表格测试锁定四分之三边界**

```go
func TestConclusionDirectionRequiresTenVotesAndStrictlyMoreThanThreeQuarters(t *testing.T) {
	tests := []struct{ yes, no int; want string }{
		{7, 2, ""}, {7, 3, ""}, {8, 2, "yes"}, {9, 3, ""}, {10, 2, "yes"}, {2, 8, "no"},
	}
	for _, tt := range tests {
		if got := conclusionDirection(tt.yes, tt.no); got != tt.want {
			t.Fatalf("conclusionDirection(%d,%d)=%q want %q", tt.yes, tt.no, got, tt.want)
		}
	}
}
```

- [ ] **Step 2: 写结论反转会使旧关系失效的测试**

先建立 yes 结论事件和一条绑定该事件的 active 出边，再将投票改到 no 超过四分之三；断言新事件为 no、Debate 当前事件已切换、旧边状态为 stale。

- [ ] **Step 3: 运行投票测试确认失败**

Run: `cd /root/Atoman/Atoman-Backend && go test ./internal/modules/debate_voting -count=1`

Expected: FAIL，因为当前服务仍投给 Argument。

- [ ] **Step 4: 实现直接辩题投票状态机**

```go
func conclusionDirection(yesVotes, noVotes int) string {
	total := yesVotes + noVotes
	if total < 10 { return "" }
	if yesVotes*4 > total*3 { return model.DebateVoteYes }
	if noVotes*4 > total*3 { return model.DebateVoteNo }
	return ""
}
```

`SetVote` 在事务中锁定 Debate，按 `(debate_id,user_id)` upsert `yes/no`，重新统计。无当前结论时达到门槛则创建事件；已有结论时仅在反方向达到门槛才反转。反转和 `UPDATE debate_relations SET status='stale' WHERE source_debate_id=? AND status='active'` 必须同事务。

- [ ] **Step 5: 改造 HTTP 接口**

固定接口：

```text
GET    /api/v1/debate/topics/:debateID/votes
PUT    /api/v1/debate/topics/:debateID/vote      {"direction":"yes|no"}
DELETE /api/v1/debate/topics/:debateID/vote
GET    /api/v1/debate/topics/:debateID/conclusions
```

响应包含 `yes_votes`、`no_votes`、`total_votes`、`current_direction`、`current_user_vote`。

- [ ] **Step 6: 运行投票包测试**

Run: `cd /root/Atoman/Atoman-Backend && go test ./internal/modules/debate_voting -count=1`

Expected: PASS。

- [ ] **Step 7: 提交投票状态机**

```bash
cd /root/Atoman/Atoman-Backend
git add internal/modules/debate_voting
git commit -m "feat(debate): form conclusions from community votes"
```

## Task 6: 提供只读图谱和 Wiki HTTP API，删除旧接口

**Files:**
- Create: `Atoman-Backend/internal/modules/debate/graph.go`
- Create: `Atoman-Backend/internal/modules/debate/graph_test.go`
- Modify: `Atoman-Backend/internal/modules/debate/dto.go`
- Modify: `Atoman-Backend/internal/modules/debate/http.go`
- Modify: `Atoman-Backend/internal/modules/debate/http_test.go`
- Modify: `Atoman-Backend/internal/modules/debate/service.go`
- Modify: `Atoman-Backend/internal/modules/debate/repo.go`
- Modify: `Atoman-Backend/internal/app/router_test.go`
- Modify: `Atoman-Backend/internal/handlers/swagger_types.go`
- Modify: `Atoman-Backend/docs/docs.go`
- Modify: `Atoman-Backend/docs/swagger.json`
- Modify: `Atoman-Backend/docs/swagger.yaml`

- [ ] **Step 1: 写树和关系图深度测试**

```go
func TestGetDebateGraphUsesSupportOnlyForTreeAndBothStancesForGraph(t *testing.T) {
	service, root, supportChain, oppose := seededGraphService(t)
	tree, err := service.GetDebateGraph(root.ID, GraphQuery{View: "tree", Depth: 3})
	if err != nil { t.Fatal(err) }
	if containsRelation(tree.Relations, oppose.ID) { t.Fatal("tree contains oppose relation") }
	if len(tree.Nodes) != len(supportChain)+1 { t.Fatalf("tree nodes=%d", len(tree.Nodes)) }
	graph, err := service.GetDebateGraph(root.ID, GraphQuery{View: "graph", Depth: 2})
	if err != nil { t.Fatal(err) }
	if !containsRelation(graph.Relations, oppose.ID) { t.Fatal("graph omitted oppose relation") }
}

func seededGraphService(t *testing.T) (*Service, model.Debate, []model.Debate, model.DebateRelation) {
	t.Helper()
	service, user := emptyWikiService(t)
	root := seedConcludedDebate(t, service, user, model.DebateVoteYes)
	direct := seedConcludedDebate(t, service, user, model.DebateVoteYes)
	indirect := seedConcludedDebate(t, service, user, model.DebateVoteYes)
	opposer := seedConcludedDebate(t, service, user, model.DebateVoteNo)
	seedActiveRelation(t, service.db, direct, root, model.DebateRelationSupport)
	seedActiveRelation(t, service.db, indirect, direct, model.DebateRelationSupport)
	opposition := seedActiveRelation(t, service.db, opposer, root, model.DebateRelationOppose)
	return service, root, []model.Debate{direct, indirect}, opposition
}

func containsRelation(relations []model.DebateRelation, id uuid.UUID) bool {
	for _, relation := range relations {
		if relation.ID == id { return true }
	}
	return false
}
```

- [ ] **Step 2: 运行图谱测试确认失败**

Run: `cd /root/Atoman/Atoman-Backend && go test ./internal/modules/debate -run Graph -count=1`

Expected: FAIL，因为当前 tree 会返回 oppose 且没有深度参数。

- [ ] **Step 3: 实现 BFS 深度查询**

`tree` 仅查询 `status='active' AND stance='support' AND target_debate_id IN frontier`，默认深度 3；`graph` 查询活动关系两个方向，默认深度 2。响应增加 `expandable_node_ids`，表示边界节点仍存在未加载活动关系。

- [ ] **Step 4: 替换 HTTP 路由**

保留并规范：

```text
GET    /api/v1/debate/topics
POST   /api/v1/debate/topics
GET    /api/v1/debate/topics/:id
PUT    /api/v1/debate/topics/:id
POST   /api/v1/debate/topics/:id/archive
GET    /api/v1/debate/topics/:id/revisions
GET    /api/v1/debate/topics/:id/revisions/:revisionID
GET    /api/v1/debate/topics/:id/revisions/:revisionID/diff?against=:otherRevisionID
POST   /api/v1/debate/topics/:id/revisions/:revisionID/revert
POST   /api/v1/debate/topics/:id/references/:relationID/reconfirm
PUT    /api/v1/debate/topics/:id/protection
DELETE /api/v1/debate/topics/:id/protection
GET    /api/v1/debates/:id/relations?view=tree|graph&depth=N
```

删除所有 `/arguments`、`/debate-arguments`、`/debate-relations` 写接口、`conclude`、`reopen` 和 `conclusion-vote` 路由。

辩题详情固定返回已解析引用，供正文行内块和重新确认使用：

```go
type DebateReferenceDTO struct {
	Raw string `json:"raw"`
	Kind string `json:"kind"`
	ResourceID uuid.UUID `json:"resource_id"`
	Title string `json:"title"`
	Qualifier string `json:"qualifier"`
	State string `json:"state"`
	RelationID *uuid.UUID `json:"relation_id,omitempty"`
}
```

`RelationID` 只在 `kind=debate` 时存在；stale 关系仍返回到正文引用列表，但不进入树或关系图。

- [ ] **Step 5: 更新 HTTP 与路由测试**

断言旧写路由返回 404，新 update 在无认证时返回 401、无效引用返回 400、基础版本冲突返回 409、diff 固定返回 `title/description/content/tags` 四字段、保护接口只允许管理员、图谱接口不会修改关系。

- [ ] **Step 6: 重新生成 Swagger**

Run: `cd /root/Atoman/Atoman-Backend && swag init -g cmd/start_server/main.go -o docs`

Expected: 文档只包含新辩题接口，不再出现 argument 或直接 relation mutation。

- [ ] **Step 7: 运行后端辩论相关测试和构建**

Run: `cd /root/Atoman/Atoman-Backend && go test ./internal/modules/debate ./internal/modules/debate_voting ./internal/app ./cmd/migrate ./cmd/start_server -count=1`

Expected: PASS。

Run: `cd /root/Atoman/Atoman-Backend && go build ./...`

Expected: exit 0。

- [ ] **Step 8: 提交 HTTP 与图谱**

```bash
cd /root/Atoman/Atoman-Backend
git add internal/modules/debate internal/app/router_test.go internal/handlers/swagger_types.go docs/docs.go docs/swagger.json docs/swagger.yaml
git commit -m "feat(debate): expose wiki and read-only graph APIs"
```

## Task 7: 收敛前端类型与 Pinia Store

**Files:**
- Modify: `Atoman-Frontend/src/types.ts`
- Rewrite: `Atoman-Frontend/src/stores/debate.ts`
- Modify: `Atoman-Frontend/tests/unit/stores/debate.spec.ts`

- [ ] **Step 1: 写 Store API 失败测试**

```ts
it('saves a wiki revision with base_revision and edit_summary', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ data: debate }), { status: 200 }))
  const store = useDebateStore()
  await store.saveWiki('debate-1', {
    title: '是否采用四天工作制？', description: '', content: '正文', tags: [],
    edit_summary: '补充说明', base_revision: 'revision-1',
  })
  expect(fetch).toHaveBeenCalledWith('/api/v1/debate/topics/debate-1', expect.objectContaining({
    method: 'PUT', body: expect.stringContaining('"base_revision":"revision-1"'),
  }))
})

it('sets a direct debate vote', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ data: voteSummary }), { status: 200 }))
  await useDebateStore().setVote('debate-1', 'yes')
  expect(fetch).toHaveBeenCalledWith('/api/v1/debate/topics/debate-1/vote', expect.objectContaining({ method: 'PUT' }))
})
```

- [ ] **Step 2: 运行 Store 测试确认失败**

Run: `cd /root/Atoman/Atoman-Frontend && bun run test:unit -- tests/unit/stores/debate.spec.ts --maxWorkers=1`

Expected: FAIL，缺少 `saveWiki/setVote`。

- [ ] **Step 3: 替换辩题类型**

先增加新类型；为保证本次提交可编译，旧 `Argument`、`ArgumentType`、旧 `DebateVote` 和旧关闭状态字段暂时保留并标记 `@deprecated`，任务 11 在删除最后调用方后统一移除。增加：

```ts
export type DebateVoteDirection = 'yes' | 'no'
export type DebateReferenceState = 'active' | 'stale' | 'unavailable'
export type ResourceKind = 'post' | 'thread' | 'debate' | 'feed' | 'article' | 'artist' | 'album' | 'song' | 'playlist' | 'podcast' | 'episode' | 'video' | 'person' | 'event' | 'channel' | 'collection' | 'comment'
export interface DebateVoteSummary {
  yes_votes: number; no_votes: number; total_votes: number
  current_direction: DebateVoteDirection | ''
  current_user_vote: DebateVoteDirection | ''
}
export interface DebateRevision {
  id: string; content_id: string; version_number: number; previous_revision_id?: string
  editor_id: string; edit_summary: string; edit_type: 'creation' | 'edit' | 'revert'
  content_snapshot: { title: string; description: string; content: string; tags: string[] }
  created_at: string
}
export interface DebateReference {
  raw: string; kind: ResourceKind; resource_id: string; title: string
  qualifier: '' | 'support' | 'oppose'; state: DebateReferenceState; relation_id?: string
}
export interface Debate {
  id: string; user_id: string; title: string; description: string; content: string
  status: 'active' | 'archived' | 'open' | 'concluded'; tags: string[]; view_count: number
  conclusion_type: DebateVoteDirection | ''; current_revision_id?: string
  current_conclusion_event_id?: string; references?: DebateReference[]
  /** @deprecated 任务 11 删除。 */ argument_count?: number
  /** @deprecated 任务 11 删除。 */ vote_count?: number
  created_at: string; updated_at: string
}
export type WikiSaveResult =
  | { ok: true; debate: Debate }
  | { ok: false; conflict: { base_revision_id: string; current_revision_id: string } }
```

- [ ] **Step 4: 重写 Store 为明确资源状态**

新增 debates、currentDebate、voteSummary、relationGraph、revisions、loading/error 状态，实现 `fetchDebate`、`saveWiki`、`fetchRevisions`、`revertRevision`、`reconfirmReference`、`fetchVotes`、`setVote`、`removeVote`、`fetchRelationGraph(id, view, depth)`。旧 Argument、直接 relation、conclude/reopen 方法暂时保留为兼容层，任务 11 删除。

- [ ] **Step 5: 运行 Store 测试和类型检查**

Run: `cd /root/Atoman/Atoman-Frontend && bun run test:unit -- tests/unit/stores/debate.spec.ts --maxWorkers=1`

Expected: PASS。

Run: `cd /root/Atoman/Atoman-Frontend && bun run type-check`

Expected: PASS；不允许提交一个无法通过类型检查的中间状态。

- [ ] **Step 6: 提交类型与 Store**

```bash
cd /root/Atoman/Atoman-Frontend
git add src/types.ts src/stores/debate.ts tests/unit/stores/debate.spec.ts
git commit -m "refactor(debate): align client state with wiki APIs"
```

## Task 8: 在编辑器实现全站资源行内引用块

**Files:**
- Create: `Atoman-Frontend/src/utils/resourceReferences.ts`
- Create: `Atoman-Frontend/src/components/shared/editor/resourceReferenceExtension.ts`
- Modify: `Atoman-Frontend/src/components/shared/PEditor.vue`
- Modify: `Atoman-Frontend/src/components/shared/PEditorRuntime.vue`
- Create: `Atoman-Frontend/tests/unit/utils/resourceReferences.spec.ts`
- Modify: `Atoman-Frontend/tests/unit/components/PEditor.spec.ts`

- [ ] **Step 1: 写前端解析与编辑器失败测试**

```ts
it('parses resource references without treating @username as a resource', () => {
  expect(parseResourceReferences('@alice @debate:01900000-0000-7000-8000-000000000001:support')).toEqual([
    expect.objectContaining({ kind: 'debate', id: '01900000-0000-7000-8000-000000000001', qualifier: 'support' }),
  ])
})

it('renders a resolved resource as an inline chip while retaining raw text', async () => {
  const raw = '@album:01900000-0000-7000-8000-000000000001'
  const wrapper = mount(PEditor, { props: {
    modelValue: raw, mode: 'normal', enableResourceReferences: true,
    resourceReferenceLabels: { 'album:01900000-0000-7000-8000-000000000001': { title: 'Kind of Blue' } },
  } })
  await vi.dynamicImportSettled()
  await nextTick()
  expect(wrapper.find('[data-resource-reference="album:01900000-0000-7000-8000-000000000001"]').text()).toContain('Kind of Blue')
  wrapper.vm.replaceDocument(`${raw}\n补充说明`)
  await nextTick()
  expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([`${raw}\n补充说明`])
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /root/Atoman/Atoman-Frontend && bun run test:unit -- tests/unit/utils/resourceReferences.spec.ts tests/unit/components/PEditor.spec.ts --maxWorkers=1`

Expected: FAIL。

- [ ] **Step 3: 实现与后端一致的纯解析函数**

```ts
import type { ResourceKind } from '@/types'

export const resourceKinds = ['post','thread','debate','feed','article','artist','album','song','playlist','podcast','episode','video','person','event','channel','collection','comment'] as const satisfies readonly ResourceKind[]
export interface ResourceReference { raw: string; kind: ResourceKind; id: string; qualifier: '' | 'support' | 'oppose'; from: number; to: number }
export function parseResourceReferences(content: string): ResourceReference[] {
  const pattern = /@([a-z]+):([0-9a-fA-F-]{36})(?::([a-z]+))?/g
  return [...content.matchAll(pattern)].flatMap((match) => {
    if (!resourceKinds.includes(match[1] as ResourceKind)) return []
    const qualifier = (match[3] ?? '') as ResourceReference['qualifier']
    if (match[1] === 'debate' ? !['support', 'oppose'].includes(qualifier) : qualifier !== '') return []
    return [{ raw: match[0], kind: match[1] as ResourceKind, id: match[2], qualifier, from: match.index, to: match.index + match[0].length }]
  })
}
```

- [ ] **Step 4: 实现 CodeMirror replacement decoration**

`resourceReferenceExtension.ts` 使用 `WidgetType` 和 `Decoration.replace`。光标不在标记内时显示标题、资源类型和关系；光标进入标记范围时恢复原始文本，保证可编辑和复制源码。Widget 必须设置 `data-resource-reference="kind:id"` 和 stale/unavailable 状态类。

- [ ] **Step 5: 给 PEditor 增加显式能力开关**

新增 props：

```ts
enableResourceReferences?: boolean
resourceReferenceLabels?: Record<string, { title: string; state?: 'active' | 'stale' | 'unavailable'; qualifierLabel?: string }>
```

默认关闭，避免改变博客和论坛编辑器。开启时把 extension 加入 CodeMirror extensions，并在 labels 变化时通过 StateEffect 刷新 decoration。

- [ ] **Step 6: 运行编辑器测试**

Run: `cd /root/Atoman/Atoman-Frontend && bun run test:unit -- tests/unit/utils/resourceReferences.spec.ts tests/unit/components/PEditor.spec.ts --maxWorkers=1`

Expected: PASS。

- [ ] **Step 7: 提交共享引用编辑器**

```bash
cd /root/Atoman/Atoman-Frontend
git add src/utils/resourceReferences.ts src/components/shared/editor/resourceReferenceExtension.ts src/components/shared/PEditor.vue src/components/shared/PEditorRuntime.vue tests/unit/utils/resourceReferences.spec.ts tests/unit/components/PEditor.spec.ts
git commit -m "feat(editor): render typed resource references inline"
```

## Task 9: 实现辩题 Wiki 编辑、版本与冲突侧层

**Files:**
- Create: `Atoman-Frontend/src/components/debate/DebateWikiEditor.vue`
- Create: `Atoman-Frontend/src/components/debate/DebateRevisionSheet.vue`
- Create: `Atoman-Frontend/src/components/debate/DebateDiscussionSheet.vue`
- Create: `Atoman-Frontend/tests/unit/components/debate/DebateWikiEditor.spec.ts`
- Create: `Atoman-Frontend/tests/unit/components/debate/DebateRevisionSheet.spec.ts`

- [ ] **Step 1: 写编辑器插入引用与冲突保留草稿测试**

```ts
it('inserts a concluded debate reference with the chosen relation', async () => {
  const sourceId = '01900000-0000-7000-8000-000000000001'
  const revisionId = '01900000-0000-7000-8000-000000000010'
  const wrapper = mount(DebateWikiEditor, { props: { debate, currentRevisionId: revisionId } })
  await wrapper.get('[data-test="insert-reference"]').trigger('click')
  await wrapper.get('[data-test="reference-search"]').setValue('通勤')
  await flushPromises()
  await wrapper.get(`[data-test="reference-result-${sourceId}"]`).trigger('click')
  await wrapper.get('[data-test="reference-stance-support"]').trigger('click')
  await wrapper.get('[data-test="confirm-reference"]').trigger('click')
  expect(wrapper.emitted('update:content')?.at(-1)?.[0]).toContain(`@debate:${sourceId}:support`)
})

it('keeps the draft open when save returns an edit conflict', async () => {
  const revisionId = '01900000-0000-7000-8000-000000000010'
  const conflictPayload = {
    base_revision_id: revisionId,
    current_revision_id: '01900000-0000-7000-8000-000000000011',
  }
  vi.spyOn(useDebateStore(), 'saveWiki').mockResolvedValue({ ok: false, conflict: conflictPayload })
  const wrapper = mount(DebateWikiEditor, { props: { debate, currentRevisionId: revisionId } })
  await wrapper.get('[data-test="save-wiki"]').trigger('click')
  expect(wrapper.get('[data-test="wiki-conflict"]').exists()).toBe(true)
  expect(wrapper.get('textarea').element.value).toContain(debate.content)
})
```

- [ ] **Step 2: 运行组件测试确认失败**

Run: `cd /root/Atoman/Atoman-Frontend && bun run test:unit -- tests/unit/components/debate/DebateWikiEditor.spec.ts tests/unit/components/debate/DebateRevisionSheet.spec.ts --maxWorkers=1`

Expected: FAIL。

- [ ] **Step 3: 实现 Wiki 编辑侧层**

使用 `PSheet`、`PInput`、`PEditor` 和编辑摘要输入。所有登录用户显示编辑入口。引用按钮调用 `searchCitableDebates`，只展示已有结论且未归档辩题，确认后插入标准标记。保存发送 `base_revision/edit_summary`；409 时保留草稿并展示基础、当前、草稿三方差异。

- [ ] **Step 4: 实现版本侧层**

列表展示版本号、编辑者、摘要和时间；选择两个版本显示四字段差异；回退要求填写摘要并发送当前 base revision。回退成功后刷新辩题、版本、引用图。

- [ ] **Step 5: 实现讨论侧层**

只封装：

```vue
<PSheet :show="show" title="讨论" @close="$emit('close')">
  <CommentSection :target="{ kind: 'debate', resourceId: debateId }" noun="讨论" />
</PSheet>
```

- [ ] **Step 6: 运行组件测试**

Run: `cd /root/Atoman/Atoman-Frontend && bun run test:unit -- tests/unit/components/debate/DebateWikiEditor.spec.ts tests/unit/components/debate/DebateRevisionSheet.spec.ts --maxWorkers=1`

Expected: PASS。

- [ ] **Step 7: 提交 Wiki 前端**

```bash
cd /root/Atoman/Atoman-Frontend
git add src/components/debate/DebateWikiEditor.vue src/components/debate/DebateRevisionSheet.vue src/components/debate/DebateDiscussionSheet.vue tests/unit/components/debate/DebateWikiEditor.spec.ts tests/unit/components/debate/DebateRevisionSheet.spec.ts
git commit -m "feat(debate): add wiki editing and revision sheets"
```

## Task 10: 实现投票面板和聚焦式详情页

**Files:**
- Create: `Atoman-Frontend/src/components/debate/DebateVotePanel.vue`
- Create: `Atoman-Frontend/tests/unit/components/debate/DebateVotePanel.spec.ts`
- Rewrite: `Atoman-Frontend/src/views/debate/DebateTopicView.vue`
- Modify: `Atoman-Frontend/src/views/debate/DebateHomeView.vue`
- Modify: `Atoman-Frontend/tests/unit/views/debate/DebateTopicView.relations.spec.ts`
- Modify: `Atoman-Frontend/tests/unit/views/debate/DebateHomeView.nodes.spec.ts`

- [ ] **Step 1: 写投票持续开放和页面标签测试**

```ts
it('allows changing vote after a conclusion exists', async () => {
  const wrapper = mount(DebateVotePanel, { props: { summary: { yes_votes: 32, no_votes: 9, total_votes: 41, current_direction: 'yes', current_user_vote: 'yes' } } })
  await wrapper.get('[data-test="vote-no"]').trigger('click')
  expect(wrapper.emitted('vote')).toEqual([['no']])
})

it('uses content tree and graph as the three primary tabs', async () => {
  const wrapper = shallowMount(DebateTopicView, {
    global: {
      stubs: {
        PButton: { template: '<button><slot /></button>' },
        DebateVotePanel: true,
        DebateRelationGraph: true,
        DebateWikiEditor: true,
        DebateRevisionSheet: true,
        DebateDiscussionSheet: true,
      },
    },
  })
  await flushPromises()
  expect(wrapper.findAll('[role="tab"]').map((item) => item.text())).toEqual(['正文', '辩论树', '关系图'])
  expect(wrapper.find('[data-test="direct-relation-action"]').exists()).toBe(false)
})

it('separates archive state from conclusion on the debate home page', async () => {
  const wrapper = shallowMount(DebateHomeView, {
    global: {
      stubs: {
        PSelect: {
          props: ['options'],
          template: '<select data-test="status-filter" :data-options="options.map((option) => option.value).join(\',\')" />',
        },
      },
    },
  })
  await flushPromises()
  expect(wrapper.find('[data-test="status-filter"]').attributes('data-options')).toBe('active,archived')
  expect(wrapper.text()).not.toContain('已结题')
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /root/Atoman/Atoman-Frontend && bun run test:unit -- tests/unit/components/debate/DebateVotePanel.spec.ts tests/unit/views/debate/DebateTopicView.relations.spec.ts --maxWorkers=1`

Expected: FAIL。

- [ ] **Step 3: 实现投票面板**

面板固定尺寸，显示当前方向、总参与数、两侧票数和两个可切换按钮；达到结论后不禁用。未登录点击时跳转登录。使用 `yes/no` 作为 API 值，用户文案集中在组件常量中，不把内部枚举直接显示给用户。

- [ ] **Step 4: 重写详情页为聚焦式组合页**

顶部保留返回、标题、当前结论和 Wiki 元信息；动作只包含编辑、版本、讨论。主区使用三标签：正文渲染行内资源引用，辩论树和关系图分别加载。移除直接引用弹窗、结题、申请结题、重开和内嵌评论长页。

- [ ] **Step 5: 更新辩题首页状态语义**

`DebateHomeView` 的筛选只保留 `active/archived`，卡片把归档状态和当前结论分开显示；移除 `ArgumentCount`、“进行中/已结题”和按 concluded 筛选的旧逻辑。创建辩题仍只填写标题、正文和标签，成功响应必须带版本 1 的 `current_revision_id`。

- [ ] **Step 6: 接入 stale 引用重新确认**

正文渲染器遇到 stale 引用块时显示“来源结论已变化”和重新确认按钮；成功后刷新正文当前版本与图谱。unavailable 仅显示不可用，不提供确认。

- [ ] **Step 7: 运行详情页和首页测试**

Run: `cd /root/Atoman/Atoman-Frontend && bun run test:unit -- tests/unit/components/debate/DebateVotePanel.spec.ts tests/unit/views/debate/DebateTopicView.relations.spec.ts tests/unit/views/debate/DebateHomeView.nodes.spec.ts --maxWorkers=1`

Expected: PASS。

- [ ] **Step 8: 提交投票与页面**

```bash
cd /root/Atoman/Atoman-Frontend
git add src/components/debate/DebateVotePanel.vue tests/unit/components/debate/DebateVotePanel.spec.ts src/views/debate/DebateTopicView.vue src/views/debate/DebateHomeView.vue tests/unit/views/debate/DebateTopicView.relations.spec.ts tests/unit/views/debate/DebateHomeView.nodes.spec.ts
git commit -m "feat(debate): build focused wiki debate page"
```

## Task 11: 限深展开树和关系图并删除旧组件

**Files:**
- Modify: `Atoman-Frontend/src/components/debate/DebateRelationGraph.vue`
- Modify: `Atoman-Frontend/src/components/debate/DebateGraphNode.vue`
- Modify: `Atoman-Frontend/src/components/debate/debateGraph.ts`
- Modify: `Atoman-Frontend/src/stores/debate.ts`
- Modify: `Atoman-Frontend/src/types.ts`
- Modify: `Atoman-Frontend/tests/unit/components/debate/DebateGraphNode.spec.ts`
- Modify: `Atoman-Frontend/tests/unit/components/debate/debateGraph.spec.ts`
- Delete: `Atoman-Frontend/src/components/debate/ArgumentNode.vue`
- Delete: `Atoman-Frontend/src/components/debate/DebateConcludeModal.vue`
- Delete: `Atoman-Frontend/src/components/debate/DebateHeaderActions.vue`
- Delete: `Atoman-Frontend/tests/unit/components/debate/ArgumentNode.spec.ts`

- [ ] **Step 1: 写纵向树、双关系图和继续展开测试**

```ts
it('lays out tree roots above incoming support nodes and exposes expandable nodes', () => {
  const flow = buildDebateFlow(graph, { view: 'tree' })
  expect(flow.edges.every((edge) => edge.data?.stance === 'support')).toBe(true)
  expect(flow.nodes.find((node) => node.id === graph.root_id)!.position.y).toBeLessThan(flow.nodes.find((node) => node.id === 'support-1')!.position.y)
  expect(flow.nodes.find((node) => node.id === 'support-1')!.data.expandable).toBe(true)
})
```

- [ ] **Step 2: 运行图组件测试确认失败**

Run: `cd /root/Atoman/Atoman-Frontend && bun run test:unit -- tests/unit/components/debate --maxWorkers=1`

Expected: FAIL，当前 builder 没有 view/expandable 数据。

- [ ] **Step 3: 调整图数据转换**

`buildDebateFlow(graph, {view})` 在 tree 模式保持 `rankdir:'TB'` 且只接收 support；graph 模式保留两种边。节点 data 增加 `expandable`，边 data 增加 `stance`，所有节点和连线继续保持不可拖拽、不可连接。

- [ ] **Step 4: 实现按节点继续展开**

点击有 `expandable` 标记的节点时发出 `expand(nodeId)`；父页面以该节点为 root 请求 depth=1 子图，按 ID 合并 nodes/relations，并重新布局。加载状态固定在节点内部，不能改变节点尺寸。

- [ ] **Step 5: 删除旧 Argument 类型、Store 兼容层和结题组件**

删除文件、`src/types.ts` 中标记 deprecated 的 Argument/旧投票类型、`src/stores/debate.ts` 中 Argument、直接关系写入、手动结题、重开兼容方法及所有 imports。此时把 `Debate.status` 收紧为 `active|archived`，并将 `current_revision_id` 和 `references` 改为必填，删除 `argument_count/vote_count`。使用 `rg -n 'ArgumentNode|DebateConcludeModal|DebateHeaderActions|argumentList|createRelation|concludeDebate|reopenDebate' src tests` 确认无残留。

- [ ] **Step 6: 运行辩论前端测试与类型检查**

Run: `cd /root/Atoman/Atoman-Frontend && bun run test:unit -- tests/unit/components/debate tests/unit/views/debate tests/unit/stores/debate.spec.ts --maxWorkers=1`

Expected: PASS。

Run: `cd /root/Atoman/Atoman-Frontend && bun run type-check`

Expected: PASS。

- [ ] **Step 7: 提交图谱和旧组件删除**

```bash
cd /root/Atoman/Atoman-Frontend
git add src/components/debate tests/unit/components/debate src/views/debate tests/unit/views/debate src/stores/debate.ts src/types.ts
git commit -m "refactor(debate): make relation views read only"
```

## Task 12: 完成端到端验证和全量构建

**Files:**
- Create: `Atoman-Frontend/tests/e2e/helpers/debate-fixtures.ts`
- Create: `Atoman-Frontend/tests/e2e/specs/debate-wiki-relations.spec.ts`
- Modify: `Atoman-Frontend/tests/e2e/specs/debate.spec.ts`

- [ ] **Step 1: 补齐本地真实 E2E fixture**

沿用现有真实歌词 E2E 的本地 PostgreSQL 方式，在 `debate-fixtures.ts` 中定义并导出下列完整接口；只用 SQL 建立和清理 10 个独立测试用户，辩题、投票、Wiki 保存和重新确认全部调用 HTTP API：

```ts
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { expect, type APIRequestContext } from '@playwright/test'

export type DebateSession = { token: string; user: Record<string, unknown>; userId: string }
export type SeededDebate = { id: string; title: string; current_revision_id: string }
export type DebateFixture = { sessions: DebateSession[]; source: SeededDebate; target: SeededDebate }

export function requireLocalDebateFixture() {
  if (process.env.DEBATE_WIKI_E2E !== '1') throw new Error('必须设置 DEBATE_WIKI_E2E=1')
  const baseURL = new URL(process.env.PLAYWRIGHT_BASE_URL ?? '')
  if (!['localhost', '127.0.0.1', '0.0.0.0'].includes(baseURL.hostname)) {
    throw new Error(`拒绝对非本地地址执行数据库 fixture：${baseURL.origin}`)
  }
}

export async function createDebateFixture(request: APIRequestContext): Promise<DebateFixture> {
  const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`
  const password = `Debate-E2E-${randomUUID()}!`
  const sessions: DebateSession[] = []
  for (let index = 0; index < 10; index += 1) {
    const username = `debate-e2e-${index}-${suffix}`
    const userId = runPsql(`
      INSERT INTO "Users" (uuid, username, email, password, role, is_active, onboarding_completed_at, created_at, updated_at, auth_version)
      VALUES (gen_random_uuid(), ${sqlLiteral(username)}, ${sqlLiteral(`${username}@example.test`)}, crypt(${sqlLiteral(password)}, gen_salt('bf', 10)), 'user', true, now(), now(), now(), 0)
      RETURNING uuid;
    `)
    const response = await request.post('/api/v1/auth/login', { data: { username, password } })
    expect(response.status()).toBe(200)
    const body = await response.json() as { token: string; user: Record<string, unknown> }
    sessions.push({ token: body.token, user: body.user, userId })
  }

  const source = await createDebate(request, sessions[0].token, `吸烟会不会显著增加肺癌风险？ ${suffix}`)
  for (const [index, session] of sessions.entries()) {
    await setVote(request, session.token, source.id, index < 8 ? 'yes' : 'no')
  }
  const votes = await api<{ current_direction: string }>(request, 'GET', `/api/v1/debate/topics/${source.id}/votes`, sessions[0].token)
  expect(votes.current_direction).toBe('yes')
  const target = await createDebate(request, sessions[0].token, `公共场所是否应该全面禁烟？ ${suffix}`)
  return { sessions, source, target }
}

export async function saveWikiReference(request: APIRequestContext, fixture: DebateFixture) {
  return api<SeededDebate>(request, 'PUT', `/api/v1/debate/topics/${fixture.target.id}`, fixture.sessions[0].token, {
    title: fixture.target.title,
    description: '',
    content: `已有医学结论：@debate:${fixture.source.id}:support`,
    tags: [],
    edit_summary: '引用已有结论',
    base_revision: fixture.target.current_revision_id,
  })
}

export async function flipSourceConclusion(request: APIRequestContext, fixture: DebateFixture) {
  for (const session of fixture.sessions.slice(0, 8)) {
    await setVote(request, session.token, fixture.source.id, 'no')
  }
  const votes = await api<{ current_direction: string }>(request, 'GET', `/api/v1/debate/topics/${fixture.source.id}/votes`, fixture.sessions[0].token)
  expect(votes.current_direction).toBe('no')
}

export function cleanupDebateFixture(fixture: DebateFixture) {
  const debateIDs = sqlList([fixture.source.id, fixture.target.id])
  const userIDs = sqlList(fixture.sessions.map(session => session.userId))
  runPsql(`
    BEGIN;
    DELETE FROM debate_relations WHERE source_debate_id IN (${debateIDs}) OR target_debate_id IN (${debateIDs});
    DELETE FROM debate_revision_references WHERE revision_id IN (SELECT id FROM revisions WHERE content_type = 'debate' AND content_id IN (${debateIDs}));
    DELETE FROM debate_conclusion_events WHERE debate_id IN (${debateIDs});
    DELETE FROM debate_votes WHERE debate_id IN (${debateIDs});
    DELETE FROM revisions WHERE content_type = 'debate' AND content_id IN (${debateIDs});
    DELETE FROM debates WHERE id IN (${debateIDs});
    DELETE FROM "Users" WHERE uuid IN (${userIDs});
    COMMIT;
  `)
}

async function createDebate(request: APIRequestContext, token: string, title: string) {
  return api<SeededDebate>(request, 'POST', '/api/v1/debate/topics', token, { title, description: '', content: '', tags: [] })
}

async function setVote(request: APIRequestContext, token: string, debateID: string, direction: 'yes' | 'no') {
  await api(request, 'PUT', `/api/v1/debate/topics/${debateID}/vote`, token, { direction })
}

async function api<T>(request: APIRequestContext, method: string, path: string, token: string, data?: unknown): Promise<T> {
  const response = await request.fetch(path, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    ...(data === undefined ? {} : { data }),
  })
  if (!response.ok()) {
    throw new Error(`${method} ${path}: ${response.status()} ${await response.text()}`)
  }
  const body = await response.json() as T | { data: T }
  if (body !== null && typeof body === 'object' && 'data' in body) return body.data
  return body as T
}

function runPsql(sql: string) {
  return execFileSync('docker', [
    'exec', process.env.DEBATE_E2E_POSTGRES_CONTAINER ?? 'atoman-dev-postgres-1',
    'psql', '-q', '-U', process.env.DEBATE_E2E_POSTGRES_USER ?? 'atoman',
    '-d', process.env.DEBATE_E2E_POSTGRES_DB ?? 'atoman_dev',
    '-v', 'ON_ERROR_STOP=1', '-At', '-c', sql,
  ], { encoding: 'utf8' }).trim()
}

function sqlLiteral(value: string) { return `'${value.replaceAll("'", "''")}'` }
function sqlList(values: string[]) { return values.map(sqlLiteral).join(', ') }
```

- [ ] **Step 2: 写核心闭环 E2E 并改掉旧论点流程**

```ts
import { expect, test } from '../fixtures/base'
import {
  cleanupDebateFixture,
  createDebateFixture,
  flipSourceConclusion,
  requireLocalDebateFixture,
  saveWikiReference,
} from '../helpers/debate-fixtures'

test.describe('Debate wiki relation lifecycle', () => {
  test.skip(process.env.DEBATE_WIKI_E2E !== '1', 'requires local PostgreSQL and DEBATE_WIKI_E2E=1')

  test('stales and explicitly reconfirms a relation after conclusion reversal', async ({ page, request }) => {
    test.setTimeout(90_000)
    requireLocalDebateFixture()
    const fixture = await createDebateFixture(request)
    try {
      await saveWikiReference(request, fixture)
      await page.addInitScript(({ token, user }) => {
        localStorage.setItem('token', token)
        localStorage.setItem('user', JSON.stringify(user))
      }, fixture.sessions[0])

      await page.goto(`/debate/${fixture.target.id}`)
      await page.getByRole('tab', { name: '辩论树' }).click()
      await expect(page.getByText(fixture.source.title, { exact: true })).toBeVisible()

      await flipSourceConclusion(request, fixture)
      await page.getByRole('tab', { name: '正文' }).click()
      await page.reload()
      await expect(page.getByText('来源结论已变化')).toBeVisible()
      await page.getByRole('tab', { name: '辩论树' }).click()
      await expect(page.getByText(fixture.source.title, { exact: true })).toHaveCount(0)

      await page.getByRole('tab', { name: '正文' }).click()
      await page.getByRole('button', { name: '重新确认' }).click()
      await page.getByRole('tab', { name: '辩论树' }).click()
      await expect(page.getByText(fixture.source.title, { exact: true })).toBeVisible()
    } finally {
      cleanupDebateFixture(fixture)
    }
  })
})
```

同时重写现有 `tests/e2e/specs/debate.spec.ts`：删除“添加论点”和“给论点投票”用例；详情页断言 `正文 / 辩论树 / 关系图` 三个标签和“讨论”入口；直接投票用例点击辩题的正向或反向按钮；状态筛选值改为 `active/archived`。

- [ ] **Step 3: 运行后端全量测试和构建**

Run: `cd /root/Atoman/Atoman-Backend && go test ./... -count=1`

Expected: PASS。

Run: `cd /root/Atoman/Atoman-Backend && go build ./...`

Expected: exit 0。

- [ ] **Step 4: 运行前端单元测试、类型检查和构建**

Run: `cd /root/Atoman/Atoman-Frontend && bun run test:unit -- --maxWorkers=1`

Expected: PASS。

Run: `cd /root/Atoman/Atoman-Frontend && bun run type-check`

Expected: PASS。

Run: `cd /root/Atoman/Atoman-Frontend && bun run build`

Expected: exit 0；允许现有动态导入分块提示，不允许新错误。

- [ ] **Step 5: 启动本地环境并运行 E2E**

先启动根目录 PostgreSQL/MinIO、后端服务和前端开发服务器，再执行：

Run: `cd /root/Atoman/Atoman-Frontend && DEBATE_WIKI_E2E=1 PLAYWRIGHT_BASE_URL=http://localhost:<frontend-port> bun run test:e2e -- tests/e2e/specs/debate-wiki-relations.spec.ts tests/e2e/specs/debate.spec.ts`

Expected: PASS，fixture 只允许连接 localhost，结束后不残留测试辩题或用户。

- [ ] **Step 6: 检查旧能力残留**

Run: `cd /root/Atoman && rg -n 'CreateArgument|DebateArgument|conclusion-vote|debate-relations|ArgumentNode|DebateConcludeModal' Atoman-Backend Atoman-Frontend --glob '!docs/superpowers/**' --glob '!docs/release/**'`

Expected: 没有实现代码命中；数据库迁移中的旧表名和断言旧路由 404 的测试允许保留。

- [ ] **Step 7: 提交 E2E**

```bash
cd /root/Atoman/Atoman-Frontend
git add tests/e2e/helpers/debate-fixtures.ts tests/e2e/specs/debate-wiki-relations.spec.ts tests/e2e/specs/debate.spec.ts
git commit -m "test(debate): cover wiki relation lifecycle"
```

## 完成检查

- 后端只保留 Debate 节点、直接投票、结论事件、Wiki 版本与正文关系投影。
- 前端没有 Argument、直接关系编辑、手动结题或重开入口。
- `@username` 与 `@type:uuid[:qualifier]` 可同时使用。
- 只有已形成结论的辩题能建立关系。
- 正文、版本和关系投影保持单事务一致。
- 树只显示 support 且默认 3 层；图显示两种关系且默认 2 跳。
- 结论反转会使旧边 stale，重新确认不会隐式发生。
- 归档、保护、并发冲突、循环检测和完整迁移均有测试。
