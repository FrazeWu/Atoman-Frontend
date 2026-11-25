import {test,expect,type WebSocketRoute} from '@playwright/test'
import * as Y from 'yjs'
if(process.env.CHROME_BIN)test.use({launchOptions:{executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']}})

test('reconnects the original editing epoch after a committed update loses its acknowledgement',async({browser,baseURL})=>{
 test.setTimeout(120000)
 const origin=new URL(baseURL!).origin
 expect(new URL(origin).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/)
 const owner='550e8400-e29b-41d4-a716-446655440001',editor='550e8400-e29b-41d4-a716-446655440002',epoch='550e8400-e29b-41d4-a716-446655440003'
 const now='2026-11-25T00:00:00Z',prefix='/papers/projects/live-fixture',filePath=prefix+'/files/main',capability=filePath+'/collaboration'
 const doc=new Y.Doc(),source=doc.getText('source')
 source.insert(0,'Original manuscript')
 const sessions=new Map<WebSocketRoute,'owner'|'editor'>()
 let revision=1,legacyWrites=0,acceptedUpdates=0,disconnectEditor=false,editorConnections=0
 let lostAck:string|null=null,replayed=false
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
    if(role==='editor'){
     editorConnections++
     if(editorConnections>1)expect(new URL(socket.url()).searchParams.get('epoch')).toBe(epoch)
    }
    sessions.set(socket,role)
    socket.onClose(()=>{sessions.delete(socket)})
    socket.onMessage(raw=>{
     const message=JSON.parse(String(raw))
     expect(message.type).toBe('update')
     expect(message.epoch).toBe(epoch)
     if(role==='editor'&&lostAck!==null){
      expect(String(raw)).toBe(lostAck)
      const before=Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64')
      Y.applyUpdate(doc,Buffer.from(message.update,'base64'))
      expect(Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64')).toBe(before)
      replayed=true
      socket.send(frame(role,message.request_id))
      return
     }
     Y.applyUpdate(doc,Buffer.from(message.update,'base64'))
     revision++;acceptedUpdates++
     file.content=source.toString();file.revision=revision;project.head_revision=revision
     if(role==='editor'&&disconnectEditor){
      lostAck=String(raw)
      sessions.delete(socket)
      for(const [peer,peerRole] of sessions)peer.send(frame(peerRole))
      socket.close({code:1012,reason:'fixture restart'})
      return
     }
     for(const [peer,peerRole] of sessions)peer.send(frame(peerRole,peer===socket?message.request_id:undefined))
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
  const firstSource=first.locator('.papers-collab .cm-content'),secondSource=second.locator('.papers-collab .cm-content')
  disconnectEditor=true
  await secondSource.click();await second.keyboard.press('End');await second.keyboard.insertText(' retained')
  await expect.poll(()=>lostAck).not.toBeNull()
  await expect.poll(()=>editorConnections).toBe(2)
  await expect.poll(()=>replayed).toBe(true)
  await expect(second.locator('.papers-collab [role=status]')).toContainText('服务器已保存')
  await expect(firstSource).toHaveText('Original manuscript retained')
  await expect(secondSource).toHaveText('Original manuscript retained')
  await expect(secondSource).toHaveAttribute('contenteditable','true')
  expect(acceptedUpdates).toBe(1)
  expect(revision).toBe(2)
  expect(legacyWrites).toBe(0)
  await second.getByRole('button',{name:'退出协作',exact:true}).click()
  await expect(second.locator('.cm-content')).toHaveText(source.toString())
 }finally{await a.close();await b.close();doc.destroy()}
})
