import {test,expect} from '@playwright/test'
test('repair Agent compiles exact saved versions, reviews changes, and recompiles to a verified PDF',async({page,baseURL})=>{
 test.setTimeout(60000)
 const origin=new URL(baseURL!).origin
 expect(new URL(origin).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/)
 const pid='repair-fixture',prefix='/papers/projects/'+pid,now='2026-11-26T00:00:00Z'
 const secret='synthetic-repair-browser-key'
 let head=5,revision=1,source='Before BadCommand After',compileCalls=0,aiCalls=0,writes=0,legacyWrites=0
 const project=()=>({id:pid,name:'Repair fixture',main_file_id:'main',head_revision:head,access_role:'owner',created_at:now,updated_at:now})
 const main=()=>({id:'main',path:'main.tex',kind:'text',revision,content:source,sha256:'',created_at:now,updated_at:now})
 const metadata=()=>[{...main(),content:''}]
 const job=(n:number,status:string)=>({id:'job-'+n,project_id:pid,source_revision:n===1?5:6,compiler:'pdflatex',status,attempts:1,max_attempts:2,cancel_requested:false,created_at:now,...(status==='failed'?{failure_code:'compile_failed',diagnostics:[{tool:'latex',file:'main.tex',line:1,message:'Undefined control sequence BadCommand'}]}:status==='succeeded'?{pdf_available:true}:{})})
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url())
  expect(url.href.includes(secret)).toBe(false)
  const api=url.pathname.startsWith('/api/v1/')&&(url.origin===origin||url.origin==='https://api.atoman.org')
  if(!api)return url.origin===origin&&!url.pathname.startsWith('/api/')?route.continue():route.abort()
  const headers={'access-control-allow-origin':origin,'access-control-allow-credentials':'true','access-control-allow-methods':'GET, OPTIONS, POST, PUT, DELETE','access-control-allow-headers':'content-type, x-csrf-token, authorization'}
  if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers})
  const path=url.pathname.slice('/api/v1'.length)
  const ok=(data:unknown)=>route.fulfill({headers,json:{data}})
  if(path==='/auth/session')return route.fulfill({headers,json:{csrf_token:'fixture-csrf',user:{uuid:'repair-owner',username:'owner',email:'fixture@example.test',role:'user',onboarding_completed_at:now}}})
  if(path==='/site/access')return route.fulfill({headers,json:{}})
  if(path==='/papers/access')return ok({allowed:true})
  if(path===prefix)return ok(project())
  if(path===prefix+'/files')return ok(metadata())
  if(path===prefix+'/files/main'){
   if(route.request().method()==='PUT'){legacyWrites++;throw Error('Unexpected ordinary save')}
   return ok({...main(),project_head_revision:head})
  }
  if(path===prefix+'/files/manage'){
   const body=route.request().postDataJSON()
   expect(body).toEqual({action:'replace_text',base_revision:5,replacements:[{file_id:'main',base_revision:1,content:'Before FixedCommand After'}]})
   expect(compileCalls).toBe(1);writes++;head++;revision++;source=body.replacements[0].content
   return ok({project:project(),files:metadata()})
  }
  if(path===prefix+'/ai/capability')return ok({enabled:true,base_urls:['https://api.openai.com/v1'],max_source_bytes:49152,max_context_bytes:98304,max_extra_files:4,project_edits:true,max_history_turns:6,max_history_bytes:16384})
  if(path===prefix+'/ai/suggestions'){
   aiCalls++
   const body=route.request().postDataJSON()
   expect(body).toMatchObject({task:'project',api_key:secret,source:'Before BadCommand After',file_id:'main',base_revision:1,project_revision:5,context:[],consent:true})
   expect(body.instruction).toContain('Undefined control sequence BadCommand')
   expect(body.instruction).toContain('main.tex')
   return ok({text:'Replace the undefined command.',model:'fixture-model',project_revision:5,edits:[{file_id:'main',path:'main.tex',base_revision:1,before:'BadCommand',after:'FixedCommand'}]})
  }
  if(path===prefix+'/files/main/collaboration')return ok({enabled:false})
  if(path===prefix+'/compile-capability')return ok({enabled:true,pdf_available:true,compilers:['pdflatex','xelatex','lualatex']})
  if(path===prefix+'/compiles'){
   if(route.request().method()==='GET')return ok([])
   const body=route.request().postDataJSON()
   compileCalls++
   expect(compileCalls).toBeLessThanOrEqual(2)
   expect(body.base_revision??body.source_revision).toBe(compileCalls===1?5:6)
   expect(body.compiler||'pdflatex').toBe('pdflatex')
   expect(writes).toBe(compileCalls-1)
   return ok(job(compileCalls,'queued'))
  }
  if(path===prefix+'/compiles/job-1')return ok(job(1,'failed'))
  if(path===prefix+'/compiles/job-2')return ok(job(2,'succeeded'))
  if(path.includes('/compiles/job-2/'))return route.fulfill({status:404,headers,json:{}})
  return ok({items:[],total:0})
 })
 await page.goto('/papers/'+pid)
 const editor=page.locator('.cm-content')
 await expect(editor).toHaveText(source)
 await page.getByRole('button',{name:'AI 助手',exact:true}).click()
 await expect(page.getByLabel('AI API Key')).toBeVisible()
 await page.getByLabel('AI API Key').fill(secret)
 await page.getByLabel('AI 模型').fill('fixture-model')
 await page.getByRole('button',{name:'开始编译修复',exact:true}).click()
 const repair=page.getByRole('region',{name:'Agent 编译修复'})
 await expect(repair).toContainText('已定位本轮源码错误',{timeout:15000})
 await expect(repair).toContainText('main.tex')
 expect(compileCalls).toBe(1);expect(aiCalls).toBe(0);expect(writes).toBe(0)
 const generate=page.getByRole('button',{name:'生成建议',exact:true})
 await expect(generate).toBeDisabled()
 await page.locator('.paper-ai__consent input').check()
 await generate.click()
 await expect(page.getByText('Agent 跨文件修改计划')).toBeVisible()
 expect(aiCalls).toBe(1);expect(writes).toBe(0)
 await expect(editor).toHaveText('Before BadCommand After')
 await page.locator('.paper-ai__result input[type=checkbox]').check()
 await page.getByRole('button',{name:'应用已选修改（1）',exact:true}).click()
 await page.getByRole('alertdialog').getByRole('button',{name:'确认',exact:true}).click()
 await expect(editor).toHaveText('Before FixedCommand After')
 await expect(repair).toContainText('编译通过，已生成 PDF。',{timeout:15000})
 await expect(repair).toContainText('已应用 1 / 3 轮')
 expect(compileCalls).toBe(2);expect(writes).toBe(1);expect(legacyWrites).toBe(0);expect(aiCalls).toBe(1)
})
