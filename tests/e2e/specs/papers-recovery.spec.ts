import {test,expect} from '@playwright/test'
if(process.env.CHROME_BIN)test.use({launchOptions:{executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']}})

test('restores a local unsaved manuscript after reload and restores a project checkpoint',async({page,baseURL})=>{
 test.setTimeout(120000)
 const origin=new URL(baseURL!).origin
 expect(new URL(origin).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/)
 const time='2026-11-25T00:00:00Z',prefix='/papers/projects/recovery-project'
 const project={id:'recovery-project',name:'Recovery fixture',head_revision:1,main_file_id:'main',created_at:time,updated_at:time}
 const file={id:'main',path:'main.tex',kind:'text',content:'Original saved source',revision:1,sha256:'',created_at:time,updated_at:time}
 const initial={id:'original',name:'Original checkpoint',source_revision:1,main_file_id:'main',file_count:1,source_bytes:file.content.length,automatic:false,created_at:time}
 const checkpoints=[initial]
 let failSave=true,createCalls=0,restoreCalls=0
 page.on('dialog',dialog=>void dialog.accept())
 await page.routeWebSocket('**/*',socket=>socket.close())
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url())
  const fixtureAPI=url.pathname.startsWith('/api/v1/')&&(url.origin===origin||url.origin==='https://api.atoman.org')
  if(!fixtureAPI)return url.origin===origin&&!url.pathname.startsWith('/api/')&&!url.pathname.startsWith('/uploads/')&&!url.pathname.startsWith('/__object-storage/')?route.continue():route.abort()
  const cors={'access-control-allow-origin':origin,'access-control-allow-credentials':'true','access-control-allow-methods':'GET, OPTIONS, POST, PUT, DELETE','access-control-allow-headers':'content-type, x-csrf-token, authorization'}
  const method=route.request().method()
  if(method==='OPTIONS')return route.fulfill({status:204,headers:cors})
  const path=url.pathname.slice('/api/v1'.length)
  const ok=(data:unknown)=>route.fulfill({headers:cors,json:{data}})
  if(path==='/auth/session')return route.fulfill({headers:cors,json:{csrf_token:'fixture-csrf',user:{uuid:'fixture-user',username:'fixture',email:'fixture@example.test',role:'user',onboarding_completed_at:time}}})
  if(path==='/site/access')return route.fulfill({headers:cors,json:{}})
  if(path==='/papers/access')return ok({allowed:true})
  if(path===prefix)return ok(project)
  if(path===prefix+'/files')return ok([{...file,content:''}])
  if(path===prefix+'/files/main'){
   if(method==='PUT'){
    if(failSave)return route.fulfill({status:503,headers:cors,json:{code:'fixture.unavailable',message:'Fixture save unavailable'}})
    const input=route.request().postDataJSON()
    expect(input.base_revision).toBe(file.revision)
    file.content=input.content;file.revision++;project.head_revision++
    return ok({...file,project_head_revision:project.head_revision})
   }
   return ok(file)
  }
  if(path===prefix+'/compile-capability')return ok({enabled:false,pdf_available:false})
  if(path===prefix+'/compiles')return ok([])
  if(path===prefix+'/snapshots'){
   if(method==='POST'){
    const input=route.request().postDataJSON()
    expect(input.base_revision).toBe(project.head_revision)
    createCalls++
    const created={...initial,id:'manual',name:input.name,source_revision:project.head_revision,source_bytes:file.content.length}
    checkpoints.unshift(created)
    return ok(created)
   }
   return ok(checkpoints)
  }
  if(path===prefix+'/snapshots/original')return ok({...initial,files:[{file_id:'main',path:'main.tex',kind:'text',revision:1,sha256:''}]})
  if(path===prefix+'/snapshots/original/restore'){
   const input=route.request().postDataJSON()
   expect(input.base_revision).toBe(project.head_revision)
   restoreCalls++
   const backup={...initial,id:'backup',name:'Before restore',source_revision:project.head_revision,automatic:true}
   checkpoints.unshift(backup)
   file.content='Original saved source';file.revision++;project.head_revision++
   return ok({project,files:[{...file,content:''}],backup})
  }
  return ok({items:[],total:0})
 })
 await page.goto('/papers/recovery-project')
 await expect(page.locator('.cm-content')).toContainText('Original saved source',{timeout:30000})
 await page.getByRole('button',{name:'草稿恢复',exact:true}).click()
 await page.getByLabel('启用本机草稿保护').check()
 await page.getByRole('button',{name:'关闭',exact:true}).click()
 const editor=page.locator('.cm-content')
 await editor.click()
 await page.keyboard.press('ControlOrMeta+a')
 await page.keyboard.insertText('Unsaved local recovery text')
 await expect(editor).toContainText('Unsaved local recovery text')
 await expect.poll(()=>page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('atoman.papers.local-draft.v1:fixture-user:recovery-project:')).length)).toBe(1)
 await expect(page.getByRole('button',{name:/草稿恢复 \(1\)/})).toBeVisible()
 await page.reload()
 await expect(editor).toContainText('Original saved source',{timeout:30000})
 await page.getByRole('button',{name:/草稿恢复 \(1\)/}).click()
 await expect(page.getByLabel('本机草稿源码')).toHaveValue('Unsaved local recovery text')
 failSave=false
 await page.getByRole('button',{name:'恢复到编辑器',exact:true}).click()
  await page.getByRole('alertdialog').getByRole('button',{name:'确认',exact:true}).click()
 await expect(editor).toContainText('Unsaved local recovery text')
 await page.getByRole('button',{name:'保存',exact:true}).click()
 await expect.poll(()=>file.content).toBe('Unsaved local recovery text')
 await expect.poll(()=>page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('atoman.papers.local-draft.v1:fixture-user:recovery-project:')).length)).toBe(0)
 await page.getByRole('button',{name:'项目快照',exact:true}).click()
 await page.getByLabel('快照名称').fill('After recovery')
 await page.getByRole('button',{name:'创建快照',exact:true}).click()
 await expect(page.getByText('项目快照已创建。')).toBeVisible()
 expect(createCalls).toBe(1)
 await page.getByRole('button',{name:/Original checkpoint/}).click()
 await page.getByRole('button',{name:'恢复整个项目',exact:true}).click()
  await page.getByRole('alertdialog').getByRole('button',{name:'确认',exact:true}).click()
 await expect(editor).toContainText('Original saved source')
 await expect(page.getByText('项目已恢复，回滚前状态已自动保存为快照。')).toBeVisible()
 expect(restoreCalls).toBe(1)
})
