import {test,expect} from '@playwright/test'
test('external video activation pauses music and resuming music closes the external frame',async({page,baseURL})=>{
 test.setTimeout(60000)
 const origin=new URL(baseURL!).origin
 expect(new URL(origin).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/)
 const now='2026-11-28T00:00:00Z',videoId='media-focus-fixture'
 const external='https://www.youtube.com/embed/abcdefghijk?rel=0'
 const sampleRate=8000,seconds=90
 const wave=Buffer.alloc(44+sampleRate*seconds*2)
 wave.write('RIFF',0);wave.writeUInt32LE(wave.length-8,4);wave.write('WAVEfmt ',8)
 wave.writeUInt32LE(16,16);wave.writeUInt16LE(1,20);wave.writeUInt16LE(1,22)
 wave.writeUInt32LE(sampleRate,24);wave.writeUInt32LE(sampleRate*2,28)
 wave.writeUInt16LE(2,32);wave.writeUInt16LE(16,34);wave.write('data',36);wave.writeUInt32LE(wave.length-44,40)
 let externalRequests=0
 await page.routeWebSocket('**/*',socket=>socket.close())
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url())
  if(url.href===external){externalRequests++;return route.fulfill({contentType:'text/html',body:'<!doctype html><title>External player fixture</title>'})}
  if(url.origin===origin&&url.pathname==='/focus-fixture.wav')return route.fulfill({contentType:'audio/wav',body:wave})
  const api=url.pathname.startsWith('/api/v1/')&&(url.origin===origin||url.origin==='https://api.atoman.org')
  if(!api)return url.origin===origin&&!url.pathname.startsWith('/api/')?route.continue():route.abort()
  const headers={'access-control-allow-origin':origin,'access-control-allow-credentials':'true','access-control-allow-methods':'GET, OPTIONS, POST, PUT, DELETE','access-control-allow-headers':'content-type, x-csrf-token, authorization'}
  if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers})
  const path=url.pathname.slice('/api/v1'.length)
  const ok=(data:unknown)=>route.fulfill({headers,json:{data}})
  if(path==='/auth/session')return route.fulfill({headers,json:{csrf_token:'fixture',user:{uuid:'focus-owner',username:'owner',email:'fixture@example.test',role:'user',onboarding_completed_at:now}}})
  if(path==='/site/access')return route.fulfill({headers,json:{}})
  if(path==='/videos/'+videoId)return route.fulfill({headers,json:{id:videoId,title:'External video fixture',description:'Fixture',video_url:'https://www.youtube.com/watch?v=abcdefghijk',storage_type:'external',visibility:'public',duration_sec:90,created_at:now,updated_at:now,user_id:'focus-owner',channel_id:'',thumbnail_url:'',status:'published',view_count:0,tags:[]}})
  if(path==='/videos/'+videoId+'/recommended')return route.fulfill({headers,json:[]})
  if(path==='/videos/bookmarks')return route.fulfill({headers,json:[]})
  if(path==='/videos/recommend/items'||path==='/videos')return route.fulfill({headers,json:{data:[],meta:{page:1,page_size:12,total:0,has_more:false}}})
  return ok({items:[],total:0})
 })
 await page.addInitScript(({origin})=>{
  const song={id:'focus-audio',title:'Focus audio fixture',artist:'Synthetic audio',audio_url:origin+'/focus-fixture.wav',duration:90}
  localStorage.setItem('playbackState',JSON.stringify({song,queue:[song],currentTime:12,volume:.35}))
  const audios:HTMLAudioElement[]=[]
  Object.defineProperty(window,'__focusAudios',{value:audios})
  window.Audio=new Proxy(window.Audio,{construct(target,args){const a=Reflect.construct(target,args) as HTMLAudioElement;audios.push(a);return a}})
 },{origin})
 const audio=()=>page.evaluate(()=>{
  const a=((window as any).__focusAudios as HTMLAudioElement[]).find(a=>a.src.includes('focus-fixture.wav'))
  return a?{paused:a.paused,time:a.currentTime}:null
 })
 await page.goto('/videos/watch/'+videoId)
 await expect(page.getByRole('heading',{name:'External video fixture'})).toBeVisible()
 const video=page.locator('.external-video-player')
 await expect(video.getByRole('button',{name:'播放外部视频',exact:true})).toBeVisible()
 await expect(video.locator('iframe')).toHaveCount(0)
 expect(externalRequests).toBe(0)
 const control=page.getByRole('button',{name:'音乐播放控制',exact:true})
 await control.click()
 const panel=page.getByRole('region',{name:'当前音频播放'})
 await panel.getByRole('button',{name:'继续播放',exact:true}).click()
 await expect.poll(async()=>(await audio())?.paused).toBe(false)
 await panel.getByRole('button',{name:'关闭音乐控制'}).click()
 const previous=(await audio())!.time
 await video.getByRole('button',{name:'播放外部视频',exact:true}).click()
 await expect(video.locator('iframe')).toHaveAttribute('src',external)
 await expect.poll(()=>externalRequests).toBe(1)
 await expect.poll(async()=>(await audio())?.paused).toBe(true)
 await control.click()
 await panel.getByRole('button',{name:'继续播放',exact:true}).click()
 await expect(video.locator('iframe')).toHaveCount(0)
 await expect.poll(async()=>(await audio())?.paused).toBe(false)
 expect((await audio())!.time).toBeGreaterThanOrEqual(previous-.1)
 await panel.getByRole('button',{name:'关闭音乐控制'}).click()
 await video.getByRole('button',{name:'播放外部视频',exact:true}).click()
 await expect.poll(async()=>(await audio())?.paused).toBe(true)
 await video.getByRole('button',{name:'关闭外部视频',exact:true}).click()
 await expect(video.locator('iframe')).toHaveCount(0)
 expect((await audio())!.paused).toBe(true)
})
