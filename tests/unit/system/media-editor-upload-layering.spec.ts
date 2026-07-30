import path from 'node:path'
import { readFileSync } from 'node:fs'

describe('media editor upload layering', () => {
  it.each([
    'src/views/podcast/PodcastEditorView.vue',
    'src/views/video/VideoEditorView.vue',
  ])('%s delegates progress uploads to the API layer', (file) => {
    const source = readFileSync(path.resolve(process.cwd(), file), 'utf8')

    expect(source).toContain("import { uploadFormDataWithProgress } from '@/api/upload'")
    expect(source).not.toContain('function uploadWithProgress(')
    expect(source).not.toContain('configureApiXHR')
  })

  it.each([
    'src/views/podcast/PodcastEditorView.vue',
    'src/views/video/VideoEditorView.vue',
  ])('%s delegates creation step transitions to a composable', (file) => {
    const source = readFileSync(path.resolve(process.cwd(), file), 'utf8')

    expect(source).toContain("import { useMediaCreationSteps } from '@/composables/useMediaCreationSteps'")
    expect(source).not.toContain('const currentStep = ref(')
    expect(source).not.toContain('const creationSteps = [')
    expect(source).not.toContain('function goNext()')
    expect(source).not.toContain('function goPrevious()')
  })
})
