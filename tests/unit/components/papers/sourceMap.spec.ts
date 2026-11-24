import {describe,it,expect} from 'vitest'
import {decodeSourceMap,sourceToPDF,pdfToSource} from '@/components/papers/sourceMap'
describe('private SyncTeX line index',()=>{
 const map=decodeSourceMap({version:1,files:['main.tex','chapters/results.tex'],points:[[0,5,1,1000,1200],[1,30,3,1200,2500],[1,31,3,1200,2700]]})!
 it('finds source to PDF and PDF to source without leaking paths',()=>{
  expect(sourceToPDF(map,'chapters/results.tex',30)).toEqual([1,30,3,1200,2500])
  expect(pdfToSource(map,3,121,269)).toEqual([1,31,3,1200,2700])
  expect(sourceToPDF(map,'chapters/results.tex',900)).toBeUndefined()
  expect(pdfToSource(map,2,120,250)).toBeUndefined()
 })
 it('rejects unsafe and invalid maps',()=>{
  expect(decodeSourceMap({version:1,files:['../secret.tex'],points:[[0,1,1,0,0]]})).toBeNull()
  expect(decodeSourceMap({version:1,files:['main.tex'],points:[[1,1,1,0,0]]})).toBeNull()
 })
})
