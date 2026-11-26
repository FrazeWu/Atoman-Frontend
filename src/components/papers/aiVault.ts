import type {PaperAIHistoryTurn,PaperAITask} from '@/api/papersAI'
import {validPaperAIBase,validPaperAIKey,paperAIModelPattern} from './aiProvider'
import {paperAIBytes} from './aiSuggestion'

const prefix='atoman.papers.ai-vault.v1:'
const MAX_RAW=1024*1024,MAX_DATA=512*1024,ITERATIONS=600000
const idPattern=/^[A-Za-z0-9_-]{1,128}$/
const modes=new Set(['revise','explain','project'])
export interface AIProfile {id:string;name:string;baseURL:string;model:string;key:string}
export interface AISessionCheckpoint {projectId:string;fileId:string;revision:number;baseURL:string;model:string;task:PaperAITask;instruction:string;history:PaperAIHistoryTurn[];updatedAt:number}
export interface AIVaultData {profiles:AIProfile[];sessions:AISessionCheckpoint[]}
interface Envelope {v:1;salt:string;iv:string;data:string}
export interface UnlockedAIVault {owner:string;raw:string;salt:string;key:CryptoKey;data:AIVaultData}
const bounded=(v:unknown,n:number):v is string=>typeof v==='string'&&v.length<=n&&!v.includes(String.fromCharCode(0))&&paperAIBytes(v)<=n
const validId=(v:unknown):v is string=>typeof v==='string'&&idPattern.test(v)
const modelValid=(v:unknown):v is string=>typeof v==='string'&&paperAIModelPattern.test(v)
const baseValid=(v:unknown):v is string=>typeof v==='string'&&validPaperAIBase(v,true,[])
export function validAIProfile(v:unknown):v is AIProfile{
 if(!v||typeof v!=='object')return false
 const p=v as AIProfile
 return validId(p.id)&&bounded(p.name,100)&&!!p.name.trim()&&baseValid(p.baseURL)&&modelValid(p.model)&&typeof p.key==='string'&&validPaperAIKey(p.key)&&!p.baseURL.includes(p.key)&&!p.model.includes(p.key)
}
export function validAICheckpoint(v:unknown):v is AISessionCheckpoint{
 if(!v||typeof v!=='object')return false
 const s=v as AISessionCheckpoint
 return validId(s.projectId)&&validId(s.fileId)&&Number.isSafeInteger(s.revision)&&s.revision>0&&baseValid(s.baseURL)&&modelValid(s.model)&&modes.has(s.task)&&bounded(s.instruction,4000)&&Number.isSafeInteger(s.updatedAt)&&s.updatedAt>0&&Array.isArray(s.history)&&s.history.length<=6&&s.history.every(t=>!!t&&modes.has(t.task)&&bounded(t.instruction,4000)&&bounded(t.reply,16384))&&s.history.reduce((n,t)=>n+paperAIBytes(t.instruction)+paperAIBytes(t.reply),0)<=16384
}
function validateData(value:unknown):AIVaultData{
 if(!value||typeof value!=='object')throw Error('Invalid vault')
 const data=value as AIVaultData
 if(!Array.isArray(data.profiles)||data.profiles.length>10||!data.profiles.every(validAIProfile)||new Set(data.profiles.map(p=>p.id)).size!==data.profiles.length||!Array.isArray(data.sessions)||data.sessions.length>20||!data.sessions.every(validAICheckpoint)||new Set(data.sessions.map(s=>s.projectId)).size!==data.sessions.length)throw Error('Invalid vault')
 // Reconstruct only the documented fields; never persist unexpected data.
 return {profiles:data.profiles.map(({id,name,baseURL,model,key})=>({id,name,baseURL,model,key})),sessions:data.sessions.map(({projectId,fileId,revision,baseURL,model,task,instruction,history,updatedAt})=>({projectId,fileId,revision,baseURL,model,task,instruction,history:history.map(({task,instruction,reply})=>({task,instruction,reply})),updatedAt}))}
}
export function aiVaultStorageKey(owner:string){
 if(!validId(owner))throw Error('Invalid account')
 return prefix+owner
}
function encode(bytes:Uint8Array){
 let binary=''
 for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192))
 return btoa(binary)
}
function decode(value:unknown,max:number):Uint8Array<ArrayBuffer>{
 if(typeof value!=='string'||value.length>Math.ceil(max/3)*4||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))throw Error('Invalid vault')
 const raw=atob(value)
 if(raw.length>max)throw Error('Invalid vault')
 return Uint8Array.from(raw,c=>c.charCodeAt(0))
}
function passBytes(passphrase:string){
 if(typeof passphrase!=='string'||Array.from(passphrase).length<12||paperAIBytes(passphrase)>1024)throw Error('Passphrase must contain at least 12 characters')
 return new TextEncoder().encode(passphrase)
}
async function derive(passphrase:string,salt:Uint8Array<ArrayBuffer>,crypto:Crypto){
 const bytes=passBytes(passphrase)
 try{
  const material=await crypto.subtle.importKey('raw',bytes,'PBKDF2',false,['deriveKey'])
  return await crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:ITERATIONS},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])
 }finally{bytes.fill(0)}
}
function aad(owner:string){return new TextEncoder().encode(aiVaultStorageKey(owner))}
async function seal(owner:string,salt:string,key:CryptoKey,data:AIVaultData,crypto:Crypto){
 const valid=validateData(data)
 const plain=new TextEncoder().encode(JSON.stringify(valid))
 if(plain.length>MAX_DATA)throw Error('Vault full')
 const iv=crypto.getRandomValues(new Uint8Array(12))
 try{
  const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(owner)},key,plain)
  const envelope:Envelope={v:1,salt,iv:encode(iv),data:encode(new Uint8Array(cipher))}
  return {raw:JSON.stringify(envelope),data:valid}
 }finally{plain.fill(0)}
}
function checkCrypto(crypto:Crypto){if(!crypto?.subtle||!crypto.getRandomValues)throw Error('Secure browser cryptography unavailable')}
function replace(storage:Storage,owner:string,expected:string|null,value:string,valid:()=>boolean){
 const k=aiVaultStorageKey(owner)
 if(!valid()||storage.getItem(k)!==expected)throw Error('Vault changed; reopen it')
 storage.setItem(k,value)
}
export async function openAIVault(storage:Storage,owner:string,passphrase:string,valid:()=>boolean=()=>true,crypto:Crypto=globalThis.crypto):Promise<UnlockedAIVault>{
 checkCrypto(crypto)
 const k=aiVaultStorageKey(owner),raw=storage.getItem(k)
 if(!valid())throw Error('Scope changed')
 if(raw===null){
  const salt=crypto.getRandomValues(new Uint8Array(16)),encoded=encode(salt),key=await derive(passphrase,salt,crypto)
  const next=await seal(owner,encoded,key,{profiles:[],sessions:[]},crypto)
  replace(storage,owner,null,next.raw,valid)
  return {owner,raw:next.raw,salt:encoded,key,data:next.data}
 }
 if(raw.length>MAX_RAW)throw Error('Invalid vault')
 const value=JSON.parse(raw) as Envelope
 if(value.v!==1)throw Error('Unsupported vault')
 const salt=decode(value.salt,16),iv=decode(value.iv,12),cipher=decode(value.data,MAX_DATA+16)
 if(salt.length!==16||iv.length!==12||cipher.length<16)throw Error('Invalid vault')
 const key=await derive(passphrase,salt,crypto)
 const plain=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:aad(owner)},key,cipher))
 try{
  if(!valid()||storage.getItem(k)!==raw)throw Error('Vault changed; reopen it')
  return {owner,raw,salt:value.salt,key,data:validateData(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(plain)))}
 }finally{plain.fill(0)}
}
export async function commitAIVault(storage:Storage,vault:UnlockedAIVault,data:AIVaultData,valid:()=>boolean=()=>true,crypto:Crypto=globalThis.crypto):Promise<UnlockedAIVault>{
 checkCrypto(crypto)
 const next=await seal(vault.owner,vault.salt,vault.key,data,crypto)
 replace(storage,vault.owner,vault.raw,next.raw,valid)
 return {...vault,raw:next.raw,data:next.data}
}
