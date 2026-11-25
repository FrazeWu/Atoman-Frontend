import { paperImportSourceLimit, paperImportZIPLimit } from '@/api/papers'

// Folder selection is zipped locally, without uploading intermediate files
// or flattening the directory. The server independently validates all entries.
const isIgnoredMetadata = (path: string) =>
  path.split('/').some(part => ['__MACOSX', '.DS_Store', 'Thumbs.db', '.git'].includes(part))

const supportedExtensions = /\.(tex|bib|sty|cls|txt|md|bst|bbl|cfg|def|clo|bbx|cbx|lbx|fd|dtx|ins|png|jpe?g|pdf)$/i
const bytes = (value: string) => new TextEncoder().encode(value).byteLength
const portablePath = (path: string) => bytes(path) <= 512 && path.split('/').every(part =>
  bytes(part) <= 255 && !part.startsWith('.') && !part.endsWith('.') && part.trim() === part &&
  /^[\p{L}\p{N}\p{M}_.() -]+$/u.test(part))

function inspectFolder(files: File[]) {
  if (!files.length) throw new Error('请选择包含论文源码的文件夹。')
  if (files.length > 512) throw new Error('文件夹条目数不能超过 512。')
  const entries = files.map(file => ({ file, path: file.webkitRelativePath }))
  const root = entries[0]?.path.split('/')[0]
  if (!root || entries.some(entry => !entry.path.startsWith(root + '/'))) throw new Error('无法读取文件夹的相对路径，请改用 ZIP 导入。')
  const names = new Set<string>()
  const dirs = new Set<string>()
  const included: {file:File; path:string}[] = []
  const excluded: string[] = []
  for (const entry of entries) {
    const path = entry.path.slice(root.length + 1)
    if (!path || bytes(path) > 512 || /[\\:\p{Cc}\p{Cf}]/u.test(path) ||
      path.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('文件夹含有不安全的路径。')
    if (isIgnoredMetadata(entry.path)) continue
    const key = path.toLowerCase()
    if (names.has(key) || dirs.has(key)) throw new Error('文件夹含有重复路径或文件与目录冲突。')
    const parts = key.split('/')
    for (let i = 1; i < parts.length; i++) {
      const parent = parts.slice(0, i).join('/')
      if (names.has(parent)) throw new Error('文件夹含有文件与目录冲突。')
      dirs.add(parent)
    }
    names.add(key)
    if (!supportedExtensions.test(path) || !portablePath(path)) excluded.push(path)
    else included.push({file:entry.file,path})
  }
  return { included, excluded: excluded.sort() }
}

export function unsupportedPaperFolderFiles(files: File[]) {
  return inspectFolder(files).excluded
}

export function paperArchiveExclusion(error: unknown): {files:string[]; confirmation:string} | null {
  if (!error || typeof error !== 'object') return null
  const value = error as {code?:unknown; details?:{files?:unknown; confirmation?:unknown}}
  const files = value.details?.files
  const confirmation = value.details?.confirmation
  if (value.code !== 'papers.archive_exclusion_required' || !Array.isArray(files) ||
      !files.length || files.length > 512 || !files.every((file:unknown) => typeof file === 'string' && file.length > 0 && file.length <= 512) ||
      typeof confirmation !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(confirmation)) return null
  return { files: [...files], confirmation }
}

export async function packPaperFolder(files: File[], excludeUnsupported = false): Promise<Blob> {
  const { included, excluded } = inspectFolder(files)
  if (excluded.length && !excludeUnsupported) throw new Error('存在不支持的文件，请先确认排除。')
  if (!included.length || included.length > 64) throw new Error('项目最多包含 64 个源文件，且必须包含论文源码。')
  let total = 0
  for (const entry of included) {
    const binary = /\.(png|jpe?g|pdf)$/i.test(entry.path)
    total += binary ? Math.ceil(entry.file.size / 3) * 4 : entry.file.size
    if (total > paperImportSourceLimit) throw new Error('项目源文件超过 4 MiB 编码容量限制。')
  }
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  for (const entry of included) zip.file(entry.path, await entry.file.arrayBuffer(), { createFolders: false })
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  if (blob.size > paperImportZIPLimit) throw new Error('生成的 ZIP 超过 5 MiB。')
  return blob
}

export function suggestPaperProjectName(file: File, folder = false) {
  return (folder ? file.webkitRelativePath.split('/')[0] : file.name.replace(/\.zip$/i, '')).trim().slice(0, 100)
}

// Built-in original templates are packaged locally and use the same atomic
// import endpoint as a user-uploaded ZIP. The server still validates entries.
export async function packPaperTemplate(id:string):Promise<Blob>{
  const {paperTemplateFiles}=await import('./templateCatalog')
  const files=Object.entries(paperTemplateFiles(id))
  if(!files.length||files.length>64||files.some(([path])=>!portablePath(path)||!supportedExtensions.test(path)))throw new Error('内置模板文件不符合项目规范。')
  if(!files.some(([path])=>path==='main.tex')||files.reduce((size,[,text])=>size+bytes(text),0)>paperImportSourceLimit)throw new Error('内置模板超过项目容量限制。')
  const {default:JSZip}=await import('jszip')
  const zip=new JSZip()
  for(const [path,text] of files)zip.file(path,text,{createFolders:false})
  const archive=await zip.generateAsync({type:'blob',compression:'DEFLATE'})
  if(!archive.size||archive.size>paperImportZIPLimit)throw new Error('模板 ZIP 超过容量限制。')
  return archive
}
