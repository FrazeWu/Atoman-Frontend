import {test,expect,type WebSocketRoute} from '@playwright/test'
import * as Y from 'yjs'
if(process.env.CHROME_BIN)test.use({launchOptions:{executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']}})

test('negotiated live membership and relative remote cursor rendering',async({browser,baseURL})=>{
 test.setTimeout(120000)
 const origin=new URL(baseURL!).origin
 expect(new URL(origin).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/)
 const owner='550e8400-e29b-41d4-a716-446655440001',editor='550e8400-e29b-41d4-a716-446655440002',epoch='550e8400-e29b-41d4-a716-446655440003'
 const now='2026-11-25T00:00:00Z',prefix='/papers/projects/live-fixture',filePath=prefix+'/files/main',capability=filePath+'/collaboration'
 const doc=new Y.Doc(),source=doc.getText('source')
 source.insert(0,'Original manuscript')
 const sessions=new Map<WebSocketRoute,{role:'owner'|'editor';connection_id:string;user_id:string;name:string;selection?:{anchor:string;head:string}}>()
 let presenceVersion=0
 const presence=()=>{
  presenceVersion++
  for(const [socket,peer] of sessions)socket.send(JSON.stringify({type:'presence',protocol:'papers-crdt-v1',epoch,connection_id:peer.connection_id,presence_version:presenceVersion,peers:[...sessions.values()]}))
 }
 let revision=1,legacyWrites=0,acceptedUpdates=0,disconnectEditor=false
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
    const peer={role,connection_id:role==='owner'?'550e8400-e29b-41d4-a716-446655440004':'550e8400-e29b-41d4-a716-446655440005',user_id:uid,name:role}
    sessions.set(socket,peer)
    socket.onClose(()=>{sessions.delete(socket);presence()})
    socket.onMessage(raw=>{
     const message=JSON.parse(String(raw))
     if(message.type==='presence'){
      const current=sessions.get(socket)!
      if(message.selection)current.selection=message.selection
      else delete current.selection
      presence()
      return
     }
     expect(message.type).toBe('update')
     expect(message.epoch).toBe(epoch)
     if(role==='editor'&&disconnectEditor){socket.close({code:1008,reason:'fixture disconnect'});sessions.delete(socket);return}
     Y.applyUpdate(doc,Buffer.from(message.update,'base64'))
     revision++;acceptedUpdates++
     file.content=source.toString();file.revision=revision;project.head_revision=revision
     for(const [peer,entry] of sessions)peer.send(frame(entry.role,peer===socket?message.request_id:undefined))
    })
    socket.send(frame(role))
    presence()
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
    if(path===capability)return ok({enabled:true,protocol:'papers-crdt-v1',role,presence:true})
    if(path===prefix+'/compile-capability')return ok({enabled:false,pdf_available:false})
    if(path===prefix+'/compiles')return ok([])
    return ok({items:[],total:0})
   })
   await page.goto('/papers/live-fixture')
   await expect(page.locator('.cm-content')).toContainText('Original manuscript',{timeout:30000})
   await page.getByRole('button',{name:'实时协作',exact:true}).click()
   await expect(page.locator('.papers-collab .cm-content')).toHaveText('Original manuscript',{timeout:30000})
   await expect(page.locator('.papers-collab [role=status]')).toContainText('服务器已保存')
   return page
  }
  const [first,second]=await Promise.all([open(a,'owner'),open(b,'editor')])
  await expect(first.getByLabel('在线成员')).toContainText('在线 2 人')
  await expect(second.getByLabel('在线成员')).toContainText('在线 2 人')
  const secondSource=second.locator('.papers-collab .cm-content')
  await secondSource.click()
  await second.keyboard.press('Home')
  await second.keyboard.press('Shift+ArrowRight')
  await second.keyboard.press('Shift+ArrowRight')
  await expect(first.locator('.papers-remote-cursor-label')).toHaveText('editor')
  await expect(first.locator('.papers-remote-selection')).toBeVisible()
  expect(acceptedUpdates).toBe(0)
  expect(legacyWrites).toBe(0)
  // Apply a committed fixture update while the remote cursor remains focused.
  // The unit test independently checks the exact relative offsets.
  source.insert(0,'New ')
  revision++;file.content=source.toString();file.revision=revision;project.head_revision=revision
  for(const [socket,peer] of sessions)socket.send(frame(peer.role))
  await expect(first.locator('.papers-collab .cm-content')).toContainText('New ')
  await expect(first.locator('.papers-remote-cursor-label')).toHaveText('editor')
  await expect(second.locator('.papers-collab [role=status]')).toContainText('服务器已保存')
  await second.getByRole('button',{name:'退出协作',exact:true}).click()
  await expect(first.getByLabel('在线成员')).toContainText('在线 1 人')
  await expect(first.locator('.papers-remote-cursor-label')).toHaveCount(0)
  expect(legacyWrites).toBe(0)
 }finally{await a.close();await b.close();doc.destroy()}
})
