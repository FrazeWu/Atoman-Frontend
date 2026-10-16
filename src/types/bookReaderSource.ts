import type { BookPublishedAsset } from '@/api/books'
import type { ReadingPosition } from '@/api/bookReading'
import type { BookReaderBookmark } from '@/utils/bookReaderPreferences'

// 渲染器复用格式处理；文件身份和正文来源由固定修订入口提供。
export interface BookReaderSource {
  asset: BookPublishedAsset
  title: string
  backTo: string
  progressKey: string
  loadContent: () => Promise<Blob>
  initialPosition?: ReadingPosition
  bookmarks?: BookReaderBookmark[]
  onPosition?: (position: ReadingPosition) => void
  onReady?: () => void
  addBookmark?: (bookmark: BookReaderBookmark) => Promise<BookReaderBookmark[]>
  removeBookmark?: (id: string) => Promise<BookReaderBookmark[]>
}
