import {test,expect} from '@playwright/test'
import {createServer} from 'node:http'
import type {AddressInfo} from 'node:net'

test('browser cookie authenticates initial Papers socket without fake bearer protocol',async({browser,baseURL})=>{
 test.setTimeout(60000)
 const origin=new URL(baseURL!).origin
 expect(new URL(origin).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/)
 const prefix='/papers/projects/handshake-fixture',filePath=prefix+'/files/main',capability=filePath+'/collaboration'
 const uid='550e8400-e29b-41d4-a716-446655440001',now='2026-11-25T00:00:00Z'
 const fixture={id:'main',path:'main.tex',kind:'text',sha256:'',revision:1,content:'Original saved source',created_at:now,updated_at:now}
 let handshake:{protocol?:string;hasCookie:boolean;origin?:string}|undefined
 const server=createServer((_req,res)=>{res.writeHead(404);res.end()})
 server.on('upgrade',(req,socket)=>{
  handshake={protocol:req.headers['sec-websocket-protocol'],hasCookie:(req.headers.cookie||'').split(';').some(c=>c.trim()==='atoman_session=papers-synthetic-cookie'),origin:req.headers.origin}
  socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nContent-Length: 0\r\n\r\n')
 })
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve))
 const socketPort=(server.address() as AddressInfo).port
 const ctx=await browser.newContext({baseURL})
 try{
  await ctx.addCookies([{name:'atoman_session',value:'papers-synthetic-cookie',url:origin,httpOnly:true,sameSite:'Lax'}])
  const page=await ctx.newPage()
  await page.addInitScript(({port})=>{
   const native=window.WebSocket
   window.WebSocket=new Proxy(native,{construct(target,args,newTarget){
    const url=new URL(String(args[0]),location.href)
    if(url.pathname.endsWith('/collaboration/ws')){
     url.hostname='127.0.0.1';url.port=String(port);url.protocol='ws:'
     return Reflect.construct(target,[url.toString(),...args.slice(1)],newTarget)
    }
    return Reflect.construct(target,args,newTarget)
   }})
  },{port:socketPort})
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url())
   const api=url.pathname.startsWith('/api/v1/')&&(url.origin===origin||url.origin==='https://api.atoman.org')
   if(!api)return url.origin===origin&&!url.pathname.startsWith('/api/')?route.continue():route.abort()
   const headers={'access-control-allow-origin':origin,'access-control-allow-credentials':'true','access-control-allow-methods':'GET, OPTIONS, POST, PUT, DELETE','access-control-allow-headers':'content-type, x-csrf-token, authorization'}
   if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers})
   const path=url.pathname.slice('/api/v1'.length)
   const ok=(data:unknown)=>route.fulfill({headers,json:{data}})
   if(path==='/auth/session')return route.fulfill({headers,json:{csrf_token:'fixture-csrf',user:{uuid:uid,username:'owner',email:'fixture@example.test',role:'user',onboarding_completed_at:now}}})
   if(path==='/site/access')return route.fulfill({headers,json:{}})
   if(path==='/papers/access')return ok({allowed:true})
   if(path===prefix)return ok({id:'handshake-fixture',name:'Handshake fixture',head_revision:1,main_file_id:'main',access_role:'owner',created_at:now,updated_at:now})
   if(path===prefix+'/files')return ok([{...fixture,content:''}])
   if(path===filePath)return ok(fixture)
   if(path===capability)return ok({enabled:true,protocol:'papers-crdt-v1',role:'owner'})
   if(path===prefix+'/compile-capability')return ok({enabled:false,pdf_available:false})
   if(path===prefix+'/compiles')return ok([])
   return ok({items:[],total:0})
  })
  await page.goto('/papers/handshake-fixture')
  await expect(page.locator('.cm-content')).toContainText('Original saved source',{timeout:30000})
  await page.getByRole('button',{name:'实时协作',exact:true}).click()
  await expect.poll(()=>handshake,{timeout:10000}).toEqual({protocol:undefined,hasCookie:true,origin})
  await expect(page.getByRole('button',{name:'重新连接',exact:true})).toBeVisible()
  await expect(page.getByLabel('连接前已保存的源码')).toContainText('Original saved source')
  handshake=undefined
  await page.getByRole('button',{name:'重新连接',exact:true}).click()
  await expect.poll(()=>handshake,{timeout:10000}).toEqual({protocol:undefined,hasCookie:true,origin})
  await page.getByRole('button',{name:'返回普通编辑',exact:true}).click()
  await expect(page.locator('.cm-content')).toContainText('Original saved source')
 }finally{
  await ctx.close()
  await new Promise<void>(resolve=>server.close(()=>resolve()))
 }
})
