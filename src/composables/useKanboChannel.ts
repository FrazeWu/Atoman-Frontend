import { ref } from 'vue'
import { useApi } from '@/composables/useApi'
import { useKanboCollections } from '@/composables/useKanboCollections'
import type { Channel } from '@/types'

export type KanboChannel = {
  id: string
  name: string
}

const currentKanboChannelId = ref<string | null>(null)
const channels = ref<KanboChannel[]>([])
const loadingChannels = ref(false)

export function useKanboChannel() {
  const { resetForChannel } = useKanboCollections()

  const setCurrentKanboChannel = (channelId: string | null) => {
    currentKanboChannelId.value = channelId
    resetForChannel(channelId)
  }

  const switchChannel = async (channelId: string | null, _token?: string | null) => {
    setCurrentKanboChannel(channelId)
  }

  const loadChannels = async (token?: string | null, userId?: string | number | null) => {
    loadingChannels.value = true
    try {
      const api = useApi()
      const url = new URL(api.blog.channels, window.location.origin)
      if (userId) url.searchParams.set('user_id', String(userId))

      const headers = token ? { Authorization: `Bearer ${token}` } : undefined
      const res = await fetch(url.toString(), headers ? { headers } : undefined)
      if (!res.ok) return
      const data = await res.json()
      const rows: Channel[] = Array.isArray(data) ? data : (data.data || [])
      channels.value = rows.map(channel => ({ id: channel.id, name: channel.name }))
      if (!currentKanboChannelId.value && channels.value.length > 0) {
        setCurrentKanboChannel(channels.value[0].id)
      }
    } finally {
      loadingChannels.value = false
    }
  }

  return {
    channels,
    loadingChannels,
    currentKanboChannelId,
    setCurrentKanboChannel,
    switchChannel,
    loadChannels,
  }
}
