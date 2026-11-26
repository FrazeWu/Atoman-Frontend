import {test,expect} from '@playwright/test'

test('owner reviews a multi-file Agent proposal, selectively commits, and continues the conversation',async({page,baseURL})=>{
 test.setTimeout(60000)
 const origin=new URL(baseURL!).origin
 expect(new URL(origin).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/)
 const pid='agent-fixture',prefix='/papers/projects/'+pid,now='2026-11-26T00:00:00Z'
 const key='synthetic-agent-browser-key'
 let head=5,aiCalls=0,writes=0,legacyWrites=0
 const main={id:'main',path:'main.tex',kind:'text',revision:1,content:'Before Original After',sha256:'',created_at:now,updated_at:now}
 const refs={...main,id:'refs',path:'refs.bib',content:'Approved references'}
 const other={...main,id:'private',path:'private.tex',content:'Unselected private text'}
 const files=[main,refs,other]
 const edits=[{file_id:main.id,path:main.path,base_revision:1,before:'Original',after:'Revised'},
  {file_id:refs.id,path:refs.path,base_revision:1,before:'references',after:'citations'}]
 const project=()=>({id:pid,name:'Agent fixture',main_file_id:'main',head_revision:head,access_role:'owner',created_at:now,updated_at:now})
 const metadata=()=>files.map(file=>({...file,content:''}))
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url())
  expect(url.href.includes(key)).toBe(false)
  const api=url.pathname.startsWith('/api/v1/')&&(url.origin===origin||url.origin==='https://api.atoman.org')
  if(!api)return url.origin===origin&&!url.pathname.startsWith('/api/')?route.continue():route.abort()
  const headers={'access-control-allow-origin':origin,'access-control-allow-credentials':'true','access-control-allow-methods':'GET, OPTIONS, POST, PUT, DELETE','access-control-allow-headers':'content-type, x-csrf-token, authorization'}
  if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers})
  const path=url.pathname.slice('/api/v1'.length)
  const ok=(data:unknown)=>route.fulfill({headers,json:{data}})
  if(path==='/auth/session')return route.fulfill({headers,json:{csrf_token:'fixture-csrf',user:{uuid:'agent-owner',username:'owner',email:'fixture@example.test',role:'user',onboarding_completed_at:now}}})
  if(path==='/site/access')return route.fulfill({headers,json:{}})
  if(path==='/papers/access')return ok({allowed:true})
  if(path===prefix)return ok(project())
  if(path===prefix+'/files')return ok(metadata())
  if(path===prefix+'/files/manage'){
   expect(route.request().method()).toBe('POST')
   const body=route.request().postDataJSON()
   expect(body).toEqual({action:'replace_text',base_revision:5,replacements:[{file_id:'main',base_revision:1,content:'Before Revised After'}]})
   writes++
   main.content=body.replacements[0].content;main.revision++;head++
   return ok({project:project(),files:metadata()})
  }
  if(path===prefix+'/files/main'||path===prefix+'/files/refs'){
   if(route.request().method()==='PUT'){legacyWrites++;throw Error('Unexpected ordinary save')}
   return ok({...files.find(f=>path.endsWith('/'+f.id)),project_head_revision:head})
  }
  if(path===prefix+'/files/private')throw Error('Unselected file fetched')
  if(path===prefix+'/ai/capability')return ok({enabled:true,base_urls:['https://api.openai.com/v1'],max_source_bytes:49152,max_context_bytes:98304,max_extra_files:4,project_edits:true,max_history_turns:6,max_history_bytes:16384})
  if(path===prefix+'/ai/suggestions'){
   aiCalls++
   const body=route.request().postDataJSON()
   expect(body.api_key).toBe(key)
   expect(body.consent).toBe(true)
   if(aiCalls===1){
    expect(body).toMatchObject({task:'project',source:'Before Original After',file_id:'main',base_revision:1,project_revision:5,context:[{file_id:'refs',revision:1}],instruction:'Revise both files'})
    expect(body.history).toBeUndefined()
    expect(JSON.stringify(body)).not.toContain(other.content)
    return ok({text:'Proposed manuscript and references revisions',model:'fixture-model',project_revision:5,edits})
   }
   expect(body).toMatchObject({task:'explain',source:'Before Revised After',file_id:'main',base_revision:2,instruction:'Explain the previous proposal',context:[]})
   expect(body.history).toEqual([{task:'project',instruction:'Revise both files',reply:JSON.stringify({summary:'Proposed manuscript and references revisions',edits})}])
   expect(body.project_revision).toBeUndefined()
   return ok({text:'The reference proposal was not applied.',model:'fixture-model'})
  }
  if(path===prefix+'/files/main/collaboration')return ok({enabled:false})
  if(path===prefix+'/compile-capability')return ok({enabled:false,pdf_available:false})
  return ok({items:[],total:0})
 })
 await page.goto('/papers/'+pid)
 const editor=page.locator('.cm-content')
 await expect(editor).toContainText(main.content)
 await page.getByRole('button',{name:'AI 助手',exact:true}).click()
 await expect(page.getByLabel('AI API Key')).toBeVisible()
 await page.getByLabel('AI API Key').fill(key)
 await page.getByLabel('AI 模型').fill('fixture-model')
 await page.getByRole('button',{name:'使用整个文件',exact:true}).click()
 await page.getByLabel('AI 任务类型').selectOption('project')
 await page.locator('.paper-ai__context').filter({hasText:'附加项目文件'}).locator('summary').first().click()
 await page.locator('.paper-ai__context label').filter({hasText:'refs.bib'}).locator('input').check()
 await expect(page.getByText('refs.bib · v1')).toBeVisible()
 await page.getByLabel('AI 修改指令').fill('Revise both files')
 await page.locator('.paper-ai__consent input').check()
 await page.getByRole('button',{name:'生成建议',exact:true}).click()
 await expect(page.getByText('Agent 跨文件修改计划')).toBeVisible()
 expect(aiCalls).toBe(1);expect(writes).toBe(0)
 await expect(page.getByRole('button',{name:'应用已选修改（0）',exact:true})).toBeDisabled()
 await expect(editor).toHaveText('Before Original After')
 await page.locator('.paper-ai__result label').filter({hasText:'main.tex'}).locator('input').check()
 await page.getByRole('button',{name:'应用已选修改（1）',exact:true}).click()
 const dialog=page.getByRole('alertdialog')
 await expect(dialog).toContainText('原子提交 1 个')
 await dialog.getByRole('button',{name:'取消',exact:true}).click()
 expect(writes).toBe(0)
 await page.getByRole('button',{name:'应用已选修改（1）',exact:true}).click()
 await dialog.getByRole('button',{name:'确认',exact:true}).click()
 await expect(editor).toHaveText('Before Revised After')
 await expect(page.getByText('已原子提交所选文件修改，原版本保留在文件历史中。')).toBeVisible()
 expect(writes).toBe(1);expect(legacyWrites).toBe(0)
 expect(refs.content).toBe('Approved references')
 expect(other.content).toBe('Unselected private text')
 await page.getByRole('button',{name:'使用整个文件',exact:true}).click()
 await page.getByLabel('AI 任务类型').selectOption('explain')
 await page.getByLabel('AI 修改指令').fill('Explain the previous proposal')
 await page.locator('.paper-ai__consent input').check()
 await page.getByRole('button',{name:'生成建议',exact:true}).click()
 await expect(page.getByText('The reference proposal was not applied.',{exact:true}).last()).toBeVisible()
 expect(aiCalls).toBe(2);expect(writes).toBe(1)
 expect(await page.evaluate(secret=>JSON.stringify({...localStorage,...sessionStorage}).includes(secret),key)).toBe(false)
 await page.getByRole('button',{name:'返回 PDF',exact:true}).click()
 await page.getByRole('button',{name:'AI 助手',exact:true}).click()
 await expect(page.getByLabel('AI API Key')).toHaveValue('')
 await expect(page.getByText('本轮对话（2 轮）')).toHaveCount(0)
})
