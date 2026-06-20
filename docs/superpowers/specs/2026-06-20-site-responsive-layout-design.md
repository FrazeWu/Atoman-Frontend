# Site Responsive Layout Design

## Context

The frontend currently uses a shared module shell built around `a-module-layout`, `PSidebar`, and `a-main-content`. This pattern is used by multiple modules including feed, kanbo, blog, forum, debate, music, video, podcast, and timeline.

The current responsive behavior is not coherent across the site. At narrower widths, the left sidebar can continue to consume horizontal space and squeeze the content area until the main reading surface becomes hard to use. The fix should not be a page-local patch. It should define one site-wide responsive navigation and layout model that shared module layouts follow.

The selected product direction is:

1. Desktop keeps the left module sidebar.
2. Tablet keeps a narrower or collapsible sidebar.
3. Mobile removes the left sidebar and uses a fixed bottom navigation similar to Notion.

## Goals

1. Prevent shared module layouts from compressing the main content area on smaller screens.
2. Replace the current ad hoc small-screen behavior with one consistent site-wide responsive navigation model.
3. Keep desktop information density and existing sidebar-driven workflows intact.
4. Give mobile a single primary navigation surface instead of mixing sidebar, drawer, and tabs.
5. Reuse shared layout primitives rather than letting each module invent its own mobile shell.

## Non-Goals

1. No full visual redesign of every page in this iteration.
2. No module-specific information architecture rewrite beyond what is required by the new responsive shell.
3. No separate mobile-only routing tree.
4. No attempt to expose every module directly in the mobile tab bar.

## Confirmed Product Decisions

### Breakpoints

The site uses three responsive bands:

1. `>= 1024px`: desktop
2. `768px - 1023px`: tablet
3. `< 768px`: mobile

### Desktop behavior

Desktop keeps the existing left module sidebar as the primary module-local navigation surface.

### Tablet behavior

Tablet keeps the left sidebar, but the sidebar must no longer be allowed to crowd the content area. It should move into a narrow or collapsible state by default so the main content keeps workable width.

### Mobile behavior

Mobile removes the left sidebar from the main layout and replaces module-level navigation with a fixed bottom navigation bar.

Mobile must not keep a second hidden sidebar, mini icon rail, or parallel drawer-based main navigation. The bottom bar is the only primary navigation surface on mobile.

### Mobile bottom navigation

The mobile bottom navigation is fixed to four top-level destinations:

1. `首页/发现`
2. `订阅`
3. `创作/内容`
4. `更多`

The fourth item opens a large bottom sheet rather than navigating to a separate "more" page.

### Mobile top bar responsibilities

On mobile, the page top bar remains visible and should show:

1. The current module or page title
2. Context-specific actions on the right side

The top bar answers:

1. Where the user currently is
2. What the user can do on the current screen

### Migration rules for old sidebar functions

When mobile removes the sidebar, existing sidebar-owned interactions move according to one shared rule:

1. Navigation-like entry points move to the page header area
2. Management actions move to right-side action buttons
3. Long lists, selectors, filters, and source pickers move into sheets

These rules are global defaults. Modules can only diverge when the default rule clearly harms usability.

## Information Architecture

### Shared responsive shell

The responsive system is composed of three layers:

1. Global top bar
2. Shared module layout shell
3. Mobile bottom navigation

The top bar keeps brand and page context.

The shared module layout shell continues to power module pages on desktop and tablet.

The mobile bottom navigation becomes the only primary navigation surface on mobile.

### Role of the "More" sheet

The `更多` destination opens a large bottom sheet that contains:

1. Lower-frequency modules
2. Personal entry points
3. Settings and related utilities

This sheet is an expansion surface for low-frequency navigation, not a second content page.

### Module internals on mobile

Module-local secondary navigation should not be forced into the bottom bar.

Instead:

1. Page-local mode switches remain inside the page header or page body
2. Search, filter, and management actions remain contextual to the current page
3. Selection-heavy controls use sheets

This avoids overloading the mobile bottom bar with page-specific state.

## Frontend Architecture

### Shared classes and containers

The existing shared shell around `a-module-layout`, `PSidebar`, and `a-main-content` should be the main implementation surface.

