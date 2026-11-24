import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'

if (process.env.CHROME_BIN) test.use({ launchOptions: { executablePath: process.env.CHROME_BIN, args: ['--no-sandbox', '--disable-dev-shm-usage'] } })

// A real two-page PDF with correct xref offsets, rather than just a %PDF header.
// Only fixture documents and intercepted HTTP responses are used in this test.
function fixturePDF(): Buffer {
  const stream = (text: string) => {
    const body = `BT /F1 24 Tf 36 200 Td (${text}) Tj ET\n`
    return `<< /Length ${Buffer.byteLength(body)} >>\nstream\n${body}endstream`
  }
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 320 600] /Resources << /Font << /F1 7 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 320 600] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>',
    stream('Papers acceptance page one'),
    stream('Papers acceptance page two'),
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(pdf))
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`
  }
  const xref = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  pdf += offsets.slice(1).map(value => `${String(value).padStart(10, '0')} 00000 n \n`).join('')
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf)
}

test.describe('Papers isolated browser acceptance', () => {
  test.setTimeout(120000)
  test('renders a genuine PDF, paginates, downloads identical bytes and stays private when disabled', async ({ page, baseURL }) => {
    const origin = new URL(baseURL!).origin
    expect(new URL(origin).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/)
    const pdf = fixturePDF()
    const prefix = '/papers/projects/project-a'
    const time = '2026-11-24T00:00:00Z'
    const project = { id: 'project-a', name: 'Papers acceptance', main_file_id: 'file-a', head_revision: 1, created_at: time, updated_at: time }
    const file = { id: 'file-a', path: 'main.tex', kind: 'text', content: '\\documentclass{article}\n\\begin{document}Fixture\\end{document}', sha256: '', revision: 1, created_at: time, updated_at: time }
    const job = { id: 'job-a', project_id: 'project-a', source_revision: 1, status: 'succeeded', attempts: 1, max_attempts: 2, cancel_requested: false, pdf_available: true, created_at: time }
    let enabled = true, requests = 0
    await page.routeWebSocket('**/*', socket => socket.close())
    await page.route('**/*', async route => {
      const url = new URL(route.request().url())
      const isFixtureAPI = url.pathname.startsWith('/api/v1/') && (url.origin === origin || url.origin === 'https://api.atoman.org')
      if (!isFixtureAPI) return url.origin === origin && !url.pathname.startsWith('/api/') && !url.pathname.startsWith('/uploads/') && !url.pathname.startsWith('/__object-storage/') ? route.continue() : route.abort()
      const cors = { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true', 'access-control-allow-methods': 'GET, OPTIONS, POST, PUT, DELETE', 'access-control-allow-headers': 'content-type, x-csrf-token, authorization' }
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
      const path = url.pathname.slice('/api/v1'.length)
      const ok = (data: unknown) => route.fulfill({ headers: cors, json: { data } })
      if (path === '/auth/session') return route.fulfill({ headers: cors, json: { csrf_token: 'fixture-csrf', user: { uuid: 'fixture-user', username: 'fixture', email: 'fixture@example.test', role: 'user', onboarding_completed_at: time } } })
      if (path === '/site/access') return route.fulfill({ headers: cors, json: {} })
      if (path === prefix) return ok(project)
      if (path === prefix + '/files') return ok([file])
      if (path === prefix + '/files/file-a') return ok(file)
      if (path === prefix + '/compile-capability') return ok({ enabled, pdf_available: enabled })
      if (path === prefix + '/compiles') return ok([job])
      if (path === prefix + '/compiles/job-a/pdf') {
        requests++
        return route.fulfill({ contentType: 'application/pdf', body: pdf, headers: { ...cors, 'cache-control': 'private, no-store' } })
      }
      return ok({ items: [], total: 0 })
    })
    await page.goto('/papers/project-a')
    const canvas = page.locator('.paper-pdf canvas')
    const first = page.locator('.paper-pdf__sheet[data-page="1"]')
    const second = page.locator('.paper-pdf__sheet[data-page="2"]')
    await expect(first).toHaveAttribute('data-rendered','true',{timeout:30000})
    await expect(canvas).toHaveCount(2)
    // Actual nonwhite glyph pixels prove PDF.js rendered the page.
    const ink = (sheet: typeof first) => sheet.locator('canvas').evaluate(el => {
      const c = el as HTMLCanvasElement
      const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data
      let ink = 0
      for (let i = 0; i < d.length; i += 4) if (d[i + 3]! > 0 && d[i]! < 150 && d[i + 1]! < 150 && d[i + 2]! < 150) ink++
      return ink
    })
    await expect.poll(()=>ink(first)).toBeGreaterThan(50)
    const pageInput=page.getByRole('textbox',{name:'页码'})
    // Scroll-driven page updates must not overwrite a typed page number.
    await pageInput.fill('2')
    await page.locator('.paper-pdf__scroll').evaluate(el => {
      el.scrollTop=0
      el.dispatchEvent(new Event('scroll'))
    })
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
    await expect(pageInput).toHaveValue('2')
    await pageInput.press('Enter')
    await expect.poll(()=>second.evaluate(el=>{
      const r=el.getBoundingClientRect(),b=el.closest('.paper-pdf__scroll')!.getBoundingClientRect()
      return Math.max(0,Math.min(r.bottom,b.bottom)-Math.max(r.top,b.top))
    })).toBeGreaterThan(100)
    await expect(second).toHaveAttribute('data-rendered','true',{timeout:30000})
    await expect.poll(()=>ink(second)).toBeGreaterThan(50)
    // A new scale can be pending while old complete pixels remain visible.
    await page.getByLabel('PDF 缩放').selectOption('125')
    await expect.poll(()=>ink(second)).toBeGreaterThan(50)
    await expect(second).toHaveAttribute('data-rendered','true',{timeout:30000})
    await expect.poll(()=>ink(second)).toBeGreaterThan(50)
    await pageInput.fill('1')
    await pageInput.press('Enter')
    await expect(first).toHaveAttribute('data-rendered','true',{timeout:30000})
    await expect.poll(()=>ink(first)).toBeGreaterThan(50)
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: '下载 PDF', exact: true }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe('paper.pdf')
    expect(await readFile((await download.path())!)).toEqual(pdf)
    expect(requests).toBe(1)
    enabled = false
    await page.reload()
    await expect(page.getByText('编译尚未开放', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '编译', exact: true })).toBeDisabled()
    await expect(canvas).toHaveCount(0)
    expect(requests).toBe(1)
  })
})
