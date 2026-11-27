import {describe,expect,it} from 'vitest'
import {normalizePaperAIBase,paperAIModelBaseCandidates,paperAIProviderDiagnostic,validPaperAIBase,validPaperAIKey,paperAIModelPattern} from '@/components/papers/aiProvider'
describe('custom public AI endpoint policy',()=>{
 it('accepts public HTTPS compatible base paths and preserves the allowlist fallback',()=>{
  for(const url of ['https://api.deepseek.com/v1/','https://open.bigmodel.cn/api/paas/v4','https://api.example.net'])expect(validPaperAIBase(url,true,[])).toBe(true)
  expect(validPaperAIBase('https://api.example.net',false,['https://api.openai.com/v1'])).toBe(false)
  expect(validPaperAIBase('https://api.openai.com/v1/',false,['https://api.openai.com/v1'])).toBe(true)
 })
 it('rejects private and malformed addresses before sending a credential',()=>{
  for(const url of ['http://api.example.net/v1','https://127.0.0.1/v1','https://[::1]/v1','https://metadata.google.internal/v1','https://router.local/v1','https://api.atoman.org/v1','https://api.example.net:8443/v1','https://api.example.net/v1?key=x','https://u:p@api.example.net/v1','https://api.example.net/%2e%2e','https://a..example.net/v1'])expect(validPaperAIBase(url,true,[]),url).toBe(false)
  expect(validPaperAIKey('synthetic-test-key')).toBe(true)
  expect(validPaperAIKey('bad key with space')).toBe(false)
  expect(paperAIModelPattern.test('provider/chat')).toBe(true)
  expect(paperAIModelPattern.test('bad model')).toBe(false)
 })
})

describe('provider compatibility diagnostics',()=>{
 it('normalizes only known complete endpoints',()=>{
  for(const endpoint of ['https://api.example.net/openai/v1/chat/completions','https://api.example.net/openai/v1/models/']){
   expect(normalizePaperAIBase(endpoint)).toBe('https://api.example.net/openai/v1')
   expect(validPaperAIBase(endpoint,true,[])).toBe(true)
  }
  expect(normalizePaperAIBase('https://api.example.net/api/paas/v4')).toBe('https://api.example.net/api/paas/v4')
  expect(validPaperAIBase('https://127.0.0.1/v1/models',true,[])).toBe(false)
 })
 it('distinguishes safe provider failure categories',()=>{
  for(const [code,text] of [
   ['papers.ai_provider_timeout','超时'],['papers.ai_provider_dns','无法解析'],
   ['papers.ai_provider_tls','证书'],['papers.ai_provider_server','5xx'],
   ['papers.ai_provider_redirect','重定向'],['papers.ai_invalid_models','响应格式'],
   ['papers.ai_models_unsupported','聊天接口仍可能正常'],['papers.ai_provider_auth','认证']
  ])expect(paperAIProviderDiagnostic(code,'models',502)).toContain(text)
  expect(paperAIProviderDiagnostic('','models',502)).toContain('网关')
  expect(paperAIProviderDiagnostic('papers.ai_provider_timeout','chat',502)).toContain('原稿未修改')
 })
})

describe('automatic API base resolution',()=>{
 it.each([
  ['api.example.net','https://api.example.net',['https://api.example.net','https://api.example.net/v1']],
  ['https://api.example.net/v1/v1/chat/completions/models/','https://api.example.net/v1',['https://api.example.net/v1','https://api.example.net']],
  ['https://api.example.net/openai','https://api.example.net/openai',['https://api.example.net/openai','https://api.example.net/openai/v1']],
  ['https://api.example.net/openai/v1/extra','https://api.example.net/openai/v1/extra',['https://api.example.net/openai/v1/extra','https://api.example.net/openai/v1','https://api.example.net/openai']],
  ['https://api.example.net/api/paas/v4','https://api.example.net/api/paas/v4',['https://api.example.net/api/paas/v4']]
 ] as const)('normalizes %s and bounds the candidates',(raw,base,expected)=>{
  expect(normalizePaperAIBase(raw)).toBe(base)
  expect(paperAIModelBaseCandidates(raw,true,[])).toEqual(expected)
 })
 it('never guesses a missing provider or downgrades HTTPS',()=>{
  for(const raw of ['', 'http://api.example.net', '127.0.0.1','https://127.0.0.1/v1','https://api.example.net@other.example.net','https://api.example.net/v1?key=secret','https://api.example.net/v1#token','https://api.example.net/%2e%2e/v1']){
   expect(validPaperAIBase(raw,true,[]),raw).toBe(false)
   expect(paperAIModelBaseCandidates(raw,true,[]),raw).toEqual([])
  }
  expect(paperAIModelBaseCandidates('https://api.example.net',false,['https://api.example.net'])).toEqual(['https://api.example.net'])
 })
})
