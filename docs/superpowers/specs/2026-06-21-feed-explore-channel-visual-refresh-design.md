# Feed Explore Channel Visual Refresh Design

## Context

The feed explore page already has a working two-mode structure in `src/views/feed/FeedRecommendedView.vue`:

1. `文章浏览`
2. `频道浏览`

The current `频道浏览` implementation is functionally correct, but visually too plain. The card design still reads like a generic metadata list and the source drawer header still uses a simple text-first layout. The user wants this channel-browse surface to feel closer to Feedly Discover:

1. Stronger source identity
2. Visible avatar/logo treatment
3. Stable brand color treatment
4. Real URL shown prominently

The selected product direction is:

1. Keep the current explore route and two-mode structure.
2. Keep channel drill-in inside the current page via the existing drawer pattern.
3. Redesign the channel cards and drawer header with a stronger source-discovery visual system.
4. Reuse the existing article list components inside the drawer instead of inventing a second article-row design.

## Goals

1. Make `频道浏览` feel like a deliberate source discovery surface rather than a plain card list.
2. Use avatar and color to improve scanability and source recognition.
3. Show the source URL as a meaningful part of the design, not hidden metadata.
4. Keep the current source drawer interaction model and existing article list behavior.
5. Reuse current feed components wherever possible so the redesign stays scoped and consistent.

## Non-Goals

1. No redesign of the standalone blog `ChannelView` route in this iteration.
2. No new route or dedicated full-page channel detail experience.
3. No custom article card design inside the source drawer.
4. No dependency on perfect third-party logos or cover images.
5. No backend recommendation logic change beyond any fields required for visual display.

## Confirmed Product Decisions

### Scope boundary

This iteration changes only the explore-page source-discovery experience:

1. Channel/source cards in `频道浏览`
2. The source drawer header
3. Supporting shared source-identity presentation pieces

It does not redesign the standalone channel page.

### Channel drill-in behavior

Clicking a channel card still opens the current in-page drawer.

The drawer remains the inspection surface for:

1. Source identity
2. Subscribe action
3. Recent articles

This iteration improves how the drawer header looks, but does not replace the drawer with route navigation.

### Article list reuse

The article rows shown after clicking a channel should continue to use the existing feed article presentation system.

This is a hard constraint for scope control:

1. Keep current drawer article list behavior
2. Reuse the existing article row styling/components
3. Only add a thin wrapper if needed for layout consistency

The redesign focus is the source card and source header, not the article-item design.

### Visual direction

The chosen visual direction is closer to Feedly Discover than the current paper-minimal card list:

1. Strong color-backed source identity
2. Avatar/logo presence
3. Card feels like a branded source object, not a row of stats
4. URL remains visible as a real source signal

The user explicitly chose the stronger visual option over the quieter URL-first card.

## UX Design

### Channel card layout

The new channel card should use a strong visual hierarchy:

1. Top brand-color hero block
2. Floating or anchored avatar/logo overlapping the hero/body transition
3. Source/channel title
4. Source description or short summary line when available
5. URL strip or URL label in the body
6. Bottom metadata row with subscription count, recent item count, and update time

The intent is that the card reads as a discoverable publication/source.

### URL treatment

The user wants URL shown directly.

The design should therefore avoid abstract-only labels like `RSS 源` or `播客源` as the primary identity. Instead:

1. Show a real URL or normalized URL fragment on the card
2. Show the full URL in the drawer header when space allows
3. Treat URL as source identity, not just a technical footer

Recommended hierarchy:

1. Card: human-readable normalized URL fragment such as host plus feed path
2. Drawer header: full URL

### Avatar treatment

The card and drawer header should both include a source avatar.

Preferred source order:

1. Site favicon or source logo when available
2. Generated letter avatar fallback

The fallback must still feel designed, not accidental. It should use the same brand color system so sources without icons still look intentional.

### Brand color treatment

Each source card should have a stable brand color surface.

Recommended implementation rule:

1. Use a provided logo/background color if a trustworthy source value exists
2. Otherwise derive a stable color from the source URL hash

The same source should always render with the same fallback color. The color should be strong enough to create identity, but still compatible with the existing Atoman feed shell.

### Drawer header redesign

The existing `FeedSourceArticlesSheet.vue` header should move from a plain text header to a compact hero header.

Recommended header structure:

1. Brand color background or accent band
2. Avatar/logo
3. Source title
4. Full URL
5. Subscribe button

This keeps the drawer visually connected to the card the user clicked.

### Metadata balance

The card should not become a dense analytics tile.

Required metadata remains:

1. Subscription count
2. Recent content count
3. Last updated time

Optional metadata such as source type should be visually subordinate or omitted if it weakens clarity. The user chose explicit URL display over abstract source-type labeling.

