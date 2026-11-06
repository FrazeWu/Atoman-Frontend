import { describe, expect, it } from 'vitest'
import { CONTACT_BATCH_LIMIT, CONTACT_FILE_MAX_BYTES, exportContactsCSV, exportContactsVCard, parseContactFile } from '@/views/mail/mail-contact-transfer'

describe('private mailbox contact interchange', () => {
  it('reads escaped UTF-8 CSV with CRLF, quoted commas/newlines and headers', () => {
    const raw = '\uFEFF"name","email","notes"\r\n"张,三","Zhang@example.org","one\r\ntwo"\r\n"Other","other@example.org","say ""hi"""\r\n'
    expect(parseContactFile('people.csv', raw).rows).toEqual([
      {name:'张,三',email:'zhang@example.org',notes:'one\r\ntwo'},
      {name:'Other',email:'other@example.org',notes:'say "hi"'}
    ])
  })
  it('supports Chinese headers and only first email for file duplicates', () => {
    const value='姓名,邮箱地址,备注\nAlice,HELLO@EXAMPLE.ORG,One\nAlice New,hello@example.org,Two\n'
    expect(parseContactFile('people.csv', value)).toEqual({
      rows:[{name:'Alice',email:'hello@example.org',notes:'One'}],
      duplicateRows:1
    })
  })
  it('exports CSV safely: never leaves spreadsheet formulas unescaped', () => {
    const csv=exportContactsCSV([{name:'=cmd|/C calc',email:'alice@example.org',notes:' +IMPORTXML(A1,"x")'},{name:'Bob',email:'b@example.org',notes:'quote, newline\nhere'}])
    expect(csv).toContain('"\'=cmd|/C calc"')
    expect(csv).toContain('"\' +IMPORTXML(A1,""x"")"')
    expect(csv).toContain('quote, newline\nhere')
    expect(parseContactFile('export.csv',csv).rows).toHaveLength(2)
  })
  it('round-trips vCard escaped characters, Chinese text, multiple cards and folded Unicode', () => {
    const contact={name:'很长的联系人'.repeat(15),email:'a@example.org',notes:'第一行\n第二行,含逗号;与分号和\\反斜杠'}
    const vcf=exportContactsVCard([contact,{name:'Other',email:'b@example.org',notes:''}])
    expect(vcf).toContain('VERSION:3.0')
    expect(vcf).toContain('\r\n ')
    for (const line of vcf.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    expect(parseContactFile('contacts.vcf',vcf).rows).toEqual([contact,{name:'Other',email:'b@example.org',notes:''}])
  })
  it('normalizes CRLF in imported notes when exporting vCard', () => {
    const vcf=exportContactsVCard([{name:'New',email:'a@example.org',notes:'first\r\nsecond\rthird'}])
    expect(vcf).toContain('NOTE:first\\nsecond\\nthird')
    expect(parseContactFile('a.vcf',vcf).rows[0]?.notes).toBe('first\nsecond\nthird')
  })
  it('supports independently declared multiple EMAIL addresses and folded vCards', () => {
    const data='BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Alice Test\r\nNOTE:join\r\n the team\r\nEMAIL;TYPE=HOME:alice@example.org\r\nEMAIL;TYPE=WORK:alice@work.org\r\nEND:VCARD\r\n'
    expect(parseContactFile('card.vcf',data).rows).toEqual([
      {name:'Alice Test',email:'alice@example.org',notes:'jointhe team'},
      {name:'Alice Test',email:'alice@work.org',notes:'jointhe team'}
    ])
  })
  it('rejects malformed files and untrusted formats', () => {
    expect(()=>parseContactFile('x.txt','hi')).toThrow('只支持')
    expect(()=>parseContactFile('x.csv','email\n"broken')).toThrow('引号')
    expect(()=>parseContactFile('x.csv','name,foo\nhi,there')).toThrow('email')
    expect(()=>parseContactFile('x.vcf','BEGIN:VCARD\nFN:Missing end')).toThrow('缺少 END')
    expect(()=>parseContactFile('x.csv','email\n@bad\n')).toThrow('格式无效')
    expect(()=>parseContactFile('x.csv','email\na@example.org\u0000')).toThrow('UTF-8')
  })
  it('enforces import count and one-megabyte file limits', () => {
    const lines=['email',...Array.from({length:CONTACT_BATCH_LIMIT+1},(_,i)=>`p${i}@example.org`)].join('\n')
    expect(()=>parseContactFile('bulk.csv',lines)).toThrow('500')
    expect(()=>parseContactFile('bulk.csv','a'.repeat(CONTACT_FILE_MAX_BYTES+1))).toThrow('1 MB')
  })
})
