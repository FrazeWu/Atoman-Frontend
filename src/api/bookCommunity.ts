import { privateBookRequest as request } from './bookPrivate'
import type { ReadingAnchor } from './bookReading'
export interface WorkRating { rating_score: number; rating_count: number; weighted_rating_score: number | null; rating_active: boolean; minimum_rating_count: number; viewer_rating?: number }
export interface BookReviewLink { content_id: string; author_id: string; title: string; summary: string; spoiler: boolean; target_path: string }
export interface BookPassage { id: string; revision_id: string; anchor: ReadingAnchor }
const id = encodeURIComponent
export const getWorkRating = (workId: string) => request<WorkRating>(`/works/${id(workId)}/rating`)
export const setWorkRating = (workId: string, score: number) => request<WorkRating>(`/works/${id(workId)}/rating`, 'PUT', { score })
export const removeWorkRating = (workId: string) => request<WorkRating>(`/works/${id(workId)}/rating`, 'DELETE')
export const highRatedWorks = (offset = 0) => request<{ items: (WorkRating & { work_id: string; title: string })[]; total: number }>(`/rankings/high-rated?limit=24&offset=${offset}`)
export const listWorkReviews = (workId: string, offset = 0) => request<{ items: BookReviewLink[]; total: number }>(`/works/${id(workId)}/reviews?limit=24&offset=${offset}`)
export const linkWorkReview = (workId: string, contentId: string, spoiler: boolean) => request(`/works/${id(workId)}/reviews/${id(contentId)}`, 'PUT', { spoiler })
export const unlinkWorkReview = (workId: string, contentId: string) => request(`/works/${id(workId)}/reviews/${id(contentId)}`, 'DELETE')
export const createPassage = (revisionId: string, anchor: ReadingAnchor) => request<BookPassage>(`/asset-revisions/${id(revisionId)}/passages`, 'POST', { anchor })
export const listPassages = (revisionId: string, offset = 0) => request<{ items: BookPassage[]; total: number }>(`/asset-revisions/${id(revisionId)}/passages?limit=50&offset=${offset}`)
