# Music Lyrics Wiki Annotations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build stage 1 of the music lyrics system: song-level wiki lyrics, bilingual rolling lyrics, selected-text annotations, annotation votes, anchor conflict handling, version history, and minimal notification records.

**Architecture:** Backend owns lyric persistence, parsing, anchor validation, versioning, permissions, and vote ranking. Frontend owns player lyrics presentation, text selection, editing flows, and conflict resolution UI. The first implementation keeps notification UI minimal and stores notification records for the later notification module plan.

**Tech Stack:** Go, Gin, GORM, PostgreSQL, Vue 3, TypeScript, Pinia, Vitest, Playwright where useful.

---

## File Structure

Backend files:

- Create: `Atoman-Backend/internal/model/music_lyrics.go`
- Create: `Atoman-Backend/internal/migrations/20260706_music_lyrics.go`
- Modify: `Atoman-Backend/cmd/migrate/main.go`
- Create: `Atoman-Backend/internal/modules/music/lyrics_types.go`
- Create: `Atoman-Backend/internal/modules/music/lyrics_parser.go`
- Create: `Atoman-Backend/internal/modules/music/lyrics_parser_test.go`
- Create: `Atoman-Backend/internal/modules/music/lyrics_service.go`
- Create: `Atoman-Backend/internal/modules/music/lyrics_service_test.go`
- Create: `Atoman-Backend/internal/modules/music/lyrics_http.go`
- Modify: `Atoman-Backend/internal/modules/music/http.go`
- Modify: `Atoman-Backend/internal/modules/music/http_test.go`

Frontend files:

- Modify: `Atoman-Frontend/src/components/music/AlbumDrawer.vue`
- Modify: `Atoman-Frontend/src/api/client.ts`
- Modify: `Atoman-Frontend/src/api/musicV1.ts`
- Create: `Atoman-Frontend/src/utils/musicLyrics.ts`
- Create: `Atoman-Frontend/tests/unit/utils/musicLyrics.spec.ts`
- Create: `Atoman-Frontend/src/composables/useMusicLyrics.ts`
- Create: `Atoman-Frontend/src/components/music/MusicLyricsLine.vue`
- Create: `Atoman-Frontend/src/components/music/MusicAnnotationPanel.vue`
- Create: `Atoman-Frontend/src/components/music/MusicAnnotationEditor.vue`
- Create: `Atoman-Frontend/src/components/music/MusicLyricEditorDrawer.vue`
- Create: `Atoman-Frontend/src/components/music/MusicLyricsPanel.vue`
- Modify: `Atoman-Frontend/src/components/music/AudioPlayer.vue`
- Test: `Atoman-Frontend/tests/unit/components/music/MusicLyricsPanel.spec.ts`
- Test: `Atoman-Frontend/tests/unit/api/musicV1.lyrics.spec.ts`

Pre-existing blocker:

- `Atoman-Frontend/src/components/music/AlbumDrawer.vue` currently contains unresolved conflict markers. Task 0 resolves it before any frontend type-check.

---

### Task 0: Resolve Existing Album Drawer Conflict

**Files:**
- Modify: `Atoman-Frontend/src/components/music/AlbumDrawer.vue`

- [ ] **Step 1: Inspect conflict markers**

Run:

```bash
cd Atoman-Frontend
rg -n '<<<<<<<|=======|>>>>>>>' src/components/music/AlbumDrawer.vue
```

Expected: output shows the current conflict marker lines.

- [ ] **Step 2: Resolve conflict markers**

Open `Atoman-Frontend/src/components/music/AlbumDrawer.vue` and remove only these marker lines:

```text
"<<<<<<< HEAD"
"======="
">>>>>>> 09d01c6 (refactor: unify music editor drawer flows)"
```

Keep both real imports when both names are used by the file:

```ts
import { ApiErrorResponseError } from '@/api/client'
import { modulePathUrl } from '@/router/siteUrls'
```

Run:

```bash
cd Atoman-Frontend
rg -n '<<<<<<<|=======|>>>>>>>' src/components/music/AlbumDrawer.vue || true
```

Expected: no output.

- [ ] **Step 3: Run frontend type-check**

```bash
cd Atoman-Frontend
bun run type-check
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
cd Atoman-Frontend
git add src/components/music/AlbumDrawer.vue
git commit -m "fix: resolve music album drawer conflict"
```

---

### Task 1: Backend Lyric Models and Migration

**Files:**
- Create: `Atoman-Backend/internal/model/music_lyrics.go`
- Create: `Atoman-Backend/internal/migrations/20260706_music_lyrics.go`
- Modify: `Atoman-Backend/cmd/migrate/main.go`
- Test: `Atoman-Backend/internal/migrations/20260706_music_lyrics_test.go`

- [ ] **Step 1: Write the migration test**

Create `Atoman-Backend/internal/migrations/20260706_music_lyrics_test.go`:

```go
package migrations

import (
	"testing"

	"atoman/internal/model"
	"atoman/internal/testdb"
)

func TestRunMusicLyricsMigrationCreatesTables(t *testing.T) {
	db := testdb.Open(t)

	if err := RunMusicLyricsMigration(db); err != nil {
		t.Fatalf("run migration: %v", err)
	}

	tables := []any{
		&model.MusicSongLyric{},
		&model.MusicSongLyricLine{},
		&model.MusicSongLyricVersion{},
		&model.MusicLyricAnnotation{},
		&model.MusicLyricAnnotationVote{},
		&model.MusicLyricNotification{},
	}
	for _, table := range tables {
		if !db.Migrator().HasTable(table) {
			t.Fatalf("expected table for %#v", table)
		}
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd Atoman-Backend
go test ./internal/migrations -run TestRunMusicLyricsMigrationCreatesTables -count=1
```

Expected: fail because `RunMusicLyricsMigration` and model types do not exist.

- [ ] **Step 3: Add lyric models**

Create `Atoman-Backend/internal/model/music_lyrics.go`:

```go
package model

import (
	"time"

	"github.com/google/uuid"
)

type MusicSongLyric struct {
	Base
	SongID      uuid.UUID `json:"song_id" gorm:"type:uuid;not null;uniqueIndex"`
	Song        *Song     `json:"song,omitempty" gorm:"foreignKey:SongID"`
	Content     string    `json:"content" gorm:"type:text"`
	Translation string    `json:"translation" gorm:"type:text"`
	Format      string    `json:"format" gorm:"default:'plain';not null"`
	Version     int       `json:"version" gorm:"default:1;not null"`
	UpdatedBy   uuid.UUID `json:"updated_by" gorm:"type:uuid;not null;index"`
	EditSummary string    `json:"edit_summary" gorm:"type:text"`
}

func (MusicSongLyric) TableName() string { return "music_song_lyrics" }

type MusicSongLyricLine struct {
	Base
	LyricID     uuid.UUID `json:"lyric_id" gorm:"type:uuid;not null;index"`
	Lyric       *MusicSongLyric `json:"lyric,omitempty" gorm:"foreignKey:LyricID"`
	LineKey     string    `json:"line_key" gorm:"not null;index"`
	LineIndex   int       `json:"line_index" gorm:"not null"`
	TimeMS      *int      `json:"time_ms,omitempty"`
	Text        string    `json:"text" gorm:"type:text"`
	Translation string    `json:"translation" gorm:"type:text"`
}

func (MusicSongLyricLine) TableName() string { return "music_song_lyric_lines" }

type MusicSongLyricVersion struct {
	Base
	SongID      uuid.UUID `json:"song_id" gorm:"type:uuid;not null;index;uniqueIndex:idx_music_lyric_versions_song_version,priority:1"`
	Version     int       `json:"version" gorm:"not null;uniqueIndex:idx_music_lyric_versions_song_version,priority:2"`
	Content     string    `json:"content" gorm:"type:text"`
	Translation string    `json:"translation" gorm:"type:text"`
	Format      string    `json:"format" gorm:"not null"`
	EditSummary string    `json:"edit_summary" gorm:"type:text"`
	CreatedBy   uuid.UUID `json:"created_by" gorm:"type:uuid;not null;index"`
}

func (MusicSongLyricVersion) TableName() string { return "music_song_lyric_versions" }

type MusicLyricAnnotation struct {
	Base
	SongID       uuid.UUID `json:"song_id" gorm:"type:uuid;not null;index"`
	LineID       uuid.UUID `json:"line_id" gorm:"type:uuid;not null;index"`
	SelectedText string    `json:"selected_text" gorm:"type:text;not null"`
	StartOffset  int       `json:"start_offset" gorm:"not null"`
	EndOffset    int       `json:"end_offset" gorm:"not null"`
	Body         string    `json:"body" gorm:"type:text;not null"`
	CreatedBy    uuid.UUID `json:"created_by" gorm:"type:uuid;not null;index"`
	Status       string    `json:"status" gorm:"default:'active';not null;index"`
}

func (MusicLyricAnnotation) TableName() string { return "music_lyric_annotations" }

type MusicLyricAnnotationVote struct {
	Base
	AnnotationID uuid.UUID `json:"annotation_id" gorm:"type:uuid;not null;index;uniqueIndex:idx_music_annotation_votes_annotation_user,priority:1"`
	UserID       uuid.UUID `json:"user_id" gorm:"type:uuid;not null;index;uniqueIndex:idx_music_annotation_votes_annotation_user,priority:2"`
	Vote         string    `json:"vote" gorm:"not null"`
}

func (MusicLyricAnnotationVote) TableName() string { return "music_lyric_annotation_votes" }

type MusicLyricNotification struct {
	Base
	UserID uuid.UUID `json:"user_id" gorm:"type:uuid;not null;index"`
	Type   string    `json:"type" gorm:"not null;index"`
	Payload string   `json:"payload" gorm:"type:text"`
	ReadAt *time.Time `json:"read_at,omitempty"`
}

func (MusicLyricNotification) TableName() string { return "music_lyric_notifications" }
```

- [ ] **Step 4: Add migration**

Create `Atoman-Backend/internal/migrations/20260706_music_lyrics.go`:

```go
package migrations

import (
	"atoman/internal/model"

	"gorm.io/gorm"
)

func RunMusicLyricsMigration(db *gorm.DB) error {
	return db.AutoMigrate(
		&model.MusicSongLyric{},
		&model.MusicSongLyricLine{},
		&model.MusicSongLyricVersion{},
		&model.MusicLyricAnnotation{},
		&model.MusicLyricAnnotationVote{},
		&model.MusicLyricNotification{},
	)
}
```

- [ ] **Step 5: Wire migration into command**

Modify `Atoman-Backend/cmd/migrate/main.go` near the existing music migrations:

```go
	if err := migrations.RunMusicLyricsMigration(db); err != nil {
		return fmt.Errorf("music lyrics migration: %w", err)
	}
```

- [ ] **Step 6: Run migration tests**

Run:

```bash
cd Atoman-Backend
go test ./internal/migrations -run TestRunMusicLyricsMigrationCreatesTables -count=1
```

Expected: pass.

- [ ] **Step 7: Commit**

```bash
cd Atoman-Backend
git add internal/model/music_lyrics.go internal/migrations/20260706_music_lyrics.go internal/migrations/20260706_music_lyrics_test.go cmd/migrate/main.go
git commit -m "feat: add music lyrics schema"
```

---

### Task 2: Backend Lyrics Parser

