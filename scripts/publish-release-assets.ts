import { readdir } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'
import { spawn } from 'node:child_process'

const bucketName = process.env.FRONTEND_RELEASE_ASSET_BUCKET || 'atoman-frontend-releases'
const distAssetsDirectory = join(process.cwd(), 'dist', 'assets')
const concurrency = 4

const contentTypes = {
  '.avif': 'image/avif',
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
} as const

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? listFiles(path) : [path]
  }))
  return files.flat()
}

function runWrangler(arguments_: string[]) {
  return new Promise<void>((resolve, reject) => {
    const process_ = spawn('bunx', ['--bun', 'wrangler', ...arguments_], {
      stdio: 'inherit',
    })
    process_.once('error', reject)
    process_.once('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`wrangler exited with code ${code ?? 'unknown'}`))
    })
  })
}

async function uploadAsset(file: string) {
  const key = `assets/${relative(distAssetsDirectory, file).replaceAll('\\', '/')}`
  const contentType = contentTypes[extname(file).toLowerCase() as keyof typeof contentTypes] || 'application/octet-stream'
  await runWrangler([
    'r2',
    'object',
    'put',
    `${bucketName}/${key}`,
    '--file',
    file,
    '--content-type',
    contentType,
    '--remote',
  ])
}

async function main() {
  if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID) {
    throw new Error('CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required to archive release assets')
  }

  const files = await listFiles(distAssetsDirectory)
  for (let index = 0; index < files.length; index += concurrency) {
    await Promise.all(files.slice(index, index + concurrency).map(uploadAsset))
  }
  console.log(`Archived ${files.length} release assets in ${bucketName}`)
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
