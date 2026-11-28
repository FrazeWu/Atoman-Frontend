import {test,expect} from '@playwright/test'

test('contextual completion uses project symbols and paths without loading the project upfront',async({page,baseURL})=>{
 test.setTimeout(90000)
 const origin=new URL(baseURL!).origin
 expect(new URL(origin).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/)
 const pid='completion-fixture',prefix='/papers/projects/'+pid,now='2026-11-28T00:00:00Z'
 let head=1
 const main={id:'main',path:'main.tex',kind:'text',revision:1,content:'Introduction',sha256:'',created_at:now,updated_at:now}
 const method={...main,id:'method',path:'sections/method.tex',content:String.raw`\label{sec:method}
\newcommand{\researchModel}{Model}
\newenvironment{researchResult}{}{}`}
 const bib={...main,id:'bib',path:'references.bib',content:'@article{smith2026,title={Synthetic paper}}'}
 const image={...main,id:'image',path:'figures/ablation.png',kind:'binary',content:''}
 const files=[main,method,bib,image]
 const reads=new Map<string,number>()
 await page.routeWebSocket('**/*',socket=>socket.close())
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url())
  const api=url.pathname.startsWith('/api/v1/')&&(url.origin===origin||url.origin==='https://api.atoman.org')
  if(!api)return url.origin===origin&&!url.pathname.startsWith('/api/')?route.continue():route.abort()
  const headers={'access-control-allow-origin':origin,'access-control-allow-credentials':'true','access-control-allow-methods':'GET, OPTIONS, POST, PUT, DELETE','access-control-allow-headers':'content-type, x-csrf-token, authorization'}
  if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers})
  const path=url.pathname.slice('/api/v1'.length)
  const ok=(data:unknown)=>route.fulfill({headers,json:{data}})
  if(path==='/auth/session')return route.fulfill({headers,json:{csrf_token:'fixture-csrf',user:{uuid:'completion-owner',username:'owner',email:'fixture@example.test',role:'user',onboarding_completed_at:now}}})
  if(path==='/site/access')return route.fulfill({headers,json:{}})
  if(path===prefix)return ok({id:pid,name:'Completion fixture',main_file_id:'main',head_revision:head,access_role:'owner',created_at:now,updated_at:now})
  if(path===prefix+'/files')return ok(files.map(f=>({...f,content:''})))
  if(path===prefix+'/compile-capability')return ok({enabled:false,pdf_available:false})
  if(path===prefix+'/files/main/collaboration')return ok({enabled:false})
  const file=files.find(f=>path===prefix+'/files/'+f.id)
  if(file){
   if(route.request().method()==='PUT'){
    expect(file.id).toBe('main')
    const request=route.request().postDataJSON()
    expect(request.base_revision).toBe(main.revision)
    main.content=request.content;main.revision++;head++
   }else reads.set(file.id,(reads.get(file.id)||0)+1)
   return ok({...file,project_head_revision:head})
  }
  return ok({items:[],total:0})
 })
 await page.goto('/papers/'+pid)
 const editor=page.locator('.cm-content')
 await expect(editor).toHaveText('Introduction',{timeout:30000})
 expect(reads.get('method')||0).toBe(0)
 expect(reads.get('image')||0).toBe(0)

 async function replaceAndComplete(source:string,option:string,expected:string){
  await editor.click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.insertText(source)
  await page.keyboard.press('Control+Space')
  const candidate=page.locator('.cm-tooltip-autocomplete [role="option"]').filter({has:page.locator('.cm-completionLabel',{hasText:option})})
  await expect(candidate.first()).toBeVisible({timeout:15000})
  await candidate.first().click()
  await expect(editor).toHaveText(expected)
 }
 // Path completion uses the existing manifest and does not read file bodies.
 await replaceAndComplete(String.raw`\includegraphics[width=.8\linewidth]{figures/abl`,'figures/ablation.png',String.raw`\includegraphics[width=.8\linewidth]{figures/ablation.png`)
 expect(reads.get('method')||0).toBe(0)
 expect(reads.get('image')||0).toBe(0)
 // Reference completion lazily reads the cross-file symbol index.
 await replaceAndComplete(String.raw`\ref{sec:met`,'sec:method',String.raw`\ref{sec:method`)
 expect(reads.get('method')).toBe(1)
 await replaceAndComplete(String.raw`\researchM`,'researchModel',String.raw`\researchModel`)
 await replaceAndComplete(String.raw`\begin{researchR`,'researchResult',String.raw`\begin{researchResult`)
 await replaceAndComplete(String.raw`\citep[see]{sm`,'smith2026',String.raw`\citep[see]{smith2026`)
 expect(reads.get('method')).toBe(1)
 expect(reads.get('image')||0).toBe(0)

 // Lint uses the live document, does not automatically read project files,
 // and never blocks saving a syntactically incomplete draft.
 const invalid=String.raw`\begin{align}
 \end{equation}
 \label{local}
 \label{local}
 \ref{sec:method}
 \ref{missing-label}
 \cite{smith2026,missing-citation}
 \input{sections/missing}
 }`
 await editor.click()
 await page.keyboard.press('ControlOrMeta+a')
 await page.keyboard.insertText(invalid)
 await expect(editor).toContainText('missing-citation')
 await expect(page.locator('.cm-lintRange-error').first()).toBeVisible()
 await page.getByRole('button',{name:'源码检查',exact:true}).click()
 const panel=page.getByRole('region',{name:'源码检查结果'})
 await expect(panel).toContainText('环境结束标记不匹配')
 await expect(panel).toContainText('当前文件重复定义标签 local')
 await expect(panel).toContainText('项目文件列表中未找到 sections/missing')
 await expect(panel).not.toContainText('项目静态索引中未找到')
 expect(reads.get('method')).toBe(1)
 await expect(page.locator('.papers-workspace__save-state')).toContainText('已保存',{timeout:15000})
 await panel.getByRole('button',{name:'检查项目引用',exact:true}).click()
 await expect(panel).toContainText('项目静态引用已检查')
 await expect(panel).toContainText('项目静态索引中未找到标签 missing-label')
 await expect(panel).toContainText('项目静态索引中未找到文献键 missing-citation')
 await expect(panel).not.toContainText('未找到标签 sec:method')
 await expect(panel).not.toContainText('未找到文献键 smith2026')
 expect(reads.get('method')).toBe(2)
 expect(reads.get('image')||0).toBe(0)
 const problem=panel.locator('.latex-lint-panel__row').filter({hasText:'未找到标签 missing-label'})
 await problem.click()
 await expect(page.locator('.latex-editor-tools > span')).toContainText('行 6')
 await editor.click()
 await page.keyboard.press('ControlOrMeta+a')
 await page.keyboard.insertText(String.raw`\ref{sec:method} \cite{smith2026}`)
 await expect(panel).toContainText('未发现当前检查范围内的问题')
 await expect(page.locator('.cm-lintRange-error,.cm-lintRange-warning')).toHaveCount(0)
 await page.setViewportSize({width:390,height:844})
 await expect(panel).toBeVisible()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true)
})