**Files:**
- Create: `Atoman-Backend/internal/modules/music/lyrics_types.go`
- Create: `Atoman-Backend/internal/modules/music/lyrics_parser.go`
- Test: `Atoman-Backend/internal/modules/music/lyrics_parser_test.go`

- [ ] **Step 1: Write parser tests**

Create `Atoman-Backend/internal/modules/music/lyrics_parser_test.go`:

```go
package music

import "testing"

func TestParseLyricLinesPlainText(t *testing.T) {
	lines, err := ParseLyricLines("hello\nworld", "", "plain")
	if err != nil {
		t.Fatalf("parse plain: %v", err)
	}
	if len(lines) != 2 || lines[0].Text != "hello" || lines[1].Text != "world" {
		t.Fatalf("unexpected lines: %#v", lines)
	}
	if lines[0].TimeMS != nil {
		t.Fatalf("plain line should not have timestamp")
	}
}

func TestParseLyricLinesLRCWithTranslation(t *testing.T) {
	content := "[00:01.20]Hello\n[00:03.00]World"
	translation := "[00:01.20]你好\n[00:03.00]世界"

	lines, err := ParseLyricLines(content, translation, "lrc")
	if err != nil {
		t.Fatalf("parse lrc: %v", err)
	}
	if len(lines) != 2 {
		t.Fatalf("expected 2 lines, got %#v", lines)
	}
	if lines[0].TimeMS == nil || *lines[0].TimeMS != 1200 || lines[0].Translation != "你好" {
		t.Fatalf("unexpected first line: %#v", lines[0])
	}
	if lines[1].TimeMS == nil || *lines[1].TimeMS != 3000 || lines[1].Translation != "世界" {
		t.Fatalf("unexpected second line: %#v", lines[1])
	}
}

func TestValidateAnnotationAnchor(t *testing.T) {
	err := ValidateAnnotationAnchor("hello world", "world", 6, 11)
	if err != nil {
		t.Fatalf("expected valid anchor: %v", err)
	}
	if err := ValidateAnnotationAnchor("hello world", "missing", 6, 11); err == nil {
		t.Fatalf("expected invalid selected text")
	}
}
```

- [ ] **Step 2: Run tests to verify failure**

```bash
cd Atoman-Backend
go test ./internal/modules/music -run 'TestParseLyricLines|TestValidateAnnotationAnchor' -count=1
```

Expected: fail because parser functions do not exist.

- [ ] **Step 3: Add parser types**

Create `Atoman-Backend/internal/modules/music/lyrics_types.go`:

```go
package music

type ParsedLyricLine struct {
	LineKey     string
	LineIndex   int
	TimeMS      *int
	Text        string
	Translation string
}
```

- [ ] **Step 4: Implement parser**

Create `Atoman-Backend/internal/modules/music/lyrics_parser.go`:

```go
package music

import (
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

var lrcLinePattern = regexp.MustCompile(`^\[(\d{2}):(\d{2})(?:\.(\d{1,3}))?\](.*)$`)

func ParseLyricLines(content string, translation string, format string) ([]ParsedLyricLine, error) {
	if strings.EqualFold(strings.TrimSpace(format), "lrc") {
		return parseLRCLines(content, translation)
	}
	return parsePlainLyricLines(content, translation), nil
}

func parsePlainLyricLines(content string, translation string) []ParsedLyricLine {
	contentLines := splitLines(content)
	translationLines := splitLines(translation)
	lines := make([]ParsedLyricLine, 0, len(contentLines))
	for index, text := range contentLines {
		lineTranslation := ""
		if index < len(translationLines) {
			lineTranslation = translationLines[index]
		}
		lines = append(lines, ParsedLyricLine{
			LineKey:     buildLineKey(nil, text, index),
			LineIndex:   index,
			Text:        text,
			Translation: lineTranslation,
		})
	}
	return lines
}

func parseLRCLines(content string, translation string) ([]ParsedLyricLine, error) {
	translationByTime := map[int]string{}
	for _, raw := range splitLines(translation) {
		timeMS, text, ok, err := parseLRCLine(raw)
		if err != nil {
			return nil, err
		}
		if ok {
			translationByTime[timeMS] = text
		}
	}

	lines := []ParsedLyricLine{}
	for _, raw := range splitLines(content) {
		timeMS, text, ok, err := parseLRCLine(raw)
		if err != nil {
			return nil, err
		}
		if !ok {
			if strings.TrimSpace(raw) == "" {
				continue
			}
			return nil, fmt.Errorf("invalid lrc line %q", raw)
		}
		t := timeMS
		lines = append(lines, ParsedLyricLine{
			LineKey:     buildLineKey(&t, text, len(lines)),
			LineIndex:   len(lines),
			TimeMS:      &t,
			Text:        text,
			Translation: translationByTime[timeMS],
		})
	}
	return lines, nil
}

func parseLRCLine(raw string) (int, string, bool, error) {
	match := lrcLinePattern.FindStringSubmatch(strings.TrimSpace(raw))
	if match == nil {
		return 0, "", false, nil
	}
	minutes, err := strconv.Atoi(match[1])
	if err != nil {
		return 0, "", false, err
	}
	seconds, err := strconv.Atoi(match[2])
	if err != nil {
		return 0, "", false, err
	}
	ms := 0
	if match[3] != "" {
		fraction := match[3]
		for len(fraction) < 3 {
			fraction += "0"
		}
		ms, err = strconv.Atoi(fraction[:3])
		if err != nil {
			return 0, "", false, err
		}
	}
	return minutes*60000 + seconds*1000 + ms, strings.TrimSpace(match[4]), true, nil
}

func splitLines(value string) []string {
	value = strings.ReplaceAll(value, "\r\n", "\n")
	value = strings.ReplaceAll(value, "\r", "\n")
	if value == "" {
		return []string{}
	}
	return strings.Split(value, "\n")
}

func buildLineKey(timeMS *int, text string, index int) string {
	hash := sha1.Sum([]byte(strings.ToLower(strings.TrimSpace(text))))
	if timeMS != nil {
		return fmt.Sprintf("t:%d:%s", *timeMS, hex.EncodeToString(hash[:6]))
	}
	return fmt.Sprintf("i:%d:%s", index, hex.EncodeToString(hash[:6]))
}

func ValidateAnnotationAnchor(lineText string, selectedText string, startOffset int, endOffset int) error {
	runes := []rune(lineText)
	if startOffset < 0 || endOffset > len(runes) || startOffset >= endOffset {
		return fmt.Errorf("invalid annotation range")
	}
	if string(runes[startOffset:endOffset]) != selectedText {
		return fmt.Errorf("selected text does not match lyric line")
	}
	return nil
}
```

- [ ] **Step 5: Run parser tests**

```bash
cd Atoman-Backend
go test ./internal/modules/music -run 'TestParseLyricLines|TestValidateAnnotationAnchor' -count=1
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
cd Atoman-Backend
git add internal/modules/music/lyrics_types.go internal/modules/music/lyrics_parser.go internal/modules/music/lyrics_parser_test.go
git commit -m "feat: parse music lyrics"
```

---

### Task 3: Backend Lyrics Service Core

**Files:**
- Create: `Atoman-Backend/internal/modules/music/lyrics_service.go`
- Test: `Atoman-Backend/internal/modules/music/lyrics_service_test.go`

- [ ] **Step 1: Write service tests**

Create `Atoman-Backend/internal/modules/music/lyrics_service_test.go` with these tests:

```go
package music

import (
	"testing"

	"atoman/internal/model"
	"atoman/internal/platform/authctx"
	"atoman/internal/testdb"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

func newLyricsServiceTest(t *testing.T) (*Service, *gorm.DB, authctx.CurrentUser, model.Song) {
	t.Helper()
	db := testdb.Open(t)
	testdb.Migrate(t, db,
		&model.User{},
		&model.Song{},
		&model.MusicSongLyric{},
		&model.MusicSongLyricLine{},
		&model.MusicSongLyricVersion{},
		&model.MusicLyricAnnotation{},
		&model.MusicLyricAnnotationVote{},
		&model.MusicLyricNotification{},
	)
	user := model.User{Username: "lyrics-user", Email: "lyrics@example.com", Password: "hash", Role: "user", IsActive: true}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	song := model.Song{Title: "Song With Lyrics", AudioURL: "https://cdn.test/song.mp3"}
	if err := db.Create(&song).Error; err != nil {
		t.Fatalf("create song: %v", err)
	}
	return NewService(db), db, authctx.CurrentUser{ID: user.UUID, Username: user.Username, Role: authctx.RoleUser}, song
}

func TestSaveLyricsCreatesCurrentVersionAndLines(t *testing.T) {
	svc, db, user, song := newLyricsServiceTest(t)

	result, err := svc.SaveSongLyrics(user, song.ID, SaveLyricsInput{
		Content:     "[00:01.00]Hello",
		Translation: "[00:01.00]你好",
		Format:      "lrc",
		EditSummary: "initial lyrics",
	})
	if err != nil {
		t.Fatalf("save lyrics: %v", err)
	}
	if result.Version != 1 || len(result.Lines) != 1 || result.Lines[0].Translation != "你好" {
		t.Fatalf("unexpected result: %#v", result)
	}

	var versionCount int64
	if err := db.Model(&model.MusicSongLyricVersion{}).Where("song_id = ?", song.ID).Count(&versionCount).Error; err != nil {
		t.Fatalf("count versions: %v", err)
	}
	if versionCount != 1 {
		t.Fatalf("expected one version, got %d", versionCount)
	}
}

func TestCreateAnnotationRejectsInvalidAnchor(t *testing.T) {
	svc, _, user, song := newLyricsServiceTest(t)
	lyrics, err := svc.SaveSongLyrics(user, song.ID, SaveLyricsInput{Content: "hello world", Format: "plain"})
	if err != nil {
		t.Fatalf("save lyrics: %v", err)
	}

	_, err = svc.CreateLyricAnnotation(user, song.ID, CreateAnnotationInput{
		LineID:       lyrics.Lines[0].ID,
		SelectedText: "missing",
		StartOffset:  0,
		EndOffset:    5,
		Body:         "annotation",
	})
	if err == nil {
		t.Fatalf("expected invalid anchor error")
	}
}

func TestVoteAnnotationReplacesPreviousVote(t *testing.T) {
	svc, _, user, song := newLyricsServiceTest(t)
	lyrics, err := svc.SaveSongLyrics(user, song.ID, SaveLyricsInput{Content: "hello world", Format: "plain"})
	if err != nil {
		t.Fatalf("save lyrics: %v", err)
	}
	annotation, err := svc.CreateLyricAnnotation(user, song.ID, CreateAnnotationInput{
		LineID:       lyrics.Lines[0].ID,
		SelectedText: "hello",
		StartOffset:  0,
		EndOffset:    5,
		Body:         "greeting",
	})
	if err != nil {
		t.Fatalf("create annotation: %v", err)
	}
	if err := svc.SetLyricAnnotationVote(user, annotation.ID, "up"); err != nil {
		t.Fatalf("upvote: %v", err)
	}
	if err := svc.SetLyricAnnotationVote(user, annotation.ID, "down"); err != nil {
		t.Fatalf("downvote: %v", err)
	}
	summary, err := svc.GetSongLyrics(user, song.ID)
	if err != nil {
		t.Fatalf("get lyrics: %v", err)
	}
	if len(summary.Annotations) != 1 || summary.Annotations[0].Upvotes != 0 || summary.Annotations[0].Downvotes != 1 || summary.Annotations[0].UserVote != "down" {
		t.Fatalf("unexpected votes: %#v", summary.Annotations)
	}
}
```

