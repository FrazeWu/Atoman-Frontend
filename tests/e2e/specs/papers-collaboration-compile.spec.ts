import {test,expect,type WebSocketRoute} from '@playwright/test'
import * as Y from 'yjs'
if(process.env.CHROME_BIN)test.use({launchOptions:{executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']}})

test('owner compiles and checkpoints only acknowledged collaborative revisions',async({browser,baseURL})=>{
 test.setTimeout(120000)
 const origin=new URL(baseURL!).origin
 expect(new URL(origin).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/)
 const owner='550e8400-e29b-41d4-a716-446655440001',editor='550e8400-e29b-41d4-a716-446655440002',epoch='550e8400-e29b-41d4-a716-446655440003'
 const now='2026-11-25T00:00:00Z',prefix='/papers/projects/live-fixture',filePath=prefix+'/files/main',capability=filePath+'/collaboration'
 const doc=new Y.Doc(),source=doc.getText('source')
 source.insert(0,'Original manuscript')
 const sessions=new Map<WebSocketRoute,'owner'|'editor'>()
 let revision=1,legacyWrites=0,acceptedUpdates=0,holdOwnerUpdate=false
 let heldUpdate:(()=>void)|null=null
 const compileRequests:number[]=[],snapshotRequests:number[]=[]
 const snapshots:{id:string;name:string;source_revision:number;main_file_id:string;file_count:number;source_bytes:number;automatic:boolean;created_at:string}[]=[]
 let job:Record<string,unknown>|null=null
 const project={id:'live-fixture',name:'Realtime collaboration fixture',head_revision:1,main_file_id:'main',created_at:now,updated_at:now}
 const file={id:'main',path:'main.tex',kind:'text',sha256:'',revision:1,content:'Original manuscript',created_at:now,updated_at:now}
 function frame(role:'owner'|'editor',request_id?:string){
  return JSON.stringify({type:'state',protocol:'papers-crdt-v1',epoch,sequence:revision,file_revision:revision,project_revision:revision,role,
    state:Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64'),vector:Buffer.from(Y.encodeStateVector(doc)).toString('base64'),...(request_id?{request_id}:{})})
 }
 const a=await browser.newContext({baseURL}),b=await browser.newContext({baseURL})
 try{
  const open=async(context:typeof a,role:'owner'|'editor')=>{
   const page=await context.newPage(),uid=role==='owner'?owner:editor
   page.on('dialog',dialog=>void dialog.accept())
   await page.routeWebSocket('**/*',socket=>{
    if(!new URL(socket.url()).pathname.endsWith(capability+'/ws')){socket.close();return}
    sessions.set(socket,role)
    socket.onClose(()=>{sessions.delete(socket)})
    socket.onMessage(raw=>{
     const message=JSON.parse(String(raw))
     expect(message.type).toBe('update')
     expect(message.epoch).toBe(epoch)
     const commit=()=>{
      Y.applyUpdate(doc,Buffer.from(message.update,'base64'))
      revision++;acceptedUpdates++
      file.content=source.toString();file.revision=revision;project.head_revision=revision
      for(const [peer,peerRole] of sessions)peer.send(frame(peerRole,peer===socket?message.request_id:undefined))
     }
     if(role==='owner'&&holdOwnerUpdate){heldUpdate=commit;return}
     commit()
    })
    socket.send(frame(role))
   })
   await page.route('**/*',async route=>{
    const url=new URL(route.request().url())
    const fixtureAPI=url.pathname.startsWith('/api/v1/')&&(url.origin===origin||url.origin==='https://api.atoman.org')
    if(!fixtureAPI)return url.origin===origin&&!url.pathname.startsWith('/api/')&&!url.pathname.startsWith('/uploads/')&&!url.pathname.startsWith('/__object-storage/')?route.continue():route.abort()
    const headers={'access-control-allow-origin':origin,'access-control-allow-credentials':'true','access-control-allow-methods':'GET, OPTIONS, POST, PUT, DELETE','access-control-allow-headers':'content-type, x-csrf-token, authorization'}
    const method=route.request().method()
    if(method==='OPTIONS')return route.fulfill({status:204,headers})
    const path=url.pathname.slice('/api/v1'.length)
    const ok=(data:unknown)=>route.fulfill({headers,json:{data}})
    if(path==='/auth/session')return route.fulfill({headers,json:{csrf_token:'fixture-csrf',user:{uuid:uid,username:role,email:'fixture@example.test',role:'user',onboarding_completed_at:now}}})
    if(path==='/site/access')return route.fulfill({headers,json:{}})
    if(path==='/papers/access')return ok({allowed:true})
    if(path===prefix)return ok({...project,access_role:role})
    if(path===prefix+'/files')return ok([{...file,content:''}])
    if(path===filePath){
     if(method==='PUT'){legacyWrites++;return route.fulfill({status:409,headers,json:{error:{code:'papers.revision_conflict',message:'No legacy save in fixture'}}})}
     return ok(file)
    }
    if(path===capability)return ok({enabled:true,protocol:'papers-crdt-v1',role})
    if(path===prefix+'/compile-capability')return ok({enabled:role==='owner',pdf_available:false})
    if(path===prefix+'/compiles'){
     if(method==='GET')return ok(job?[job]:[])
     expect(role).toBe('owner')
     const body=route.request().postDataJSON()
     expect(body.base_revision).toBe(revision)
     expect(body.idempotency_key).toBeTruthy()
     expect(body).not.toHaveProperty('content')
     compileRequests.push(body.base_revision)
     job={id:'compile-1',project_id:project.id,source_revision:revision,status:'succeeded',compiler:'pdflatex',attempts:1,max_attempts:2,cancel_requested:false,pdf_available:false,created_at:now}
     return ok(job)
    }
    if(path===prefix+'/snapshots'){
     expect(role).toBe('owner')
     if(method==='GET')return ok(snapshots)
     const body=route.request().postDataJSON()
     expect(body.base_revision).toBe(revision)
     expect(body).not.toHaveProperty('content')
     snapshotRequests.push(body.base_revision)
     const row={id:'snapshot-1',name:body.name,source_revision:revision,main_file_id:'main',file_count:1,source_bytes:source.length,automatic:false,created_at:now}
     snapshots.push(row)
     return ok(row)
    }
    if(path===prefix+'/snapshots/snapshot-1'){
     expect(role).toBe('owner')
     return ok({...snapshots[0],files:[{file_id:'main',path:'main.tex',revision:2,kind:'text',sha256:''}]})
    }
    return ok({items:[],total:0})
   })
   await page.goto('/papers/live-fixture')
   await expect(page.locator('.cm-content')).toContainText('Original manuscript',{timeout:30000})
   await page.getByRole('button',{name:'实时协作',exact:true}).click()
   await expect(page.locator('.papers-collab .cm-content')).toHaveText('Original manuscript',{timeout:30000})
   await expect(page.locator('.papers-collab__bar [role=status]')).toContainText('服务器已保存')
   return page
  }
  const [first,second]=await Promise.all([open(a,'owner'),open(b,'editor')])
  const firstSource=first.locator('.papers-collab .cm-content'),secondSource=second.locator('.papers-collab .cm-content')
  const compile=first.getByRole('button',{name:'编译',exact:true})
  await expect(compile).toBeEnabled()
  await expect(second.getByRole('button',{name:'编译',exact:true})).toBeDisabled()
  await expect(second.getByRole('button',{name:'项目快照',exact:true})).toHaveCount(0)
  await first.getByRole('button',{name:'项目快照',exact:true}).click()
  const snapshotName=first.getByLabel('快照名称')
  await snapshotName.fill('Confirmed revision')
  const create=first.getByRole('button',{name:'创建快照',exact:true})
  await expect(create).toBeEnabled()
  holdOwnerUpdate=true
  await firstSource.click();await first.keyboard.press('End');await first.keyboard.insertText(' confirmed')
  await expect.poll(()=>heldUpdate!==null).toBe(true)
  await expect(compile).toBeDisabled()
  await expect(create).toBeDisabled()
  expect(compileRequests).toHaveLength(0);expect(snapshotRequests).toHaveLength(0)
  expect(source.toString()).toBe('Original manuscript')
  holdOwnerUpdate=false
  const release=heldUpdate as (()=>void)|null
  expect(release).not.toBeNull();release!()
  await expect(first.locator('.papers-collab__bar [role=status]')).toContainText('服务器已保存')
  await expect(secondSource).toHaveText('Original manuscript confirmed')
  await expect(compile).toBeEnabled()
  await expect(create).toBeEnabled()
  await create.click()
  await expect.poll(()=>snapshotRequests).toEqual([2])
  await expect(first.getByText('项目快照已创建 · 版本 2。')).toBeVisible()
  await first.getByRole('button',{name:/Confirmed revision/}).click()
  await expect(first.getByRole('button',{name:'恢复整个项目',exact:true})).toBeDisabled()
  await compile.click()
  await expect.poll(()=>compileRequests).toEqual([2])
  await expect(first.locator('.papers-workspace__compile-label')).toContainText('版本 2')
  await secondSource.click();await second.keyboard.press('End');await second.keyboard.insertText(' remote')
  await expect.poll(()=>revision).toBe(3)
  await expect(firstSource).toHaveText('Original manuscript confirmed remote')
  await expect(first.getByText(/编译已确认的项目版本 3/)).toBeVisible()
  expect(legacyWrites).toBe(0)
  await first.getByRole('button',{name:'退出协作',exact:true}).click()
  await expect(first.locator('.cm-content')).toHaveText(source.toString())
  await first.getByRole('button',{name:'项目快照',exact:true}).click()
  await first.getByRole('button',{name:/Confirmed revision/}).click()
  await expect(first.getByRole('button',{name:'恢复整个项目',exact:true})).toBeEnabled()
 }finally{await a.close();await b.close();doc.destroy()}
})