The responsive redesign should change the behavior of shared layout primitives first, then let module layouts inherit the new behavior.

Recommended direction:

1. Keep the desktop shell shape intact
2. Add tablet-specific sidebar sizing and collapse behavior at the shared shell level
3. Add mobile layout rules that remove sidebar occupation and reserve safe space for the bottom navigation

### New shared component

Add a shared `MobileBottomNav` component rendered at the application shell level for mobile breakpoints.

Responsibilities:

1. Render the four fixed primary destinations
2. Highlight the active destination
3. Open the `更多` sheet
4. Avoid carrying page-local controls

### Layout ownership

Existing module layouts such as `FeedLayout`, `KanboLayout`, `BlogLayout`, `ForumLayout`, `DebateLayout`, `MusicLayout`, and other `PSidebar`-based shells should continue to define module navigation for desktop and tablet.

On mobile, these layouts should stop occupying left-column space. They should render the content area without sidebar layout pressure.

### Safe area and spacing

Mobile content must reserve bottom padding so the fixed navigation bar never covers interactive content.

The shared layout layer should own this spacing rather than asking each page to guess the bottom bar height.

## UX Rules

### Desktop

1. Sidebar is visible and primary
2. Main content uses the existing wide reading and management layouts
3. Current page patterns remain largely unchanged

### Tablet

1. Sidebar remains available
2. Sidebar width is reduced or starts collapsed
3. Content width takes priority over sidebar comfort
4. Pages should not require horizontal scrolling because the shell kept too much sidebar width

### Mobile

1. Main content is full width
2. No left sidebar remains in-flow
3. Bottom navigation is fixed and always reachable
4. Page headers provide context and local actions
5. Sheets handle overflow navigation, long lists, filters, and source selection

## Module Migration Guidance

### Feed

Feed is the highest-priority beneficiary because it currently uses the shared sidebar shell heavily.

Mobile migration rules for feed:

1. Source list opens through a sheet instead of occupying the left edge
2. Subscription management moves to a top-right action
3. Explore and reading modes stay inside page-level controls, not the global bottom bar

### Other module-shell pages

Kanbo, blog, forum, debate, music, video, podcast, and timeline should follow the same shell rules:

1. Do not invent module-specific mobile primary nav bars
2. Do not preserve hidden left-column occupancy on mobile
3. Reuse shared header, sheet, and bottom-nav patterns

### Heavy editor pages

Editor-style pages may require local exceptions for tool density, but they still inherit the same breakpoint model:

1. Desktop uses the richer side-oriented layout
2. Tablet compresses side surfaces
3. Mobile prioritizes the document surface and contextual actions

## Implementation Strategy

### Phase 1: shared shell

1. Update shared layout CSS for the three breakpoint bands
2. Add shared mobile bottom navigation
3. Add shared mobile bottom safe-area spacing

### Phase 2: module layout adoption

1. Wire module layouts into the shared mobile shell behavior
2. Remove mobile sidebar occupancy from `PSidebar`-based layouts
3. Verify active-state mapping from current route to mobile bottom navigation

### Phase 3: module-specific migrations

1. Move feed source navigation into a sheet
2. Move module management actions into page headers
3. Review any remaining pages whose small-screen behavior still assumes left-column occupancy

## Testing

### Automated coverage

Add or update layout tests for:

1. Shared shell breakpoint behavior
2. Mobile bottom navigation rendering and active state
3. `更多` sheet open behavior
4. Feed mobile source access through sheet-driven interactions

### Manual verification

Verify at minimum:

1. Desktop widths at or above `1024px`
2. Tablet widths between `768px` and `1023px`
3. Mobile widths below `768px`
4. One representative page each from feed, kanbo, blog, forum, and music

## Acceptance Criteria

1. Shared module pages no longer compress the content area into an unusable narrow column on mobile.
2. Mobile users have one consistent primary navigation surface: the fixed bottom bar.
3. Tablet widths preserve access to sidebar navigation without stealing too much content width.
4. Page-local actions remain discoverable through headers and sheets after sidebar removal on mobile.
5. Shared shell changes are adopted across `PSidebar`-based modules rather than only fixing feed in isolation.
