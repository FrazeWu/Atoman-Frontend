import { useTransitionStore } from '@/stores/transition'
import { useSheetStore } from '@/stores/sheet'

export function useAsyncNavigate() {
  const transition = useTransitionStore()
  const sheet = useSheetStore()

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

      // 3. 请求成功，开始收场动画
      // 快速收回 Sheet
      sheet.clearStack(false)
      
      // 触发背景文字隐去
      transition.triggerExit()

      // 4. 存储接力数据
      localStorage.setItem('atoman_transition_relay', JSON.stringify({
        type,
        data,
        timestamp: Date.now()
      }))

      // 5. 等待动画完成并跳转 (匹配 CSS 0.5s 动画)
      await new Promise(r => setTimeout(r, 500))
      document.body.style.cursor = 'default'
      window.location.assign(targetUrl)

    } catch (err) {
      console.error('Transition fetch failed:', err)
      document.body.style.cursor = 'default'
      // TODO: 可选：触发一个轻提示告警
    }
  }

  /**
   * 基础跨模块跳转函数 (无需展开数据)
   * 用于顶部导航栏等直接切换模块的场景
   * @param targetUrl 目标页面的完整 URL
   */
  async function navigateModuleWithShutter(targetUrl: string) {
    // 1. 快速收回 Sheet
    sheet.clearStack(false)
    
    // 2. 触发背景文字隐去
    transition.triggerExit()

    // 3. 设置基础转场标记 (让新页面知道是从转场进来的，触发入场动画)
    localStorage.setItem('atoman_transition_relay_basic', 'true')

    // 4. 等待动画完成并跳转 (匹配 CSS 0.5s 动画)
    await new Promise(r => setTimeout(r, 500))
    window.location.assign(targetUrl)
  }

  return { navigateWithShutter, navigateModuleWithShutter }
}
