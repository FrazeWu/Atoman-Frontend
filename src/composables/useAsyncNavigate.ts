import { useTransitionStore } from '@/stores/transition'
import { useSheetStore } from '@/stores/sheet'
import { useRouter } from 'vue-router'

export function useAsyncNavigate() {
  const transition = useTransitionStore()
  const sheet = useSheetStore()
  const router = useRouter()

  /**
   * 跨模块跳转函数
   * @param fetchFn 请求数据的 Promise 函数
   * @param targetUrl 目标页面的完整 URL
   * @param type 详情页类型 ('post' | 'collection')
   */
  async function navigateWithShutter<T>(
    fetchFn: () => Promise<T>,
    targetUrl: string,
    type: 'post' | 'collection'
  ) {
    // 1. 提示加载 (这里可以后续扩展更复杂的 UI 提示)
    document.body.style.cursor = 'wait'

    try {
      // 2. 静默请求
      const data = await fetchFn()

      // 3. 先存储接力数据，写入失败时不能启动半截转场
      localStorage.setItem('atoman_transition_relay', JSON.stringify({
        type,
        data,
        timestamp: Date.now()
      }))

      // 4. 请求成功且接力数据写入成功，开始收场动画
      // 快速收回 Sheet
      sheet.clearStack(false)
      
      // 触发背景文字隐去
      transition.triggerExit()

      // 5. 等待动画完成并跳转 (匹配 CSS 0.5s 动画)
      await new Promise(r => setTimeout(r, 500))
      
      if (router) {
        transition.reset()
        await router.push(targetUrl)
        transition.triggerEntry()
        const { useTransitionRelay } = await import('@/composables/useTransitionRelay')
        const { checkRelay } = useTransitionRelay()
        checkRelay()
      } else {
        window.location.assign(targetUrl)
      }

    } catch (err) {
      console.error('Transition fetch failed:', err)
      // TODO: 可选：触发一个轻提示告警
    } finally {
      document.body.style.cursor = 'default'
    }
  }

  /**
   * 基础跨模块跳转函数 (无需展开数据)
   * 用于顶部导航栏等直接切换模块的场景
   * @param targetUrl 目标页面的完整 URL
   */
  async function navigateModuleWithShutter(targetUrl: string) {
    try {
      // 1. 先设置基础转场标记，写入失败时不能启动半截转场
      localStorage.setItem('atoman_transition_relay_basic', 'true')
    } catch (err) {
      console.error('Transition relay failed:', err)
      return
    }

    // 1. 快速收回 Sheet
    sheet.clearStack(false)
    
    // 2. 触发背景文字隐去
    transition.triggerExit()

    // 4. 等待动画完成并跳转 (匹配 CSS 0.5s 动画)
    await new Promise(r => setTimeout(r, 500))
    
    if (router) {
      transition.reset()
      await router.push(targetUrl)
      transition.triggerEntry()
      localStorage.removeItem('atoman_transition_relay_basic')
    } else {
      window.location.assign(targetUrl)
    }
  }

  return { navigateWithShutter, navigateModuleWithShutter }
}
