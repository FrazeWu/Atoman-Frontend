import {test,expect} from '@playwright/test'
import JSZip from 'jszip'

if(process.env.CHROME_BIN)test.use({launchOptions:{executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']}})

test('creates a complete Chinese manuscript through the real template UI and respects the compiler capability',async({page,baseURL})=>{
  test.setTimeout(120000)
  const origin=new URL(baseURL!).origin
  expect(new URL(origin).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/)
  const time='2026-11-25T00:00:00Z'
  const prefix='/papers/projects/template-project'
  let imports=0
  let project:{id:string;name:string;head_revision:number;main_file_id:string;created_at:string;updated_at:string}|undefined
  let files:Array<{id:string;path:string;kind:'text';content:string;revision:number;sha256:string;created_at:string;updated_at:string}>=[]
  await page.routeWebSocket('**/*',socket=>socket.close())
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url())
    const fixtureAPI=url.pathname.startsWith('/api/v1/')&&(url.origin===origin||url.origin==='https://api.atoman.org')
    if(!fixtureAPI)return url.origin===origin&&!url.pathname.startsWith('/api/')&&!url.pathname.startsWith('/uploads/')&&!url.pathname.startsWith('/__object-storage/')?route.continue():route.abort()
    const cors={'access-control-allow-origin':origin,'access-control-allow-credentials':'true','access-control-allow-methods':'GET, OPTIONS, POST, PUT, DELETE','access-control-allow-headers':'content-type, x-csrf-token, authorization'}
    if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:cors})
    const path=url.pathname.slice('/api/v1'.length)
    const ok=(data:unknown)=>route.fulfill({headers:cors,json:{data}})
    if(path==='/auth/session')return route.fulfill({headers:cors,json:{csrf_token:'fixture-csrf',user:{uuid:'fixture-user',username:'fixture',email:'fixture@example.test',role:'user',onboarding_completed_at:time}}})
    if(path==='/site/access')return route.fulfill({headers:cors,json:{}})
    if(path==='/papers/access')return ok({allowed:true})
    if(path==='/papers/projects')return ok(project?[project]:[])
    if(path==='/papers/projects/import'&&route.request().method()==='POST'){
      imports++
      expect(url.searchParams.get('main_file')).toBe('main.tex')
      expect(url.searchParams.get('name')).toBe('Dissertation fixture')
      const raw=route.request().postDataBuffer()
      expect(raw).not.toBeNull()
      const zip=await JSZip.loadAsync(raw!)
      files=[]
      for(const entry of Object.values(zip.files)){
        expect(entry.dir).toBe(false)
        files.push({id:entry.name==='main.tex'?'main':'file-'+files.length,path:entry.name,kind:'text',content:await entry.async('string'),revision:1,sha256:'',created_at:time,updated_at:time})
      }
      expect(files.find(f=>f.path==='main.tex')?.content).toContain('ctexbook')
      expect(files.some(f=>f.path==='references.bib')).toBe(true)
      expect(files.filter(f=>f.path.startsWith('sections/'))).toHaveLength(5)
      project={id:'template-project',name:'Dissertation fixture',head_revision:1,main_file_id:'main',created_at:time,updated_at:time}
      return ok(project)
    }
    if(path===prefix)return ok(project)
    if(path===prefix+'/files')return ok(files)
    if(path.startsWith(prefix+'/files/'))return ok(files.find(f=>f.id===path.slice((prefix+'/files/').length)))
    if(path===prefix+'/compile-capability')return ok({enabled:true,pdf_available:true,compilers:['pdflatex','xelatex']})
    if(path===prefix+'/compiles')return ok([])
    return ok({items:[],total:0})
  })
  await page.goto('/papers')
  await page.getByRole('button',{name:'模板库',exact:true}).click({timeout:30000})
  const library=page.getByRole('region',{name:'论文模板库'})
  await expect(library.locator('.paper-templates__card')).toHaveCount(8)
  await library.getByLabel('搜索论文模板').fill('ACL')
  await expect(library.locator('.paper-templates__card')).toHaveCount(1)
  await expect(library).toContainText('非官方投稿格式')
  await expect(library.getByRole('link',{name:'官方模板与说明'})).toHaveAttribute('href','https://github.com/acl-org/acl-style-files')
  await library.getByLabel('搜索论文模板').fill('')
  await library.getByRole('button',{name:'中文论文',exact:true}).click()
  await expect(library.locator('.paper-templates__card')).toHaveCount(2)
  await library.locator('.paper-templates__card').filter({hasText:'中文学位论文通用稿'}).getByRole('button',{name:'选择模板',exact:true}).click()
  await page.locator('#paper-project-name').fill('Dissertation fixture')
  await page.getByRole('button',{name:'从模板创建',exact:true}).click()
  await expect(page).toHaveURL(/\/papers\/template-project$/)
  await expect(page.locator('.cm-content')).toContainText('ctexbook',{timeout:30000})
  await expect(page.getByLabel('TeX 编译器')).toHaveValue('xelatex')
  expect(imports).toBe(1)
})
