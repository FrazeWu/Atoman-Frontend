import {describe,expect,it} from 'vitest'
import {validPaperAIBase,validPaperAIKey,paperAIModelPattern} from '@/components/papers/aiProvider'
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
