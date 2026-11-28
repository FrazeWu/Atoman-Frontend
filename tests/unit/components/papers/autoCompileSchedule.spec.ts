import {describe,expect,it} from 'vitest'
import {AutoCompileSchedule} from '@/components/papers/autoCompileSchedule'

describe('automatic compile scheduling policy',()=>{
 it('debounces from the last edit and respects the last actual submission',()=>{
  const schedule=new AutoCompileSchedule()
  expect(schedule.delay(0)).toBeNull()
  schedule.markDirty(0)
  expect(schedule.delay(0)).toBe(15000)
  schedule.markDirty(10000)
  expect(schedule.delay(14999)).toBe(10001)
  schedule.begin(25000);schedule.accepted(true)
  expect(schedule.delay(25001)).toBeNull()
  schedule.markDirty(30000)
  expect(schedule.delay(30000)).toBe(55000)
 })
 it('does not consume newer edits or an unacknowledged submission',()=>{
  const schedule=new AutoCompileSchedule()
  schedule.markDirty(0);schedule.begin(15000)
  schedule.markDirty(16000);schedule.accepted(false)
  expect(schedule.delay(16000)).toBe(59000)
  schedule.begin(75000);schedule.accepted(true)
  expect(schedule.delay(75000)).toBeNull()
 })
 it('backs off twice, then waits for an edit or explicit user action',()=>{
  const schedule=new AutoCompileSchedule()
  schedule.markDirty(0);schedule.begin(15000);schedule.failed(15001,true)
  expect(schedule.delay(15001)).toBe(60000)
  schedule.begin(75001);schedule.failed(75002,true)
  expect(schedule.delay(75002)).toBe(120000)
  schedule.begin(195002);schedule.failed(195003,true)
  expect(schedule.delay(300000)).toBeNull()
  schedule.markDirty(300000);expect(schedule.delay(300000)).toBe(15000)
  schedule.failed(315000,false);expect(schedule.delay(400000)).toBeNull()
  schedule.reset();expect(schedule.delay(400000)).toBeNull()
 })
})
