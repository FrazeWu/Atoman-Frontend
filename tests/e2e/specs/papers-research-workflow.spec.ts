import {test,expect} from '@playwright/test'
test('research workflow restores encrypted sessions, recommends context and checks submission without modifying files',async({page,baseURL})=>{
 test.setTimeout(60000)
 const origin=new URL(baseURL!).origin
 expect(new URL(origin).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/)
 const pid='research-fixture',prefix='/papers/projects/'+pid,now='2026-11-26T00:00:00Z'
 const source=String.raw`\author{Synthetic Author}
\input{sections/results}
\cite{missing}
TODO`
 const project={id:pid,name:'Research fixture',main_file_id:'main',head_revision:5,access_role:'owner',created_at:now,updated_at:now}
 const make=(id:string,path:string,content:string)=>({id,path,content,kind:'text',revision:1,sha256:'',created_at:now,updated_at:now})
 const files=[make('main','main.tex',source),make('results','sections/results.tex','Synthetic accuracy results.'),make('refs','refs.bib','@article{known,title={Example}}')]
 const dummy='synthetic-research-test-only',passphrase='synthetic-passphrase-only'
 let suggestions=0
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url())
  const api=url.pathname.startsWith('/api/v1/')&&(url.origin===origin||url.origin==='https://api.atoman.org')
  if(!api)return url.origin===origin&&!url.pathname.startsWith('/api/')?route.continue():route.abort()
  const headers={'access-control-allow-origin':origin,'access-control-allow-credentials':'true','access-control-allow-methods':'GET, OPTIONS, POST, PUT, DELETE','access-control-allow-headers':'content-type, x-csrf-token, authorization'}
  if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers})
  const path=url.pathname.slice('/api/v1'.length)
  const ok=(data:unknown)=>route.fulfill({headers,json:{data}})
  if(path==='/auth/session')return route.fulfill({headers,json:{csrf_token:'fixture-csrf',user:{uuid:'research-owner',username:'owner',email:'fixture@example.test',role:'user',onboarding_completed_at:now}}})
  if(path==='/site/access')return route.fulfill({headers,json:{}})
  if(path==='/papers/access')return ok({allowed:true})
  if(path===prefix)return ok(project)
  if(path===prefix+'/files')return ok(files.map(f=>({...f,content:''})))
  const f=files.find(f=>path===prefix+'/files/'+f.id)
  if(f){expect(route.request().method()).toBe('GET');return ok({...f,project_head_revision:5})}
  if(path===prefix+'/ai/capability')return ok({enabled:true,base_urls:['https://api.openai.com/v1'],custom_base_urls:true,max_source_bytes:49152,max_context_bytes:98304,max_extra_files:4,project_edits:true,max_history_turns:6,max_history_bytes:16384})
  if(path===prefix+'/ai/suggestions'){
   suggestions++
   expect(route.request().postDataJSON()).toMatchObject({api_key:dummy,task:'explain',source,consent:true})
   expect(route.request().postDataJSON().context).toContainEqual({file_id:'results',revision:1})
   return ok({text:'Synthetic research analysis',model:'test-model'})
  }
  if(path===prefix+'/files/main/collaboration')return ok({enabled:false})
  if(path===prefix+'/compile-capability')return ok({enabled:false,pdf_available:false})
  return ok({items:[],total:0})
 })
 await page.goto('/papers/'+pid)
 await expect(page.locator('.cm-content')).toContainText('Synthetic Author')
 const ai=page.getByRole('button',{name:'AI 助手',exact:true})
 await ai.click()
 await page.getByLabel('AI API Key',{exact:true}).fill(dummy)
 await page.getByLabel('AI 模型',{exact:true}).fill('test-model')
 await page.getByRole('button',{name:'AI 任务类型',exact:true}).click()
 await page.getByRole('option',{name:'解释、分析或排查',exact:true}).click()
 await page.getByRole('button',{name:'使用整个文件',exact:true}).click()
 await page.getByLabel('AI 修改指令').fill('Explain the accuracy results')
 const vault=page.locator('.paper-ai-vault')
 await vault.locator('summary').click()
 await vault.getByLabel('保险库口令').fill(passphrase)
 await vault.getByRole('button',{name:'创建加密保险库'}).click()
 await expect(vault).toContainText('保险库已解锁')
 await vault.getByLabel('新配置名称').fill('Synthetic profile')
 await vault.getByRole('button',{name:'保存当前 API 配置'}).click()
 await expect(vault).toContainText('API 配置已加密保存')
 await page.getByText('附加项目文件（0/4）',{exact:true}).click()
 await page.getByRole('button',{name:'全项目检索并选择相关文件'}).click()
 await expect(page.getByText(/已检索 3 个文本文件/)).toBeVisible()
 expect(suggestions).toBe(0)
 await page.locator('.paper-ai__consent input').check()
 await page.getByRole('button',{name:'生成建议',exact:true}).click()
 await expect(page.locator('.paper-ai__result')).toContainText('Synthetic research analysis')
 await vault.getByRole('button',{name:'保存当前会话'}).click()
 await expect(vault).toContainText('本项目会话已加密保存')
 expect(await page.evaluate(({key,pass})=>{const raw=Object.entries(localStorage).find(([k])=>k.startsWith('atoman.papers.ai-vault.v1:'))?.[1]||'';return !!raw&&!raw.includes(key)&&!raw.includes(pass)&&!raw.includes('Synthetic research analysis')},{key:dummy,pass:passphrase})).toBe(true)
 await ai.click()
 await ai.click()
 await expect(page.getByLabel('AI API Key',{exact:true})).toHaveValue('')
 await vault.locator('summary').click()
 await vault.getByLabel('保险库口令').fill(passphrase)
 await vault.getByRole('button',{name:'解锁保险库'}).click()
 await vault.getByRole('button',{name:'恢复项目会话'}).click()
 await expect(page.getByLabel('AI 修改指令')).toHaveValue('Explain the accuracy results')
 await expect(page.getByLabel('AI API Key',{exact:true})).toHaveValue(dummy)
 await expect(page.getByRole('button',{name:'生成建议',exact:true})).toBeDisabled()
 expect(suggestions).toBe(1)
 await page.getByRole('button',{name:'投稿检查',exact:true}).click()
 await page.getByRole('button',{name:'检查当前保存版本'}).click()
 await expect(page.getByLabel('投稿前检查')).toContainText('未在项目 .bib 中找到引用键：missing')
 await expect(page.getByLabel('投稿前检查')).toContainText('存在作者、单位、致谢或邮箱字段')
 await expect(page.getByLabel('投稿前检查')).toContainText('无法确认页数')
 expect(suggestions).toBe(1)
})
