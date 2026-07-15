import { expect, test } from '../fixtures/base'
import type { Page, Route } from '@playwright/test'

type Comment = {
  id: string
  author_id: string
  author: { id: string; username: string; display_name: string; avatar_url: string }
  floor_number: number
  content: string
  rendered_html: string
  status: string
  like_count: number
  reply_count: number
  hot_score: number
  created_at: string
  marked: boolean
  liked: boolean
  mentions: { user_id: string; start: number; end: number }[]
  attachments: never[]
  time_anchors: { start: number; end: number; seconds: number }[]
  replies: never[]
}

const owner = { id: 'owner-1', username: 'owner', display_name: 'Owner', avatar_url: '' }

async function becomeUser(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('token', `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.signature`)
    localStorage.setItem('user', JSON.stringify({
      uuid: 'owner-1', username: 'owner', email: 'owner@example.com', role: 'user', onboarding_completed_at: '2026-07-15T09:00:00Z',
    }))
  })
}

function makeComment(id: string, content: string, mentions: Comment['mentions'] = []): Comment {
  const match = content.match(/(?:^|\s)(\d{1,3}:\d{2})(?:\s|$)/)
  const token = match?.[1]
  const start = token ? Array.from(content.slice(0, content.indexOf(token))).length : 0
  return {
    id,
    author_id: owner.id,
    author: owner,
    floor_number: 1,
    content,
    rendered_html: `<p>${content}</p>`,
    status: 'active',
    like_count: 0,
    reply_count: 0,
    hot_score: 0,
    created_at: '2026-07-15T10:00:00Z',
    marked: false,
    liked: false,
    mentions,
    attachments: [],
    time_anchors: token ? [{ start, end: start + Array.from(token).length, seconds: 84 }] : [],
    replies: [],
  }
}

async function mockComments(page: Page, kind: 'blog_post' | 'video' | 'forum_topic', resourceId: string) {
  const comments: Comment[] = []
  let submittedBody: Record<string, unknown> | null = null
  let markedCommentId: string | null = null
  await page.route(`**/api/v1/discussions/${kind}/${resourceId}/comments**`, async (route: Route) => {
    if (route.request().method() === 'POST') {
      submittedBody = route.request().postDataJSON()
      const created = makeComment(`${kind}-comment-1`, String(submittedBody?.content ?? ''), (submittedBody?.mentions as Comment['mentions']) ?? [])
      comments.push(created)
      await route.fulfill({ status: 201, json: { data: created } })
      return
    }
    await route.fulfill({
      json: {
        data: {
          items: comments,
          page: 1,
          per_page: 20,
          total_roots: comments.length,
          total_comments: comments.length,
          total_replies: 0,
          target: {
            kind,
            resource_id: resourceId,
            mark_label: kind === 'forum_topic' ? '最佳回答' : '置顶',
            can_mark: true,
            marked_comment_id: markedCommentId,
            comment_count: comments.length,
            root_count: comments.length,
          },
        },
      },
    })
  })
  await page.route(`**/api/v1/discussions/${kind}/${resourceId}/pinned-comment`, async (route) => {
    if (route.request().method() === 'PUT') {
      markedCommentId = String(route.request().postDataJSON()?.comment_id ?? '')
    } else if (route.request().method() === 'DELETE') {
      markedCommentId = null
    }
    await route.fulfill({ json: { data: { ok: true } } })
  })
  return () => submittedBody
}

