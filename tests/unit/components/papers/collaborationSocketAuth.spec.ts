import {describe,expect,it} from 'vitest'
import {paperSocketProtocols} from '@/components/papers/collaborationSocketAuth'
describe('Papers WebSocket authentication',()=>{
 it('uses the existing browser cookie instead of the cookie-session placeholder',()=>{
  expect(paperSocketProtocols('cookie-session')).toBeUndefined()
  expect(paperSocketProtocols(null)).toBeUndefined()
  expect(paperSocketProtocols(undefined)).toBeUndefined()
 })
 it('retains explicit API session authentication without adding a token to the URL',()=>{
  expect(paperSocketProtocols('synthetic-api-session')).toEqual(['atoman.api.synthetic-api-session'])
 })
})
