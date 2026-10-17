import { ref, shallowRef } from 'vue'
import { ApiErrorResponseError } from '@/api/client'
import { createReadingSession, getCloudReadingState, saveCloudReadingState, sendReadingHeartbeat, type CloudReadingState, type ReadingPosition, type ReadingSession, type ReadingWrite } from '@/api/bookReading'

interface Outbox { request?: ReadingWrite; latest?: ReadingPosition; furthest: number; baseVersion?: number }

// 一条串行写队列；失败重放原 request_id，跨设备冲突必须由读者决定。
export function useRevisionReading(owner: string, revisionId: string) {
  const status = ref<'loading' | 'saved' | 'pending' | 'saving' | 'offline' | 'conflict'>('loading')
  const state = shallowRef<CloudReadingState>()
  const conflict = shallowRef<CloudReadingState>()
  const initialPosition = shallowRef<ReadingPosition>()
  const controller = new AbortController()
  const key = `atoman:book-reading-outbox:${owner}:${revisionId}`
  let outbox: Outbox = { furthest: 0 }
  try { outbox = JSON.parse(localStorage.getItem(key) || 'null') || outbox } catch { /* 无缓存时使用云端。 */ }
  let session: ReadingSession['session'] | undefined
  let currentPosition: ReadingPosition | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let saving = false
  let disposed = false
  let readingReady = false
  let heartbeatBusy = false
  let heartbeatSequence = 0
  let lastActivity = 0
  const clientSessionId = crypto.randomUUID()
  let deviceId = ''
  try { deviceId = localStorage.getItem('atoman:book-device') || ''; if (!deviceId) { deviceId = crypto.randomUUID(); localStorage.setItem('atoman:book-device', deviceId) } } catch { deviceId ||= crypto.randomUUID() }
  function persist() {
    try {
      if (outbox.request || outbox.latest) localStorage.setItem(key, JSON.stringify(outbox))
      else localStorage.removeItem(key)
    } catch { /* 存储不可用不影响在线阅读。 */ }
  }
  function pendingPosition() { return outbox.latest || outbox.request }
  async function start() {
    status.value = 'loading'
    try {
      const result = await createReadingSession(revisionId, clientSessionId, deviceId, controller.signal)
      if (disposed) return false
      session = result.session
      heartbeatSequence = session.heartbeat_sequence
      state.value = result.state
      outbox.furthest = Math.max(outbox.furthest, result.state.furthest_percent)
      initialPosition.value = pendingPosition() || result.state
      currentPosition = initialPosition.value
      if (!outbox.request && outbox.latest && result.state.version !== (outbox.baseVersion ?? 0)) {
        conflict.value = result.state
        status.value = 'conflict'
        return true
      }
      status.value = pendingPosition() ? 'pending' : 'saved'
      if (pendingPosition()) void flush()
      return true
    } catch { if (!disposed) status.value = 'offline'; return false }
  }
  function observe(position: ReadingPosition) {
    if (disposed) return
    activity()
    currentPosition = { ...position }
    outbox.latest = currentPosition
    outbox.baseVersion ??= state.value?.version
    outbox.furthest = Math.max(outbox.furthest, position.current_percent)
    persist()
    if (status.value === 'conflict' || status.value === 'offline') return
    status.value = 'pending'
    clearTimeout(timer)
    timer = setTimeout(() => { void flush() }, 800)
  }
  async function flush() {
    clearTimeout(timer)
    if (disposed || saving || !session || !state.value || status.value === 'conflict') return
    if (!outbox.request && !outbox.latest) return
    saving = true
    status.value = 'saving'
    if (!outbox.request) {
      outbox.request = { ...outbox.latest!, session_id: session.id, request_id: crypto.randomUUID(), sequence: ++session.last_sequence, base_version: state.value.version, furthest_percent: outbox.furthest }
      outbox.latest = undefined
      persist()
    }
    try {
      const result = await saveCloudReadingState(revisionId, outbox.request, controller.signal)
      if (disposed) return
      // 响应丢失后的幂等回执可能早于其他设备的新写入，不能拿旧回执当最新状态。
      const latest = result.duplicate ? await getCloudReadingState(revisionId, controller.signal) : result.state
      if (disposed) return
      outbox.request = undefined
      state.value = latest
      outbox.baseVersion = latest.version
      if (!result.position_applied || latest.version !== result.state.version) {
        // 不把被服务端忽略的位置误报为已保存。
        conflict.value = latest
        outbox.latest ||= currentPosition
        status.value = 'conflict'
      } else status.value = outbox.latest ? 'pending' : 'saved'
      persist()
    } catch (err) {
      if (disposed) return
      if (err instanceof ApiErrorResponseError && err.code === 'books.reading_state_conflict') {
        try {
          conflict.value = await getCloudReadingState(revisionId, controller.signal)
          if (!disposed) status.value = 'conflict'
        } catch { if (!disposed) status.value = 'offline' }
      } else status.value = 'offline'
    } finally {
      saving = false
      if (!disposed && status.value === 'pending') void flush()
    }
  }
  function chooseCloud() {
    if (!conflict.value) return
    state.value = conflict.value
    initialPosition.value = conflict.value
    currentPosition = conflict.value
    outbox = { furthest: conflict.value.furthest_percent, baseVersion: conflict.value.version }
    conflict.value = undefined
    status.value = 'saved'
    persist()
  }
  function chooseLocal() {
    if (!conflict.value || !currentPosition) return
    state.value = conflict.value
    outbox = { latest: currentPosition, furthest: Math.max(outbox.furthest, conflict.value.furthest_percent), baseVersion: conflict.value.version }
    conflict.value = undefined
    status.value = 'pending'
    persist()
    void flush()
  }
  function activity() { lastActivity = Date.now() }
  function ready() { readingReady = true; activity(); void heartbeat() }
  async function heartbeat(stop = false) {
    if (disposed || heartbeatBusy || !session || !readingReady) return
    heartbeatBusy = true
    try {
      const visible = !stop && document.visibilityState === 'visible'
      await sendReadingHeartbeat(session.id, { sequence: ++heartbeatSequence, visible, active: visible && Date.now() - lastActivity < 60_000 }, controller.signal)
    } catch { /* 时长请求失败不伪造或补报时间。 */ }
    finally { heartbeatBusy = false }
  }
  function dispose() { disposed = true; clearTimeout(timer); controller.abort() }
  return { status, state, conflict, initialPosition, signal: controller.signal, start, observe, flush, chooseCloud, chooseLocal, activity, ready, heartbeat, dispose }
}
