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
    if (!userId) {
      clearChannels()
      return
    }

    loadingChannels.value = true
    try {
      const api = useApi()
      const url = new URL(api.blog.channels, window.location.origin)
      url.searchParams.set('user_id', String(userId))

      if (token) {
        localStorage.setItem('token', token)
      } else {
        localStorage.removeItem('token')
      }
      const data = await apiGetRaw<Channel[] | { data?: Channel[] }>(url.toString())
      const rows: Channel[] = Array.isArray(data) ? data : (data.data || [])
      channels.value = rows.map(channel => ({ id: channel.id, name: channel.name }))
      if (!currentMediaChannelId.value && channels.value.length > 0) {
        setCurrentMediaChannel(channels.value[0].id)
      }
    } finally {
      loadingChannels.value = false
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
