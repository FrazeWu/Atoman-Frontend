import {describe,it,expect,vi,afterEach} from 'vitest'
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
