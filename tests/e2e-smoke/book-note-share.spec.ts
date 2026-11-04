import { expect, test } from '@playwright/test'

test.use({ channel: 'chrome' })
const key='abcD1234-abcD1234-abcD1234-abcD1234-abcD12'
const privateText='未被选中的私人笔记内容'
const shared={title:'原始作品：读书笔记合集',description:'精选的公开摘要',version:2,visibility:'link',published_at:'2026-11-04T00:00:00Z',items:[{kind:'highlight',title:'第一节',quote:'一段经过选择的短引用',note:'自己原创的读书分析',color:'blue'}]}
const envelope=(data:unknown)=>({status:200,contentType:'application/json',body:JSON.stringify({data})})

test('真实 Chrome 渲染链接快照，不读取私人笔记与文件',async({page})=>{
 const called:string[]=[]
 await page.route('**/api/v1/**',route=>{
  const url=new URL(route.request().url())
  called.push(url.pathname)
  if(url.pathname==='/api/v1/books/note-shares/'+key) return route.fulfill(envelope(shared))
  if(url.pathname==='/api/v1/auth/session')return route.fulfill({status:204})
  return route.fulfill(envelope({items:[],total:0}))
 })
 const response=await page.goto('/books/note-shares/'+key)
 expect(response?.status()).toBe(200)
 await expect(page.getByRole('heading',{name:'原始作品：读书笔记合集'})).toBeVisible()
 await expect(page.getByText('一段经过选择的短引用')).toBeVisible()
 await expect(page.getByText('自己原创的读书分析')).toBeVisible()
 await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content','noindex,nofollow')
 await expect(page.locator('body')).not.toContainText(privateText)
 expect(called.some(path=>path.includes('/me/private-notes'))).toBe(false)
 expect(called.some(path=>path.includes('/me/reading-marks'))).toBe(false)
})

test('撤销分享后，即使持有旧链接，页面也无法读取历史快照',async({page})=>{
 let revoked=false
 await page.route('**/api/v1/**',route=>{
  const url=new URL(route.request().url())
  if(url.pathname==='/api/v1/books/note-shares/'+key) {
   if(revoked)return route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({error:{code:'books.note_share_not_found',message:'Shared notes unavailable'}})})
   return route.fulfill(envelope(shared))
  }
  if(url.pathname==='/api/v1/auth/session')return route.fulfill({status:204})
  return route.fulfill(envelope({items:[],total:0}))
 })
 await page.goto('/books/note-shares/'+key)
 await expect(page.getByText('自己原创的读书分析')).toBeVisible()
 revoked=true
 await page.reload()
 await expect(page.getByRole('heading',{name:'分享已不可访问'})).toBeVisible()
 await expect(page.locator('body')).not.toContainText('自己原创的读书分析')
})

test('公开索引只展示 public 合集，不列出仅凭链接分享的笔记',async({page})=>{
 await page.route('**/api/v1/**',route=>{
  const url=new URL(route.request().url())
  if(url.pathname==='/api/v1/books/note-shares')return route.fulfill(envelope({items:[{title:'面向所有人的读书笔记',description:'分享阅读收获',share_path:'/books/note-shares/public-key',note_count:3,published_at:'2026-11-04T00:00:00Z'}],total:1}))
  if(url.pathname==='/api/v1/auth/session')return route.fulfill({status:204})
  return route.fulfill(envelope({items:[],total:0}))
 })
 await page.goto('/books/shared-notes')
 await expect(page.getByRole('link',{name:'面向所有人的读书笔记'})).toBeVisible()
 await expect(page.locator('body')).not.toContainText('原始作品：读书笔记合集')
})