test.describe('Comment surfaces and core API', () => {
  test('publishes a blog comment with a selected mention', async ({ page }) => {
    await becomeUser(page)
    const submitted = await mockComments(page, 'blog_post', 'post-1')
    await page.route('**/api/v1/blog/posts/post-1', (route) => route.fulfill({
      json: {
        data: {
          id: 'post-1', user_id: owner.id, user: owner, title: '统一评论文章', content: '正文', summary: '',
          status: 'published', visibility: 'public', likes_count: 0, created_at: '2026-07-15T10:00:00Z',
        },
      },
    }))
    await page.route('**/api/v1/users/search?*', (route) => route.fulfill({
      json: { data: [{ uuid: 'user-2', username: '测试者', display_name: '测试者', avatar_url: '', role: 'user' }] },
    }))

    await page.goto('/posts/post/post-1')
    const composer = page.locator('.comment-section textarea').first()
    await composer.fill('@测试')
    await composer.press('End')
    await page.getByRole('option', { name: /测试者/ }).click()
    await composer.press('End')
    await composer.type(' 你好')
    await page.locator('.comment-section [data-test="comment-submit"]').click()

    await expect(page.getByText('@测试者 你好', { exact: true })).toBeVisible()
    expect(submitted()?.mentions).toEqual([{ user_id: 'user-2', start: 0, end: 4 }])
  })

  test('detects a video time anchor and seeks to its second', async ({ page }) => {
    await becomeUser(page)
    await page.addInitScript(() => {
      let currentTime = 0
      Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
        configurable: true,
        get: () => currentTime,
        set: (value: number) => { currentTime = value },
      })
      HTMLMediaElement.prototype.play = () => Promise.resolve()
    })
    await mockComments(page, 'video', 'video-1')
    await page.route('**/api/v1/videos/video-1/recommended', (route) => route.fulfill({ json: [] }))
    await page.route('**/api/v1/videos/video-1/view', (route) => route.fulfill({ json: { ok: true } }))
    await page.route('**/api/v1/videos/video-1', (route) => route.fulfill({
      json: {
        id: 'video-1', user_id: owner.id, title: '统一评论视频', description: '', video_url: 'about:blank',
        thumbnail_url: '', storage_type: 'local', status: 'published', visibility: 'public', duration_sec: 300,
        view_count: 0, created_at: '2026-07-15T10:00:00Z', tags: [], preview_thumbnails: [],
      },
    }))

    await page.goto('/videos/videos/watch/video-1')
    const composer = page.locator('[data-testid="video-comments"] textarea').first()
    await composer.fill('1:24 这里开始')
    await page.locator('[data-testid="video-comments"] [data-test="comment-submit"]').click()
    await page.locator('[data-testid="video-comments"] [data-test="time-anchor"]').click()

    await expect.poll(() => page.locator('video').evaluate((element) => (element as HTMLVideoElement).currentTime)).toBe(84)
  })

  test('publishes a forum reply and marks one best answer', async ({ page }) => {
    await becomeUser(page)
    await mockComments(page, 'forum_topic', 'topic-1')
    await page.route('**/api/v1/forum/topics/topic-1', (route) => route.fulfill({
      json: {
        data: {
          id: 'topic-1', user_id: owner.id, user: owner, category_id: 'category-1',
          category: { id: 'category-1', name: '通用', color: '#111111' }, title: '统一评论话题', content: '正文',
          tags: [], pinned: false, featured: false, closed: false, is_solved: false, reply_count: 0,
          like_count: 0, view_count: 0, is_liked: false, is_bookmarked: false,
          created_at: '2026-07-15T10:00:00Z', updated_at: '2026-07-15T10:00:00Z',
        },
      },
    }))

    await page.goto('/forum/topic/topic-1')
    await page.locator('.comment-section textarea').fill('可采纳的回答')
    await page.locator('.comment-section [data-test="comment-submit"]').click()
    await expect(page.getByText('可采纳的回答', { exact: true })).toBeVisible()
    await page.locator('.comment-section button[title="最佳回答"]').click()
    await expect(page.locator('.comment-section [data-test="marked-label"]')).toHaveText(/最佳回答/)
  })

  test('real comment API parses time anchors', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/debate')
    const token = await authenticatedPage.evaluate(() => localStorage.getItem('token'))
    expect(token).toBeTruthy()
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    const videoResponse = await authenticatedPage.request.post('/api/v1/videos', {
      headers,
      data: {
        title: `Comment E2E ${Date.now()}`,
        description: 'time anchor',
        storage_type: 'external',
        video_url: 'https://example.com/comment-e2e.mp4',
        duration_sec: 300,
        visibility: 'public',
        status: 'published',
      },
    })
    expect(videoResponse.status()).toBe(201)
    const video = await videoResponse.json() as { id: string }

    try {
      const commentResponse = await authenticatedPage.request.post(`/api/v1/discussions/video/${video.id}/comments`, {
        headers,
        data: { content: '1:24 核心识别', mentions: [], attachment_ids: [] },
      })
      expect(commentResponse.status()).toBe(201)
      const created = (await commentResponse.json()).data as Comment
      expect(created.time_anchors).toEqual([{ start: 0, end: 4, seconds: 84 }])
    } finally {
      await authenticatedPage.request.delete(`/api/v1/videos/${video.id}`, { headers })
    }
  })
})
