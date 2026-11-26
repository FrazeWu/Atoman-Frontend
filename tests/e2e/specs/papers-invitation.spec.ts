import {test,expect} from '@playwright/test'
test('redeems a private invitation only after explicit consent without a URL token',async({browser,baseURL})=>{
 const origin=new URL(baseURL!).origin
 expect(new URL(origin).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/)
 const token='A'.repeat(43)
 const uid='550e8400-e29b-41d4-a716-446655440001',pid='550e8400-e29b-41d4-a716-446655440002',now='2026-11-26T00:00:00Z'
 const ctx=await browser.newContext({baseURL})
 try{
  const page=await ctx.newPage()
  let accepted=0
  const requests:string[]=[]
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url())
   requests.push(url.href)
   const api=url.pathname.startsWith('/api/v1/')&&(url.origin===origin||url.origin==='https://api.atoman.org')
   if(!api)return url.origin===origin&&!url.pathname.startsWith('/api/')?route.continue():route.abort()
   const headers={'access-control-allow-origin':origin,'access-control-allow-credentials':'true','access-control-allow-methods':'GET, OPTIONS, POST, PUT, DELETE','access-control-allow-headers':'content-type, x-csrf-token, authorization'}
   if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers})
   const path=url.pathname.slice('/api/v1'.length)
   const ok=(data:unknown)=>route.fulfill({headers,json:{data}})
   if(path==='/auth/session')return route.fulfill({headers,json:{csrf_token:'fixture-csrf',user:{uuid:uid,username:'recipient',email:'fixture@example.test',role:'user',onboarding_completed_at:now}}})
   if(path==='/site/access')return route.fulfill({headers,json:{}})
   if(path==='/papers/access')return ok({allowed:true})
   if(path==='/papers/invitations/accept'){
    expect(route.request().method()).toBe('POST')
    expect(route.request().postDataJSON()).toEqual({token})
    accepted++
    return ok({project_id:pid,role:'viewer'})
   }
   if(path==='/papers/projects/'+pid)return ok({id:pid,name:'Shared fixture',head_revision:1,main_file_id:'main',access_role:'viewer',created_at:now,updated_at:now})
   const file={id:'main',path:'main.tex',kind:'text',sha256:'',revision:1,content:'Shared source',created_at:now,updated_at:now}
   if(path==='/papers/projects/'+pid+'/files')return ok([{...file,content:''}])
   if(path==='/papers/projects/'+pid+'/files/main')return ok(file)
   if(path.endsWith('/collaboration'))return ok({enabled:true,protocol:'papers-crdt-v1',role:'viewer'})
   return ok({items:[],total:0})
  })
  await page.goto('/papers/invite#'+token)
  await expect(page.getByText('加入共享论文')).toBeVisible({timeout:20000})
  await expect.poll(()=>new URL(page.url()).hash).toBe('')
  expect(accepted).toBe(0)
  await page.getByRole('button',{name:'接受邀请',exact:true}).click()
  await expect(page).toHaveURL(new RegExp('/papers/'+pid+'$'))
  expect(accepted).toBe(1)
  await expect(page.locator('.cm-content')).toContainText('Shared source')
  await expect(page.getByText('共享阅读：当前账号无编辑权限。')).toBeVisible()
  expect(requests.every(url=>!url.includes(token))).toBe(true)
 }finally{await ctx.close()}
})
