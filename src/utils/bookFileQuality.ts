import type { BookFileQualityReport } from '@/api/bookFileShelf'

export function describeBookFileQuality(report?: BookFileQualityReport): string[] {
  if (!report || report.version !== 1) return ['尚无该文件的质量诊断记录']
  const checked = report.format === 'pdf'
    ? '已通过安全扫描与 PDF 文件头检查（未检验全文结构）'
    : report.format === 'txt'
      ? '已通过安全扫描与全文 UTF-8 编码验证'
      : '已通过安全扫描与压缩包基础结构检查'
  const facts = [
    checked,
    `文件大小：${(report.bytes / 1024 / 1024).toFixed(2)} MiB（大小不代表质量）`,
  ]
  if (report.format === 'epub') {
    if (report.epub_spine_items !== undefined) facts.push(`声明的阅读顺序章节项：${report.epub_spine_items}`)
    if (report.epub_has_navigation !== undefined) facts.push(report.epub_has_navigation ? '包含导航目录声明' : '未发现导航目录声明')
  }
  if (report.format === 'cbz' || report.format === 'cbr') {
    if (report.comic_image_pages !== undefined) facts.push(`压缩包中的图片文件：${report.comic_image_pages} 个`)
  }
  if (report.format === 'txt' && report.txt_valid_utf8 !== undefined) {
    facts.push(report.txt_valid_utf8 ? '全文 UTF-8 编码校验通过' : '文件不是有效 UTF-8，可能需要编码转换')
    if (report.txt_characters !== undefined) facts.push(`Unicode 字符数：${report.txt_characters.toLocaleString()}`)
  }
  return facts
}
