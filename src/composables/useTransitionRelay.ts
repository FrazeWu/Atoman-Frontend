import { reportError } from '@/utils/logger'
import { useSheetStore } from '@/stores/sheet'
import { motionTimings } from '@/config/motion'

export function useTransitionRelay() {
  const sheetStore = useSheetStore()

  const checkRelay = () => {
    const raw = localStorage.getItem('atoman_transition_relay')
    if (!raw) return

    try {
      const relay = JSON.parse(raw)
      const now = Date.now()

      // 10秒有效期检查
      if (now - relay.timestamp < 10000 && relay.data) {
        const sheetData = {
          id: relay.data.id,
          type: relay.type,
          title: relay.data.title || 'Loading...'
        }
        // 错峰弹出：等待背景浮出动画进行到 200ms
      setTimeout(() => {
        sheetStore.pushSheet(sheetData, false) // 不记录历史，因为这是跳转后的初始状态
      }, motionTimings.relayDelay)
      }
    } catch (e) {
      reportError(e, 'Failed to parse relay data')
    } finally {
      localStorage.removeItem('atoman_transition_relay')
    }
  }

  return { checkRelay }
}
