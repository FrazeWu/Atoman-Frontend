import { test, expect } from '../fixtures/base'

const hasRealMusicFixture = Boolean(process.env.MUSIC_WIKI_REAL_E2E)

test.describe('Music Wiki Real', () => {
  test.skip(!hasRealMusicFixture, 'requires MUSIC_WIKI_REAL_E2E and prepared backend fixture data')

  test('authenticated user can open the music contribute flow against real backend', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/artist/new')

    await expect(authenticatedPage.getByText('添加/补全艺术家')).toBeVisible()
    await expect(authenticatedPage.getByRole('button', { name: '创建艺术家' })).toBeVisible()
  })
})
