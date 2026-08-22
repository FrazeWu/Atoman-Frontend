import type { BaseSheetLayer } from '@/composables/useSheetStack'

export type BlogChannelLayer = BaseSheetLayer & {
  kind: 'channel'
  payload: {
    channelId: string
  }
}

export type BlogCollectionLayer = BaseSheetLayer & {
  kind: 'collection'
  payload: {
    collectionId: string
    channelId: string
  }
}

export type BlogPostLayer = BaseSheetLayer & {
  kind: 'post'
  payload: {
    postId: string
    collectionId?: string
  }
}

export type ShortNoteLayer = BaseSheetLayer & {
  kind: 'short_note'
  payload: {
    noteId: string
  }
}

export type BlogSheetLayer = BlogChannelLayer | BlogCollectionLayer | BlogPostLayer | ShortNoteLayer
