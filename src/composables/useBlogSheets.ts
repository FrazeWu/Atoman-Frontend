import { createSheetStack } from '@/composables/useSheetStack'
import type { BlogSheetLayer } from '@/components/blog/blogSheetTypes'

const stack = createSheetStack<BlogSheetLayer>({
  maxLayers: 2,
  resolveOverflow: (next, current) => {
    const collection = current.find(layer => layer.kind === 'collection')
    return collection ? [collection, next] : [next]
  },
})

export function useBlogSheets() {
  const openCollection = (collectionId: string, title: string, channelId: string) => {
    stack.push({
      key: `collection:${collectionId}`,
      kind: 'collection',
      title,
      payload: { collectionId, channelId },
    })
  }

  const openPost = (postId: string, title: string, collectionId?: string) => {
    stack.push({
      key: `post:${postId}`,
      kind: 'post',
      title,
      route: `/posts/post/${postId}`,
      payload: { postId, collectionId },
    })
  }

  const closeLayer = (key: string) => {
    stack.popTo(key)
    stack.pop()
  }

  return {
    layers: stack.layers,
    top: stack.top,
    openCollection,
    openPost,
    closeLayer,
    closeTop: stack.pop,
    closeAll: stack.clear,
    isTop: stack.isTop,
    isShifted: stack.isShifted,
  }
}
