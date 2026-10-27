import { expect, test } from '@playwright/test'

test('PDF compatibility runtime loads without native Iterator helpers', async ({ page }) => {
  await page.addInitScript(() => { Reflect.deleteProperty(globalThis, 'Iterator') })
  await page.route('**/api/v1/**', route => route.fulfill({ status: 204 }))
  await page.goto('/')
  const result = await page.evaluate(async (moduleURL) => {
    const pdf = await import(moduleURL)
    const worker = await fetch('/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')
    return { getDocument: typeof pdf.getDocument, textLayer: typeof pdf.TextLayer, workerAvailable: worker.ok }
  }, '/node_modules/pdfjs-dist/legacy/build/pdf.mjs')
  expect(result).toEqual({ getDocument: 'function', textLayer: 'function', workerAvailable: true })
})
