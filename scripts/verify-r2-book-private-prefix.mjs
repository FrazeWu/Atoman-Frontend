#!/usr/bin/env node
/**
 * Read-only Cloudflare R2 public-domain regression test.
 * Every request uses a unique path that is guaranteed to be synthetic.
 * Never reads a real private ebook or writes to object storage.
 */
import { randomUUID } from 'node:crypto'

const base = new URL(process.env.ATOMAN_ASSETS_URL || 'https://assets.atoman.org')
const key = randomUUID()
const checks = [
  { label: 'immutable book revisions', path: `/book/revisions/${key}/source.epub`, expected: 403 },
  { label: 'private book imports', path: `/books/private/users/${key}/imports/${key}/source.pdf`, expected: 403 },
  { label: 'private publication evidence', path: `/books/private/publication-evidence/requests/${key}/receipt.pdf`, expected: 403 },
  { label: 'uppercase path normalization', path: `/BOOK/revisions/${key}/source.epub`, expected: 403 },
  { label: 'percent-encoded private prefix', path: `/books%2Fprivate%2Fusers%2F${key}%2Fsource.pdf`, expected: 403 },
  { label: 'unrelated public media remains accessible', path: `/music/qa-nonexistent-${key}.jpg`, expected: 404 },
]

let failures = 0
for (const { label, path, expected } of checks) {
  const target = new URL(path, base)
  try {
    const response = await fetch(target, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(12_000) })
    // Synthetic paths should have no object body; cancel without consuming it.
    await response.body?.cancel()
    const ok = response.status === expected
    console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: HTTP ${response.status} (expected ${expected})`)
    if (!ok) failures += 1
  } catch (err) {
    console.error(`FAIL ${label}: ${String(err).slice(0, 160)}`)
    failures += 1
  }
}
if (failures) {
  console.error(`R2 private-prefix guard verification failed: ${failures}/${checks.length}`)
  process.exitCode = 1
} else {
  console.log(`R2 private-prefix guard verification passed: ${checks.length}/${checks.length}`)
}
