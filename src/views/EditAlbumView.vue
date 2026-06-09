<script setup lang="ts">
import { AlbumEditorShell } from '@/components/music'
</script>

<template>
  <AlbumEditorShell
    mode="edit"
    :meta="{ artist: [], album: '', releaseDate: '' }"
    :cover="{ file: null, previewUrl: '' }"
    :tracks="[]"
    :notes="{ editNote: '', reviewNote: '' }"
    :sources="[]"
  />
</template>