- [ ] **Step 2: Run tests to verify failure**

```bash
cd Atoman-Backend
go test ./internal/modules/music -run 'TestSaveLyrics|TestCreateAnnotation|TestVoteAnnotation' -count=1
```

Expected: fail because service methods and DTOs do not exist.

- [ ] **Step 3: Implement service DTOs and result types**

At top of `Atoman-Backend/internal/modules/music/lyrics_service.go`:

```go
package music

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"atoman/internal/model"
	"atoman/internal/platform/apperr"
	"atoman/internal/platform/authctx"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type SaveLyricsInput struct {
	Content string
	Translation string
	Format string
	EditSummary string
	AnnotationResolutions []AnnotationResolutionInput
}

type AnnotationResolutionInput struct {
	AnnotationID uuid.UUID
	Action string
	LineID uuid.UUID
	SelectedText string
	StartOffset int
	EndOffset int
}

type CreateAnnotationInput struct {
	LineID uuid.UUID
	SelectedText string
	StartOffset int
	EndOffset int
	Body string
}

type MusicLyricLineDTO struct {
	ID uuid.UUID `json:"id"`
	LineKey string `json:"line_key"`
	LineIndex int `json:"line_index"`
	TimeMS *int `json:"time_ms,omitempty"`
	Text string `json:"text"`
	Translation string `json:"translation"`
}

type MusicLyricAnnotationDTO struct {
	ID uuid.UUID `json:"id"`
	SongID uuid.UUID `json:"song_id"`
	LineID uuid.UUID `json:"line_id"`
	SelectedText string `json:"selected_text"`
	StartOffset int `json:"start_offset"`
	EndOffset int `json:"end_offset"`
	Body string `json:"body"`
	CreatedBy uuid.UUID `json:"created_by"`
	Status string `json:"status"`
	Upvotes int64 `json:"upvotes"`
	Downvotes int64 `json:"downvotes"`
	NetScore int64 `json:"net_score"`
	UserVote string `json:"user_vote,omitempty"`
	CanEdit bool `json:"can_edit"`
}

type MusicLyricsDTO struct {
	SongID uuid.UUID `json:"song_id"`
	Content string `json:"content"`
	Translation string `json:"translation"`
	Format string `json:"format"`
	Version int `json:"version"`
	EditSummary string `json:"edit_summary"`
	Lines []MusicLyricLineDTO `json:"lines"`
	Annotations []MusicLyricAnnotationDTO `json:"annotations"`
}
```

- [ ] **Step 4: Implement save and read methods**

Add to `lyrics_service.go`:

```go
func (s *Service) SaveSongLyrics(user authctx.CurrentUser, songID uuid.UUID, input SaveLyricsInput) (MusicLyricsDTO, error) {
	if user.ID == uuid.Nil {
		return MusicLyricsDTO{}, apperr.Unauthorized("Login required")
	}
	format := strings.ToLower(strings.TrimSpace(input.Format))
	if format == "" {
		format = "plain"
	}
	if format != "plain" && format != "lrc" {
		return MusicLyricsDTO{}, apperr.BadRequest("music.invalid_lyrics_format", "Invalid lyrics format")
	}
	parsed, err := ParseLyricLines(input.Content, input.Translation, format)
	if err != nil {
		return MusicLyricsDTO{}, apperr.BadRequest("music.invalid_lyrics", err.Error())
	}
	if strings.TrimSpace(input.EditSummary) == "" {
		input.EditSummary = "更新歌词"
	}

	err = s.db.Transaction(func(tx *gorm.DB) error {
		var existing model.MusicSongLyric
		err := tx.Where("song_id = ?", songID).First(&existing).Error
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		nextVersion := 1
		if existing.ID != uuid.Nil {
			nextVersion = existing.Version + 1
		}
		lyric := existing
		lyric.SongID = songID
		lyric.Content = input.Content
		lyric.Translation = input.Translation
		lyric.Format = format
		lyric.Version = nextVersion
		lyric.UpdatedBy = user.ID
		lyric.EditSummary = input.EditSummary
		if lyric.ID == uuid.Nil {
			if err := tx.Create(&lyric).Error; err != nil {
				return err
			}
		} else if err := tx.Save(&lyric).Error; err != nil {
			return err
		}
		if err := tx.Where("lyric_id = ?", lyric.ID).Delete(&model.MusicSongLyricLine{}).Error; err != nil {
			return err
		}
		lines := make([]model.MusicSongLyricLine, 0, len(parsed))
		for _, line := range parsed {
			lines = append(lines, model.MusicSongLyricLine{
				LyricID: lyric.ID,
				LineKey: line.LineKey,
				LineIndex: line.LineIndex,
				TimeMS: line.TimeMS,
				Text: line.Text,
				Translation: line.Translation,
			})
		}
		if len(lines) > 0 {
			if err := tx.Create(&lines).Error; err != nil {
				return err
			}
		}
		version := model.MusicSongLyricVersion{
			SongID: songID,
			Version: nextVersion,
			Content: input.Content,
			Translation: input.Translation,
			Format: format,
			EditSummary: input.EditSummary,
			CreatedBy: user.ID,
		}
		if err := tx.Create(&version).Error; err != nil {
			return err
		}
		return s.validateOrMarkAnnotationAnchors(tx, user, songID, input.AnnotationResolutions)
	})
	if err != nil {
		return MusicLyricsDTO{}, err
	}
	return s.GetSongLyrics(user, songID)
}

func (s *Service) GetSongLyrics(user authctx.CurrentUser, songID uuid.UUID) (MusicLyricsDTO, error) {
	var lyric model.MusicSongLyric
	if err := s.db.Where("song_id = ?", songID).First(&lyric).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return MusicLyricsDTO{SongID: songID, Format: "plain", Lines: []MusicLyricLineDTO{}, Annotations: []MusicLyricAnnotationDTO{}}, nil
		}
		return MusicLyricsDTO{}, err
	}
	var lines []model.MusicSongLyricLine
	if err := s.db.Where("lyric_id = ?", lyric.ID).Order("line_index ASC").Find(&lines).Error; err != nil {
		return MusicLyricsDTO{}, err
	}
	annotations, err := s.listAnnotationDTOs(user, songID)
	if err != nil {
		return MusicLyricsDTO{}, err
	}
	return MusicLyricsDTO{
		SongID: songID,
		Content: lyric.Content,
		Translation: lyric.Translation,
		Format: lyric.Format,
		Version: lyric.Version,
		EditSummary: lyric.EditSummary,
		Lines: toLineDTOs(lines),
		Annotations: annotations,
	}, nil
}
```

- [ ] **Step 5: Implement annotations and votes**

Append to `lyrics_service.go`:

```go
func (s *Service) CreateLyricAnnotation(user authctx.CurrentUser, songID uuid.UUID, input CreateAnnotationInput) (MusicLyricAnnotationDTO, error) {
	if user.ID == uuid.Nil {
		return MusicLyricAnnotationDTO{}, apperr.Unauthorized("Login required")
	}
	var line model.MusicSongLyricLine
	if err := s.db.First(&line, "id = ?", input.LineID).Error; err != nil {
		return MusicLyricAnnotationDTO{}, err
	}
	if err := ValidateAnnotationAnchor(line.Text, input.SelectedText, input.StartOffset, input.EndOffset); err != nil {
		return MusicLyricAnnotationDTO{}, apperr.BadRequest("music.invalid_annotation_anchor", err.Error())
	}
	annotation := model.MusicLyricAnnotation{
		SongID: songID,
		LineID: input.LineID,
		SelectedText: input.SelectedText,
		StartOffset: input.StartOffset,
		EndOffset: input.EndOffset,
		Body: strings.TrimSpace(input.Body),
		CreatedBy: user.ID,
		Status: "active",
	}
	if annotation.Body == "" {
		return MusicLyricAnnotationDTO{}, apperr.BadRequest("music.empty_annotation", "Annotation body is required")
	}
	if err := s.db.Create(&annotation).Error; err != nil {
		return MusicLyricAnnotationDTO{}, err
	}
	return s.getAnnotationDTO(user, annotation.ID)
}

func (s *Service) UpdateLyricAnnotation(user authctx.CurrentUser, annotationID uuid.UUID, body string) (MusicLyricAnnotationDTO, error) {
	var annotation model.MusicLyricAnnotation
	if err := s.db.First(&annotation, "id = ?", annotationID).Error; err != nil {
		return MusicLyricAnnotationDTO{}, err
	}
	if annotation.CreatedBy != user.ID {
		return MusicLyricAnnotationDTO{}, apperr.Forbidden("music.annotation_forbidden", "Only the annotation author can edit it")
	}
	body = strings.TrimSpace(body)
	if body == "" {
		return MusicLyricAnnotationDTO{}, apperr.BadRequest("music.empty_annotation", "Annotation body is required")
	}
	if err := s.db.Model(&annotation).Updates(map[string]any{"body": body, "status": "active"}).Error; err != nil {
		return MusicLyricAnnotationDTO{}, err
	}
	return s.getAnnotationDTO(user, annotationID)
}

func (s *Service) DeleteLyricAnnotation(user authctx.CurrentUser, annotationID uuid.UUID) error {
	var annotation model.MusicLyricAnnotation
	if err := s.db.First(&annotation, "id = ?", annotationID).Error; err != nil {
		return err
	}
	if annotation.CreatedBy != user.ID {
		return apperr.Forbidden("music.annotation_forbidden", "Only the annotation author can delete it")
	}
	return s.db.Model(&annotation).Update("status", "deleted").Error
}

func (s *Service) SetLyricAnnotationVote(user authctx.CurrentUser, annotationID uuid.UUID, vote string) error {
	if user.ID == uuid.Nil {
		return apperr.Unauthorized("Login required")
	}
	vote = strings.TrimSpace(vote)
	if vote == "" {
		return s.db.Where("annotation_id = ? AND user_id = ?", annotationID, user.ID).Delete(&model.MusicLyricAnnotationVote{}).Error
	}
	if vote != "up" && vote != "down" {
		return apperr.BadRequest("music.invalid_annotation_vote", "Invalid annotation vote")
	}
	row := model.MusicLyricAnnotationVote{AnnotationID: annotationID, UserID: user.ID, Vote: vote}
	var existing model.MusicLyricAnnotationVote
	err := s.db.Where("annotation_id = ? AND user_id = ?", annotationID, user.ID).First(&existing).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return s.db.Create(&row).Error
	}
	if err != nil {
		return err
	}
	return s.db.Model(&existing).Update("vote", vote).Error
}
```

- [ ] **Step 6: Implement DTO helpers and conflict marker**

Append to `lyrics_service.go`:

