import {test,expect} from '@playwright/test'

test('automatic compilation coalesces saved edits and manual compilation can explicitly rerun a revision',async({page,baseURL})=>{
 test.setTimeout(90000)
 const origin=new URL(baseURL!).origin
 expect(new URL(origin).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/)
 const pid='auto-compile-fixture',prefix='/papers/projects/'+pid,now='2026-11-28T00:00:00Z'
 const file={id:'main',path:'main.tex',kind:'text',revision:1,content:'Original manuscript',sha256:'',created_at:now,updated_at:now}
 const jobs=(revision:number,id:string)=>({id,project_id:pid,source_revision:revision,compiler:'pdflatex',status:'succeeded',attempts:1,max_attempts:2,cancel_requested:false,pdf_available:false,created_at:now})
 const submissions:{base_revision:number;idempotency_key:string;compiler:string}[]=[]
 await page.routeWebSocket('**/*',socket=>socket.close())
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url())
  const api=url.pathname.startsWith('/api/v1/')&&(url.origin===origin||url.origin==='https://api.atoman.org')
  if(!api)return url.origin===origin&&!url.pathname.startsWith('/api/')?route.continue():route.abort()
  const headers={'access-control-allow-origin':origin,'access-control-allow-credentials':'true','access-control-allow-methods':'GET, OPTIONS, POST, PUT, DELETE','access-control-allow-headers':'content-type, x-csrf-token, authorization'}
  if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers})
  const path=url.pathname.slice('/api/v1'.length)
  const ok=(data:unknown)=>route.fulfill({headers,json:{data}})
  if(path==='/auth/session')return route.fulfill({headers,json:{csrf_token:'fixture-csrf',user:{uuid:'auto-owner',username:'owner',email:'fixture@example.test',role:'user',onboarding_completed_at:now}}})
  if(path==='/site/access')return route.fulfill({headers,json:{}})
  if(path===prefix)return ok({id:pid,name:'Auto compilation fixture',main_file_id:file.id,head_revision:file.revision,access_role:'owner',created_at:now,updated_at:now})
  if(path===prefix+'/files')return ok([{...file,content:''}])
  if(path===prefix+'/compile-capability')return ok({enabled:true,pdf_available:false})
  if(path===prefix+'/files/main/collaboration')return ok({enabled:false})
  if(path===prefix+'/files/main'){
   if(route.request().method()==='PUT'){
    const body=route.request().postDataJSON()
    expect(body.base_revision).toBe(file.revision)
    file.content=body.content;file.revision++
   }
   return ok({...file,project_head_revision:file.revision})
  }
  if(path===prefix+'/compiles'){
   if(route.request().method()==='POST'){
    const request=route.request().postDataJSON()
    expect(request.base_revision).toBe(file.revision)
    submissions.push(request)
    return ok(jobs(request.base_revision,'new-job-'+submissions.length))
   }
   return ok([jobs(1,'existing-job')])
  }
  return ok({items:[],total:0})
 })
 await page.goto('/papers/'+pid)
 const editor=page.locator('.cm-content')
 await expect(editor).toHaveText('Original manuscript',{timeout:30000})
 await expect(page.getByText('版本 1',{exact:false}).first()).toBeVisible()
 await page.clock.install()
 const auto=page.getByRole('checkbox',{name:'自动编译'})
 await auto.check()
 await expect(auto).toBeChecked()
 // Opting in does not rerun a revision that already has a compile job.
 await page.clock.fastForward(16000)
 expect(submissions).toHaveLength(0)
 const replace=async(text:string)=>{
  await editor.click()
  await page.keyboard.press('Control+a')
  await page.keyboard.insertText(text)
  await expect(editor).toHaveText(text)
 }
 await replace('First saved change')
 await expect.poll(()=>file.revision).toBe(2)
 await replace('Newest manuscript change')
 await expect.poll(()=>file.revision).toBe(3)
 expect(submissions).toHaveLength(0)
 await page.clock.fastForward(16000)
 await expect.poll(()=>submissions.length).toBe(1)
 expect(submissions[0]?.base_revision).toBe(3)
 expect(file.content).toBe('Newest manuscript change')
 await expect(page.getByRole('button',{name:'编译',exact:true})).toBeEnabled()
 await page.clock.fastForward(120000)
 expect(submissions).toHaveLength(1)
 await page.getByRole('button',{name:'编译',exact:true}).click()
 await expect.poll(()=>submissions.length).toBe(2)
 expect(submissions[1]?.base_revision).toBe(3)
 expect(submissions[1]?.idempotency_key).not.toBe(submissions[0]?.idempotency_key)
})
