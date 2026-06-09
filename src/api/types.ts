export type ApiSuccess<T, M = Record<string, unknown>> = {
  data: T
  meta?: M
}

export type PaginationMeta = {
  page: number
  page_size: number
  total: number
  has_more: boolean
}

export type ApiList<T> = {
  data: T[]
  meta: PaginationMeta
}

export type ApiErrorEnvelope = {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

export type UploadPurpose = 'blog.image' | 'music.cover' | 'music.audio'

export type UploadAsset = {
  url: string
  key: string
  content_type: string
  size: number
}
