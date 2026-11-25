import {test,expect} from '@playwright/test'

if(process.env.CHROME_BIN)test.use({launchOptions:{executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']}})

test('shares an existing manuscript between isolated authenticated browser contexts',async({browser,baseURL})=>{
 test.setTimeout(120000)
 const origin=new URL(baseURL!).origin
 expect(new URL(origin).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/)
 const owner='550e8400-e29b-41d4-a716-446655440001'
 const collaborator='550e8400-e29b-41d4-a716-446655440002'
 const time='2026-11-25T00:00:00Z',prefix='/papers/projects/shared-project'
 let role:'editor'|'viewer'|null=null,saveCalls=0
 const project={id:'shared-project',name:'Shared manuscript fixture',head_revision:1,main_file_id:'main',created_at:time,updated_at:time}
 const file={id:'main',path:'main.tex',kind:'text',content:'Original manuscript',revision:1,sha256:'',created_at:time,updated_at:time}
 const ownerContext=await browser.newContext({baseURL}),memberContext=await browser.newContext({baseURL})
 try{
  const open=async(context:typeof ownerContext,uid:string)=>{
   const page=await context.newPage()
   const isOwner=uid===owner
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
    const deny=()=>route.fulfill({status:404,headers:cors,json:{error:{code:'papers.project_not_found',message:'Not found'}}})
    const row=()=>({user_id:collaborator,role,created_at:time,updated_at:time})
    if(path==='/auth/session')return route.fulfill({headers:cors,json:{csrf_token:'fixture-csrf',user:{uuid:uid,username:isOwner?'owner':'editor',email:'fixture@example.test',role:'user',onboarding_completed_at:time}}})
    if(path==='/site/access')return route.fulfill({headers:cors,json:{}})
    if(path==='/papers/access')return ok({allowed:true})
    if(path===prefix)return isOwner||role?ok({...project,access_role:isOwner?'owner':role}):deny()
    if(path===prefix+'/files')return isOwner||role?ok([{...file,content:''}]):deny()
    if(path===prefix+'/files/main'){
     if(!isOwner&&!role)return deny()
     if(method==='PUT'){
      if(!isOwner&&role!=='editor')return route.fulfill({status:403,headers:cors,json:{error:{code:'papers.read_only',message:'Read only'}}})
      const input=route.request().postDataJSON()
      if(input.base_revision!==file.revision)return route.fulfill({status:409,headers:cors,json:{error:{code:'papers.revision_conflict',message:'Conflict'}}})
      saveCalls++;file.content=input.content;file.revision++;project.head_revision++
      return ok({...file,project_head_revision:project.head_revision})
     }
     return ok(file)
    }
    if(path===prefix+'/compile-capability')return isOwner?ok({enabled:false,pdf_available:false}):deny()
    if(path===prefix+'/members')return isOwner?ok(role?[row()]:[]):deny()
    if(path===prefix+'/members/'+collaborator){
     if(!isOwner)return deny()
     if(method==='PUT'){role=route.request().postDataJSON().role;return ok(row())}
     if(method==='DELETE'){role=null;return ok({deleted:true})}
    }
    if(path===prefix+'/compiles')return ok([])
    return ok({items:[],total:0})
   })
   await page.goto('/papers/shared-project')
   await expect(page.locator('.cm-content')).toContainText('Original manuscript',{timeout:30000})
   return page
  }
  const ownerPage=await open(ownerContext,owner)
  await ownerPage.getByRole('button',{name:'项目成员',exact:true}).click()
  await ownerPage.getByLabel('成员账号 UUID').fill(collaborator)
  await ownerPage.getByRole('button',{name:'添加 / 更新成员',exact:true}).click()
  await ownerPage.getByRole('alertdialog').getByRole('button',{name:'确认',exact:true}).click()
  await expect(ownerPage.getByText('成员权限已更新。')).toBeVisible()
  expect(role).toBe('editor')
  const editorPage=await open(memberContext,collaborator)
  await expect(editorPage.getByText('共享编辑：保存时检查文件版本，暂不支持实时共同编辑。')).toBeVisible()
  await expect(editorPage.getByRole('button',{name:'项目快照',exact:true})).toHaveCount(0)
  const editor=editorPage.locator('.cm-content')
  await editor.click()
  await editorPage.keyboard.press('ControlOrMeta+a')
  await editorPage.keyboard.insertText('Collaborator saved manuscript')
  await editorPage.getByRole('button',{name:'保存',exact:true}).click()
  await expect.poll(()=>file.content).toBe('Collaborator saved manuscript')
  expect(saveCalls).toBeGreaterThan(0)
  await ownerPage.getByRole('button',{name:'改为阅读者',exact:true}).click()
  await ownerPage.getByRole('alertdialog').getByRole('button',{name:'确认',exact:true}).click()
  await expect(ownerPage.getByRole('button',{name:'改为编辑者',exact:true})).toBeVisible()
  await editorPage.getByRole('button',{name:'刷新项目',exact:true}).click()
  await expect(editorPage.getByText('共享阅读：当前账号无编辑权限。')).toBeVisible()
  await expect(editorPage.locator('.cm-content')).toHaveAttribute('contenteditable','false')
  await ownerPage.getByRole('button',{name:'移除',exact:true}).click()
  await ownerPage.getByRole('alertdialog').getByRole('button',{name:'确认',exact:true}).click()
  await expect(ownerPage.getByText('成员访问权限已撤销。')).toBeVisible()
  await editorPage.getByRole('button',{name:'刷新项目',exact:true}).click()
  await expect(editorPage.getByText('无法打开论文。请确认项目存在且当前账号具有访问权限。')).toBeVisible()
 }finally{await ownerContext.close();await memberContext.close()}
})
