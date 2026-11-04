import { expect, test } from '@playwright/test'
import JSZip from 'jszip'
import { readFileSync } from 'node:fs'

test.skip(process.env.BOOK_QA_REAL_BROWSER !== '1', 'Requires the ephemeral Go QA server, PostgreSQL and MinIO containers')
test.use({ channel: 'chrome' })
test.describe.configure({ mode: 'serial' })

type Fixture = { work_id: string; asset_id: string; revision_id: string; collection_id: string; note_id: string; highlight_id: string; trashed_highlight_id: string; linked_share_path: string; public_share_path: string; private_bucket: string }
let fixture: Fixture
const api = (path: string) => `/api/v1/books${path}`

test.beforeAll(async ({ request }) => {
 const response=await request.get(api('/__qa/fixture'))
 expect(response.ok()).toBeTruthy()
 fixture=await response.json() as Fixture
})

test('真正的 MinIO 文件读取、匿名链接分享和公开索引',async({ page, request })=>{
 const file=await request.get(api(`/asset-revisions/${fixture.revision_id}/content`))
 expect(file.status()).toBe(200)
 expect((await file.text())).toContain('AToMAN QA: 这是来自独立 MinIO 的真实 TXT 文件。')
 expect(file.headers()['content-type']).toContain('text/plain')
 // A bucket object cannot be downloaded directly without backend authorization.
 const unsigned=await request.get(`http://127.0.0.1:19100/${fixture.private_bucket}/book/revisions/qa-actual-minio-file.txt`)
 expect([401,403]).toContain(unsigned.status())

 await page.goto(`/books/public-read/${fixture.asset_id}`)
 await expect(page.locator('.public-reader__text pre')).toContainText('AToMAN QA: 这是来自独立 MinIO 的真实 TXT 文件。')
 await expect(page.locator('.public-reader__text pre')).toContainText('实际对象存储中的章节')
 await page.goto(fixture.linked_share_path)
 await expect(page.getByRole('heading',{name:'仅持有链接可访问的合集'})).toBeVisible()
 await expect(page.getByText('已选入合集的公开部分')).toBeVisible()
 await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content','noindex,nofollow')
 await expect(page.locator('body')).not.toContainText('不允许泄漏的原始秘密')
 await page.goto('/books/shared-notes')
 await expect(page.getByRole('link',{name:'可以公开发现的合集'})).toBeVisible()
 await expect(page.locator('body')).not.toContainText('仅持有链接可访问的合集')
})

