<script setup lang="ts">
import { computed, ref } from 'vue'

import PSheet from '@/components/ui/PSheet.vue'
import BlogPostReader from '@/components/blog/BlogPostReader.vue'
import { useBlogSheets } from '@/composables/useBlogSheets'
import { useBlogSheetNavigation } from '@/composables/useBlogSheetNavigation'
import type { BlogPostLayer } from '@/components/blog/blogSheetTypes'

const props = withDefaults(defineProps<{
  layer: BlogPostLayer
  layerIndex?: number
  stackSize?: number
}>(), {
  layerIndex: 0,
  stackSize: 1,
})

const sheets = useBlogSheets()
const reader = ref<InstanceType<typeof BlogPostReader> | null>(null)
const postId = computed(() => props.layer.payload.postId)
const sheetTitle = computed(() => reader.value?.post?.title || props.layer.title || '未命名')
const commentsBlockParent = computed(() => Boolean(reader.value?.commentsBlockParent))
const isTopSheet = computed(() => sheets.isTop(props.layer.key) && !commentsBlockParent.value)
const replaceCurrentPost = (id: string) => sheets.replacePost(id, '文章', props.layer.payload.collectionId)
const { navigation, loading: navigationLoading, direction: navigationDirection, navigate } = useBlogSheetNavigation(
  'post',
  postId,
  replaceCurrentPost,
  isTopSheet,
)
</script>

<template>
  <PSheet
    :show="sheets.isActive(layer.key)"
    :title="`文章-${sheetTitle}`"
    :index="layerIndex"
    :layer-index="layerIndex"
    :stack-size="stackSize"
    :is-shifted="sheets.isShifted(layer.key) || commentsBlockParent"
    :is-top-layer="sheets.isTop(layer.key) && !commentsBlockParent"
    reading-mode
    close-type="both"
    :navigation="navigation"
    :navigation-key="postId"
    :navigation-direction="navigationDirection"
    :navigation-loading="navigationLoading"
    @close="sheets.closeLayer(layer.key)"
    @activate="sheets.returnToLayer(layer.key)"
    @navigate="navigate"
  >
    <BlogPostReader
      ref="reader"
      :post-id="postId"
      presentation="sheet"
      :layer-key="layer.key"
      :layer-index="layerIndex"
      :stack-size="stackSize"
      :collection-id="layer.payload.collectionId"
    />
  </PSheet>
</template>
