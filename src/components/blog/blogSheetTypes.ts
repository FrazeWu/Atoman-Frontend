import type { BaseSheetLayer } from '@/composables/useSheetStack'

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

export type BlogSheetLayer = BlogCollectionLayer | BlogPostLayer
