import {test,expect} from '@playwright/test'
test('AI audit attests reviewed plans, persists timeline after reopen, and rolls back only confirmed versions',async({page,baseURL})=>{
 test.setTimeout(60000)
 const origin=new URL(baseURL!).origin
 expect(new URL(origin).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/)
 const pid='ai-audit-fixture',prefix='/papers/projects/'+pid,now='2026-11-26T00:00:00Z'
 const proposal='11111111-1111-4111-8111-111111111111',applied='22222222-2222-4222-8222-222222222222',rolled='33333333-3333-4333-8333-333333333333'
 const key='synthetic-audit-browser-key',original='Before Original After',changed='Before Revised After'
 const originalSHA='a'.repeat(64),changedSHA='b'.repeat(64)
 const agent={id:'papers-agent',display_name:'Papers Agent',kind:'ai',permission:'propose_only'}
 let diffReads=0
 let head=5,revision=1,source=original,writes=0,aiCalls=0,historyReads=0
 const project=()=>({id:pid,name:'AI audit fixture',main_file_id:'main',head_revision:head,access_role:'owner',created_at:now,updated_at:now})
 const main=()=>({id:'main',path:'main.tex',kind:'text',revision,content:source,sha256:source===original?originalSHA:changedSHA,created_at:now,updated_at:now})
 const extra={...main(),id:'extra',path:'extra.tex',content:'Unrelated text'}
 const metadata=()=>[{...main(),content:''},{...extra,content:''}]
 const record=(id:string,action:string,project_revision:number,before:number,after:number,related_id:string)=>({id,action,project_revision,created_at:now,attempt_id:'attempt-fixture',related_id,task:'project',files:[{file_id:'main',before_revision:before,after_revision:after}]})
 const events:ReturnType<typeof record>[]=[]
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url())
  expect(url.href).not.toContain(key)
  const api=url.pathname.startsWith('/api/v1/')&&(url.origin===origin||url.origin==='https://api.atoman.org')
  if(!api)return url.origin===origin&&!url.pathname.startsWith('/api/')?route.continue():route.abort()
  const headers={'access-control-allow-origin':origin,'access-control-allow-credentials':'true','access-control-allow-methods':'GET, OPTIONS, POST, PUT, DELETE','access-control-allow-headers':'content-type, x-csrf-token, authorization'}
  if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers})
  const path=url.pathname.slice('/api/v1'.length)
  const ok=(data:unknown)=>route.fulfill({headers,json:{data}})
  if(path==='/auth/session')return route.fulfill({headers,json:{csrf_token:'fixture-csrf',user:{uuid:'audit-owner',username:'owner',email:'fixture@example.test',role:'user',onboarding_completed_at:now}}})
  if(path==='/site/access')return route.fulfill({headers,json:{}})
  if(path==='/papers/access')return ok({allowed:true})
  if(path===prefix)return ok(project())
  if(path===prefix+'/files')return ok(metadata())
  if(path===prefix+'/files/main'){
   expect(route.request().method()).toBe('GET')
   return ok({...main(),project_head_revision:head})
  }
  if(path===prefix+'/files/main/versions/1'){
   historyReads++
   return ok({file_id:'main',revision:1,path:'main.tex',content:original,sha256:originalSHA,created_at:now})
  }
  if(path===prefix+'/ai/capability')return ok({enabled:true,base_urls:['https://api.openai.com/v1'],max_source_bytes:49152,max_context_bytes:98304,max_extra_files:4,project_edits:true,activity:true,agent,historical_changes:true,max_history_turns:6,max_history_bytes:16384})
  if(path===prefix+'/ai/activity')return ok(events)
  if(path===prefix+'/ai/activity/'+applied+'/changes/main'){
   diffReads++
   return ok({event_id:applied,file_id:'main',action:'papers.ai.applied',contributor:agent,decision:'owner_approved',path:'main.tex',before_revision:1,after_revision:2,before:original,after:changed})
  }
  if(path===prefix+'/ai/suggestions'){
   aiCalls++
   expect(route.request().postDataJSON()).toMatchObject({task:'project',api_key:key,project_revision:5,base_revision:1,source:original,consent:true})
   events.unshift(record(proposal,'papers.ai.proposed',5,1,2,''))
   return ok({text:'Revise the selected file',model:'fixture-model',proposal_id:proposal,project_revision:5,edits:[{file_id:'main',path:'main.tex',base_revision:1,before:'Original',after:'Revised'}]})
  }
  if(path===prefix+'/files/manage'){
   const body=route.request().postDataJSON()
   writes++
   if(writes===1){
    expect(body).toEqual({action:'ai_apply',ai_event_id:proposal,base_revision:5,replacements:[{file_id:'main',base_revision:1,content:changed}]})
    source=changed;head++;revision++
    events.unshift(record(applied,'papers.ai.applied',head,1,2,proposal))
    return ok({project:project(),files:metadata(),ai_event_id:applied})
   }
   expect(writes).toBe(2)
   expect(body).toEqual({action:'ai_rollback',ai_event_id:applied,base_revision:6})
   source=original;head++;revision++
   events.unshift(record(rolled,'papers.ai.rolled_back',head,2,3,applied))
   return ok({project:project(),files:metadata(),ai_event_id:rolled})
  }
  if(path===prefix+'/files/main/collaboration')return ok({enabled:false})
  if(path===prefix+'/compile-capability')return ok({enabled:false,pdf_available:false})
  return ok({items:[],total:0})
 })
 await page.goto('/papers/'+pid)
 const editor=page.locator('.cm-content')
 await expect(editor).toHaveText(original)
 await page.getByRole('button',{name:'AI 助手',exact:true}).click()
 await expect(page.locator('.paper-ai__workbench')).toContainText('Papers Agent')
 await expect(page.locator('.paper-ai__workbench')).toContainText('拥有者审批')
 await page.getByRole('button',{name:'展开工作区',exact:true}).click()
 await expect(editor).not.toBeVisible()
 await page.getByRole('button',{name:'恢复分栏',exact:true}).click()
 await expect(editor).toBeVisible()
 await page.getByLabel('AI API Key').fill(key)
 await page.getByLabel('AI 模型').fill('fixture-model')
 await page.getByRole('button',{name:'使用整个文件',exact:true}).click()
 await page.getByLabel('AI 任务类型').selectOption('project')
 await page.getByLabel('AI 修改指令').fill('Revise this file')
 await page.locator('.paper-ai__consent input').check()
 await page.getByRole('button',{name:'生成建议',exact:true}).click()
 await expect(page.getByText('Agent 跨文件修改计划')).toBeVisible()
 await expect(page.locator('.paper-ai__result del')).toHaveText('Original')
 await expect(page.locator('.paper-ai__result ins')).toHaveText('Revised')
 await expect(page.locator('.paper-ai__workbench')).toContainText('等待审批 · 0 / 1 个文件已勾选')

 const panel=page.locator('.paper-ai-activity')
 await panel.locator('summary').click()
 await expect(panel).toContainText('建议已生成')
 expect(writes).toBe(0)
 await page.locator('.paper-ai__result input[type=checkbox]').check()
 await page.getByRole('button',{name:'应用已选修改（1）',exact:true}).click()
 await page.getByRole('alertdialog').getByRole('button',{name:'确认',exact:true}).click()
 await expect(editor).toHaveText(changed)
 await expect(panel).toContainText('修改已提交')
 expect(writes).toBe(1)
 await page.getByRole('button',{name:'返回 PDF',exact:true}).click()
 await page.getByRole('button',{name:'AI 助手',exact:true}).click()
 await expect(page.getByLabel('AI API Key')).toHaveValue('')
 await panel.locator('summary').click()
 await expect(panel).toContainText('修改已提交')
 expect(diffReads).toBe(0)
 await panel.getByRole('button',{name:'查看修改差异',exact:true}).click()
 const historical=panel.getByRole('region',{name:'已提交的 AI 历史差异'})
 await expect(historical).toContainText('拥有者批准并提交')
 await expect(historical.locator('del')).toHaveText('Original')
 await expect(historical.locator('ins')).toHaveText('Revised')
 expect(diffReads).toBe(1)
 await historical.getByRole('button',{name:'关闭差异',exact:true}).click()
 await expect(historical).toHaveCount(0)
 const undo=panel.getByRole('button',{name:'回滚此修改',exact:true})
 await expect(undo).toBeEnabled()
 await undo.click()
 const dialog=page.getByRole('alertdialog')
 await expect(dialog).toContainText('仅在这些文件之后没有修改时')
 await dialog.getByRole('button',{name:'取消',exact:true}).click()
 await expect(undo).toBeEnabled()
 expect(writes).toBe(1);expect(historyReads).toBe(0)
 await undo.click()
 await dialog.getByRole('button',{name:'确认',exact:true}).click()
 await expect(editor).toHaveText(original)
 await expect(panel).toContainText('回滚已提交')
 await expect(panel).toContainText('已回滚 · 跨文件 Agent')
 await expect(undo).toBeDisabled()
 expect(writes).toBe(2);expect(historyReads).toBe(1);expect(aiCalls).toBe(1)
 expect(extra.content).toBe('Unrelated text')
})
