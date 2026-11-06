// Isolated browser acceptance with synthetic mailbox/API fixtures. Never sends mail.
const assert = require('node:assert/strict')
const { chromium } = require('@playwright/test')
const root = process.env.MAIL_PREVIEW_URL || 'http://127.0.0.1:5189'
const files = new Map()
let account = {status:'active',available:true,address:'preview@atoman.org'}
let readIds=[],actionCalls=[],queued=null,settingsWrites=0,passwords=[]
let contacts=[],searchHistory=[]
const folders=[
 {id:'inbox',name:'Inbox',role:'inbox',parentId:null,totalEmails:2,unreadEmails:2},
 {id:'sent',name:'Sent',role:'sent',parentId:null,totalEmails:1,unreadEmails:0},
 {id:'drafts',name:'Drafts',role:'drafts',parentId:null,totalEmails:0,unreadEmails:0},
 {id:'archive',name:'Archive',role:'archive',parentId:null,totalEmails:0,unreadEmails:0},
 {id:'junk',name:'Junk',role:'junk',parentId:null,totalEmails:0,unreadEmails:0},
 {id:'trash',name:'Trash',role:'trash',parentId:null,totalEmails:0,unreadEmails:0},
]
const messages=[
 {id:'one',threadId:'conversation',subject:'周末计划与行程确认',preview:'周六下午见，地点和安排已经确认。',receivedAt:'2026-11-05T09:00:00Z',hasAttachment:true,from:[{name:'林小满',email:'lin@example.test'}],mailboxIds:{inbox:true},isRead:false,isStarred:false},
 {id:'two',threadId:'conversation',subject:'周末计划与行程确认',preview:'谢谢确认，我会准时到。附件是这次的行程安排。',receivedAt:'2026-11-05T10:00:00Z',hasAttachment:true,from:[{name:'林小满',email:'lin@example.test'}],mailboxIds:{inbox:true},isRead:false,isStarred:false},
 {id:'three',threadId:'receipt',subject:'你的订单已确认',preview:'订单信息已经整理好了，感谢你的支持。',receivedAt:'2026-11-05T08:00:00Z',hasAttachment:false,from:[{name:'Paper & Co.',email:'shop@example.test'}],mailboxIds:{inbox:true},isRead:true,isStarred:true},
]
let preferences={conversation_mode:true,signature:{enabled:false,text:'',html:'',on_reply:true},blocked_senders:[],auto_reply:{enabled:false,subject:'',text:''},rules:[]}
async function run(){
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']})
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1})
  await context.route('**/api/v1/**',async route=>{
   const request=route.request(),url=new URL(request.url()),path=url.pathname,method=request.method()
   let data={},status=200,result
   if(path.endsWith('/auth/session')) result={csrf_token:'fixture-csrf',user:{username:'layout-preview',uuid:'11111111-1111-4111-8111-111111111111',email:'preview@example.test',role:'user',is_active:true}}
   else if(path.endsWith('/mail/me'))data=account
   else if(path.endsWith('/mail/folders')) data=folders
   else if(path.endsWith('/mail/unread')) data={count:2,latest_id:'two'}
   else if(path.endsWith('/mail/contacts')){
     if(method==='POST') {const input=request.postDataJSON(); const row={...input,id:'contact-'+(contacts.length+1),revision:1,updated_at:new Date().toISOString()};contacts.push(row);data=row}
     else data=contacts
   }else if(/\/mail\/contacts\/[^/]+$/.test(path)) {
     const id=path.split('/').pop()
     if(method==='PUT'){const input=request.postDataJSON();const row={...input,revision:input.revision+1,updated_at:new Date().toISOString()};contacts=contacts.map(item=>item.id===id?row:item);data=row}
     else if(method==='DELETE'){contacts=contacts.filter(item=>item.id!==id);data={deleted:true}}
   }
   else if(path.endsWith('/mail/search')){
    searchHistory.push(Object.fromEntries(url.searchParams.entries()))
    const items=url.searchParams.has('thread_id')?messages.filter(row=>row.threadId===url.searchParams.get('thread_id')):url.searchParams.get('mailbox_id')==='inbox'?messages:[]
    data={items,total:items.length,position:0,has_more:false}
   }else if(path.endsWith('/mail/message')){
    const id=url.searchParams.get('message_id'),summary=messages.find(row=>row.id===id)
    data={...summary,to:[{name:'预览用户',email:'preview@atoman.org'}],cc:[],plainText:'你好，\n\n周六下午的见面已经安排好了。\n\n我们可以先沿河走一走，再找一家咖啡馆聊聊。行程安排放在附件里，如果时间有变化，回复这封邮件就好。\n\n周末见！\n小满\n\n<script>这是被安全显示的文字</script>',html:'<form action="https://tracking.invalid/post"><input></form><p style="background:url(https://tracking.invalid/css)">你好，</p><p>周末见！<img src="https://tracking.invalid/pixel" onerror="alert(1)"></p><script>alert(1)</script>',hasPlainText:true,bodyTruncated:false,isRead:readIds.includes(id),attachments:[{partId:'part-one',name:'周末行程.pdf',type:'application/pdf',size:18400}],messageId:[`${id}@example.test`],replyTo:summary.from}
   }else if(path.endsWith('/mail/messages/read')){const body=request.postDataJSON();readIds.push(body.message_id);data={read:true}}
   else if(path.endsWith('/mail/messages/actions')){const body=request.postDataJSON();actionCalls.push(body);data={updated:body.ids,undo_token:'fixture-receipt'}}
   else if(path.endsWith('/mail/messages/actions/undo'))data={updated:['one','two']}
   else if(path.endsWith('/mail/drafts'))data=[...files.values()].map(({compose,...row})=>({...row,subject:compose.subject}))
   else if(/\/mail\/drafts\/[^/]+$/.test(path)){
    const id=path.split('/').pop()
    if(method==='PUT'){const body=request.postDataJSON();const previous=files.get(id);assert.equal(body.revision,previous?.revision||0,'Draft must use returned revision');const row={id,revision:body.revision+1,subject:body.compose.subject,updated_at:new Date().toISOString(),compose:body.compose};files.set(id,row);data=row}
    else if(method==='DELETE'){files.delete(id);data={deleted:true}}
    else data=files.get(id)
   }else if(path.endsWith('/mail/attachments')){data={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'notes.txt',type:'text/plain',size:5}}
   else if(path.endsWith('/mail/attachment')){await route.fulfill({status:200,contentType:'application/octet-stream',body:'fixture attachment'});return}
   else if(path.endsWith('/mail/outbox')){
    if(method==='POST'){const body=request.postDataJSON();assert.ok(body.request_id);assert.ok(body.attachment_ids);queued={id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',status:'queued',send_after:body.send_at||new Date(Date.now()+5000).toISOString(),scheduled:Boolean(body.send_at),created_at:new Date().toISOString(),draft_id:body.draft_id,draft_revision:body.draft_revision};data=queued}
    else data=queued?[queued]:[]
   }else if(/\/mail\/outbox\/[^/]+\/cancel$/.test(path)){queued={...queued,status:'cancelled'};data=queued}
   else if(/\/mail\/outbox\/[^/]+$/.test(path))data=queued
   else if(path.endsWith('/mail/settings')){if(method==='PUT'){preferences=request.postDataJSON();settingsWrites++}data=preferences}
   else if(path.endsWith('/mail/app-passwords')){if(method==='POST'){const body=request.postDataJSON();const pw={id:'device-one',name:body.name,created_at:new Date().toISOString()};passwords.push(pw);data={...pw,password:'synthetic-preview-only'}}else data=passwords}
   else if(path.endsWith('/mail/app-passwords/device-one')&&method==='DELETE'){passwords=[];data={revoked:true}}
   await route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(result||{data})})
  })
  const page=await context.newPage()
  await page.goto(`${root}/mail`,{waitUntil:'domcontentloaded'})
  await page.getByTestId('mail-message-two').waitFor({timeout:25000});assert.equal(readIds.length,0)
  assert.equal(await page.locator('[data-testid^="mail-message-"]').count(),2,'Threads grouped by default')
  await page.getByTestId('mail-message-two').click();await page.getByTestId('mail-plain-text').waitFor()
  await page.waitForTimeout(100);assert.deepEqual(readIds,['two']);assert.equal(await page.locator('.mail-workspace__reader-body script').count(),0)
  const remoteRequests=[]
  page.on('request',request=>{if(/tracking\.invalid/.test(request.url()))remoteRequests.push(request.url())})
  await page.getByRole('button',{name:'显示排版',exact:true}).click()
  const frame=page.frameLocator('iframe[title="邮件正文"]')
  await frame.locator('body').waitFor()
  assert.equal(await frame.locator('script,form,input,img,iframe').count(),0)
  assert.equal(await frame.locator('[style],[onerror]').count(),0)
  await page.waitForTimeout(120);assert.deepEqual(remoteRequests,[])
  await page.getByRole('button',{name:'显示纯文本',exact:true}).click()
  await page.getByRole('button',{name:/预览或下载附件/}).click()
  await page.getByTestId('mail-attachment-preview').waitFor()
  await page.getByText('不支持在线预览',{exact:true}).waitFor()
  await page.getByTestId('mail-attachment-preview').getByRole('button',{name:'关闭',exact:true}).click()
  console.log('MAIL_ATTACHMENT_UNTRUSTED_CONTENT_NOT_RENDERED_OK')
  console.log('MAIL_CHROME_HTML_SANITIZER_AND_NO_REMOTE_LOADS_OK')
  const rects=await page.evaluate(()=>['mail-folder-pane','mail-list-pane','mail-reader-pane'].map(name=>{const r=document.querySelector(`[data-testid="${name}"]`).getBoundingClientRect();return{x:r.x,width:r.width,right:r.right}}))
  assert.ok(rects.every(r=>r.width>160));assert.ok(rects[0].right<=rects[1].x+2&&rects[1].right<=rects[2].x+2)
  await page.screenshot({path:'/tmp/atoman-mail-complete-desktop.png',fullPage:true})
  console.log('MAIL_DESKTOP_THREE_PANES_AND_EXPAND_ONLY_READ_OK',JSON.stringify(rects))
  await page.getByRole('button',{name:'高级筛选'}).click()
  await page.getByRole('textbox',{name:'发件人'}).fill('lin@example.test')
  await page.getByRole('textbox',{name:'主题包含'}).fill('周末')
  await page.getByRole('checkbox',{name:'搜索所有文件夹'}).check()
  await page.getByRole('button',{name:'搜索邮件',exact:true}).click()
  await page.waitForTimeout(250)
  assert.equal(searchHistory.at(-1).from,'lin@example.test')
  assert.equal(searchHistory.at(-1).subject,'周末')
  assert.equal(searchHistory.at(-1).mailbox_id,'')
  await page.getByRole('button',{name:/高级筛选已启用/}).click()
  console.log('MAIL_ADVANCED_SEARCH_FILTERS_AND_ALL_FOLDERS_OK')

  await page.getByTestId('mail-folder-pane').getByRole('button',{name:'写邮件',exact:true}).click()
  await page.getByRole('textbox',{name:'收件人',exact:true}).fill('recipient@example.test')
  await page.getByRole('textbox',{name:'邮件主题',exact:true}).fill('完整写信流程验收')
  await page.getByRole('textbox',{name:'邮件正文',exact:true}).fill('这封邮件只在本地 fixture 中验证。')
  await page.locator('input[type=file]').setInputFiles({name:'notes.txt',mimeType:'text/plain',buffer:Buffer.from('hello')})
  await page.waitForTimeout(1250);assert.equal(files.size,1)
  await page.screenshot({path:'/tmp/atoman-mail-complete-compose.png',fullPage:true})
  await page.getByRole('button',{name:'发送',exact:true}).click();await page.getByRole('button',{name:/撤销发送/}).waitFor();await page.getByRole('button',{name:/撤销发送/}).click()
  await page.getByRole('textbox',{name:'邮件正文',exact:true}).waitFor();assert.equal(queued.status,'cancelled');assert.ok((await page.getByRole('textbox',{name:'邮件正文',exact:true}).inputValue()).includes('fixture'))
  await page.getByRole('button',{name:'保存并关闭'}).click();await page.getByRole('textbox',{name:'邮件正文',exact:true}).waitFor({state:'hidden'})
  console.log('MAIL_AUTOSAVE_ATTACHMENT_QUEUE_AND_CONFIRMED_UNDO_OK')
  await page.getByRole('button',{name:'邮箱设置',exact:true}).click();await page.getByText('自动回复',{exact:true}).waitFor()
  await page.getByRole('button',{name:'新建联系人'}).click()
  await page.getByPlaceholder('备注姓名（可留空）').fill('验收联系人')
  await page.getByPlaceholder('name@example.com').fill('contact@example.test')
  await page.getByRole('button',{name:'保存联系人'}).click()
  await page.getByText('contact@example.test',{exact:true}).waitFor()
  assert.equal(contacts.length,1)
  console.log('MAIL_PRIVATE_CONTACT_CREATE_VISIBLE_OK')

  await page.getByLabel('启用自动回复').check()
  await page.getByPlaceholder('例如：暂时无法回复').fill('暂时外出')
  await page.getByPlaceholder('写下你的自动回复…').fill('我会在回来后回复你。')
  await page.getByPlaceholder('每行一个邮箱地址').fill('blocked@example.test')
  await page.getByRole('button',{name:'添加规则'}).click()
  await page.getByPlaceholder('关键词或地址').fill('receipt')
  await page.locator('.mail-rule .p-select-trigger').nth(0).click();await page.getByRole('option',{name:'主题'}).click()
  await page.locator('.mail-rule .p-select-trigger').nth(1).click();await page.getByRole('option',{name:'归档'}).click()
  await page.getByRole('button',{name:'保存设置',exact:true}).click()
  await page.getByText('设置已保存',{exact:true}).waitFor()
  assert.equal(settingsWrites,1);assert.equal(preferences.auto_reply.enabled,true);assert.equal(preferences.rules[0].contains,'receipt');assert.deepEqual(preferences.blocked_senders,['blocked@example.test'])
  await page.getByRole('textbox',{name:'客户端名称'}).fill('验收邮件客户端')
  await page.getByRole('button',{name:'创建密码',exact:true}).click()
  await page.getByText('请保存新密码，仅显示这一次。',{exact:true}).waitFor()
  assert.equal(passwords.length,1)
  await page.screenshot({path:'/tmp/atoman-mail-complete-settings.png',fullPage:true})
  await page.getByRole('button',{name:'撤销',exact:true}).click()
  await page.getByRole('button',{name:'确认撤销',exact:true}).click()
  await page.getByText('尚未创建客户端密码',{exact:true}).waitFor()
  assert.equal(passwords.length,0);assert.equal(await page.locator('.mail-settings__new-password').count(),0)
  console.log('MAIL_SETTINGS_RULES_VACATION_BLOCKING_AND_APP_PASSWORD_REVOKE_OK')
  await page.keyboard.press('Escape')
  await page.getByTestId('mail-message-two').click();await page.getByTestId('mail-plain-text').waitFor()
  await page.getByRole('button',{name:'转发',exact:true}).click()
  await page.getByRole('textbox',{name:'邮件正文',exact:true}).waitFor()
  assert.equal(await page.locator('.mail-compose__attachments>div').count(),1)
  assert.ok((await page.getByRole('textbox',{name:'邮件正文',exact:true}).inputValue()).includes('转发的邮件'))
  await page.getByRole('button',{name:'保存并关闭',exact:true}).click()
  await page.getByRole('textbox',{name:'邮件正文',exact:true}).waitFor({state:'hidden'})
  console.log('MAIL_FORWARD_WITH_COPIED_ATTACHMENT_OK')
  await page.getByRole('checkbox',{name:'选择当前列表全部邮件'}).check();await page.getByRole('button',{name:'归档所选邮件'}).click();await page.getByRole('button',{name:'撤销操作',exact:true}).waitFor();assert.equal(actionCalls[0].action,'archive');await page.getByRole('button',{name:'撤销操作',exact:true}).click()
  console.log('MAIL_BULK_ARCHIVE_AND_UNDO_OK')
  await page.getByTestId('mail-folder-pane').getByRole('button',{name:'写邮件',exact:true}).click()
  await page.getByRole('textbox',{name:'收件人',exact:true}).fill('contact')
  await page.getByRole('option',{name:/contact@example.test/}).click()
  assert.ok((await page.getByRole('textbox',{name:'收件人'}).inputValue()).includes('contact@example.test'))
  await page.getByRole('textbox',{name:'邮件正文'}).fill('测试定时发送：此操作只在模拟服务器中执行')
  await page.getByRole('checkbox',{name:'定时发送'}).check()
  const future=await page.evaluate(()=>new Date(Date.now()+3600000-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16))
  await page.locator('input[type=datetime-local]').fill(future)
  await page.getByRole('button',{name:'确认定时发送',exact:true}).click()
  await page.getByRole('button',{name:/撤销发送/}).waitFor()
  assert.equal(queued.scheduled,true)
  assert.ok(new Date(queued.send_after).getTime()>Date.now()+3000000)
  await page.getByRole('button',{name:/撤销发送/}).click()
  assert.equal(queued.status,'cancelled')
  await page.getByRole('textbox',{name:'邮件正文'}).waitFor()
  await page.getByRole('button',{name:'保存并关闭'}).click()
  await page.getByRole('textbox',{name:'邮件正文'}).waitFor({state:'hidden'})
  console.log('MAIL_CONTACT_AUTOCOMPLETE_DURABLE_SCHEDULE_CANCEL_OK')

  await page.setViewportSize({width:390,height:844});await page.reload({waitUntil:'domcontentloaded'});await page.getByTestId('mail-message-two').waitFor({timeout:25000})
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.atomanApp),'mobile')
  assert.ok(await page.getByTestId('mail-list-pane').isVisible());assert.ok(!(await page.getByTestId('mail-folder-pane').isVisible()))
  await page.getByTestId('mail-list-pane').getByRole('button',{name:'写邮件'}).click()
  await page.getByRole('textbox',{name:'邮件主题'}).waitFor()
  await page.getByRole('button',{name:'保存并关闭'}).click()
  await page.getByRole('textbox',{name:'邮件主题'}).waitFor({state:'hidden'})
  await page.setViewportSize({width:320,height:700})
  const narrow=await page.evaluate(()=>({viewport:innerWidth,scrollWidth:document.querySelector('.mail-page').scrollWidth}))
  assert.ok(narrow.scrollWidth<=narrow.viewport+1,JSON.stringify(narrow))
  await page.setViewportSize({width:390,height:844})
  console.log('MAIL_MOBILE_COMPOSE_AND_NARROW_VIEWPORT_OK',JSON.stringify(narrow))
  await page.screenshot({path:'/tmp/atoman-mail-complete-mobile-list.png',fullPage:true})
  await page.getByTestId('mail-message-two').click();await page.getByTestId('mail-plain-text').waitFor();await page.screenshot({path:'/tmp/atoman-mail-complete-mobile-reader.png',fullPage:true})
  const bounds=await page.evaluate(()=>({viewport:innerWidth,scrollWidth:document.querySelector('.mail-page').scrollWidth}));assert.ok(bounds.scrollWidth<=bounds.viewport+1)
  await page.getByRole('button',{name:'返回邮件列表',exact:true}).click();await page.getByRole('button',{name:'显示文件夹',exact:true}).click();await page.getByTestId('mail-folder-pane').waitFor({state:'visible'})
  console.log('MAIL_GENUINE_MOBILE_SINGLE_PANE_AND_NO_OVERFLOW_OK',JSON.stringify(bounds))
  account={status:'reserved',available:false,address:'preview@atoman.org'};await page.reload({waitUntil:'domcontentloaded'});await page.getByTestId('mail-not-active').waitFor({timeout:25000});assert.equal(await page.getByTestId('mail-active-workspace').count(),0)
  console.log('MAIL_RESERVED_ACCOUNT_FAIL_CLOSED_OK')
 }finally{await browser.close()}
}
run().catch(error=>{console.error(error);process.exitCode=1})
