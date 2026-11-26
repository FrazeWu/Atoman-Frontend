import {test,expect} from '@playwright/test'

test('owner reviews AI proposal, applies only selected source, and retains normal editor undo',async({page,baseURL})=>{
 test.setTimeout(60000)
 const origin=new URL(baseURL!).origin
 expect(new URL(origin).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/)
 const pid='ai-fixture',prefix='/papers/projects/'+pid,now='2026-11-26T00:00:00Z'
 const key='synthetic-ai-key-browser-test'
 const file={id:'main',path:'main.tex',kind:'text',revision:1,content:'Before Original After',sha256:'',created_at:now,updated_at:now}
 const extra={...file,id:'refs',path:'refs.bib',content:'Approved fixture context'}
 let revision=1,source=file.content,aiCalls=0,saves=0,head=1
 const urls:string[]=[]
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url())
  urls.push(url.href)
  const api=url.pathname.startsWith('/api/v1/')&&(url.origin===origin||url.origin==='https://api.atoman.org')
  if(!api)return url.origin===origin&&!url.pathname.startsWith('/api/')?route.continue():route.abort()
  const headers={'access-control-allow-origin':origin,'access-control-allow-credentials':'true','access-control-allow-methods':'GET, OPTIONS, POST, PUT, DELETE','access-control-allow-headers':'content-type, x-csrf-token, authorization'}
  if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers})
  const path=url.pathname.slice('/api/v1'.length)
  const ok=(data:unknown)=>route.fulfill({headers,json:{data}})
  if(path==='/auth/session')return route.fulfill({headers,json:{csrf_token:'fixture-csrf',user:{uuid:'owner-fixture',username:'owner',email:'fixture@example.test',role:'user',onboarding_completed_at:now}}})
  if(path==='/site/access')return route.fulfill({headers,json:{}})
  if(path==='/papers/access')return ok({allowed:true})
  if(path===prefix)return ok({id:pid,name:'AI manuscript fixture',main_file_id:'main',head_revision:head,access_role:'owner',created_at:now,updated_at:now})
  if(path===prefix+'/files')return ok([{...file,content:'',revision},extra])
  if(path===prefix+'/files/main'){
   if(route.request().method()==='PUT'){
    const body=route.request().postDataJSON()
    expect(body.base_revision).toBe(revision)
    saves++;source=body.content;revision++;head++
   }
   return ok({...file,content:source,revision,project_head_revision:head})
  }
  if(path===prefix+'/files/refs')return ok(extra)
  if(path===prefix+'/ai/capability')return ok({enabled:true,base_urls:['https://api.openai.com/v1'],max_source_bytes:49152,max_context_bytes:98304,max_extra_files:4})
  if(path===prefix+'/ai/suggestions'){
   aiCalls++
   const body=route.request().postDataJSON()
   expect(body).toMatchObject({api_key:key,source:'After',file_id:'main',base_revision:1,task:'revise',consent:true,context:[{file_id:'refs',revision:1}]})
   expect(body.source).not.toContain('Before')
   return ok({text:'Revised',model:'test-model',input_tokens:20,output_tokens:5})
  }
  if(path===prefix+'/files/main/collaboration')return ok({enabled:false})
  if(path===prefix+'/compile-capability')return ok({enabled:false,pdf_available:false})
  return ok({items:[],total:0})
 })
 await page.goto('/papers/'+pid)
 const editor=page.locator('.cm-content')
 await expect(editor).toContainText(file.content)
 await editor.click()
 await page.keyboard.press('ControlOrMeta+a')
 await page.keyboard.press('ArrowRight')
 for(let i=0;i<5;i++)await page.keyboard.press('Shift+ArrowLeft')
 await page.getByRole('button',{name:'AI 助手',exact:true}).click()
 await expect(page.getByLabel('AI API Key')).toBeVisible()
 await page.getByRole('button',{name:'使用编辑器选区'}).click()
 await expect(page.getByText('main.tex · 选中文本')).toBeVisible()
 await page.getByLabel('AI API Key').fill(key)
 await page.getByLabel('AI 模型').fill('test-model')
 await page.getByRole('button',{name:'学术润色',exact:true}).click()
 await page.locator('.paper-ai__context').filter({hasText:'附加项目文件'}).locator('summary').first().click()
 await page.locator('.paper-ai__context input[type=checkbox]').check()
 await expect(page.getByText('refs.bib · v1')).toBeVisible()
 await page.getByText('refs.bib · v1').click()
 await expect(page.getByText('Approved fixture context',{exact:true})).toBeVisible()
 const generate=page.getByRole('button',{name:'生成建议',exact:true})
 await expect(generate).toBeDisabled()
 expect(aiCalls).toBe(0)
 await page.locator('.paper-ai__consent input').check()
 await generate.click()
 await expect(page.getByText('建议替换为')).toBeVisible()
 await expect(editor).toContainText(file.content)
 expect(aiCalls).toBe(1);expect(saves).toBe(0)
 await page.getByRole('button',{name:'接受修改',exact:true}).click()
 await expect(editor).toContainText('Before Original Revised')
 // The result is a normal CodeMirror edit, not a replacement of the entire
 // editor state. Existing undo and optimistic saves stay active.
 await page.keyboard.press('ControlOrMeta+z')
 await expect(editor).toContainText(file.content)
 expect(urls.every(url=>!url.includes(key))).toBe(true)
 expect(await page.evaluate(secret=>JSON.stringify({...localStorage,...sessionStorage}).includes(secret),key)).toBe(false)
})
