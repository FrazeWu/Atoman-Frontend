import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiGet, apiRequestEnvelope } from '@/api/client'
import { listPublicationReports, reportPublishedBookAsset, reviewPublicationReport } from '@/api/books'

vi.mock('@/api/client', () => ({
  apiGet: vi.fn(),
  apiRequest: vi.fn(),
  apiRequestEnvelope: vi.fn(),
}))

beforeEach(() => vi.clearAllMocks())

describe('公共电子书举报 API', () => {
  it('向已发布文件提交举报，并让版主列出和处理举报', async () => {
    vi.mocked(apiRequestEnvelope).mockResolvedValue({ data: { id: 'report-1', status: 'pending' } } as never)
    vi.mocked(apiGet).mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 })

    await reportPublishedBookAsset('asset 1', { reason: 'copyright', note: '权利问题' })
    await listPublicationReports({ limit: 20, offset: 0 })
    await reviewPublicationReport('report/1', { decision: 'rejected', note: '不成立' })

    const [reportUrl, reportInit] = vi.mocked(apiRequestEnvelope).mock.calls[0]!
    expect(reportUrl).toBe('/api/v1/books/assets/asset%201/reports')
    expect(reportInit).toMatchObject({ method: 'POST', body: JSON.stringify({ reason: 'copyright', note: '权利问题' }) })
    expect(apiGet).toHaveBeenCalledWith('/api/v1/books/admin/publication-reports?limit=20&offset=0')
    const [reviewUrl, reviewInit] = vi.mocked(apiRequestEnvelope).mock.calls[1]!
    expect(reviewUrl).toBe('/api/v1/books/admin/publication-reports/report%2F1')
    expect(reviewInit).toMatchObject({ method: 'PUT', body: JSON.stringify({ decision: 'rejected', note: '不成立' }) })
  })
})
