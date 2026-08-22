import { ref, type ComputedRef } from 'vue'
import type { Extension } from '@codemirror/state'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { yCollab } from 'y-codemirror.next'
import { useApiWebSocketUrl } from '@/composables/useApi'

export interface EditorPeer {
  clientId: number
  name: string
  color: string
}

interface CollaborationOptions {
  userName: ComputedRef<string>
  initialValue: () => string
  onReady: (value: string) => void
}

const cursorColors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c']

export function useEditorCollaboration(options: CollaborationOptions) {
  const peers = ref<EditorPeer[]>([])
  const userColor = cursorColors[Math.floor(Math.random() * cursorColors.length)]
  let document: Y.Doc | null = null
  let provider: WebsocketProvider | null = null
  let text: Y.Text | null = null
  let readyEmitted = false

  function start(roomId: string): { extension: Extension; document: string } {
    stop()
    document = new Y.Doc()
    provider = new WebsocketProvider(useApiWebSocketUrl('collab/ws'), roomId, document, { connect: true })
    text = document.getText('codemirror')

    provider.awareness.on('change', () => {
      const activePeers: EditorPeer[] = []
      provider?.awareness.getStates().forEach((state, clientId) => {
        if (clientId === provider?.awareness.clientID || !state.user) return
        activePeers.push({ clientId, name: state.user.name as string, color: state.user.color as string })
      })
      peers.value = activePeers
    })
    provider.awareness.setLocalStateField('user', { name: options.userName.value, color: userColor })
    provider.on('sync', (synced: boolean) => {
      if (!synced || readyEmitted || !text) return
      if (text.length === 0 && options.initialValue()) text.insert(0, options.initialValue())
      readyEmitted = true
      options.onReady(text.toString())
    })

    return { extension: yCollab(text, provider.awareness), document: options.initialValue() }
  }

  function replaceDocument(markdown: string) {
    if (!text) return false
    if (text.length > 0) text.delete(0, text.length)
    if (markdown) text.insert(0, markdown)
    return true
  }

  function stop() {
    provider?.destroy()
    document?.destroy()
    provider = null
    document = null
    text = null
    readyEmitted = false
    peers.value = []
  }

  return { peers, start, stop, replaceDocument }
}
