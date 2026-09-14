import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const mobileAppSource = readFileSync(resolve(process.cwd(), 'apps/mobile/MobileApp.vue'), 'utf8')

function colorToken(name: string) {
  return mobileAppSource.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1] || ''
}

function relativeLuminance(hex: string) {
  const channels = hex.slice(1).match(/../g)?.map((value) => Number.parseInt(value, 16) / 255) || []
  const linear = channels.map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

function contrastRatio(foreground: string, background: string) {
  const foregroundLuminance = relativeLuminance(foreground)
  const backgroundLuminance = relativeLuminance(background)
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
}

describe('mobile accessibility color contract', () => {
  it('keeps secondary text and primary controls readable on the mobile surface', () => {
    expect(contrastRatio(colorToken('--a-color-muted'), '#f2f2f7')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(colorToken('--a-color-muted-soft'), '#f2f2f7')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(colorToken('--a-color-primary'), '#ffffff')).toBeGreaterThanOrEqual(4.5)
  })
})
