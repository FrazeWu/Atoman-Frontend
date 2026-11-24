import { paperImportSourceLimit, paperImportZIPLimit } from '@/api/papers'

// Folder selection is zipped locally, without uploading intermediate files
// or flattening the directory. The server independently validates all entries.
const isIgnoredMetadata = (path: string) =>
  path.split('/').some(part => ['__MACOSX', '.DS_Store', 'Thumbs.db', '.git'].includes(part))

export async function packPaperFolder(files: File[]): Promise<Blob> {
  if (!files.length) throw new Error('请选择包含论文源码的文件夹。')
  if (files.length > 512) throw new Error('文件夹条目数不能超过 512。')
  const entries = files.map(file => ({ file, path: file.webkitRelativePath }))
  const root = entries[0]?.path.split('/')[0]
  if (!root || entries.some(entry => !entry.path.startsWith(root + '/'))) throw new Error('无法读取文件夹的相对路径，请改用 ZIP 导入。')
  const included = entries.filter(entry => !isIgnoredMetadata(entry.path))
  if (!included.length || included.length > 64) throw new Error('项目最多包含 64 个源文件。')
  let total = 0
  const names = new Set<string>()
  for (const entry of included) {
    const path = entry.path.slice(root.length + 1)
    if (!path || path.split('/').some(part => !part || part === '.' || part === '..') || names.has(path.toLowerCase())) {
      throw new Error('文件夹含有无效或重复路径。')
    }
    names.add(path.toLowerCase())
    const binary = /\.(png|jpe?g|pdf)$/i.test(path)
    total += binary ? Math.ceil(entry.file.size / 3) * 4 : entry.file.size
    if (total > paperImportSourceLimit) throw new Error('项目源文件超过 4 MiB 编码容量限制。')
  }
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  for (const entry of included) zip.file(entry.path.slice(root.length + 1), await entry.file.arrayBuffer(), { createFolders: false })
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  if (blob.size > paperImportZIPLimit) throw new Error('生成的 ZIP 超过 5 MiB。')
  return blob
}

export function suggestPaperProjectName(file: File, folder = false) {
  return (folder ? file.webkitRelativePath.split('/')[0] : file.name.replace(/\.zip$/i, '')).trim().slice(0, 100)
}
