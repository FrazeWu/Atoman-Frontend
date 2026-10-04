export type SubscriptionBatchFlag = 'is_muted' | 'auto_mark_read' | 'auto_add_reading_list'

export function selectedSubscriptionIds(selection: ReadonlySet<string>) {
  return [...selection]
}

export function batchFlagPayload(key: SubscriptionBatchFlag, value: boolean) {
  return { [key]: value } as Record<SubscriptionBatchFlag, boolean>
}

export function batchPauseValue(operation: string) {
  if (operation === 'pause') return true
  if (operation === 'resume') return false
  return null
}
