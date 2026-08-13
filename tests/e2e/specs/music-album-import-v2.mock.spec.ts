import { test, expect } from '../fixtures/base'

const importId = 'import-e2e-1'
const fileId = 'file-e2e-1'
const signedUploadUrl = 'https://uploads.example.test/import-e2e-1/file-e2e-1/part-1'

function envelope(data: unknown) {
  return JSON.stringify({ data })
}

function importSnapshot(status: 'pending_upload' | 'uploading' | 'uploaded' | 'queued' | 'ready') {
  return {
    importId,
    status,
    archiveName: '',
    uploadProgress: status === 'ready' ? 100 : 0,
    uploadSpeed: 0,
    coverUrl: '',
    coverKey: '',
    derivedAlbumTitle: status === 'ready' ? 'E2E Import Album' : '',
    derivedCover: status === 'ready' ? 'https://img.example.test/e2e-cover.jpg' : '',
    derivedReleaseDate: status === 'ready' ? '2026-08-13' : '',
    derivedAlbumType: status === 'ready' ? 'album' : '',
    metadataSourceUrl: status === 'ready' ? 'https://musicbrainz.org/release/e2e-release' : '',
    missingArtists: [],
    derivedTracks: status === 'ready'
      ? [{ songId: 'song-e2e-1', title: 'E2E Imported Track', audioKey: 'music/e2e-track.mp3', origin: 'import' }]
      : [],
    lastSyncedAt: '2026-07-23T00:00:00Z',
    errorMessage: '',
    inputMode: 'files',
    stage: status === 'ready' ? 'ready' : 'upload',
    progress: { current: status === 'ready' ? 1 : 0, total: 1 },
    files: [{
      fileId,
      relativePath: 'E2E Imported Track.mp3',
      fileName: 'E2E Imported Track.mp3',
      role: 'audio',
      detectedFormat: 'mp3',
      size: 3,
      uploadStatus: status === 'pending_upload' || status === 'uploading' ? 'pending' : 'uploaded',
      processingStatus: 'pending',
      discNumber: 1,
      trackNumber: 1,
      title: 'E2E Imported Track',
      errorMessage: '',
    }],
    errors: [],
  }
}

test('通过真实专辑创建界面完成 v2 分片导入并显示识别曲目', async ({ page }) => {
  const requestPaths: string[] = []
  let importPolls = 0

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    requestPaths.push(`${request.method()} ${path}`)

    if (request.method() === 'GET' && path === '/api/v1/auth/session') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        csrf_token: 'e2e-csrf',
        user: { uuid: 'user-e2e', username: 'e2e-user', email: 'e2e@example.test', role: 'user' },
      }) })
      return
    }
    if (request.method() === 'GET' && path === '/api/v1/music/artists/artist-e2e-1') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: envelope({
        id: 'artist-e2e-1', name: 'E2E Artist', legal_name: 'E2E Artist', albums: [], entry_status: 'open',
      }) })
      return
    }
    if (request.method() === 'GET' && path === '/api/v1/music/albums') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: envelope([]) })
      return
    }
    if (request.method() === 'GET' && path === '/api/v1/music/bookmarks/artists') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: envelope([]) })
      return
    }
    if (request.method() === 'POST' && path === '/api/v1/music/imports/albums') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: envelope(importSnapshot('pending_upload')) })
      return
    }
    if (request.method() === 'POST' && path === `/api/v1/music/imports/albums/${importId}/files`) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: envelope(importSnapshot('uploading')) })
      return
    }
    if (request.method() === 'POST' && path === `/api/v1/music/imports/albums/${importId}/files/${fileId}/parts/1`) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: envelope({ partNumber: 1, uploadUrl: signedUploadUrl }) })
      return
    }
    if (request.method() === 'POST' && path === `/api/v1/music/imports/albums/${importId}/files/${fileId}/parts/1/complete`) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: envelope(importSnapshot('uploading')) })
      return
    }
    if (request.method() === 'POST' && path === `/api/v1/music/imports/albums/${importId}/files/${fileId}/complete`) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: envelope(importSnapshot('uploaded')) })
      return
    }
    if (request.method() === 'GET' && path === `/api/v1/music/imports/albums/${importId}`) {
      importPolls += 1
      await route.fulfill({ status: 200, contentType: 'application/json', body: envelope(importSnapshot(importPolls >= 1 ? 'ready' : 'queued')) })
      return
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: envelope([]) })
  })

  await page.route(signedUploadUrl, async (route) => {
    await route.fulfill({ status: 200, headers: { ETag: 'e2e-etag' } })
  })

  await page.goto('/music/artist/artist-e2e-1')
  await page.getByRole('button', { name: '添加新专辑' }).click()
  const creationDialog = page.getByRole('dialog', { name: '创建音乐条目' })
  const filesInput = creationDialog.getByTestId('album-import-files-input')
  await expect(filesInput).toBeAttached()

  await filesInput.setInputFiles({
    name: 'E2E Imported Track.mp3',
    mimeType: 'audio/mpeg',
    buffer: Buffer.from([1, 2, 3]),
  })

  await expect.poll(() => requestPaths, { timeout: 20_000 }).toEqual(expect.arrayContaining([
    `POST /api/v1/music/imports/albums`,
    `POST /api/v1/music/imports/albums/${importId}/files`,
    `POST /api/v1/music/imports/albums/${importId}/files/${fileId}/parts/1`,
    `POST /api/v1/music/imports/albums/${importId}/files/${fileId}/parts/1/complete`,
    `POST /api/v1/music/imports/albums/${importId}/files/${fileId}/complete`,
  ]))
  await expect.poll(() => importPolls).toBeGreaterThan(0)
  await expect(creationDialog.getByLabel('专辑名*')).toHaveValue('E2E Import Album')

  await expect(creationDialog.getByTestId('album-import-status')).toBeVisible()
  await creationDialog.getByTestId('artist-next-button').click()
  await expect(creationDialog.getByTestId('album-import-preview-step')).toBeVisible()
  await expect(creationDialog.getByText('E2E Imported Track')).toBeVisible()
})
