import path from 'node:path'
import { readFileSync } from 'node:fs'

const collectionManageSource = readFileSync(
  path.resolve(process.cwd(), 'src/views/blog/CollectionManageView.vue'),
  'utf8',
)

describe('CollectionManageView endpoints', () => {
  it('creates collections through the selected channel endpoint', () => {
    expect(collectionManageSource).toContain('api.blog.channelCollections(formData.value.channel_id)')
    expect(collectionManageSource).not.toContain('? api.blog.collections')
  })

  it('loads protected collections with auth headers', () => {
    expect(collectionManageSource).toContain("fetch(api.blog.collections, { headers: { Authorization: `Bearer ${authStore.token}` } })")
  })
})
