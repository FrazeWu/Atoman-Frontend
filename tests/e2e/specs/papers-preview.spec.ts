import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'

if (process.env.CHROME_BIN) test.use({ launchOptions: { executablePath: process.env.CHROME_BIN, args: ['--no-sandbox', '--disable-dev-shm-usage'] } })

// A real two-page PDF with correct xref offsets, rather than just a %PDF header.
// Only fixture documents and intercepted HTTP responses are used in this test.
function fixturePDF(): Buffer {
  const stream = (text: string) => {
    const body = `BT /F1 16 Tf 36 200 Td (${text}) Tj ET\n`
    return `<< /Length ${Buffer.byteLength(body)} >>\nstream\n${body}endstream`
  }
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R /Outlines 8 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 320 600] /Resources << /Font << /F1 7 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 320 600] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>',
    stream('Papers acceptance page one'),
    stream('Papers acceptance page two'),
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Outlines /First 9 0 R /Last 9 0 R /Count 1 >>',
    '<< /Title (Results page) /Parent 8 0 R /Dest [4 0 R /Fit] >>',
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
  test.setTimeout(180000)
  test('renders a genuine PDF, paginates, downloads identical bytes and stays private when disabled', async ({ page, baseURL }) => {
    const origin = new URL(baseURL!).origin
    expect(new URL(origin).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/)
    const pdf = fixturePDF()
    const prefix = '/papers/projects/project-a'
    const time = '2026-11-24T00:00:00Z'
    const project = { id: 'project-a', name: 'Papers acceptance', main_file_id: 'file-a', head_revision: 1, created_at: time, updated_at: time }
    const file = { id: 'file-a', path: 'main.tex', kind: 'text', content: '\\documentclass{article}\n\\begin{document}\n\\section{Introduction}\nFixture\n\\end{document}', sha256: '', revision: 1, created_at: time, updated_at: time }
    const job = { id: 'job-a', project_id: 'project-a', source_revision: 1, status: 'succeeded', attempts: 1, max_attempts: 2, cancel_requested: false, pdf_available: true, created_at: time }
    const image={...file,id:'image-a',kind:'binary',path:'figures/pixel.png',content:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGOQq7gEAAIgAWmLr1EGAAAAAElFTkSuQmCC'}
    const resource={...file,id:'resource-a',kind:'binary',path:'figures/source.pdf',content:pdf.toString('base64')}
    let enabled = true, requests = 0
    const uploaded: Array<typeof image> = []
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
      if (path === prefix + '/files') return ok([file,image,resource,...uploaded])
      if (path === prefix + '/files/manage' && route.request().method() === 'POST') {
        const change=route.request().postDataJSON()
        expect(change.action).toBe('upload')
        expect(change.base_revision).toBe(project.head_revision)
        for(const [i,upload] of change.uploads.entries()) uploaded.push({...image,...upload,id:'uploaded-'+i})
        project.head_revision++
        return ok({project,files:[file,image,resource,...uploaded]})
      }
      if (path.startsWith(prefix + '/files/uploaded-')) return ok(uploaded.find(f=>path.endsWith('/'+f.id)))
      if (path === prefix + '/files/image-a') return ok(image)
      if (path === prefix + '/files/resource-a') return ok(resource)
      if (path === prefix + '/files/file-a') {
        if(route.request().method()==='PUT'){
          const change=route.request().postDataJSON()
          expect(change.base_revision).toBe(file.revision)
          file.content=change.content
          file.revision++
          project.head_revision++
          return ok({...file,project_head_revision:project.head_revision})
        }
        return ok(file)
      }
      if (path === prefix + '/compile-capability') return ok({ enabled, pdf_available: enabled })
      if (path === prefix + '/compiles') return ok([job])
      if (path === prefix + '/compiles/job-a/pdf') {
        requests++
        return route.fulfill({ contentType: 'application/pdf', body: pdf, headers: { ...cors, 'cache-control': 'private, no-store' } })
      }
      return ok({ items: [], total: 0 })
    })
    await page.goto('/papers/project-a')
    await expect(page.locator('.cm-content')).toContainText('Fixture',{timeout:90000})
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
    // Verify real PDF.js text, not only a control label.
    await page.getByRole('button',{name:'选择文字',exact:true}).click()
    const textLayer=first.locator('.paper-pdf__text-layer')
    await expect(textLayer).toContainText('Papers acceptance page one',{timeout:15000})
    const selected=await textLayer.evaluate(el=>{
      const span=Array.from(el.querySelectorAll('span')).find(x=>x.textContent?.includes('Papers acceptance'))!
      const range=document.createRange();range.selectNodeContents(span)
      const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(range)
      const value=selection.toString();selection.removeAllRanges();return value
    })
    expect(selected).toContain('Papers acceptance')
    await page.getByRole('button',{name:'选字中',exact:true}).click()
    await expect(textLayer).toHaveCount(0)
    await page.getByRole('button',{name:'目录',exact:true}).click()
    await page.getByRole('button',{name:/Results page/}).click()
    await expect(second).toHaveAttribute('data-rendered','true',{timeout:30000})
    await page.getByRole('button',{name:'查找替换',exact:true}).click()
    await expect(page.locator('.cm-search')).toBeVisible()
    await page.getByRole('button',{name:'大纲',exact:true}).click()
    await expect(page.locator('.papers-workspace__outline')).toContainText('Introduction')
    await page.getByRole('button',{name:'大纲',exact:true}).click()
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
    await page.locator('button[title="figures/pixel.png"]').click()
    await expect(page.locator('.paper-asset img')).toBeVisible()
    await expect.poll(()=>page.locator('.paper-asset img').evaluate(el=>(el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
    await page.locator('button[title="figures/source.pdf"]').click()
    await expect(page.locator('.paper-asset .paper-pdf__sheet[data-page="1"]')).toHaveAttribute('data-rendered','true',{timeout:30000})
    await page.locator('button[title="main.tex"]').click()
    await expect(page.locator('.cm-content')).toContainText('Introduction')
    // Real browser File/DataTransfer objects; all writes target the fixture API.
    const transfer=await page.evaluateHandle(base64=>{
      const bytes=Uint8Array.from(atob(base64),ch=>ch.charCodeAt(0))
      const dt=new DataTransfer()
      dt.items.add(new File([bytes],'curve plot.png',{type:'image/png'}))
      return dt
    },image.content)
    const sidebar=page.getByRole('complementary',{name:'论文文件'})
    await sidebar.dispatchEvent('dragover',{dataTransfer:transfer})
    await expect(sidebar).toContainText('松开鼠标上传插图')
    await sidebar.dispatchEvent('drop',{dataTransfer:transfer})
    await expect(page.locator('button[title="figures/curve plot.png"]')).toBeVisible()
    await expect(page.locator('.cm-content')).toContainText('Fixture')
    await transfer.dispose()
    await page.locator('.cm-line').filter({hasText:/^Fixture$/}).click()
    await page.keyboard.press('End')
    await page.getByRole('button',{name:'插图',exact:true}).click()
    const figures=page.getByRole('region',{name:'插图管理'})
    await figures.getByLabel('插图文件').selectOption('uploaded-0')
    await figures.getByRole('button',{name:'预览资源',exact:true}).click()
    await expect.poll(()=>figures.locator('img').evaluate(el=>(el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
    await figures.getByLabel('图片宽度百分比').fill('65')
    await figures.getByLabel('图片图注').fill('Ablation & recall: 95%')
    await figures.getByLabel('图片引用标签').fill('fig:ablation')
    await expect(figures.getByLabel('生成的插图代码')).toHaveValue(/width=0\.65\\linewidth/)
    await figures.getByRole('button',{name:'插入到光标处',exact:true}).click()
    await expect(figures).toHaveCount(0)
    await expect(page.locator('.cm-content')).toContainText('\\includegraphics[width=0.65\\linewidth]{figures/curve plot.png}')
    await expect(page.locator('.cm-content')).toContainText('Fixture')
    await page.getByRole('button',{name:'保存',exact:true}).click()
    await expect.poll(()=>file.content).toContain('\\label{fig:ablation}')
    enabled = false
    await page.reload()
    await expect(page.getByText('编译尚未开放', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '编译', exact: true })).toBeDisabled()
    await expect(canvas).toHaveCount(0)
    expect(requests).toBe(1)
  })
})

test('read-only collaborator can render the latest shared PDF and refresh after revocation',async({page,baseURL})=>{
 test.setTimeout(60000)
 const origin=new URL(baseURL!).origin
 expect(new URL(origin).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/)
 const pdf=fixturePDF(),pid='shared-preview-project',prefix='/papers/projects/'+pid
 const now='2026-11-26T00:00:00Z'
 const project={id:pid,name:'Shared PDF acceptance',main_file_id:'main',head_revision:2,access_role:'viewer',created_at:now,updated_at:now}
 const file={id:'main',path:'main.tex',kind:'text',content:'Shared manuscript',sha256:'',revision:1,created_at:now,updated_at:now}
 const job={id:'latest-pdf',project_id:pid,source_revision:1,status:'succeeded',compiler:'xelatex',pdf_available:true,attempts:1,max_attempts:2,cancel_requested:false,created_at:now}
 let allowed=true,pdfReads=0,historyReads=0,mapReads=0
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url())
  const api=url.pathname.startsWith('/api/v1/')&&(url.origin===origin||url.origin==='https://api.atoman.org')
  if(!api)return url.origin===origin&&!url.pathname.startsWith('/api/')?route.continue():route.abort()
  const headers={'access-control-allow-origin':origin,'access-control-allow-credentials':'true','access-control-allow-methods':'GET, OPTIONS, POST, PUT, DELETE','access-control-allow-headers':'content-type, x-csrf-token, authorization'}
  if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers})
  const path=url.pathname.slice('/api/v1'.length)
  const ok=(data:unknown)=>route.fulfill({headers,json:{data}})
  const denied=()=>route.fulfill({status:404,headers,json:{code:'papers.project_not_found',message:'Not found'}})
  if(path==='/auth/session')return route.fulfill({headers,json:{csrf_token:'fixture-csrf',user:{uuid:'fixture-viewer',username:'viewer',email:'fixture@example.test',role:'user',onboarding_completed_at:now}}})
  if(path==='/site/access')return route.fulfill({headers,json:{}})
  if(path===prefix)return ok(project)
  if(path===prefix+'/files')return ok([file])
  if(path===prefix+'/files/main')return ok(file)
  if(path===prefix+'/compile-capability')return denied()
  if(path===prefix+'/shared-preview')return allowed?ok(job):denied()
  if(path===prefix+'/compiles'){historyReads++;return denied()}
  if(path.endsWith('/source-map')){mapReads++;return denied()}
  if(path===prefix+'/compiles/latest-pdf/pdf'){
   if(!allowed)return denied()
   pdfReads++
   return route.fulfill({contentType:'application/pdf',body:pdf,headers:{...headers,'cache-control':'private, no-store'}})
  }
  return ok({items:[],total:0})
 })
 await page.goto('/papers/'+pid)
 await expect(page.locator('.cm-content')).toContainText('Shared manuscript')
 await expect(page.locator('.paper-pdf__sheet[data-page="1"]')).toHaveAttribute('data-rendered','true',{timeout:30000})
 await expect(page.getByText('共享 PDF · 版本 1（上次成功版本）')).toBeVisible()
 await expect(page.getByRole('button',{name:'编译',exact:true})).toBeDisabled()
 expect(pdfReads).toBe(1)
 expect(historyReads).toBe(0)
 expect(mapReads).toBe(0)
 allowed=false
 await page.getByRole('button',{name:'刷新预览'}).click()
 await expect(page.locator('.paper-pdf canvas')).toHaveCount(0)
 await expect(page.getByText('暂时无法读取共享 PDF，请检查项目权限后刷新。')).toBeVisible()
})
