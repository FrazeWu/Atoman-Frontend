import {describe,it,expect,vi,afterEach} from 'vitest'
import {webcrypto,createHash} from 'node:crypto'
import {validGitHubRepo,validGitHubBranch,validGitPaperPath,validateGitSources,checkGitOverlay,publishGitHubBranch,type GitHubPlan} from '@/components/papers/githubPapers'
const commit='a'.repeat(40),tree='b'.repeat(40)
const plan:GitHubPlan={repository:'example-owner/example-paper',branch:'main',private:true,commit,tree,entries:[],included:[],excluded:[]}
const sources=[{path:'main.tex',data:new TextEncoder().encode('Synthetic paper')}]
afterEach(()=>vi.unstubAllGlobals())
describe('GitHub source validation',()=>{
 it('rejects incompatible names, traversal and conflicting source paths',()=>{
  expect(validGitHubRepo(plan.repository)).toBe(true)
  expect(validGitHubRepo('https://example.org/a/b')).toBe(false)
  expect(validGitHubBranch('feature/tex')).toBe(true)
  expect(validGitHubBranch('feature/../main')).toBe(false)
  expect(validGitPaperPath('figures/图 1.pdf')).toBe(true)
  expect(validGitPaperPath('../main.tex')).toBe(false)
  expect(validGitPaperPath('build.sh')).toBe(false)
  expect(()=>validateGitSources([...sources,{path:'MAIN.tex',data:sources[0]!.data}])).toThrow()
 })
 it('rejects a colliding case or symlink in the base tree',()=>{
  expect(()=>checkGitOverlay({...plan,entries:[{path:'MAIN.tex',type:'blob',mode:'100644',sha:commit}]},sources)).toThrow()
  expect(()=>checkGitOverlay({...plan,entries:[{path:'main.tex',type:'blob',mode:'120000',sha:commit}]},sources)).toThrow()
  expect(checkGitOverlay({...plan,entries:[{path:'main.tex',type:'blob',mode:'100644',sha:commit}]},sources)).toEqual(['main.tex'])
 })
 it('does not create a reference if repository visibility changes during publication',async()=>{
  vi.stubGlobal('crypto',webcrypto)
  const blob=createHash('sha1').update('blob '+sources[0]!.data.length+String.fromCharCode(0)).update(sources[0]!.data).digest('hex')
  const newTree='c'.repeat(40),newCommit='d'.repeat(40)
  let checks=0
  const requests:{url:string;method:string}[]=[]
  const fetcher=vi.fn(async(url:string,init:RequestInit)=>{
   requests.push({url,method:String(init.method)})
   let data:unknown
   if(url.endsWith('/example-paper'))data={full_name:plan.repository,private:++checks<5}
   else if(url.endsWith('/git/ref/heads/main'))data={ref:'refs/heads/main',object:{type:'commit',sha:commit}}
   else if(url.endsWith('/git/blobs'))data={sha:blob}
   else if(url.endsWith('/git/trees'))data={sha:newTree}
   else if(url.endsWith('/git/commits'))data={sha:newCommit}
   else throw Error('Unexpected write')
   return new Response(JSON.stringify(data))
  })
  vi.stubGlobal('fetch',fetcher)
  await expect(publishGitHubBranch({repository:plan.repository,branch:'main',token:'synthetic-test-only'},plan,sources,'papers-export-test',new AbortController().signal,()=>true)).rejects.toThrow('visibility changed')
  expect(requests.some(r=>r.url.endsWith('/git/commits'))).toBe(true)
  expect(requests.some(r=>r.url.endsWith('/git/refs'))).toBe(false)
 })
 it('rejects a case-colliding parent directory',()=>{
  expect(()=>checkGitOverlay({...plan,entries:[{path:'Sections',mode:'040000',type:'tree',sha:tree}]},[...sources,{path:'sections/method.tex',data:sources[0]!.data}])).toThrow('目录冲突')
 })
 it('does not submit source when repository visibility changes',async()=>{
  const fetcher=vi.fn(async()=>new Response(JSON.stringify({full_name:plan.repository,private:false})))
  vi.stubGlobal('fetch',fetcher)
  await expect(publishGitHubBranch({repository:plan.repository,branch:'main',token:'synthetic-test-only'},plan,sources,'papers-export-test',new AbortController().signal,()=>true)).rejects.toThrow('visibility changed')
  expect(fetcher).toHaveBeenCalledTimes(1)
 })
 it('does not submit source when the base branch has changed',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({full_name:plan.repository,private:true}))).mockResolvedValueOnce(new Response(JSON.stringify({ref:'refs/heads/main',object:{type:'commit',sha:'c'.repeat(40)}})))
  vi.stubGlobal('fetch',fetcher)
  await expect(publishGitHubBranch({repository:plan.repository,branch:'main',token:'synthetic-test-only'},plan,sources,'papers-export-test',new AbortController().signal,()=>true)).rejects.toThrow('Base branch changed')
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(fetcher.mock.calls.every(args=>args[1].method==='GET')).toBe(true)
 })
})
