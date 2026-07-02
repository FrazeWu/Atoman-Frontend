import { test, expect } from '../fixtures/base'
import { buildMockMusicAlbumsResponse, buildMockMusicArtist, buildMockMusicArtistsResponse } from '../helpers/music-fixtures'

test.describe('Music Wiki Mock', () => {
  test('renders mocked artist list on music home', async ({ page }) => {
    await page.route('**/api/v1/music/artists**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildMockMusicArtistsResponse()),
      })
    })

    await page.goto('/music')

    await expect(page.getByText('Mock Artist')).toBeVisible()
  })

  test('opens authenticated artist create page with seeded query name', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/artist/new?name=mock_artist')

    await expect(authenticatedPage.getByText('添加/补全艺术家')).toBeVisible()
    await expect(authenticatedPage.getByPlaceholder('例如：kanye_west')).toHaveValue('mock_artist')
  })

  test('renders mocked artist drawer content when wiki artist endpoint resolves', async ({ page }) => {
    const artist = buildMockMusicArtist()

    await page.route('**/api/v1/music/artists**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildMockMusicArtistsResponse()),
      })
    })

    await page.route(`**/api/v1/music/artists/${artist.id}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: artist }),
      })
    })

    await page.route(`**/api/v1/music/albums?artist_id=${artist.id}**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildMockMusicAlbumsResponse()),
      })
    })

    await page.goto('/music')
    await page.getByText('Mock Artist').click()

    await expect(page.getByText('Mock Album')).toBeVisible()
  })
})
