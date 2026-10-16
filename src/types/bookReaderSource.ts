import type { BookPublishedAsset } from '@/api/books'

// 渲染器复用格式处理；文件身份和正文来源由固定修订入口提供。
export interface BookReaderSource {
  asset: BookPublishedAsset
  title: string
  backTo: string
  progressKey: string
  loadContent: () => Promise<Blob>
}
