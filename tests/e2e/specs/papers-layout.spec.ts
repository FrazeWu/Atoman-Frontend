import {test,expect,type Page} from '@playwright/test'
function fixturePDF(): Buffer {
  const stream = (text: string) => {
    const body = `BT /F1 16 Tf 36 200 Td (${text}) Tj ET\n`
    return `<< /Length ${Buffer.byteLength(body)} >>\nstream\n${body}endstream`
  }
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R /Outlines 8 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 320 600] /Resources << /Font << /F1 7 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 320 600] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>',
    stream('Papers acceptance page one'),
    stream('Papers acceptance page two'),
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Outlines /First 9 0 R /Last 9 0 R /Count 1 >>',
    '<< /Title (Results page) /Parent 8 0 R /Dest [4 0 R /Fit] >>',
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(pdf))
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`
  }
  const xref = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  pdf += offsets.slice(1).map(value => `${String(value).padStart(10, '0')} 00000 n \n`).join('')
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf)
}


const pid='layout-fixture',prefix='/papers/projects/'+pid,now='2026-11-26T00:00:00Z'
const project={id:pid,name:'Reliable AI for Scientific Research',main_file_id:'main',head_revision:5,access_role:'owner',created_at:now,updated_at:now}
const make=(id:string,path:string,content:string)=>({id,path,content,kind:'text',revision:1,sha256:'',created_at:now,updated_at:now})
const files=[make('main','main.tex',String.raw`\documentclass{article}
\usepackage{amsmath}
\title{Reliable AI for Scientific Research}
\author{Anonymous Authors}
\begin{document}
\maketitle

\begin{abstract}
We investigate reliable language model evaluation and
compare reproducible methods across benchmark tasks.
\end{abstract}

\section{Introduction}
Scientific workflows require transparent evaluation.

