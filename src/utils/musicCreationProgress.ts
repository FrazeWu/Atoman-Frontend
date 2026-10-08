import type { MusicCreationFlowState } from '@/components/music/musicCreationTypes'

export function musicCreationProgress(flow: MusicCreationFlowState | null) {
  const steps = [
    ...(flow?.artistFirstFlow ? [{ key: 'artist', label: '创建艺术家' }] : []),
    { key: 'upload', label: '上传文件' },
    { key: 'match', label: '确认艺术家与匹配' },
    { key: 'details', label: '填写信息' },
    { key: 'submit', label: '核对并提交' },
  ]
  let key = 'upload'
  if (flow?.step === 'artist') key = flow.editingContributorId ? 'match' : 'artist'
  else if (flow?.step === 'albumDetails') key = 'details'
  else if (flow?.step === 'preview') key = 'submit'
  else if (flow?.draft.albumImport.derivedTracks.length) key = 'match'
  const index = Math.max(0, steps.findIndex((step) => step.key === key))
  return { steps, index, label: `第 ${index + 1} 步 / ${steps[index].label}`, value: `${index + 1} / ${steps.length}` }
}
