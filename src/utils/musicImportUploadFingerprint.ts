// A small, persistent identity check for resuming multipart uploads after a
// browser reload. The original File cannot be persisted; the user must select
// it again. Only a content fingerprint (not bytes or names) is stored locally.
const HASH_CHUNK_SIZE = 4 * 1024 * 1024
const KEY_PREFIX = 'atoman:music:upload-fingerprint:v1:'
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000

type SavedFingerprint = { digest: string; savedAt: number }

function key(importId: string, fileId: string): string {
  return `${KEY_PREFIX}${importId}:${fileId}`
}

export async function musicUploadFileFingerprint(file: File): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('当前浏览器不支持安全文件指纹')
  // Hash the *whole* file in bounded chunks. A head/tail sample is unsafe:
  // selecting a modified file of the same size could corrupt completed parts.
  const chunkHashes: Uint8Array[] = []
  for (let offset = 0; offset < file.size; offset += HASH_CHUNK_SIZE) {
    const chunk = await file.slice(offset, Math.min(offset + HASH_CHUNK_SIZE, file.size)).arrayBuffer()
    chunkHashes.push(new Uint8Array(await crypto.subtle.digest('SHA-256', chunk)))
  }
  const identity = new TextEncoder().encode(`${file.name}\0${file.size}\0${file.type}\0`)
  const bytes = new Uint8Array(identity.length + chunkHashes.length * 32)
  bytes.set(identity)
  chunkHashes.forEach((hash, index) => bytes.set(hash, identity.length + index * 32))
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function rememberMusicUploadFingerprint(importId: string, fileId: string, file: File): Promise<void> {
  if (typeof localStorage === 'undefined') return
  const digest = await musicUploadFileFingerprint(file)
  localStorage.setItem(key(importId, fileId), JSON.stringify({ digest, savedAt: Date.now() } satisfies SavedFingerprint))
}

export async function verifyMusicUploadFingerprint(importId: string, fileId: string, file: File): Promise<void> {
  if (typeof localStorage === 'undefined') throw new Error('无法验证文件，请使用替换文件重新上传')
  let saved: SavedFingerprint | null = null
  try {
    saved = JSON.parse(localStorage.getItem(key(importId, fileId)) || 'null') as SavedFingerprint | null
  } catch { /* invalid local record */ }
  if (!saved || typeof saved.digest !== 'string' || !Number.isFinite(saved.savedAt) || Date.now() - saved.savedAt > MAX_AGE_MS) {
    throw new Error('找不到原文件的上传指纹，请使用替换文件重新上传')
  }
  if (saved.digest !== await musicUploadFileFingerprint(file)) {
    throw new Error('所选文件与上次上传的内容不一致，请重新选择原文件')
  }
}