test('真实浏览器编辑草稿、预览确认、发布、访问控制、历史与撤销',async({page,request})=>{
 await page.context().setExtraHTTPHeaders({'X-Book-QA-Actor':'owner'})
 await page.goto(`/books/work/${fixture.work_id}/collections/${fixture.collection_id}`)
 await expect(page.getByLabel('合集标题')).toHaveValue('浏览器准备发布的私人草稿')
 await page.getByLabel('合集标题').fill('Chrome 确认后的真实发布内容')
 await page.getByLabel('选择分享权限').selectOption('public')
 await page.getByRole('button',{name:'预览并发布'}).click()
 await expect(page.getByText('已选入合集的公开部分')).toBeVisible()
 await expect(page.getByText('来自真实对象存储的划线')).toBeVisible()
 await page.getByRole('button',{name:'确认按预览发布'}).click()
 await expect(page.getByText('已按预览发布新的冻结快照')).toBeVisible()
 const sharePath=await page.getByRole('link',{name:'查看已发布内容'}).getAttribute('href')
 expect(sharePath).toMatch(/^\/books\/note-shares\//)
 const sharedResponse=await request.get(api(sharePath!.replace(/^\/books/,'')))
 expect(sharedResponse.status()).toBe(200)
 expect(await sharedResponse.text()).toContain('Chrome 确认后的真实发布内容')
 expect(await sharedResponse.text()).not.toContain('不允许泄漏的原始秘密')
 const unauth=await request.get(api(`/me/note-collections/${fixture.collection_id}/history`),{headers:{'X-Book-QA-Actor':'other'}})
 expect([403,404]).toContain(unauth.status())
 await page.getByRole('button',{name:'查看历史版本'}).click()
 await expect(page.getByText(/版本 1/)).toBeVisible()
 await page.getByRole('button',{name:'查看冻结内容'}).click()
 await expect(page.getByText('Chrome 确认后的真实发布内容')).toBeVisible()
 await page.getByRole('button',{name:'关闭',exact:true}).click()
 await page.getByLabel('选择分享权限').selectOption('private')
 await page.getByRole('button',{name:'撤销分享'}).click()
 await page.getByRole('alertdialog').getByRole('button',{name:'确认',exact:true}).click()
 await expect(page.getByText('分享已撤销，私人草稿及历史版本仍保留。')).toBeVisible()
 const revoked=await request.get(api(sharePath!.replace(/^\/books/,'')))
 expect(revoked.status()).toBe(404)
 const history=await page.request.get(api(`/me/note-collections/${fixture.collection_id}/history/1`))
 expect(history.status()).toBe(200)
})

test('真实回收站恢复划线后可读取原始标注，但不会重新发布分享',async({page,request})=>{
 await page.context().setExtraHTTPHeaders({'X-Book-QA-Actor':'owner'})
 await page.goto('/books/notes')
 await page.getByRole('radio',{name:'回收站'}).click()
 await expect(page.getByText('等待浏览器恢复的私人划线')).toBeVisible()
 await page.getByRole('button',{name:'恢复划线'}).click()
 await expect(page.getByText('划线已恢复到原电子书')).toBeVisible()
 const list=await page.request.get(api(`/me/reading-marks/${fixture.revision_id}`))
 expect(list.status()).toBe(200)
 const raw=await list.text()
 expect(raw).toContain('等待浏览器恢复的私人划线')
 const trash=await page.request.get(api('/me/reading-marks/trash'))
 expect(trash.status()).toBe(200)
 expect(await trash.text()).not.toContain('等待浏览器恢复的私人划线')
})


test('真实 API JSON 导出导入幂等，以及浏览器 Markdown ZIP 下载',async({page,request})=>{
 const exported=await request.get(api('/me/private-notes/export'),{headers:{'X-Book-QA-Actor':'owner'}})
 expect(exported.status()).toBe(200)
 const backup=(await exported.json()).data as {schema_version:number;notes:{id:string;title:string;body:string}[]}
 expect(backup.schema_version).toBe(1)
 expect(backup.notes.length).toBeGreaterThanOrEqual(3)
 expect(backup.notes.some(note=>note.body==='不允许泄漏的原始秘密')).toBe(true)
 expect(backup.notes.some(note=>note.body==='等待浏览器恢复的私人划线')).toBe(false)
 const requestID=crypto.randomUUID()
 const payload={...backup,request_id:requestID}
 const imported=await request.post(api('/me/private-notes/import'),{headers:{'X-Book-QA-Actor':'other'},data:payload})
 expect(imported.status()).toBe(200)
 const importedData=(await imported.json()).data as {created:string[];duplicate:boolean}
 expect(importedData.created.length).toBeGreaterThan(0)
 const retry=await request.post(api('/me/private-notes/import'),{headers:{'X-Book-QA-Actor':'other'},data:payload})
 expect(retry.status()).toBe(200)
 expect((await retry.json()).data.duplicate).toBe(true)
 await page.context().setExtraHTTPHeaders({'X-Book-QA-Actor':'owner'})
 await page.goto('/books/notes')
 const downloadPromise=page.waitForEvent('download')
 await page.getByRole('button',{name:'导出全部笔记'}).click()
 const download=await downloadPromise
 expect(download.suggestedFilename()).toBe('atoman-notes.zip')
 const zip=await JSZip.loadAsync(readFileSync((await download.path())!))
 const entries=Object.keys(zip.files).filter(name=>name.endsWith('.md'))
 expect(entries.length).toBeGreaterThanOrEqual(3)
 const markdown=await zip.files[entries[0]!]!.async('string')
 expect(markdown).toContain('作品：')
})
