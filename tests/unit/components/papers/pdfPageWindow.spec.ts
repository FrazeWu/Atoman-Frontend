import {describe,expect,it,vi} from 'vitest'
import {firstPageAfter,pdfPageWindow} from '@/components/papers/pdfPageWindow'

describe('PDF ordered page window',()=>{
 it('uses logarithmic page lookup even near the end of a 1000-page document',()=>{
  const read=vi.fn((page:number)=>({top:(page-1)*608,bottom:(page-1)*608+600}))
  const result=pdfPageWindow(1000,read,899*608,899*608+600,1,0,12)
  expect(result.page).toBe(900)
  expect(result.pages).toEqual([900,899,901])
  expect(read.mock.calls.length).toBeLessThan(25)
 })
 it('handles mixed page heights, gaps, partial pages and preferred navigation',()=>{
  const rows=[{top:0,bottom:200},{top:208,bottom:800},{top:808,bottom:1400},{top:1408,bottom:1500}]
  const read=(n:number)=>rows[n-1]
  expect(firstPageAfter(rows.length,200,read)).toBe(2)
  expect(firstPageAfter(rows.length,200,read,true)).toBe(1)
  expect(pdfPageWindow(rows.length,read,790,1110,2,2,12).page).toBe(2)
  expect(pdfPageWindow(rows.length,read,790,1110,2,0,12).page).toBe(3)
  expect(pdfPageWindow(rows.length,read,790,1110,2,0,1).pages).toEqual([3])
 })
 it('returns a safe empty window when the document is mounting or hidden',()=>{
  expect(pdfPageWindow(1000,()=>undefined,0,600,1,0,12)).toEqual({pages:[],page:1})
  expect(pdfPageWindow(3,n=>({top:n,bottom:n+1}),0,0,2,0,12)).toEqual({pages:[],page:2})
  expect(firstPageAfter(0,0,()=>undefined)).toBeNull()
 })
})