```go
func toLineDTOs(lines []model.MusicSongLyricLine) []MusicLyricLineDTO {
	dtos := make([]MusicLyricLineDTO, 0, len(lines))
	for _, line := range lines {
		dtos = append(dtos, MusicLyricLineDTO{
			ID: line.ID,
			LineKey: line.LineKey,
			LineIndex: line.LineIndex,
			TimeMS: line.TimeMS,
			Text: line.Text,
			Translation: line.Translation,
		})
	}
	return dtos
}

func (s *Service) validateOrMarkAnnotationAnchors(tx *gorm.DB, user authctx.CurrentUser, songID uuid.UUID, resolutions []AnnotationResolutionInput) error {
	var active []model.MusicLyricAnnotation
	if err := tx.Where("song_id = ? AND status = ?", songID, "active").Find(&active).Error; err != nil {
		return err
	}
	resolutionByID := map[uuid.UUID]AnnotationResolutionInput{}
	for _, resolution := range resolutions {
		resolutionByID[resolution.AnnotationID] = resolution
	}
	for _, annotation := range active {
		var line model.MusicSongLyricLine
		err := tx.First(&line, "id = ?", annotation.LineID).Error
		if err == nil && ValidateAnnotationAnchor(line.Text, annotation.SelectedText, annotation.StartOffset, annotation.EndOffset) == nil {
			continue
		}
		resolution, ok := resolutionByID[annotation.ID]
		if !ok {
			return apperr.BadRequest("music.annotation_anchor_conflict", fmt.Sprintf("Annotation %s needs resolution", annotation.ID))
		}
		switch resolution.Action {
		case "rebind":
			if err := tx.Model(&annotation).Updates(map[string]any{
				"line_id": resolution.LineID,
				"selected_text": resolution.SelectedText,
				"start_offset": resolution.StartOffset,
				"end_offset": resolution.EndOffset,
				"status": "active",
			}).Error; err != nil {
				return err
			}
		case "needs_rebind":
			if err := tx.Model(&annotation).Update("status", "needs_rebind").Error; err != nil {
				return err
			}
			payload, _ := json.Marshal(map[string]string{
				"annotation_id": annotation.ID.String(),
				"song_id": songID.String(),
			})
			notice := model.MusicLyricNotification{
				UserID: annotation.CreatedBy,
				Type: "music.lyric_annotation_rebind",
				Payload: string(payload),
			}
			if err := tx.Create(&notice).Error; err != nil {
				return err
			}
		default:
			return apperr.BadRequest("music.invalid_annotation_resolution", "Invalid annotation resolution")
		}
	}
	return nil
}
```

- [ ] **Step 7: Implement annotation listing helpers**

Append to `lyrics_service.go`:

```go
func (s *Service) getAnnotationDTO(user authctx.CurrentUser, annotationID uuid.UUID) (MusicLyricAnnotationDTO, error) {
	var annotation model.MusicLyricAnnotation
	if err := s.db.First(&annotation, "id = ?", annotationID).Error; err != nil {
		return MusicLyricAnnotationDTO{}, err
	}
	items, err := s.listAnnotationDTOs(user, annotation.SongID)
	if err != nil {
		return MusicLyricAnnotationDTO{}, err
	}
	for _, item := range items {
		if item.ID == annotationID {
			return item, nil
		}
	}
	return MusicLyricAnnotationDTO{}, gorm.ErrRecordNotFound
}

func (s *Service) listAnnotationDTOs(user authctx.CurrentUser, songID uuid.UUID) ([]MusicLyricAnnotationDTO, error) {
	var annotations []model.MusicLyricAnnotation
	if err := s.db.Where("song_id = ? AND status <> ?", songID, "deleted").Order("updated_at DESC").Find(&annotations).Error; err != nil {
		return nil, err
	}
	result := make([]MusicLyricAnnotationDTO, 0, len(annotations))
	for _, annotation := range annotations {
		var upvotes int64
		var downvotes int64
		if err := s.db.Model(&model.MusicLyricAnnotationVote{}).Where("annotation_id = ? AND vote = ?", annotation.ID, "up").Count(&upvotes).Error; err != nil {
			return nil, err
		}
		if err := s.db.Model(&model.MusicLyricAnnotationVote{}).Where("annotation_id = ? AND vote = ?", annotation.ID, "down").Count(&downvotes).Error; err != nil {
			return nil, err
		}
		userVote := ""
		if user.ID != uuid.Nil {
			var vote model.MusicLyricAnnotationVote
			if err := s.db.Where("annotation_id = ? AND user_id = ?", annotation.ID, user.ID).First(&vote).Error; err == nil {
				userVote = vote.Vote
			}
		}
		result = append(result, MusicLyricAnnotationDTO{
			ID: annotation.ID,
			SongID: annotation.SongID,
			LineID: annotation.LineID,
			SelectedText: annotation.SelectedText,
			StartOffset: annotation.StartOffset,
			EndOffset: annotation.EndOffset,
			Body: annotation.Body,
			CreatedBy: annotation.CreatedBy,
			Status: annotation.Status,
			Upvotes: upvotes,
			Downvotes: downvotes,
			NetScore: upvotes - downvotes,
			UserVote: userVote,
			CanEdit: user.ID != uuid.Nil && user.ID == annotation.CreatedBy,
		})
	}
	return result, nil
}
```

- [ ] **Step 8: Run service tests**

```bash
cd Atoman-Backend
go test ./internal/modules/music -run 'TestSaveLyrics|TestCreateAnnotation|TestVoteAnnotation' -count=1
```

Expected: pass.

- [ ] **Step 9: Commit**

```bash
cd Atoman-Backend
git add internal/modules/music/lyrics_service.go internal/modules/music/lyrics_service_test.go
git commit -m "feat: add music lyrics service"
```

---

### Task 4: Backend Lyrics HTTP API

**Files:**
- Create: `Atoman-Backend/internal/modules/music/lyrics_http.go`
- Modify: `Atoman-Backend/internal/modules/music/http.go`
- Modify: `Atoman-Backend/internal/modules/music/http_test.go`

- [ ] **Step 1: Add test database models to helper**

Modify `newMusicHTTPTestService` migration list in `Atoman-Backend/internal/modules/music/http_test.go` to include:

```go
		&model.MusicSongLyric{},
		&model.MusicSongLyricLine{},
		&model.MusicSongLyricVersion{},
		&model.MusicLyricAnnotation{},
		&model.MusicLyricAnnotationVote{},
		&model.MusicLyricNotification{},
```

- [ ] **Step 2: Write HTTP tests**

Append to `http_test.go`:

```go
func TestRegisterRoutesSavesAndGetsLyrics(t *testing.T) {
	service, db, user := newMusicHTTPTestService(t)
	song := model.Song{Title: "HTTP Lyrics", AudioURL: "https://cdn.test/song.mp3"}
	if err := db.Create(&song).Error; err != nil {
		t.Fatalf("create song: %v", err)
	}
	r := newMusicHTTPRouter(service, &user)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPut, "/api/v1/music/songs/"+song.ID.String()+"/lyrics", strings.NewReader(`{"content":"[00:01.00]Hello","translation":"[00:01.00]你好","format":"lrc","edit_summary":"add lyrics"}`))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/api/v1/music/songs/"+song.ID.String()+"/lyrics", nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"translation":"你好"`) {
		t.Fatalf("expected translated line: %s", w.Body.String())
	}
}

func TestRegisterRoutesAnnotationVoteLifecycle(t *testing.T) {
	service, db, user := newMusicHTTPTestService(t)
	song := model.Song{Title: "Annotation HTTP", AudioURL: "https://cdn.test/song.mp3"}
	if err := db.Create(&song).Error; err != nil {
		t.Fatalf("create song: %v", err)
	}
	lyrics, err := service.SaveSongLyrics(user, song.ID, SaveLyricsInput{Content: "hello world", Format: "plain"})
	if err != nil {
		t.Fatalf("save lyrics: %v", err)
	}
	r := newMusicHTTPRouter(service, &user)

	body := fmt.Sprintf(`{"line_id":"%s","selected_text":"hello","start_offset":0,"end_offset":5,"body":"greeting"}`, lyrics.Lines[0].ID)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/music/songs/"+song.ID.String()+"/lyrics/annotations", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}

	var created struct{ Data MusicLyricAnnotationDTO `json:"data"` }
	if err := json.Unmarshal(w.Body.Bytes(), &created); err != nil {
		t.Fatalf("decode annotation: %v", err)
	}

	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPut, "/api/v1/music/lyrics/annotations/"+created.Data.ID.String()+"/vote", strings.NewReader(`{"vote":"up"}`))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}
```

Add missing import:

```go
import "fmt"
```

- [ ] **Step 3: Run tests to verify failure**

```bash
cd Atoman-Backend
go test ./internal/modules/music -run 'TestRegisterRoutesSavesAndGetsLyrics|TestRegisterRoutesAnnotationVoteLifecycle' -count=1
```

Expected: fail because routes do not exist.

- [ ] **Step 4: Add HTTP request DTOs and handlers**

Create `Atoman-Backend/internal/modules/music/lyrics_http.go`:

```go
package music

import (
	"net/http"

	"atoman/internal/platform/apperr"
	"atoman/internal/platform/httpx"

	"github.com/gin-gonic/gin"
)

type saveLyricsRequest struct {
	Content string `json:"content"`
	Translation string `json:"translation"`
	Format string `json:"format"`
	EditSummary string `json:"edit_summary"`
	AnnotationResolutions []AnnotationResolutionInput `json:"annotation_resolutions"`
}

type createAnnotationRequest struct {
	LineID string `json:"line_id"`
	SelectedText string `json:"selected_text"`
	StartOffset int `json:"start_offset"`
	EndOffset int `json:"end_offset"`
	Body string `json:"body"`
}

type updateAnnotationRequest struct {
	Body string `json:"body"`
}

type voteAnnotationRequest struct {
	Vote *string `json:"vote"`
}

func (h *Handler) getSongLyrics(c *gin.Context) {
	user, _ := currentMusicUser(c)
	songID, err := parseMusicID(c.Param("songId"), "songId")
	if err != nil {
		httpx.Error(c, err)
		return
	}
	result, err := h.service.GetSongLyrics(user, songID)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, http.StatusOK, result)
}

func (h *Handler) saveSongLyrics(c *gin.Context) {
	user, ok := currentMusicUser(c)
	if !ok {
		httpx.Error(c, apperr.Unauthorized("Login required"))
		return
	}
	songID, err := parseMusicID(c.Param("songId"), "songId")
	if err != nil {
		httpx.Error(c, err)
		return
	}
	var req saveLyricsRequest
	if err := bindJSON(c, &req); err != nil {
		httpx.Error(c, err)
		return
	}
	result, err := h.service.SaveSongLyrics(user, songID, SaveLyricsInput{
		Content: req.Content,
		Translation: req.Translation,
		Format: req.Format,
		EditSummary: req.EditSummary,
		AnnotationResolutions: req.AnnotationResolutions,
	})
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, http.StatusOK, result)
}

func (h *Handler) createLyricAnnotation(c *gin.Context) {
	user, ok := currentMusicUser(c)
	if !ok {
		httpx.Error(c, apperr.Unauthorized("Login required"))
		return
	}
	songID, err := parseMusicID(c.Param("songId"), "songId")
	if err != nil {
		httpx.Error(c, err)
		return
	}
	var req createAnnotationRequest
	if err := bindJSON(c, &req); err != nil {
		httpx.Error(c, err)
		return
	}
	lineID, err := parseMusicID(req.LineID, "line_id")
	if err != nil {
		httpx.Error(c, err)
		return
	}
	result, err := h.service.CreateLyricAnnotation(user, songID, CreateAnnotationInput{
		LineID: lineID,
		SelectedText: req.SelectedText,
		StartOffset: req.StartOffset,
		EndOffset: req.EndOffset,
		Body: req.Body,
	})
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, http.StatusCreated, result)
}

