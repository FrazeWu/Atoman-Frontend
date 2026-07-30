import path from 'node:path'
import { readFileSync } from 'node:fs'

describe('PostEditorView layering', () => {
  it('delegates draft persistence and collaborative recovery to a composable', () => {
    const source = readFileSync(path.resolve(process.cwd(), 'src/views/blog/PostEditorView.vue'), 'utf8')

    expect(source).toContain('usePostEditorDraftSession({')
    for (const declaration of [
      'const syncServerDraft = async',
      'const evaluateDraftRecovery = async',
      'const handleCollabReady = async',
      'onBeforeRouteLeave(',
    ]) {
      expect(source).not.toContain(declaration)
    }
  })

  it('delegates collection loading and synchronization to a composable', () => {
    const source = readFileSync(path.resolve(process.cwd(), 'src/views/blog/PostEditorView.vue'), 'utf8')

    expect(source).toContain('usePostEditorCollections({')
    for (const declaration of [
      'const loadChannelCollections = async',
      'const syncPostCollections = async',
      'const onCollectionSelect =',
    ]) {
      expect(source).not.toContain(declaration)
    }
  })

  it('delegates post loading, saving and scheduling to a composable', () => {
    const source = readFileSync(path.resolve(process.cwd(), 'src/views/blog/PostEditorView.vue'), 'utf8')

    expect(source).toContain('usePostEditorPublication({')
    for (const declaration of [
      'const loadPost = async',
      'const save = async',
      'const schedulePublish = async',
    ]) {
      expect(source).not.toContain(declaration)
    }
  })
})
