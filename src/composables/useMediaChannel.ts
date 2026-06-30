import { ref } from 'vue'
import { apiGetRaw } from '@/api/client'
import { useApi } from '@/composables/useApi'
import { useMediaCollections } from '@/composables/useMediaCollections'
import type { Channel } from '@/types'

export type MediaChannel = {
  id: string
  name: string
}

const currentMediaChannelId = ref<string | null>(null)
const channels = ref<MediaChannel[]>([])
const loadingChannels = ref(false)
let latestLoadChannelsRequest = 0

export function useMediaChannel() {
  const { resetForChannel } = useMediaCollections()

  const setCurrentMediaChannel = (channelId: string | null) => {
    currentMediaChannelId.value = channelId
    resetForChannel(channelId)
  }

  const switchChannel = async (channelId: string | null, _token?: string | null) => {
    setCurrentMediaChannel(channelId)
  }

  const clearChannels = () => {
    channels.value = []
    setCurrentMediaChannel(null)
  }

  const loadChannels = async (token?: string | null, userId?: string | number | null) => {
    const requestId = ++latestLoadChannelsRequest

    if (!userId) {
      clearChannels()
      return
    }

    clearChannels()
    loadingChannels.value = true
    try {
      const api = useApi()
      const url = new URL(api.blog.channels, window.location.origin)
      url.searchParams.set('user_id', String(userId))

      const data = await apiGetRaw<Channel[] | { data?: Channel[] }>(url.toString(), {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      const rows: Channel[] = Array.isArray(data) ? data : (data.data || [])
      if (requestId !== latestLoadChannelsRequest) return

      channels.value = rows.map(channel => ({ id: channel.id, name: channel.name }))
      if (!currentMediaChannelId.value && channels.value.length > 0) {
        setCurrentMediaChannel(channels.value[0].id)
      }
    } catch (error) {
      if (requestId === latestLoadChannelsRequest) {
        clearChannels()
      }
      throw error
    } finally {
      if (requestId === latestLoadChannelsRequest) {
        loadingChannels.value = false
      }
    }
  }

  return {
    channels,
    loadingChannels,
    currentMediaChannelId,
    setCurrentMediaChannel,
    switchChannel,
    clearChannels,
    loadChannels,
  }
}
