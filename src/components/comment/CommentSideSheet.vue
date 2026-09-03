<template>
  <PSheet
    :show="show"
    :title="title"
    mode="partial"
    :partial-anchor="partialAnchor"
    :content-max-width="contentMaxWidth"
    :is-shifted="isShifted"
    :is-top-layer="isTopLayer"
    :layer-index="layerIndex"
    :stack-size="stackSize"
    :index="index"
    :above-player="abovePlayer"
    @close="$emit('close')"
    @activate="$emit('activate')"
    @mode-change="$emit('mode-change', $event)"
  >
    <CommentSection
      :target="target"
      :above-player="abovePlayer"
      :noun="noun"
      :mark-label="markLabel"
      :current-time="currentTime"
      :readonly="readonly"
      :can-delete="canDelete"
      :focus-comment-id="focusCommentId"
      :focus-root-id="focusRootId"
      @seek="$emit('seek', $event)"
      @marked-change="$emit('marked-change', $event)"
      @count-change="$emit('count-change', $event)"
    />
  </PSheet>
</template>

<script setup lang="ts">
import type { CommentTargetRef } from '@/api/comments'
import PSheet from '@/components/ui/PSheet.vue'
import CommentSection from './CommentSection.vue'

defineOptions({ name: 'CommentSideSheet' })

withDefaults(defineProps<{
  show: boolean
  title?: string
  target: CommentTargetRef
  partialAnchor?: HTMLElement | null
  noun?: '评论' | '讨论' | '回复' | '修订提案'
  markLabel?: '置顶' | '最佳回答'
  currentTime?: () => number | null
  readonly?: boolean
  canDelete?: boolean
  focusCommentId?: string
  focusRootId?: string
  contentMaxWidth?: string
  isShifted?: boolean
  isTopLayer?: boolean
  layerIndex?: number
  stackSize?: number
  index?: number
  abovePlayer?: boolean
}>(), {
  title: '评论',
  partialAnchor: null,
  noun: '评论',
  markLabel: undefined,
  currentTime: undefined,
  readonly: false,
  canDelete: undefined,
  focusCommentId: '',
  focusRootId: '',
  contentMaxWidth: '42rem',
  isShifted: false,
  isTopLayer: true,
  layerIndex: undefined,
  stackSize: 1,
  index: undefined,
  abovePlayer: false,
})

defineEmits<{
  close: []
  activate: []
  'mode-change': [mode: 'full' | 'partial']
  seek: [seconds: number]
  'marked-change': [marked: boolean]
  'count-change': [count: number]
}>()
</script>