func (h *Handler) updateLyricAnnotation(c *gin.Context) {
	user, ok := currentMusicUser(c)
	if !ok {
		httpx.Error(c, apperr.Unauthorized("Login required"))
		return
	}
	annotationID, err := parseMusicID(c.Param("annotationId"), "annotationId")
	if err != nil {
		httpx.Error(c, err)
		return
	}
	var req updateAnnotationRequest
	if err := bindJSON(c, &req); err != nil {
		httpx.Error(c, err)
		return
	}
	result, err := h.service.UpdateLyricAnnotation(user, annotationID, req.Body)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, http.StatusOK, result)
}

func (h *Handler) deleteLyricAnnotation(c *gin.Context) {
	user, ok := currentMusicUser(c)
	if !ok {
		httpx.Error(c, apperr.Unauthorized("Login required"))
		return
	}
	annotationID, err := parseMusicID(c.Param("annotationId"), "annotationId")
	if err != nil {
		httpx.Error(c, err)
		return
	}
	if err := h.service.DeleteLyricAnnotation(user, annotationID); err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, http.StatusOK, gin.H{"deleted": true})
}

func (h *Handler) voteLyricAnnotation(c *gin.Context) {
	user, ok := currentMusicUser(c)
	if !ok {
		httpx.Error(c, apperr.Unauthorized("Login required"))
		return
	}
	annotationID, err := parseMusicID(c.Param("annotationId"), "annotationId")
	if err != nil {
		httpx.Error(c, err)
		return
	}
	var req voteAnnotationRequest
	if err := bindJSON(c, &req); err != nil {
		httpx.Error(c, err)
		return
	}
	vote := ""
	if req.Vote != nil {
		vote = *req.Vote
	}
	if err := h.service.SetLyricAnnotationVote(user, annotationID, vote); err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, http.StatusOK, gin.H{"voted": true})
}
```

- [ ] **Step 5: Register routes**

Modify `Atoman-Backend/internal/modules/music/http.go` inside `RegisterRoutes`:

```go
	group.GET("/songs/:songId/lyrics", h.getSongLyrics)
	group.PUT("/songs/:songId/lyrics", h.saveSongLyrics)
	group.POST("/songs/:songId/lyrics/annotations", h.createLyricAnnotation)
	group.PATCH("/lyrics/annotations/:annotationId", h.updateLyricAnnotation)
	group.DELETE("/lyrics/annotations/:annotationId", h.deleteLyricAnnotation)
	group.PUT("/lyrics/annotations/:annotationId/vote", h.voteLyricAnnotation)
```

- [ ] **Step 6: Run HTTP tests**

```bash
cd Atoman-Backend
go test ./internal/modules/music -run 'TestRegisterRoutesSavesAndGetsLyrics|TestRegisterRoutesAnnotationVoteLifecycle' -count=1
```

Expected: pass.

- [ ] **Step 7: Commit**

```bash
cd Atoman-Backend
git add internal/modules/music/lyrics_http.go internal/modules/music/http.go internal/modules/music/http_test.go
git commit -m "feat: expose music lyrics api"
```

---

### Task 5: Frontend API Client

**Files:**
- Modify: `Atoman-Frontend/src/api/client.ts`
- Modify: `Atoman-Frontend/src/api/musicV1.ts`
- Test: `Atoman-Frontend/tests/unit/api/musicV1.lyrics.spec.ts`

- [ ] **Step 1: Write API tests**

Create `Atoman-Frontend/tests/unit/api/musicV1.lyrics.spec.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/composables/useApi', () => ({ useApiUrl: () => '/api/v1' }))

const getMock = vi.fn()
const postMock = vi.fn()
const putMock = vi.fn()
const patchMock = vi.fn()
const deleteMock = vi.fn()

vi.mock('@/api/client', () => ({
  ApiErrorResponseError: class ApiErrorResponseError extends Error {},
  apiGet: (...args: unknown[]) => getMock(...args),
  apiGetEnvelope: (...args: unknown[]) => getMock(...args),
  apiPostJson: (...args: unknown[]) => postMock(...args),
  apiPutJson: (...args: unknown[]) => putMock(...args),
  apiPatchJson: (...args: unknown[]) => patchMock(...args),
  apiDeleteJson: (...args: unknown[]) => deleteMock(...args),
  apiPostMultipart: vi.fn(),
}))

