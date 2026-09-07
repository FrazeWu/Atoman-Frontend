import { afterEach, describe, expect, it, vi } from 'vitest'
import {
	addMusicTag,
	listMusicTags,
	searchMusicTags,
	musicV1Endpoints,
  voteMusicTag,
} from '@/api/musicV1'

describe('music tag endpoints', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

	it('builds song and album tag paths', () => {
		expect(musicV1Endpoints.tags()).toBe('/api/v1/music/tags')
    expect(musicV1Endpoints.songTags('song-1')).toBe('/api/v1/music/songs/song-1/tags')
    expect(musicV1Endpoints.albumTags('album-1')).toBe('/api/v1/music/albums/album-1/tags')
    expect(musicV1Endpoints.songTagVote('song-1', 'tag-1')).toBe('/api/v1/music/songs/song-1/tags/tag-1/vote')
	})

	it('searches the public tag directory by kind and query', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(
			new Response(JSON.stringify({ data: [{ id: 'tag-1', name: '治愈', kind: 'mood' }] }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			}),
		))

		await expect(searchMusicTags('mood', '治愈')).resolves.toEqual([
			{ id: 'tag-1', name: '治愈', kind: 'mood' },
		])
		expect(fetch).toHaveBeenCalledWith('/api/v1/music/tags?kind=mood&q=%E6%B2%BB%E6%84%88', expect.anything())
	})

  it('lists, adds and votes on a song tag', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'tag-1', assignment_id: 'assignment-1', name: '治愈', kind: 'mood', upvotes: 0, downvotes: 0, score: 0, viewer_vote: '', can_delete: true } }), { status: 201, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'tag-1', assignment_id: 'assignment-1', name: '治愈', kind: 'mood', upvotes: 1, downvotes: 0, score: 1, viewer_vote: 'up', can_delete: true } }), { status: 200, headers: { 'Content-Type': 'application/json' } })),
    )

    await listMusicTags('song', 'song-1')
    await addMusicTag('song', 'song-1', { kind: 'mood', name: '治愈' })
    const tag = await voteMusicTag('song', 'song-1', 'tag-1', 'up')

    expect(tag.viewer_vote).toBe('up')
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/v1/music/songs/song-1/tags', expect.objectContaining({ method: 'POST' }))
    expect(fetch).toHaveBeenNthCalledWith(3, '/api/v1/music/songs/song-1/tags/tag-1/vote', expect.objectContaining({ method: 'PUT' }))
  })
})