## Frontend Architecture

### Shared source identity component

`ChannelExplorePanel.vue` should stop owning the complete source-card markup inline.

Recommended direction:

1. Extract a shared source identity card component for explore cards
2. Give it props for title, URL, description, counts, avatar, and visual color
3. Use the same identity logic in the drawer header where practical

This makes the redesign reusable without forcing other surfaces to adopt the full card layout.

### FeedSourceArticlesSheet reuse

`FeedSourceArticlesSheet.vue` remains the drawer surface.

Changes should stay focused:

1. Redesign the header
2. Add avatar and URL presentation
3. Keep the existing article list interaction model

Do not replace the article rows with a second article-card system unless a very thin wrapper is necessary for spacing or alignment.

### Source presentation helpers

The redesign will likely need small helpers for:

1. URL normalization for display
2. Avatar fallback label generation
3. Stable color derivation from source URL or id

These helpers should live outside the view component so tests can validate them directly.

### Data shape additions

If current explore source responses do not already include enough information for the visual design, the frontend may need optional support for:

1. Description or tagline text
2. Favicon/logo URL
3. Explicit brand color

These should be additive fields. The UI must still render cleanly when none of them are present.

## Data and Fallback Rules

### URL normalization

The UI should not dump raw long URLs without formatting discipline.

Recommended rules:

1. Strip protocol in card display when helpful
2. Preserve the feed path when it is meaningful
3. Use line wrapping or clamping to avoid card blowout
4. Keep full URL available in the drawer

### Avatar fallback

If no remote icon is available:

1. Use the first meaningful character from the source title
2. Place it in a shaped avatar container
3. Tint the avatar with the same stable source color

This fallback must be the default-quality experience, not an obviously broken state.

### Color fallback

If no explicit brand color exists:

1. Generate one from the source URL or source id
2. Map the hash into a constrained palette or HSL range
3. Keep contrast high enough for overlaid text and avatar readability

### Missing description

If a source description/tagline is unavailable:

1. Do not synthesize a fake editorial summary
2. Collapse that line cleanly
3. Let the card breathe rather than filling it with placeholder text

## Responsiveness

### Desktop

Desktop keeps a card grid and can afford stronger visual cards.

Recommended behavior:

1. Two to three columns depending on width
2. Consistent hero heights
3. Stable card heights where practical

### Mobile

Mobile should keep the same brand-led visual language, but simplify the layout:

1. Single-column stack
2. Slightly reduced hero height
3. Avatar and URL remain visible without making the card overly tall

The mobile version should still feel like the same design, not a fallback wireframe.

### Drawer on smaller screens

The source drawer header on mobile should compress gracefully:

1. Avatar remains visible
2. URL wraps correctly
3. Subscribe button remains obvious
4. The hero does not consume so much height that article discovery is delayed

## Testing Strategy

### Component coverage

Add or update unit tests for:

1. Channel explore card rendering with normal source data
2. Card rendering without avatar/logo fields
3. Stable fallback color/avatar behavior
4. Drawer header rendering with full URL

### Reuse regression coverage

Preserve existing drawer behavior by testing:

1. Source article rows still render and open correctly
2. Subscribe actions still emit correctly
3. The redesign does not break anonymous source article viewing

### Visual regression focus

The key regressions to guard against are:

1. URL overflow breaking card height
2. Missing logo causing broken layout
3. Mobile drawer header becoming too tall
4. Card styles drifting away from the selected strong-visual direction

## Implementation Strategy

### Phase 1: source identity helpers

1. Add display helpers for URL normalization, avatar fallback, and stable color derivation
2. Extend source types only as needed for optional avatar/description/color support

### Phase 2: channel card extraction

1. Extract the shared visual source card component
2. Move `ChannelExplorePanel.vue` to the new card
3. Preserve existing click and pagination behavior

### Phase 3: drawer header redesign

1. Update `FeedSourceArticlesSheet.vue` header
2. Keep article list behavior intact
3. Reuse the same source identity helpers

### Phase 4: verification

1. Update unit tests
2. Verify article-mode explore remains unchanged
3. Verify channel-mode cards, drawer opening, and subscription flow still work

## Open Implementation Questions Resolved

### Should clicking a channel navigate to a separate page?

No. The user confirmed the design should stay inside the current explore page via the drawer.

### Should the drawer article items use a new custom design?

No. The user explicitly approved reuse of existing components for the article entries after clicking a channel.

### Should URL or abstract source type be primary?

URL is primary. Abstract labels like `RSS 源` may remain secondary at most, but they should not be the main identity treatment.

### Should the design stay quiet or become more visual?

More visual. The user explicitly chose the stronger, more Feedly-like direction with avatar and color.