describe('music lyrics API', async () => {
  const api = await import('@/api/musicV1')

  beforeEach(() => {
    getMock.mockReset()
    postMock.mockReset()
    putMock.mockReset()
    patchMock.mockReset()
    deleteMock.mockReset()
  })

  it('gets song lyrics', async () => {
    getMock.mockResolvedValue({ song_id: 'song-1', lines: [], annotations: [] })
    await api.getMusicSongLyrics('song-1')
    expect(getMock).toHaveBeenCalledWith('/api/v1/music/songs/song-1/lyrics')
  })

  it('saves song lyrics', async () => {
    putMock.mockResolvedValue({ song_id: 'song-1', lines: [], annotations: [] })
    await api.saveMusicSongLyrics('song-1', { content: 'hello', translation: '', format: 'plain', edit_summary: 'update' })
    expect(putMock).toHaveBeenCalledWith('/api/v1/music/songs/song-1/lyrics', {
      content: 'hello',
      translation: '',
      format: 'plain',
      edit_summary: 'update',
    })
  })

  it('votes on annotation', async () => {
    putMock.mockResolvedValue({ voted: true })
    await api.voteMusicLyricAnnotation('ann-1', 'down')
    expect(putMock).toHaveBeenCalledWith('/api/v1/music/lyrics/annotations/ann-1/vote', { vote: 'down' })
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

```bash
cd Atoman-Frontend
bun run test:unit -- tests/unit/api/musicV1.lyrics.spec.ts
```

Expected: fail because API functions and `apiPutJson` do not exist.

- [ ] **Step 3: Add PUT JSON helper**

Modify `src/api/client.ts` near the existing JSON helpers:

```ts
export async function apiPutJson<T>(url: string, body: unknown): Promise<T> {
  return unwrapResponse<T>(await fetch(url, {
    method: 'PUT',
    credentials: 'include',
    headers: withAuthHeaders(url, jsonHeaders),
    body: JSON.stringify(body),
  }))
}
```

- [ ] **Step 4: Add types and endpoints**

Modify `src/api/musicV1.ts` near existing music types:

```ts
export type MusicLyricFormat = 'plain' | 'lrc'
export type MusicLyricAnnotationStatus = 'active' | 'needs_rebind' | 'deleted'
export type MusicLyricAnnotationVote = 'up' | 'down'

export type MusicLyricLine = {
  id: string
  line_key: string
  line_index: number
  time_ms?: number | null
  text: string
  translation: string
}

export type MusicLyricAnnotation = {
  id: string
  song_id: string
  line_id: string
  selected_text: string
  start_offset: number
  end_offset: number
  body: string
  created_by: string
  status: MusicLyricAnnotationStatus
  upvotes: number
  downvotes: number
  net_score: number
  user_vote?: MusicLyricAnnotationVote
  can_edit: boolean
}

export type MusicSongLyrics = {
  song_id: string
  content: string
  translation: string
  format: MusicLyricFormat
  version: number
  edit_summary: string
  lines: MusicLyricLine[]
  annotations: MusicLyricAnnotation[]
}

export type SaveMusicSongLyricsInput = {
  content: string
  translation: string
  format: MusicLyricFormat
  edit_summary?: string
  annotation_resolutions?: Array<{
    annotation_id: string
    action: 'rebind' | 'needs_rebind'
    line_id?: string
    selected_text?: string
    start_offset?: number
    end_offset?: number
  }>
}
```

Add endpoints:

```ts
  songLyrics: (songId: string) => `${apiV1Base()}/music/songs/${songId}/lyrics`,
  lyricAnnotations: (songId: string) => `${apiV1Base()}/music/songs/${songId}/lyrics/annotations`,
  lyricAnnotation: (annotationId: string) => `${apiV1Base()}/music/lyrics/annotations/${annotationId}`,
  lyricAnnotationVote: (annotationId: string) => `${apiV1Base()}/music/lyrics/annotations/${annotationId}/vote`,
```

- [ ] **Step 5: Add API functions**

Modify the import from `@/api/client` in `src/api/musicV1.ts` to include `apiPutJson`:

```ts
import {
  apiDeleteJson,
  apiGet,
  apiGetEnvelope,
  apiPatchJson,
  apiPostJson,
  apiPostMultipart,
  apiPutJson,
} from '@/api/client'
```

Append near existing music API functions:

```ts
export async function getMusicSongLyrics(songId: string): Promise<MusicSongLyrics> {
  return apiGet<MusicSongLyrics>(musicV1Endpoints.songLyrics(songId))
}

export async function saveMusicSongLyrics(songId: string, input: SaveMusicSongLyricsInput): Promise<MusicSongLyrics> {
  return apiPutJson<MusicSongLyrics>(musicV1Endpoints.songLyrics(songId), input)
}

export async function createMusicLyricAnnotation(
  songId: string,
  input: Pick<MusicLyricAnnotation, 'line_id' | 'selected_text' | 'start_offset' | 'end_offset' | 'body'>,
): Promise<MusicLyricAnnotation> {
  return apiPostJson<MusicLyricAnnotation>(musicV1Endpoints.lyricAnnotations(songId), input)
}

export async function updateMusicLyricAnnotation(annotationId: string, body: string): Promise<MusicLyricAnnotation> {
  return apiPatchJson<MusicLyricAnnotation>(musicV1Endpoints.lyricAnnotation(annotationId), { body })
}

export async function deleteMusicLyricAnnotation(annotationId: string): Promise<{ deleted: boolean }> {
  return apiDeleteJson<{ deleted: boolean }>(musicV1Endpoints.lyricAnnotation(annotationId))
}

export async function voteMusicLyricAnnotation(annotationId: string, vote: MusicLyricAnnotationVote | null): Promise<{ voted: boolean }> {
  return apiPutJson<{ voted: boolean }>(musicV1Endpoints.lyricAnnotationVote(annotationId), { vote })
}
```

- [ ] **Step 6: Run API tests**

```bash
cd Atoman-Frontend
bun run test:unit -- tests/unit/api/musicV1.lyrics.spec.ts
```

Expected: pass.

- [ ] **Step 7: Commit**

```bash
cd Atoman-Frontend
git add src/api/client.ts src/api/musicV1.ts tests/unit/api/musicV1.lyrics.spec.ts
git commit -m "feat: add music lyrics api client"
```

---

### Task 6: Frontend Lyrics Utility

**Files:**
- Create: `Atoman-Frontend/src/utils/musicLyrics.ts`
- Test: `Atoman-Frontend/tests/unit/utils/musicLyrics.spec.ts`

- [ ] **Step 1: Write utility tests**

Create `tests/unit/utils/musicLyrics.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { computeCurrentLyricLine, getAnnotatedRanges, isValidSelectionOffset } from '@/utils/musicLyrics'
import type { MusicLyricAnnotation, MusicLyricLine } from '@/api/musicV1'

describe('musicLyrics utilities', () => {
  const lines: MusicLyricLine[] = [
    { id: 'line-1', line_key: '1', line_index: 0, time_ms: 1000, text: 'hello world', translation: '你好世界' },
    { id: 'line-2', line_key: '2', line_index: 1, time_ms: 3000, text: 'next line', translation: '下一句' },
  ]

  it('computes current line from playback time', () => {
    expect(computeCurrentLyricLine(lines, 1.2)?.id).toBe('line-1')
    expect(computeCurrentLyricLine(lines, 3.1)?.id).toBe('line-2')
  })

  it('validates selected text offsets', () => {
    expect(isValidSelectionOffset('hello world', 'world', 6, 11)).toBe(true)
    expect(isValidSelectionOffset('hello world', 'hello', 6, 11)).toBe(false)
  })

  it('builds annotated ranges for a line', () => {
    const annotations: MusicLyricAnnotation[] = [{
      id: 'ann-1',
      song_id: 'song-1',
      line_id: 'line-1',
      selected_text: 'world',
      start_offset: 6,
      end_offset: 11,
      body: 'planet',
      created_by: 'user-1',
      status: 'active',
      upvotes: 2,
      downvotes: 1,
      net_score: 1,
      can_edit: false,
    }]
    expect(getAnnotatedRanges(lines[0], annotations)).toEqual([{ start: 6, end: 11, annotationIds: ['ann-1'] }])
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

```bash
cd Atoman-Frontend
bun run test:unit -- tests/unit/utils/musicLyrics.spec.ts
```

Expected: fail because utility file does not exist.

- [ ] **Step 3: Implement utilities**

Create `src/utils/musicLyrics.ts`:

```ts
import type { MusicLyricAnnotation, MusicLyricLine } from '@/api/musicV1'

export type AnnotatedRange = {
  start: number
  end: number
  annotationIds: string[]
}

export function computeCurrentLyricLine(lines: MusicLyricLine[], currentTimeSeconds: number): MusicLyricLine | null {
  const timed = lines
    .filter((line) => typeof line.time_ms === 'number')
    .sort((a, b) => Number(a.time_ms) - Number(b.time_ms))
  if (!timed.length) return null

  const currentMS = currentTimeSeconds * 1000
  let current: MusicLyricLine | null = timed[0]
  for (const line of timed) {
    if (Number(line.time_ms) <= currentMS) {
      current = line
      continue
    }
    break
  }
  return current
}

export function isValidSelectionOffset(lineText: string, selectedText: string, startOffset: number, endOffset: number): boolean {
  const chars = Array.from(lineText)
  if (startOffset < 0 || endOffset > chars.length || startOffset >= endOffset) return false
  return chars.slice(startOffset, endOffset).join('') === selectedText
}

export function getAnnotatedRanges(line: MusicLyricLine, annotations: MusicLyricAnnotation[]): AnnotatedRange[] {
  const ranges = annotations
    .filter((annotation) => annotation.status === 'active' && annotation.line_id === line.id)
    .filter((annotation) => isValidSelectionOffset(line.text, annotation.selected_text, annotation.start_offset, annotation.end_offset))
    .map((annotation) => ({
      start: annotation.start_offset,
      end: annotation.end_offset,
      annotationIds: [annotation.id],
    }))
  return mergeRanges(ranges)
}

function mergeRanges(ranges: AnnotatedRange[]): AnnotatedRange[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end)
  const merged: AnnotatedRange[] = []
  for (const range of sorted) {
    const last = merged[merged.length - 1]
    if (!last || range.start > last.end) {
      merged.push({ ...range })
      continue
    }
    last.end = Math.max(last.end, range.end)
    last.annotationIds.push(...range.annotationIds)
  }
  return merged
}
```

- [ ] **Step 4: Run utility tests**

```bash
cd Atoman-Frontend
bun run test:unit -- tests/unit/utils/musicLyrics.spec.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
cd Atoman-Frontend
git add src/utils/musicLyrics.ts tests/unit/utils/musicLyrics.spec.ts
git commit -m "feat: add music lyrics utilities"
```

---

### Task 7: Frontend Composable

**Files:**
- Create: `Atoman-Frontend/src/composables/useMusicLyrics.ts`

- [ ] **Step 1: Create composable**

Create `src/composables/useMusicLyrics.ts`:

```ts
import { computed, ref } from 'vue'
import {
  createMusicLyricAnnotation,
  deleteMusicLyricAnnotation,
  getMusicSongLyrics,
  saveMusicSongLyrics,
  updateMusicLyricAnnotation,
  voteMusicLyricAnnotation,
  type MusicLyricAnnotation,
  type MusicLyricAnnotationVote,
  type MusicSongLyrics,
  type SaveMusicSongLyricsInput,
} from '@/api/musicV1'
import { computeCurrentLyricLine } from '@/utils/musicLyrics'

export function useMusicLyrics() {
  const lyrics = ref<MusicSongLyrics | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const errorMessage = ref('')

  const annotationsByLine = computed(() => {
    const map = new Map<string, MusicLyricAnnotation[]>()
    for (const annotation of lyrics.value?.annotations ?? []) {
      if (annotation.status === 'deleted') continue
      const list = map.get(annotation.line_id) ?? []
      list.push(annotation)
      map.set(annotation.line_id, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => (
        b.net_score - a.net_score
        || b.upvotes - a.upvotes
        || a.id.localeCompare(b.id)
      ))
    }
    return map
  })

  async function load(songId: string) {
    loading.value = true
    errorMessage.value = ''
    try {
      lyrics.value = await getMusicSongLyrics(songId)
    } catch (error) {
      console.error('Failed to load music lyrics:', error)
      errorMessage.value = '歌词加载失败'
      lyrics.value = null
    } finally {
      loading.value = false
    }
  }

  async function save(songId: string, input: SaveMusicSongLyricsInput) {
    saving.value = true
    errorMessage.value = ''
    try {
      lyrics.value = await saveMusicSongLyrics(songId, input)
    } finally {
      saving.value = false
    }
  }

  async function createAnnotation(songId: string, input: Parameters<typeof createMusicLyricAnnotation>[1]) {
    const annotation = await createMusicLyricAnnotation(songId, input)
    if (lyrics.value) {
      lyrics.value.annotations = [...lyrics.value.annotations, annotation]
    }
  }

  async function updateAnnotation(annotationId: string, body: string) {
    const updated = await updateMusicLyricAnnotation(annotationId, body)
    if (lyrics.value) {
      lyrics.value.annotations = lyrics.value.annotations.map((item) => item.id === annotationId ? updated : item)
    }
  }

  async function deleteAnnotation(annotationId: string) {
    await deleteMusicLyricAnnotation(annotationId)
    if (lyrics.value) {
      lyrics.value.annotations = lyrics.value.annotations.filter((item) => item.id !== annotationId)
    }
  }

  async function voteAnnotation(annotationId: string, vote: MusicLyricAnnotationVote | null) {
    await voteMusicLyricAnnotation(annotationId, vote)
    if (lyrics.value?.song_id) {
      await load(lyrics.value.song_id)
    }
  }

  function currentLine(currentTime: number) {
    return computeCurrentLyricLine(lyrics.value?.lines ?? [], currentTime)
  }

  return {
    lyrics,
    loading,
    saving,
    errorMessage,
    annotationsByLine,
    load,
    save,
    createAnnotation,
    updateAnnotation,
    deleteAnnotation,
    voteAnnotation,
    currentLine,
  }
}
```

- [ ] **Step 2: Run type-check for composable**

```bash
cd Atoman-Frontend
bun run type-check
```

Expected: pass.

- [ ] **Step 3: Commit**

```bash
cd Atoman-Frontend
git add src/composables/useMusicLyrics.ts
git commit -m "feat: add music lyrics composable"
```

---

### Task 8: Frontend Lyrics Display Components

**Files:**
- Create: `Atoman-Frontend/src/components/music/MusicLyricsLine.vue`
- Create: `Atoman-Frontend/src/components/music/MusicAnnotationPanel.vue`
- Create: `Atoman-Frontend/src/components/music/MusicAnnotationEditor.vue`

- [ ] **Step 1: Create `MusicLyricsLine.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { MusicLyricAnnotation, MusicLyricLine } from '@/api/musicV1'
import { getAnnotatedRanges } from '@/utils/musicLyrics'

const props = defineProps<{
  line: MusicLyricLine
  annotations: MusicLyricAnnotation[]
  active?: boolean
  bilingual?: boolean
}>()

const emit = defineEmits<{
  (e: 'select-text', payload: { line: MusicLyricLine; selectedText: string; startOffset: number; endOffset: number }): void
  (e: 'open-annotations', payload: { line: MusicLyricLine; annotationIds: string[] }): void
}>()

const ranges = computed(() => getAnnotatedRanges(props.line, props.annotations))

function handleMouseUp() {
  const selection = window.getSelection()
  const selectedText = selection?.toString() ?? ''
  if (!selectedText.trim()) return
  const start = props.line.text.indexOf(selectedText)
  if (start < 0) return
  emit('select-text', {
    line: props.line,
    selectedText,
    startOffset: start,
    endOffset: start + Array.from(selectedText).length,
  })
}
</script>

<template>
  <div class="music-lyric-line" :class="{ 'is-active': active }" @mouseup="handleMouseUp">
    <p class="music-lyric-line__text">
      <template v-if="ranges.length">
        <span>{{ line.text.slice(0, ranges[0].start) }}</span>
        <button
          type="button"
          class="music-lyric-line__annotated"
          @click="emit('open-annotations', { line, annotationIds: ranges[0].annotationIds })"
        >
          {{ line.text.slice(ranges[0].start, ranges[0].end) }}
        </button>
        <span>{{ line.text.slice(ranges[0].end) }}</span>
      </template>
      <template v-else>{{ line.text }}</template>
    </p>
    <p v-if="bilingual && line.translation" class="music-lyric-line__translation">{{ line.translation }}</p>
  </div>
</template>

<style scoped>
.music-lyric-line { padding: 0.65rem 0; opacity: 0.45; transition: opacity 0.18s ease, transform 0.18s ease; }
.music-lyric-line.is-active { opacity: 1; transform: translateX(0.2rem); }
.music-lyric-line__text { margin: 0; font-size: clamp(1.3rem, 2vw, 2rem); font-weight: 900; line-height: 1.25; }
.music-lyric-line__translation { margin: 0.35rem 0 0; color: var(--a-color-muted); font-size: 0.95rem; line-height: 1.45; }
.music-lyric-line__annotated { border: 0; background: color-mix(in srgb, #fff2a8 70%, transparent); color: inherit; font: inherit; padding: 0 0.2rem; cursor: pointer; }
</style>
```

- [ ] **Step 2: Create `MusicAnnotationPanel.vue`**

```vue
<script setup lang="ts">
import type { MusicLyricAnnotation, MusicLyricAnnotationVote } from '@/api/musicV1'
import PButton from '@/components/ui/PButton.vue'

defineProps<{ annotations: MusicLyricAnnotation[] }>()
const emit = defineEmits<{
  (e: 'vote', annotationId: string, vote: MusicLyricAnnotationVote | null): void
  (e: 'edit', annotation: MusicLyricAnnotation): void
  (e: 'delete', annotationId: string): void
}>()
</script>

<template>
  <aside class="music-annotation-panel">
    <h3>注释</h3>
    <p v-if="!annotations.length" class="music-annotation-panel__empty">暂无注释</p>
    <article v-for="annotation in annotations" :key="annotation.id" class="music-annotation">
      <p>{{ annotation.body }}</p>
      <div class="music-annotation__meta">
        <button type="button" @click="emit('vote', annotation.id, annotation.user_vote === 'up' ? null : 'up')">赞 {{ annotation.upvotes }}</button>
        <button type="button" @click="emit('vote', annotation.id, annotation.user_vote === 'down' ? null : 'down')">踩 {{ annotation.downvotes }}</button>
        <span>净 {{ annotation.net_score }}</span>
      </div>
      <div v-if="annotation.can_edit" class="music-annotation__actions">
        <PButton type="button" variant="ghost" @click="emit('edit', annotation)">编辑</PButton>
        <PButton type="button" variant="ghost" @click="emit('delete', annotation.id)">删除</PButton>
      </div>
    </article>
  </aside>
</template>

<style scoped>
.music-annotation-panel { padding: 1rem; border-left: 1px solid var(--a-color-line-soft); background: var(--a-color-paper); overflow: auto; }
.music-annotation-panel h3 { margin: 0 0 1rem; }
.music-annotation { border-bottom: 1px solid var(--a-color-line-soft); padding: 0.9rem 0; }
.music-annotation p { margin: 0 0 0.75rem; line-height: 1.55; }
.music-annotation__meta, .music-annotation__actions { display: flex; gap: 0.5rem; align-items: center; }
.music-annotation__meta button { border: 1px solid var(--a-color-line-soft); background: transparent; cursor: pointer; }
.music-annotation-panel__empty { color: var(--a-color-muted); }
</style>
```

- [ ] **Step 3: Create `MusicAnnotationEditor.vue`**

```vue
<script setup lang="ts">
import { ref, watch } from 'vue'
import PButton from '@/components/ui/PButton.vue'
import PTextarea from '@/components/ui/PTextarea.vue'

const props = defineProps<{
  show: boolean
  selectedText?: string
  initialBody?: string
}>()

const emit = defineEmits<{
  (e: 'save', body: string): void
  (e: 'cancel'): void
}>()

const body = ref('')

watch(() => props.show, (show) => {
  if (show) body.value = props.initialBody ?? ''
}, { immediate: true })
</script>

<template>
  <div v-if="show" class="music-annotation-editor">
    <p v-if="selectedText" class="music-annotation-editor__quote">{{ selectedText }}</p>
    <PTextarea v-model="body" label="注释" placeholder="写下这句歌词的解释" :rows="5" />
    <div class="music-annotation-editor__actions">
      <PButton type="button" variant="secondary" @click="emit('cancel')">取消</PButton>
      <PButton type="button" variant="primary" :disabled="!body.trim()" @click="emit('save', body.trim())">保存</PButton>
    </div>
  </div>
</template>

<style scoped>
.music-annotation-editor { padding: 1rem; border: 1px solid var(--a-color-line-soft); background: var(--a-color-paper); }
.music-annotation-editor__quote { margin: 0 0 0.75rem; font-weight: 800; }
.music-annotation-editor__actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.75rem; }
</style>
```

- [ ] **Step 4: Run type-check**

```bash
cd Atoman-Frontend
bun run type-check
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
cd Atoman-Frontend
git add src/components/music/MusicLyricsLine.vue src/components/music/MusicAnnotationPanel.vue src/components/music/MusicAnnotationEditor.vue
git commit -m "feat: add music lyric annotation components"
```

---

### Task 9: Lyrics Panel and Player Integration

**Files:**
- Create: `Atoman-Frontend/src/components/music/MusicLyricsPanel.vue`
- Modify: `Atoman-Frontend/src/components/music/AudioPlayer.vue`
- Test: `Atoman-Frontend/tests/unit/components/music/MusicLyricsPanel.spec.ts`

- [ ] **Step 1: Write panel test**

Create `tests/unit/components/music/MusicLyricsPanel.spec.ts`:

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import MusicLyricsPanel from '@/components/music/MusicLyricsPanel.vue'

vi.mock('@/composables/useMusicLyrics', () => ({
  useMusicLyrics: () => ({
    lyrics: {
      value: {
        song_id: 'song-1',
        content: '[00:01.00]Hello',
        translation: '[00:01.00]你好',
        format: 'lrc',
        version: 1,
        edit_summary: '',
        lines: [{ id: 'line-1', line_key: 'k', line_index: 0, time_ms: 1000, text: 'Hello', translation: '你好' }],
        annotations: [],
      },
    },
    loading: { value: false },
    errorMessage: { value: '' },
    annotationsByLine: { value: new Map() },
    load: vi.fn(),
    createAnnotation: vi.fn(),
    voteAnnotation: vi.fn(),
    updateAnnotation: vi.fn(),
    deleteAnnotation: vi.fn(),
    currentLine: () => ({ id: 'line-1' }),
  }),
}))

describe('MusicLyricsPanel', () => {
  it('renders bilingual lyrics', () => {
    const wrapper = mount(MusicLyricsPanel, {
      props: {
        show: true,
        song: { id: 'song-1', title: 'Song', artist: 'Artist', album: 'Album', album_id: 'album-1', year: 2026, release_date: '', lyrics: '', audio_url: '', cover_url: '', status: 'open' },
        currentTime: 1.2,
        duration: 3,
      },
    })
    expect(wrapper.text()).toContain('Hello')
    expect(wrapper.text()).toContain('你好')
  })
})
```

- [ ] **Step 2: Run panel test to verify failure**

```bash
cd Atoman-Frontend
bun run test:unit -- tests/unit/components/music/MusicLyricsPanel.spec.ts
```

Expected: fail because component does not exist.

- [ ] **Step 3: Create `MusicLyricsPanel.vue`**

```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Song } from '@/types'
import MusicLyricsLine from '@/components/music/MusicLyricsLine.vue'
import MusicAnnotationPanel from '@/components/music/MusicAnnotationPanel.vue'
import MusicAnnotationEditor from '@/components/music/MusicAnnotationEditor.vue'
import { useMusicLyrics } from '@/composables/useMusicLyrics'
import type { MusicLyricAnnotation, MusicLyricLine } from '@/api/musicV1'

const props = defineProps<{
  show: boolean
  song: Song | null
  currentTime: number
  duration: number
}>()

const emit = defineEmits<{ (e: 'close'): void }>()

const { lyrics, loading, errorMessage, annotationsByLine, load, createAnnotation, voteAnnotation, updateAnnotation, deleteAnnotation, currentLine } = useMusicLyrics()
const bilingual = ref(true)
const selectedAnnotationIds = ref<string[]>([])
const annotationDraft = ref<null | { line: MusicLyricLine; selectedText: string; startOffset: number; endOffset: number }>(null)

watch(() => [props.show, props.song?.id] as const, ([show, songId]) => {
  if (show && songId) void load(String(songId))
}, { immediate: true })

const activeLine = computed(() => currentLine(props.currentTime))
const selectedAnnotations = computed(() => {
  const ids = new Set(selectedAnnotationIds.value)
  return (lyrics.value?.annotations ?? []).filter((annotation) => ids.has(annotation.id))
})

function openAnnotations(payload: { line: MusicLyricLine; annotationIds: string[] }) {
  selectedAnnotationIds.value = payload.annotationIds
}

function startAnnotation(payload: { line: MusicLyricLine; selectedText: string; startOffset: number; endOffset: number }) {
  annotationDraft.value = payload
}

async function saveAnnotation(body: string) {
  if (!props.song?.id || !annotationDraft.value) return
  await createAnnotation(String(props.song.id), {
    line_id: annotationDraft.value.line.id,
    selected_text: annotationDraft.value.selectedText,
    start_offset: annotationDraft.value.startOffset,
    end_offset: annotationDraft.value.endOffset,
    body,
  })
  annotationDraft.value = null
}
</script>

<template>
  <Transition name="slide-up">
    <section v-if="show && song" class="music-lyrics-panel">
      <header class="music-lyrics-panel__header">
        <div>
          <h2>{{ song.title }}</h2>
          <p>{{ song.artist || song.artists?.map((artist) => artist.name).join(' / ') || '未知艺术家' }}</p>
        </div>
        <div class="music-lyrics-panel__actions">
          <button type="button" :class="{ active: !bilingual }" @click="bilingual = false">原文</button>
          <button type="button" :class="{ active: bilingual }" @click="bilingual = true">双语</button>
          <button type="button" @click="emit('close')">关闭</button>
        </div>
      </header>

      <div class="music-lyrics-panel__body">
        <main class="music-lyrics-panel__lines">
          <p v-if="loading" class="music-lyrics-panel__state">正在加载歌词...</p>
          <p v-else-if="errorMessage" class="music-lyrics-panel__state music-lyrics-panel__state--error">{{ errorMessage }}</p>
          <p v-else-if="!lyrics?.lines.length" class="music-lyrics-panel__state">暂无歌词</p>
          <MusicLyricsLine
            v-for="line in lyrics?.lines ?? []"
            :key="line.id"
            :line="line"
            :annotations="annotationsByLine.get(line.id) ?? []"
            :active="activeLine?.id === line.id"
            :bilingual="bilingual"
            @select-text="startAnnotation"
            @open-annotations="openAnnotations"
          />
        </main>
        <MusicAnnotationPanel
          class="music-lyrics-panel__annotations"
          :annotations="selectedAnnotations"
          @vote="voteAnnotation"
          @edit="(annotation: MusicLyricAnnotation) => selectedAnnotationIds = [annotation.id]"
          @delete="deleteAnnotation"
        />
      </div>

      <MusicAnnotationEditor
        :show="annotationDraft !== null"
        :selected-text="annotationDraft?.selectedText"
        @save="saveAnnotation"
        @cancel="annotationDraft = null"
      />
    </section>
  </Transition>
</template>

<style scoped>
.music-lyrics-panel { position: fixed; inset: 0; z-index: 2100; background: var(--a-color-bg); color: var(--a-color-fg); display: grid; grid-template-rows: auto 1fr auto; }
.music-lyrics-panel__header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.5rem; border-bottom: 1px solid var(--a-color-line-soft); }
.music-lyrics-panel__header h2, .music-lyrics-panel__header p { margin: 0; }
.music-lyrics-panel__actions { display: flex; gap: 0.5rem; }
.music-lyrics-panel__actions button { border: 1px solid var(--a-color-line-soft); background: transparent; padding: 0.45rem 0.75rem; cursor: pointer; }
.music-lyrics-panel__actions button.active { background: var(--a-color-fg); color: var(--a-color-bg); }
.music-lyrics-panel__body { min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) minmax(280px, 360px); }
.music-lyrics-panel__lines { overflow: auto; padding: 12vh 8vw; }
.music-lyrics-panel__state { color: var(--a-color-muted); }
.music-lyrics-panel__state--error { color: var(--a-color-danger, #b42318); }
@media (max-width: 760px) { .music-lyrics-panel__body { grid-template-columns: 1fr; } .music-lyrics-panel__annotations { border-left: 0; border-top: 1px solid var(--a-color-line-soft); max-height: 42vh; } }
</style>
```

- [ ] **Step 4: Wire into `AudioPlayer.vue`**

In `AudioPlayer.vue`, replace the existing lyrics transition block with:

```vue
  <MusicLyricsPanel
    :show="player.showLyrics"
    :song="player.currentSong"
    :current-time="player.currentTime"
    :duration="player.duration"
    @close="player.toggleLyrics"
  />
```

Add import:

```ts
import MusicLyricsPanel from '@/components/music/MusicLyricsPanel.vue'
```

- [ ] **Step 5: Run panel test**

```bash
cd Atoman-Frontend
bun run test:unit -- tests/unit/components/music/MusicLyricsPanel.spec.ts
```

Expected: pass after adjusting test mocks for Vue refs if needed.

- [ ] **Step 6: Commit**

```bash
cd Atoman-Frontend
git add src/components/music/MusicLyricsPanel.vue src/components/music/AudioPlayer.vue tests/unit/components/music/MusicLyricsPanel.spec.ts
git commit -m "feat: add music lyrics panel"
```

---

### Task 10: Lyric Wiki Editor

**Files:**
- Create: `Atoman-Frontend/src/components/music/MusicLyricEditorDrawer.vue`
- Modify: `Atoman-Frontend/src/components/music/MusicLyricsPanel.vue`

- [ ] **Step 1: Create editor drawer**

Create `src/components/music/MusicLyricEditorDrawer.vue`:

```vue
<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { MusicSongLyrics, MusicLyricFormat, SaveMusicSongLyricsInput } from '@/api/musicV1'
import PSheet from '@/components/ui/PSheet.vue'
import PButton from '@/components/ui/PButton.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import PInput from '@/components/ui/PInput.vue'

const props = defineProps<{
  show: boolean
  lyrics: MusicSongLyrics | null
  saving?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', input: SaveMusicSongLyricsInput): void
}>()

const form = reactive({
  content: '',
  translation: '',
  format: 'plain' as MusicLyricFormat,
  editSummary: '',
})

watch(() => props.show, (show) => {
  if (!show) return
  form.content = props.lyrics?.content ?? ''
  form.translation = props.lyrics?.translation ?? ''
  form.format = props.lyrics?.format ?? 'plain'
  form.editSummary = ''
}, { immediate: true })

function save() {
  emit('save', {
    content: form.content,
    translation: form.translation,
    format: form.format,
    edit_summary: form.editSummary.trim() || '更新歌词',
  })
}
</script>

<template>
  <PSheet :show="show" width="720px" @close="emit('close')">
    <div class="music-lyric-editor">
      <h2>编辑歌词</h2>
      <div class="music-lyric-editor__format">
        <label>
          <input v-model="form.format" type="radio" value="plain" />
          普通文本
        </label>
        <label>
          <input v-model="form.format" type="radio" value="lrc" />
          LRC
        </label>
      </div>
      <PTextarea v-model="form.content" label="原文歌词" placeholder="输入或粘贴歌词" :rows="12" />
      <PTextarea v-model="form.translation" label="翻译歌词" placeholder="可选：输入或粘贴翻译" :rows="8" />
      <PInput v-model="form.editSummary" label="修改说明" placeholder="更新歌词" />
      <div class="music-lyric-editor__actions">
        <PButton type="button" variant="secondary" @click="emit('close')">取消</PButton>
        <PButton type="button" variant="primary" :disabled="saving" @click="save">保存</PButton>
      </div>
    </div>
  </PSheet>
</template>

<style scoped>
.music-lyric-editor { display: grid; gap: 1rem; }
.music-lyric-editor h2 { margin: 0; }
.music-lyric-editor__format { display: flex; gap: 1rem; }
.music-lyric-editor__actions { display: flex; justify-content: flex-end; gap: 0.75rem; }
</style>
```

- [ ] **Step 2: Add editor entry to panel**

Modify `MusicLyricsPanel.vue`:

```ts
import MusicLyricEditorDrawer from '@/components/music/MusicLyricEditorDrawer.vue'
const editingLyrics = ref(false)
```

Add button in actions:

```vue
<button type="button" @click="editingLyrics = true">编辑歌词</button>
```

Add drawer near bottom:

```vue
<MusicLyricEditorDrawer
  :show="editingLyrics"
  :lyrics="lyrics"
  :saving="saving"
  @close="editingLyrics = false"
  @save="async (input) => { if (song?.id) { await save(String(song.id), input); editingLyrics = false } }"
/>
```

Ensure `saving` and `save` are destructured from `useMusicLyrics()`.

- [ ] **Step 3: Run frontend type-check**

```bash
cd Atoman-Frontend
bun run type-check
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
cd Atoman-Frontend
git add src/components/music/MusicLyricEditorDrawer.vue src/components/music/MusicLyricsPanel.vue
git commit -m "feat: add music lyric wiki editor"
```

---

### Task 11: Backend Version List and Revert

**Files:**
- Modify: `Atoman-Backend/internal/modules/music/lyrics_service.go`
- Modify: `Atoman-Backend/internal/modules/music/lyrics_http.go`
- Modify: `Atoman-Backend/internal/modules/music/http.go`
- Test: `Atoman-Backend/internal/modules/music/lyrics_service_test.go`

- [ ] **Step 1: Write revert test**

Append to `lyrics_service_test.go`:

```go
func TestRevertLyricsCreatesNewVersion(t *testing.T) {
	svc, _, user, song := newLyricsServiceTest(t)
	if _, err := svc.SaveSongLyrics(user, song.ID, SaveLyricsInput{Content: "first", Format: "plain"}); err != nil {
		t.Fatalf("save first: %v", err)
	}
	if _, err := svc.SaveSongLyrics(user, song.ID, SaveLyricsInput{Content: "second", Format: "plain"}); err != nil {
		t.Fatalf("save second: %v", err)
	}
	result, err := svc.RevertSongLyrics(user, song.ID, 1, "restore first")
	if err != nil {
		t.Fatalf("revert: %v", err)
	}
	if result.Version != 3 || result.Content != "first" {
		t.Fatalf("unexpected reverted lyrics: %#v", result)
	}
}
```

- [ ] **Step 2: Run test to verify failure**

```bash
cd Atoman-Backend
go test ./internal/modules/music -run TestRevertLyricsCreatesNewVersion -count=1
```

Expected: fail because `RevertSongLyrics` does not exist.

- [ ] **Step 3: Implement version list and revert**

Add to `lyrics_service.go`:

```go
func (s *Service) ListSongLyricVersions(songID uuid.UUID) ([]model.MusicSongLyricVersion, error) {
	var versions []model.MusicSongLyricVersion
	err := s.db.Where("song_id = ?", songID).Order("version DESC").Find(&versions).Error
	return versions, err
}

func (s *Service) RevertSongLyrics(user authctx.CurrentUser, songID uuid.UUID, version int, editSummary string) (MusicLyricsDTO, error) {
	var existing model.MusicSongLyricVersion
	if err := s.db.First(&existing, "song_id = ? AND version = ?", songID, version).Error; err != nil {
		return MusicLyricsDTO{}, err
	}
	if strings.TrimSpace(editSummary) == "" {
		editSummary = fmt.Sprintf("回滚到版本 %d", version)
	}
	return s.SaveSongLyrics(user, songID, SaveLyricsInput{
		Content: existing.Content,
		Translation: existing.Translation,
		Format: existing.Format,
		EditSummary: editSummary,
	})
}
```

- [ ] **Step 4: Add HTTP handlers**

Add to `lyrics_http.go`:

```go
type revertLyricsRequest struct {
	EditSummary string `json:"edit_summary"`
}

func (h *Handler) listSongLyricVersions(c *gin.Context) {
	songID, err := parseMusicID(c.Param("songId"), "songId")
	if err != nil {
		httpx.Error(c, err)
		return
	}
	versions, err := h.service.ListSongLyricVersions(songID)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, http.StatusOK, versions)
}

func (h *Handler) revertSongLyrics(c *gin.Context) {
	user, ok := currentMusicUser(c)
	if !ok {
		httpx.Error(c, apperr.Unauthorized("Login required"))
		return
	}
	songID, err := parseMusicID(c.Param("songId"), "songId")
	if err != nil {
		httpx.Error(c, err)
		return
	}
	version, err := strconv.Atoi(c.Param("version"))
	if err != nil {
		httpx.Error(c, apperr.BadRequest("music.invalid_lyrics_version", "Invalid lyrics version"))
		return
	}
	var req revertLyricsRequest
	if err := bindJSON(c, &req); err != nil {
		httpx.Error(c, err)
		return
	}
	result, err := h.service.RevertSongLyrics(user, songID, version, req.EditSummary)
	if err != nil {
		httpx.Error(c, err)
		return
	}
	httpx.OK(c, http.StatusOK, result)
}
```

Add import to `lyrics_http.go`:

```go
import "strconv"
```

- [ ] **Step 5: Register routes**

Add in `RegisterRoutes`:

```go
	group.GET("/songs/:songId/lyrics/versions", h.listSongLyricVersions)
	group.POST("/songs/:songId/lyrics/versions/:version/revert", h.revertSongLyrics)
```

- [ ] **Step 6: Run test**

```bash
cd Atoman-Backend
go test ./internal/modules/music -run TestRevertLyricsCreatesNewVersion -count=1
```

Expected: pass.

- [ ] **Step 7: Commit**

```bash
cd Atoman-Backend
git add internal/modules/music/lyrics_service.go internal/modules/music/lyrics_http.go internal/modules/music/http.go internal/modules/music/lyrics_service_test.go
git commit -m "feat: add music lyric versions"
```

---

### Task 12: Final Verification and Cleanup

**Files:**
- All files touched by prior tasks.

- [ ] **Step 1: Confirm conflict markers are gone**

```bash
cd Atoman-Frontend
rg -n '<<<<<<<|=======|>>>>>>>' src/components/music/AlbumDrawer.vue || true
```

Expected: no output.

- [ ] **Step 2: Run backend build**

```bash
cd Atoman-Backend
go build ./...
```

Expected: no output and exit code 0.

- [ ] **Step 3: Run backend music tests**

```bash
cd Atoman-Backend
go test ./internal/modules/music ./internal/migrations -count=1
```

Expected: pass.

- [ ] **Step 4: Run frontend type-check**

```bash
cd Atoman-Frontend
bun run type-check
```

Expected: pass.

- [ ] **Step 5: Run focused frontend tests**

```bash
cd Atoman-Frontend
bun run test:unit -- tests/unit/utils/musicLyrics.spec.ts tests/unit/api/musicV1.lyrics.spec.ts tests/unit/components/music/MusicLyricsPanel.spec.ts
```

Expected: pass.

- [ ] **Step 6: Inspect final git status**

```bash
cd Atoman-Frontend
git status --short
```

Expected: no unstaged lyrics feature files remain.

---

## Self-Review

Spec coverage:

- Song-level wiki lyrics: Tasks 1, 3, 4, 10, 11.
- Original and bilingual lyrics: Tasks 2, 5, 8, 9, 10.
- Rolling lyrics: Tasks 6 and 9.
- Selected-text annotations: Tasks 1, 3, 4, 8, 9.
- Annotation author-only edit/delete: Task 3 and Task 4.
- Upvote/downvote: Task 3, Task 4, Task 8.
- Net score sorting: Task 7 and backend DTO helpers in Task 3.
- Anchor conflict handling: Task 3 and Task 10 baseline.
- Minimal notification record: Task 1 and Task 3.
- Version history and revert: Task 11.
- Stage 2 is intentionally out of implementation scope.

Known implementation risks:

- The plan uses a simple offset calculation in `MusicLyricsLine.vue` based on `indexOf`. This is acceptable for stage 1 but should be improved in stage 2 for repeated selected text.
- The plan uses current component patterns but does not introduce a global notification UI. Notification module planning follows this plan.
- The frontend API plan adds `apiPutJson` and uses it for `PUT /lyrics` and `PUT /lyrics/annotations/:id/vote`.
