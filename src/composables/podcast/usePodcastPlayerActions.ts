import { addPodcastEpisodeBookmark, type PodcastBookmarkKind } from '@/api/podcast'
import { useAuthStore } from '@/stores/auth'
import { useLoginRedirect } from '@/composables/useLoginRedirect'
import { reportError } from '@/utils/logger'

export function usePodcastPlayerActions(showMessage: (message: string) => void) {
  const authStore = useAuthStore()
  const { requireLogin } = useLoginRedirect()

  async function addBookmark(episodeId: string | undefined, kind: PodcastBookmarkKind) {
    if (!episodeId || !requireLogin()) return
    try {
      await addPodcastEpisodeBookmark(episodeId, kind, authStore.token ?? undefined)
      showMessage(kind === 'favorite' ? '已收藏' : '已加入稍后听')
    } catch (error) {
      reportError(error, kind === 'favorite' ? '收藏播客节目失败' : '添加稍后收听失败')
      showMessage('操作失败')
    }
  }

  return {
    addPodcastBookmark: (episodeId?: string) => addBookmark(episodeId, 'favorite'),
    addPodcastListenLater: (episodeId?: string) => addBookmark(episodeId, 'listen_later'),
  }
}