\input{sections/method}
\input{sections/results}
\bibliographystyle{plain}
\bibliography{references}
\end{document}`),make('method','sections/method.tex',String.raw`\section{Method}
A synthetic method description.`),make('results','sections/results.tex',String.raw`\section{Results}
Synthetic results.`),make('references','references.bib','@article{example2026,title={Research fixture}}')]
const job={id:'layout-job',project_id:pid,source_revision:5,status:'succeeded',compiler:'pdflatex',attempts:1,max_attempts:2,cancel_requested:false,pdf_available:true,created_at:now}
async function fixture(page:Page,baseURL:string,activeCompile=false){
 const origin=new URL(baseURL).origin
 expect(new URL(origin).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/)
 let requests=0
 const running={...job,id:"layout-running",status:"running",pdf_available:false}
 let current=running
 await page.routeWebSocket('**/*',socket=>socket.close())
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url())
  const api=url.pathname.startsWith('/api/v1/')&&(url.origin===origin||url.origin==='https://api.atoman.org')
  if(!api)return url.origin===origin&&!url.pathname.startsWith('/api/')?route.continue():route.abort()
  const headers={'access-control-allow-origin':origin,'access-control-allow-credentials':'true','access-control-allow-methods':'GET, OPTIONS, POST, PUT, DELETE','access-control-allow-headers':'content-type, x-csrf-token, authorization'}
  if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers})
  const path=url.pathname.slice('/api/v1'.length)
  const ok=(data:unknown)=>route.fulfill({headers,json:{data}})
  if(path==='/auth/session')return route.fulfill({headers,json:{csrf_token:'fixture-csrf',user:{uuid:'layout-owner',username:'owner',email:'fixture@example.test',role:'user',onboarding_completed_at:now}}})
  if(path==='/site/access')return route.fulfill({headers,json:{}})
  if(path==='/papers/access')return ok({allowed:true})
  if(path==='/papers/projects')return ok([project,{...project,id:'fixture-two',name:'Manuscript revision notes',head_revision:2,access_role:'editor'}])
  if(path===prefix)return ok(project)
  if(path===prefix+'/files')return ok(files.map(f=>({...f,content:''})))
  const f=files.find(f=>path===prefix+'/files/'+f.id)
  if(f){expect(route.request().method()).toBe('GET');return ok({...f,project_head_revision:5})}
  if(path===prefix+'/ai/capability')return ok({enabled:true,base_urls:['https://api.openai.com/v1'],custom_base_urls:true,model_discovery:true,max_source_bytes:49152,max_context_bytes:98304,max_extra_files:4,project_edits:true,max_history_turns:6,max_history_bytes:16384})
  if(path===prefix+'/files/main/collaboration')return ok({enabled:false})
  if(path===prefix+'/compile-capability')return ok({enabled:true,pdf_available:true,compilers:['pdflatex','xelatex']})
  if(path===prefix+'/compiles')return ok(activeCompile?[current,job]:[job])
  if(path===prefix+'/compiles/layout-running'){
   if(route.request().method()==='DELETE')current={...running,status:'cancelled',cancel_requested:true}
   return ok(current)
  }
  if(path===prefix+'/compiles/layout-job/pdf'){requests++;return route.fulfill({headers,contentType:'application/pdf',body:fixturePDF()})}
  return ok({items:[],total:0})
 })
 return ()=>requests
}
async function noPageOverflow(page:Page){
 const dimensions=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}))
 expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width+2)
}
test('desktop panels use independent space, preserve the loaded PDF, and remember resized widths',async({page,baseURL},info)=>{
 test.setTimeout(60000)
 await page.setViewportSize({width:1440,height:900})
 const pdfRequests=await fixture(page,baseURL!)
 await page.goto('/papers')
 await expect(page.getByRole('link',{name:/Reliable AI for Scientific Research/})).toBeVisible()
 await expect(page.getByRole('region',{name:'我的论文项目'})).toBeVisible()
 await noPageOverflow(page)
 if(process.env.PAPERS_LAYOUT_SCREENSHOTS)await page.screenshot({path:info.outputPath('desktop-home.png')})
 await page.getByRole('link',{name:/Reliable AI for Scientific Research/}).click()
 await expect(page.locator('.cm-content')).toContainText('Scientific workflows')
 await expect(page.locator('.paper-pdf__sheet[data-page="1"]')).toHaveAttribute('data-rendered','true')
 const editor=page.getByLabel('源码编辑',{exact:true})
 const old=await editor.boundingBox()
 expect(old!.height).toBeGreaterThan(450)
 expect(old!.width).toBeGreaterThan(300)
 if(process.env.PAPERS_LAYOUT_SCREENSHOTS)await page.screenshot({path:info.outputPath('desktop-editor.png')})
 await page.getByRole('button',{name:'参考文献',exact:true}).click()
 const tools=page.getByRole('complementary',{name:'项目工具工作区'})
 await expect(tools).toBeVisible()
 expect((await editor.boundingBox())!.height).toBeGreaterThanOrEqual(old!.height-2)
 expect((await tools.boundingBox())!.height).toBeGreaterThan(450)
 await expect(page.getByRole('complementary',{name:'编译预览'})).toBeHidden()
 await tools.getByRole('button',{name:'关闭',exact:true}).click()
 await expect(page.getByRole('complementary',{name:'编译预览'})).toBeVisible()
 expect(pdfRequests()).toBe(1)
 const beforePDF=(await page.getByRole('complementary',{name:'编译预览'}).boundingBox())!
 await page.getByRole('button',{name:'AI 助手',exact:true}).click()
 await expect(page.getByLabel('AI API Key')).toBeVisible()
 const ai=page.getByRole('complementary',{name:'AI 论文助手'})
 await expect(ai).toBeVisible()
 const bottomPDF=(await page.getByRole('complementary',{name:'编译预览'}).boundingBox())!
 const eb=(await editor.boundingBox())!,ab=(await ai.boundingBox())!
 expect(Math.abs(eb.x-ab.x)).toBeLessThanOrEqual(2)
 expect(Math.abs(eb.width-ab.width)).toBeLessThanOrEqual(2)
 expect(eb.y+eb.height).toBeLessThanOrEqual(ab.y+1)
 expect(Math.abs(beforePDF.width-bottomPDF.width)).toBeLessThanOrEqual(2)
 expect(Math.abs(beforePDF.height-bottomPDF.height)).toBeLessThanOrEqual(2)
 expect(pdfRequests()).toBe(1)
 if(process.env.PAPERS_LAYOUT_SCREENSHOTS)await page.screenshot({path:info.outputPath('desktop-ai.png')})
 await page.getByRole('button',{name:'展开工作区'}).click()
 await expect(editor).toBeHidden()
 await page.getByRole('button',{name:'恢复分栏'}).click()
 await expect(editor).toBeVisible()
 await page.getByRole('button',{name:'关闭 AI'}).click()
 const divider=page.getByRole('separator',{name:'调整文件栏宽度'})
 await divider.focus();await page.keyboard.press('ArrowRight')
 await expect(divider).toHaveAttribute('aria-valuenow','264')
 await page.reload()
 await expect(divider).toHaveAttribute('aria-valuenow','264')
 await divider.dblclick()
 await expect(divider).toHaveAttribute('aria-valuenow','248')
 await noPageOverflow(page)
 await page.setViewportSize({width:1024,height:768})
 await expect(editor).toBeVisible()
 await noPageOverflow(page)
 expect((await editor.boundingBox())!.width).toBeGreaterThan(280)
 if(process.env.PAPERS_LAYOUT_SCREENSHOTS)await page.screenshot({path:info.outputPath('tablet-editor.png')})
})
test('phone displays one work area, a file drawer, and accessible secondary tools',async({page,baseURL},info)=>{
 test.setTimeout(60000)
 await page.setViewportSize({width:390,height:844})
 await fixture(page,baseURL!)
 await page.goto('/papers')
 await expect(page.getByRole('link',{name:/Reliable AI for Scientific Research/})).toBeVisible()
 await noPageOverflow(page)
 if(process.env.PAPERS_LAYOUT_SCREENSHOTS)await page.screenshot({path:info.outputPath('mobile-home.png')})
 await page.getByRole('link',{name:/Reliable AI for Scientific Research/}).click()
 await expect(page.locator('.cm-content')).toContainText('Scientific workflows')
 const editor=page.getByLabel('源码编辑',{exact:true})
 const pdf=page.getByRole('complementary',{name:'编译预览'})
 const files=page.getByRole('complementary',{name:'论文文件'})
 await expect(editor).toBeVisible()
 await expect(pdf).toBeHidden()
 await expect(files).toBeHidden()
 expect((await editor.boundingBox())!.width).toBeGreaterThan(350)
 expect((await editor.boundingBox())!.height).toBeGreaterThan(400)
 await noPageOverflow(page)
 if(process.env.PAPERS_LAYOUT_SCREENSHOTS)await page.screenshot({path:info.outputPath('mobile-editor.png')})
 await page.getByRole('button',{name:'文件栏',exact:true}).click()
 await expect(files).toBeVisible()
 if(process.env.PAPERS_LAYOUT_SCREENSHOTS)await page.screenshot({path:info.outputPath('mobile-files.png')})
 await page.keyboard.press('Escape')
 await expect(files).toBeHidden()
 await page.getByRole('button',{name:'更多',exact:false}).click()
 await page.getByRole('button',{name:'投稿检查',exact:true}).click()
 await expect(editor).toBeHidden()
 const tools=page.getByRole('complementary',{name:'项目工具工作区'})
 await expect(tools).toBeVisible()
 expect((await tools.boundingBox())!.width).toBeGreaterThan(350)
 await tools.getByRole('button',{name:'检查当前保存版本'}).click()
 await expect(tools).toContainText('项目 v5')
 await tools.getByRole('button',{name:'关闭',exact:true}).click()
 await expect(editor).toBeVisible()
 await page.getByRole('button',{name:'AI 助手',exact:true}).click()
 await expect(editor).toBeVisible()
 const ai=page.getByRole('complementary',{name:'AI 论文助手'})
 await expect(ai).toBeVisible()
 expect((await ai.boundingBox())!.width).toBeGreaterThan(350)
 await expect(page.getByLabel('AI API Key')).toBeVisible()
 await noPageOverflow(page)
 if(process.env.PAPERS_LAYOUT_SCREENSHOTS)await page.screenshot({path:info.outputPath('mobile-ai.png')})
 expect((await editor.boundingBox())!.y+(await editor.boundingBox())!.height).toBeLessThanOrEqual((await ai.boundingBox())!.y+1)
 await page.getByLabel('AI API Key').fill('synthetic-mobile-layout-key')
 await page.getByRole('button',{name:'预览',exact:true}).click()
 await expect(pdf).toBeVisible()
 await expect(editor).toBeHidden()
 await expect(ai).toBeHidden()
 await expect(page.locator('.paper-pdf__sheet[data-page="1"]')).toHaveAttribute('data-rendered','true')
 if(process.env.PAPERS_LAYOUT_SCREENSHOTS)await page.screenshot({path:info.outputPath('mobile-pdf.png')})
 await page.getByRole('button',{name:'源码',exact:true}).click()
 await expect(editor).toBeVisible()
 await expect(pdf).toBeHidden()
 await expect(ai).toBeVisible()
 await expect(page.getByLabel('AI API Key')).toHaveValue('synthetic-mobile-layout-key')
 await ai.getByRole('button',{name:'收起 AI',exact:true}).click()
 await expect(page.getByLabel('AI API Key')).toBeHidden()
 await ai.getByRole('button',{name:'展开 AI',exact:true}).click()
 await expect(page.getByLabel('AI API Key')).toHaveValue('synthetic-mobile-layout-key')
 await noPageOverflow(page)
})

test('activity rail, quick open, tabs and focus mode retain editor, bottom AI and independent PDF',async({page,baseURL},info)=>{
 test.setTimeout(60000)
 await page.setViewportSize({width:1600,height:960})
 const pdfRequests=await fixture(page,baseURL!)
 await page.goto('/papers/'+pid)
 const editor=page.getByLabel('源码编辑',{exact:true})
 const rail=page.getByRole('navigation',{name:'项目工具'})
 const tabs=page.getByRole('navigation',{name:'已打开文件'})
 const pdf=page.getByRole('complementary',{name:'编译预览'})
 const filePane=page.getByRole('complementary',{name:'论文文件'})
 await expect(page.locator('.cm-content')).toContainText('Scientific workflows')
 await expect(page.locator('.paper-pdf__sheet[data-page="1"]')).toHaveAttribute('data-rendered','true')
 expect((await rail.boundingBox())!.width).toBeLessThan(60)
 await expect(tabs.getByRole('button',{name:'切换到 main.tex'})).toHaveAttribute('aria-current','page')
 await page.keyboard.press('Control+p')
 const dialog=page.getByRole('dialog',{name:'快速打开文件'})
 await expect(dialog).toBeVisible()
 const query=dialog.getByRole('textbox',{name:'快速搜索文件'})
 await query.fill('sections method')
 await query.press('Enter')
 await expect(dialog).toBeHidden()
 await expect(page.locator('.cm-content')).toContainText('A synthetic method description.')
 await expect(tabs.getByRole('button',{name:'切换到 sections/method.tex'})).toHaveAttribute('aria-current','page')
 await tabs.getByRole('button',{name:'切换到 main.tex'}).click()
 await expect(page.locator('.cm-content')).toContainText('Scientific workflows')
 await tabs.getByRole('button',{name:'关闭标签 sections/method.tex'}).click()
 await expect(tabs.getByRole('button',{name:'切换到 sections/method.tex'})).toHaveCount(0)
 const oldWidth=(await editor.boundingBox())!.width
 await page.getByRole('button',{name:'专注模式',exact:true}).click()
 await expect(rail).toBeHidden()
 await expect(pdf).toBeHidden()
 await expect(filePane).toBeHidden()
 expect((await editor.boundingBox())!.width).toBeGreaterThan(oldWidth*1.7)
 if(process.env.PAPERS_LAYOUT_SCREENSHOTS)await page.screenshot({path:info.outputPath('focus-editor.png')})
 await page.keyboard.press('Escape')
 await expect(pdf).toBeVisible()
 await expect(filePane).toBeVisible()
 await expect(rail).toBeVisible()
 await rail.getByRole('button',{name:'AI 助手',exact:true}).click()
 const ai=page.getByRole('complementary',{name:'AI 论文助手'})
 await expect(ai).toBeVisible()
 await page.getByLabel('AI API Key').fill('synthetic-pin-test-key')
 await expect(pdf).toBeVisible()
 const eb=(await editor.boundingBox())!,pb=(await pdf.boundingBox())!,ab=(await ai.boundingBox())!
 expect(Math.abs(eb.x-ab.x)).toBeLessThanOrEqual(2)
 expect(Math.abs(eb.width-ab.width)).toBeLessThanOrEqual(2)
 expect(eb.y+eb.height).toBeLessThanOrEqual(ab.y+1)
 expect(pb.x).toBeGreaterThan(eb.x+eb.width-2)
 expect(Math.abs(pb.height-(ab.y+ab.height-eb.y))).toBeLessThanOrEqual(2)
 expect(pdfRequests()).toBe(1)
 const resize=page.getByRole('separator',{name:'调整 AI 面板高度'})
 await expect(resize).toHaveAttribute('aria-valuenow','43')
 await resize.focus();await page.keyboard.press('ArrowUp')
 await expect(resize).toHaveAttribute('aria-valuenow','48')
 expect((await ai.boundingBox())!.height).toBeGreaterThan(ab.height+10)
 expect(Math.abs((await pdf.boundingBox())!.height-pb.height)).toBeLessThanOrEqual(2)
 await resize.dblclick()
 await expect(resize).toHaveAttribute('aria-valuenow','43')
 await ai.getByRole('button',{name:'任务',exact:true}).click()
 await expect(page.getByLabel('AI 修改指令')).toBeVisible()
 await page.getByLabel('AI 修改指令').fill('Synthetic bottom assistant task')
 await noPageOverflow(page)
 if(process.env.PAPERS_LAYOUT_SCREENSHOTS)await page.screenshot({path:info.outputPath('editor-pdf-ai.png')})
 await ai.getByRole('button',{name:'收起 AI',exact:true}).click()
 await expect(page.getByLabel('AI API Key')).toBeHidden()
 expect((await editor.boundingBox())!.height).toBeGreaterThan(eb.height+100)
 await ai.getByRole('button',{name:'展开 AI',exact:true}).click()
 await expect(page.getByLabel('AI API Key')).toHaveValue('synthetic-pin-test-key')
 await expect(page.getByLabel('AI 修改指令')).toHaveValue('Synthetic bottom assistant task')
 await page.getByRole('button',{name:'预览',exact:true}).click()
 await expect(pdf).toBeVisible()
 await expect(ai).toBeHidden()
 await page.getByRole('button',{name:'分栏',exact:true}).click()
 await expect(ai).toBeVisible()
 await expect(page.getByLabel('AI 修改指令')).toHaveValue('Synthetic bottom assistant task')
 expect(pdfRequests()).toBe(1)
 await resize.focus();await page.keyboard.press('ArrowUp')
 await page.reload()
 await page.getByRole('button',{name:'AI 助手',exact:true}).click()
 await expect(resize).toHaveAttribute('aria-valuenow','48')
 await expect(page.getByLabel('AI API Key')).toHaveValue('')
 await resize.dblclick()
 await ai.getByRole('button',{name:'关闭 AI'}).click()
 await expect(ai).toBeHidden()
 await expect(pdf).toBeVisible()
})

test('compact PDF controls keep the reading area visible while compiling',async({page,baseURL},info)=>{
 test.setTimeout(90000)
 await page.setViewportSize({width:1366,height:900})
 await fixture(page,baseURL!,true)
 await page.goto('/papers/'+pid)
 const pdf=page.getByRole('complementary',{name:'编译预览'})
 const heading=pdf.locator('.papers-workspace__preview-heading')
 const toolbar=pdf.locator('.paper-pdf__toolbar')
 await expect(pdf.locator('.paper-pdf__sheet[data-page="1"]')).toHaveAttribute('data-rendered','true',{timeout:30000})
 await expect(heading).toContainText('编译中')
 await expect(heading).toContainText('预览为上次成功版本')
 for(const width of [1600,1366,1200,1024,390]){
  await page.setViewportSize({width,height:900})
  if(width===390){
   await expect(page.locator('.papers-workspace')).toHaveClass(/papers-workspace--compact/)
   await page.getByRole('button',{name:'预览',exact:true}).click()
   await expect.poll(async()=>(await pdf.boundingBox())?.width??0).toBeGreaterThan(350)
  }else{
   await expect(page.locator('.papers-workspace')).not.toHaveClass(/papers-workspace--compact/)
   await expect(pdf).toBeVisible()
  }
  const bounds=await pdf.boundingBox()
  const h=await heading.boundingBox(),t=await toolbar.boundingBox()
  expect(h).not.toBeNull();expect(t).not.toBeNull()
  console.log('compact PDF metrics',JSON.stringify({viewport:width,panel:bounds!.width,heading:h!.height,toolbar:t!.height}))
  // The shared mobile select deliberately retains a 44px tap target.
  expect(h!.height+t!.height).toBeLessThanOrEqual(width===390?130:100)
  if(bounds!.width>=350)expect(t!.height).toBeLessThanOrEqual(width===390?52:40)
  await expect(pdf.getByRole('button',{name:'下载 PDF',exact:true})).toBeVisible()
  await expect(pdf.getByRole('button',{name:'取消任务',exact:true})).toBeVisible()
  for(const el of await toolbar.getByRole('button').all()){
   const r=await el.boundingBox()
   if(r){expect(r.x).toBeGreaterThanOrEqual(bounds!.x-1);expect(r.x+r.width).toBeLessThanOrEqual(bounds!.x+bounds!.width+1)}
  }
  await noPageOverflow(page)
  if(process.env.PAPERS_LAYOUT_SCREENSHOTS)await pdf.screenshot({path:info.outputPath('compact-pdf-'+width+'.png')})
 }
 await pdf.getByRole('button',{name:'取消任务',exact:true}).click()
 await expect(pdf.getByRole('button',{name:'取消任务',exact:true})).toHaveCount(0)
 await expect(pdf.locator('.paper-pdf__sheet[data-page="1"]')).toHaveAttribute('data-rendered','true')
})


test('the whole workbench uses compact chrome and preserves file, editor and AI actions',async({page,baseURL},info)=>{
 test.setTimeout(90000)
 await page.setViewportSize({width:1440,height:900})
 await fixture(page,baseURL!)
 await page.goto('/papers/'+pid)
 const root=page.locator('.papers-workspace')
 const header=root.locator('.papers-workspace__header')
 const files=root.getByRole('complementary',{name:'论文文件'})
 const source=root.getByLabel('源码编辑',{exact:true})
 await expect(source.locator('.cm-content')).toContainText('Scientific workflows',{timeout:30000})
 await expect(root.locator('.paper-pdf__sheet[data-page="1"]')).toHaveAttribute('data-rendered','true')
 const fileHeading=files.locator('.papers-workspace__files-heading')
 const fileSearch=files.locator('.papers-workspace__files-toolbar')
 const tabs=source.locator('.papers-workspace__tabs')
 const editorHeading=source.locator('.papers-workspace__editor-header')
 const editorHost=source.locator('.latex-editor-host')
 const editorTools=source.locator('.latex-editor-tools')
 const heights=async()=>({
  header:(await header.boundingBox())!.height,
  files:(await fileHeading.boundingBox())!.height+(await fileSearch.boundingBox())!.height,
  editorTop:(await tabs.boundingBox())!.height+(await editorHeading.boundingBox())!.height,
  editorFooter:(await editorTools.boundingBox())!.height,
  code:(await editorHost.boundingBox())!.height,
 })
 for(const width of [1600,1440,1024]){
  await page.setViewportSize({width,height:900})
  await expect(root).not.toHaveClass(/papers-workspace--compact/)
  const m=await heights()
  console.log('workbench metrics',JSON.stringify({viewport:width,...m}))
  expect(m.header).toBeLessThanOrEqual(46)
  expect(m.files).toBeLessThanOrEqual(70)
  expect(m.editorTop).toBeLessThanOrEqual(70)
  expect(m.editorFooter).toBeLessThanOrEqual(34)
  expect(m.code).toBeGreaterThan(450)
  const code=await editorHost.boundingBox(),tools=await editorTools.boundingBox()
  expect(code!.y+code!.height).toBeLessThanOrEqual(tools!.y+1)
  await noPageOverflow(page)
 }
 await page.setViewportSize({width:1440,height:900})
 await fileHeading.getByRole('button',{name:'新建文本文件',exact:true}).click()
 await expect(files.getByRole('textbox',{name:'新建文本文件',exact:true})).toBeVisible()
 await fileHeading.getByRole('button',{name:'新建文本文件',exact:true}).click()
 await expect(files.getByRole('textbox',{name:'新建文本文件',exact:true})).toBeHidden()
 await fileHeading.getByRole('button',{name:'上传文件',exact:true}).click()
 await expect(files.getByText('上传到目录（可选）')).toBeVisible()
 await fileHeading.getByRole('button',{name:'上传文件',exact:true}).click()
 await expect(files.getByText('上传到目录（可选）')).toBeHidden()
 await page.getByRole('button',{name:'AI 助手',exact:true}).click()
 const ai=root.getByRole('complementary',{name:'AI 论文助手'})
 const aiStatus=ai.locator('.paper-ai__workbench')
 await expect(ai.getByLabel('AI API Key')).toBeVisible()
 await expect(aiStatus).toContainText('拥有者审批')
 const aiNav=await ai.locator('.paper-ai__navigation').boundingBox()
 const aiSummary=await aiStatus.boundingBox()
 console.log('AI compact metrics',JSON.stringify({navigation:aiNav!.height,summary:aiSummary!.height}))
 expect(aiNav!.height).toBeLessThanOrEqual(40)
 expect(aiSummary!.height).toBeLessThanOrEqual(112)
 await ai.getByText(/流程 .*审批说明/).click()
 await expect(ai.locator('.paper-ai__workflow')).toHaveAttribute('open','')
 await ai.getByText(/流程 .*审批说明/).click()
 await ai.getByRole('button',{name:'任务',exact:true}).click()
 await expect(ai.getByLabel('AI 修改指令')).toBeVisible()
 await ai.getByLabel('AI 修改指令').fill('Synthetic layout task')
 if(process.env.PAPERS_LAYOUT_SCREENSHOTS)await page.screenshot({path:info.outputPath('optimized-workbench.png')})
 await ai.getByRole('button',{name:'收起 AI',exact:true}).click()
 await expect(ai.getByLabel('AI 修改指令')).toBeHidden()
 expect((await ai.boundingBox())!.height).toBeLessThanOrEqual(40)
 await ai.getByRole('button',{name:'展开 AI',exact:true}).click()
 await expect(ai.getByLabel('AI 修改指令')).toHaveValue('Synthetic layout task')
 await page.setViewportSize({width:390,height:844})
 await expect(root).toHaveClass(/papers-workspace--compact/)
 await expect(header).toBeVisible()
 await noPageOverflow(page)
 await page.getByRole('button',{name:'预览',exact:true}).click()
 await expect(root.locator('.paper-pdf__sheet[data-page="1"]')).toHaveAttribute('data-rendered','true')
 await noPageOverflow(page)
})
