import type { StudioModule } from '@/types'

export interface StudioModuleConfig {
  label: string
  itemLabel: string
  createLabel: string
}

export const studioModules = {
  blog: { label: '博客', itemLabel: '文章', createLabel: '写文章' },
  podcast: { label: '播客', itemLabel: '单集', createLabel: '发布单集' },
  video: { label: '视频', itemLabel: '视频', createLabel: '上传视频' },
} satisfies Record<StudioModule, StudioModuleConfig>
