# Music Module Wiki UI/UX Design Spec

## 1. Overview
This document outlines the UX and UI redesign for the Music module, bringing the backend wiki-style collaboration features (revision history, 3-way merge conflict resolution, approval workflow) to the frontend. The design strictly adheres to the "Paper & Ink" aesthetic, emphasizing spatial depth, typography, and context retention through stacked sheet interactions.

## 2. Global Navigation (Sidebar)
The sidebar is simplified to focus on core user intents rather than mixing consumption and management:
- **探索 (Explore)**: Random discovery / hot feeds.
- **艺术家 (Artists)**: The primary entry point for browsing the library.
- **我的收藏 (Starred)**: User's saved albums/artists.

## 3. Core Interaction Architecture: Paper Stacking
To maintain context and prevent audio playback interruption, the application relies on a multi-level stacked drawer (PaperSheet) system rather than traditional page routing.

### Level 1: Base View (Artist Grid)
- **Content**: A grid of artist cards (random or trending by default).
- **Actions**:
  - A prominent search bar to find artists.
  - If an artist is not found, an adjacent "添加艺术家 (Add Artist)" button opens a form drawer.

### Level 2: Artist Drawer (PaperSheet)
- **Trigger**: Clicking an artist card in Level 1.
- **Transition**: Level 1 shifts slightly left and dims; Level 2 slides in from the right.
- **Layout**:
  - **Header**: Artist metadata (Name, bio, status badges).
  - **Actions**: "✍ 修订艺术家信息 (Revise Artist)" and "+ 添加新专辑 (Add Album)".
  - **Album List (Timeline)**: A single-column list representing the artist's discography.
    - **Left Column**: Release year (large) and date.
    - **Right Column**: Album card (Cover, Title, Tracks count, Type).
    - **Controls**: Sorting dropdown (Newest to Oldest / Oldest to Newest).

### Level 3: Album Drawer (PaperSheet)
- **Trigger**: Clicking an album row in Level 2.
- **Transition**: Level 2 shifts slightly left; Level 3 slides in from the right.
- **Layout Framework (The "Boxes")**:
  - **Box A: Meta**: Cover art, Title, Artist, Year, Genre, and protection/entry status badges.
  - **Box B: Action Center**: 
    - Primary solid button: "▶ 播放全专 (Play Album)".
    - Secondary actions: "★ 收藏 (Star)".
    - Wiki actions (dashed borders): "✍ 修订 (Revise)" and "⏱ 历史 (History)".
  - **Box C: Tracklist**: Minimalist list of tracks and durations.

### Level 4: Nested Form/List Drawer
- **Trigger**: Clicking any Wiki action (Revise, History, Add Album) from Level 2 or Level 3.
- **Behavior**: Slides in over the current drawer to present forms or complex lists without navigating away.
  - **Revise Form**: Inline fields for Title, Date, Genre, Summary, and a mandatory "Edit Summary" field. Warns users if the entry is protected.
  - **History List**: A vertical timeline showing version numbers, status (PENDING, APPROVED), edit summaries, author, and a "View Diff" action.
  - **Conflict Resolution**: If a save fails due to a 3-way merge conflict, this drawer renders the conflict UI, displaying the server's version alongside the user's version for manual selection.

## 4. Discussion Placement
To avoid cluttering the main content flow, the "Discussion" feature is accessed via a right-edge trigger (similar to `PaperIndexTrigger` in the Feed module) or integrated into the Action Bar, sliding out its own drawer. It does not act as a primary tab next to the tracklist.

## 5. Implementation Notes
- Requires enhancing the existing `PaperSheet` component or creating a nested drawer manager to handle the `shifted` CSS states (scale, translateX, opacity) cleanly.
- The global `AudioPlayer` remains fixed at the bottom throughout all drawer transitions.
