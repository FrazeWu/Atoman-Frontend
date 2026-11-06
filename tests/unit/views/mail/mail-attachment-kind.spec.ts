import { describe,expect,it } from 'vitest'
import { sniffMailAttachmentType as sniff } from '@/views/mail/mail-attachment-kind'
describe('Safe mail preview signature allowlist',()=>{
 it('accepts only PDF and static image magic bytes',()=>{
  expect(sniff(Uint8Array.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))).toBe('png')
  expect(sniff(Uint8Array.from([0xff,0xd8,0xff,0xe0]))).toBe('jpeg')
  expect(sniff(new TextEncoder().encode('GIF89a'))).toBe('gif')
  expect(sniff(new TextEncoder().encode('%PDF-1.7'))).toBe('pdf')
 })
 it('denies HTML, SVG, XML, forged extensions and empty input',()=>{
  for(const input of ['<svg onload=alert(1)>','<html><script>','<!DOCTYPE html>','<?xml version','MZ',''])expect(sniff(new TextEncoder().encode(input))).toBe('other')
 })
})
