import { expect, test } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

let fixtureDir = ''
let pdfFixture: Buffer
let epubFixture: Buffer

test.beforeAll(() => {
  fixtureDir = mkdtempSync(join(tmpdir(), 'atoman-books-real-'))
  execFileSync('python3', [resolve('scripts/gen-book-reader-fixtures.py'), fixtureDir])
  pdfFixture = readFileSync(join(fixtureDir, 'reader-fixture.pdf'))
  epubFixture = readFileSync(join(fixtureDir, 'reader-fixture.epub'))
})
test.afterAll(() => { if (fixtureDir) rmSync(fixtureDir, { recursive: true, force: true }) })

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/auth/session')) return route.fulfill({ status: 204 })
    if (path.endsWith('/asset-revisions/revision-pdf-real/content')) return route.fulfill({ status: 200, contentType: 'application/pdf', body: pdfFixture })
    if (path.endsWith('/asset-revisions/revision-epub-real/content')) return route.fulfill({ status: 200, contentType: 'application/epub+zip', body: epubFixture })
    const pdf = path.endsWith('/assets/pdf-real/revisions')
    const epub = path.endsWith('/assets/epub-real/revisions')
    const data = pdf || epub ? { items: [{ id: pdf ? 'revision-pdf-real' : 'revision-epub-real', asset_id: pdf ? 'pdf-real' : 'epub-real', number: 1, status: 'ready', original_filename: pdf ? 'reader-fixture.pdf' : 'reader-fixture.epub', created_at: '2026-11-04T00:00:00Z' }] } : { items: [], total: 0 }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) })
  })
})

const key = (id: string) => `atoman:book-reading-progress:${id}`
test('real PDF.js: continuous scroll and precise page fraction resume', async ({ page }) => {
  await page.goto('/books/public-read/pdf-real')
  const scroll = page.locator('.book-pdf-continuous__scroll')
  await expect(scroll).toBeVisible()
  await expect(page.locator('.pdfViewer .page')).toHaveCount(12)
  await expect(page.locator('.pdfViewer .page canvas').first()).toBeVisible()
  await scroll.hover()
  await page.mouse.wheel(0, 450)
  await expect.poll(async () => page.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}').pdf_offset || 0, key('pdf-real'))).toBeGreaterThan(.1)
  const saved = await page.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}'), key('pdf-real'))
  expect(saved.pdf_page).toBe(1)
  await page.reload()
  await expect(page.locator('.book-pdf-continuous__scroll')).toBeVisible()
  await expect.poll(async () => scroll.evaluate(el => (el as HTMLElement).scrollTop)).toBeGreaterThan(80)
  await page.getByRole('button', { name: '切换为单页翻页' }).click()
  await expect(page.locator('.public-reader__pdf-page canvas')).toBeVisible()
  await page.getByRole('button', { name: '下一页' }).click()
  await expect(page.getByText('第 2 / 12 页')).toBeVisible()
  await page.getByRole('button', { name: '切换为连续滚动' }).click()
  await expect(scroll).toBeVisible()
})

test('real EPUB.js: continuous view and paginated mode reflow', async ({ page }) => {
  await page.goto('/books/public-read/epub-real')
  const host = page.locator('.public-reader__epub-renderer')
  await expect(host).toBeVisible()
  await expect.poll(async () => host.locator('iframe').count()).toBeGreaterThan(0)
  await expect.poll(async () => page.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}').epub_cfi || '', key('epub-real'))).not.toBe('')
  const firstCfi = await page.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}').epub_cfi || '', key('epub-real'))
  await host.hover()
  await page.mouse.wheel(0, 1600)
  await page.mouse.wheel(0, 1600)
  await expect.poll(async () => page.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}').epub_cfi || '', key('epub-real'))).not.toBe(firstCfi)
  await page.getByRole('button', { name: '切换为单页翻页' }).click()
  await expect(page.getByRole('button', { name: '切换为连续滚动' })).toBeVisible()
  await expect.poll(async () => host.locator('iframe').count()).toBeGreaterThan(0)
  await page.getByRole('button', { name: '切换为连续滚动' }).click()
  await expect(page.getByRole('button', { name: '切换为单页翻页' })).toBeVisible()
  await expect.poll(async () => host.locator('iframe').count()).toBeGreaterThan(0)
})
