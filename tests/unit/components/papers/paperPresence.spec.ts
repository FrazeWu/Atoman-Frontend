import {describe,expect,it} from 'vitest'
import * as Y from 'yjs'
import {encodeSelection,resolveSelection,parsePresencePeers,remoteCursorDecorations,peerColor} from '@/components/papers/paperPresence'

const first='550e8400-e29b-41d4-a716-446655440001',second='550e8400-e29b-41d4-a716-446655440002'
const peer={connection_id:first,user_id:second,name:'Collaborator',role:'editor' as const}
describe('Papers relative cursor presence',()=>{
 it('preserves position after concurrent insertions and deletions',()=>{
  const a=new Y.Doc(),b=new Y.Doc()
  try{
   const source=a.getText('source'),remote=b.getText('source')
   source.insert(0,'abc def');Y.applyUpdate(b,Y.encodeStateAsUpdate(a))
   const selection=encodeSelection(remote,{anchor:4,head:7})!
   expect(resolveSelection(source,selection)).toEqual({anchor:4,head:7})
   source.insert(0,'++')
   expect(resolveSelection(source,selection)).toEqual({anchor:6,head:9})
   source.delete(2,1)
   expect(resolveSelection(source,selection)).toEqual({anchor:5,head:8})
   expect(remoteCursorDecorations(source,[{...peer,selection}],source.length).size).toBe(2)
  }finally{a.destroy();b.destroy()}
 })
 it('rejects foreign types, malformed positions and bounds',()=>{
  const doc=new Y.Doc()
  try{
   const source=doc.getText('source'),foreign=doc.getText('other')
   source.insert(0,'abc');foreign.insert(0,'xyz')
   expect(resolveSelection(source,encodeSelection(foreign,{anchor:1,head:2})!)).toBeNull()
   expect(resolveSelection(source,{anchor:'!',head:'AAAA'})).toBeNull()
   expect(()=>encodeSelection(source,{anchor:0,head:4})).toThrow()
   expect(remoteCursorDecorations(source,[{...peer,selection:{anchor:'!',head:'AAAA'}}],source.length).size).toBe(0)
   expect(encodeSelection(source,null)).toBeNull()
  }finally{doc.destroy()}
 })
 it('validates member count, unique identity and position size',()=>{
  expect(parsePresencePeers([peer])).toEqual([peer])
  expect(()=>parsePresencePeers([peer,peer])).toThrow()
  expect(()=>parsePresencePeers([{...peer,name:'x'.repeat(65)}])).toThrow()
  expect(()=>parsePresencePeers([{...peer,role:'admin'}])).toThrow()
  expect(()=>parsePresencePeers([{...peer,selection:{anchor:btoa('x'.repeat(129)),head:'AA=='}}])).toThrow()
  expect(peerColor(first)).toMatch(/^#[0-9a-f]{6}$/)
 })
})
