export function generateWaveformPlaceholder(seed: string, peakCount = 160): number[] {
  if (peakCount <= 0) return []

  let state = 2166136261
  for (const character of seed) {
    state ^= character.charCodeAt(0)
    state = Math.imul(state, 16777619)
  }

  const random = () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 4294967295
  }

  let previous = 0.35 + random() * 0.3
  return Array.from({ length: peakCount }, (_, index) => {
    const contour = 0.72 + Math.sin((index / Math.max(1, peakCount - 1)) * Math.PI) * 0.28
    const target = 0.18 + random() * 0.82
    previous = previous * 0.58 + target * 0.42
    return Math.max(0.1, Math.min(1, previous * contour))
  })
}
