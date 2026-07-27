# Design Spec: Theme Background Color Fix

We are fixing an issue where components render with a dark blue background in the light theme when the user's operating system has dark mode enabled.

## Affected Files
1. [ArtistDrawer.vue](file:///root/Atoman/Atoman-Frontend/src/components/music/ArtistDrawer.vue)
2. [MusicLyricEditorDrawer.vue](file:///root/Atoman/Atoman-Frontend/src/components/music/MusicLyricEditorDrawer.vue)
3. [MusicEntityEditorDrawer.vue](file:///root/Atoman/Atoman-Frontend/src/components/music/MusicEntityEditorDrawer.vue)
4. [MusicLyricsPanel.vue](file:///root/Atoman/Atoman-Frontend/src/components/music/MusicLyricsPanel.vue)
5. [AudioPlayer.vue](file:///root/Atoman/Atoman-Frontend/src/components/music/AudioPlayer.vue)

## Design Details

We will replace all system theme media queries (`@media (prefers-color-scheme: dark)`) and attribute-based theme selectors (`[data-theme='dark']` / `:root:not([data-theme="light"])`) in the style blocks of these components with class-based selectors scoped to `:root.dark`.

This ensures that dark backgrounds are strictly applied only when the website's root element has the `.dark` class.

## Testing Plan
- Run `bun run type-check` to verify no typescript/vue issues.
- Run `bun run build` to verify standard production bundle builds successfully.
