import {describe,it,expect} from 'vitest'
import {webcrypto} from 'node:crypto'
import {aiVaultStorageKey,openAIVault,commitAIVault,validAICheckpoint,validAIProfile} from '@/components/papers/aiVault'
const crypto=webcrypto as unknown as Crypto
function storage(){
 const values=new Map<string,string>()
 return {get length(){return values.size},clear:()=>values.clear(),key:(i:number)=>[...values.keys()][i]??null,getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v)},removeItem:(k:string)=>{values.delete(k)}} as Storage
}
const pass='synthetic vault passphrase'
const profile={id:'profile',name:'Synthetic provider',baseURL:'https://api.example.net/v1',model:'test-model',key:'synthetic-fixture-key'}
const session={projectId:'project',fileId:'file',revision:7,baseURL:profile.baseURL,model:profile.model,task:'project' as const,instruction:'Synthetic manuscript instruction',history:[{task:'project' as const,instruction:'Review',reply:'Synthetic proposal'}],updatedAt:123}
describe('encrypted Papers vault',()=>{
 it('persists ciphertext and reopens with the correct passphrase',async()=>{
  const s=storage(),v=await openAIVault(s,'owner',pass,()=>true,crypto)
  const saved=await commitAIVault(s,v,{profiles:[profile],sessions:[session]},()=>true,crypto)
  const raw=s.getItem(aiVaultStorageKey('owner'))!
  for(const value of [profile.key,profile.name,session.instruction,pass])expect(raw).not.toContain(value)
  expect(saved.key.extractable).toBe(false)
  const opened=await openAIVault(s,'owner',pass,()=>true,crypto)
  expect(opened.data).toEqual({profiles:[profile],sessions:[session]})
  await expect(openAIVault(s,'owner','incorrect passphrase',()=>true,crypto)).rejects.toThrow()
  s.setItem(aiVaultStorageKey('other-owner'),raw)
  await expect(openAIVault(s,'other-owner',pass,()=>true,crypto)).rejects.toThrow()
 },15000)
 it('rejects stale updates and invalid records',async()=>{
  const s=storage(),v=await openAIVault(s,'owner',pass,()=>true,crypto)
  const newer=await commitAIVault(s,v,{profiles:[profile],sessions:[]},()=>true,crypto)
  await expect(commitAIVault(s,v,{profiles:[],sessions:[session]},()=>true,crypto)).rejects.toThrow()
  await expect(commitAIVault(s,newer,{profiles:[],sessions:[]},()=>false,crypto)).rejects.toThrow()
  expect(validAIProfile({...profile,baseURL:'https://127.0.0.1/v1'})).toBe(false)
  expect(validAICheckpoint({...session,revision:0})).toBe(false)
 },15000)
})
