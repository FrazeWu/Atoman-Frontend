import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSheetStack, type BaseSheetLayer } from '@/composables/useSheetStack'

type TestLayer = BaseSheetLayer & {
  kind: 'artist' | 'album' | 'history'
  payload: { id: string }
}

const layer = (kind: TestLayer['kind'], id: string): TestLayer => ({
  key: `${kind}:${id}`,
  kind,
  title: `${kind} ${id}`,
  payload: { id },
})

describe('createSheetStack', () => {
  beforeEach(() => document.body.replaceChildren())

  it('pushes, replaces, pops, and returns to a retained layer', () => {
    const stack = createSheetStack<TestLayer>()
    stack.push(layer('artist', '1'))
    stack.push(layer('album', '2'))
    stack.replaceTop(layer('history', '3'))
    expect(stack.layers.value.map(item => item.key)).toEqual(['artist:1', 'history:3'])
    stack.push(layer('album', '4'))
    stack.popTo('artist:1')
    expect(stack.layers.value.map(item => item.key)).toEqual(['artist:1'])
    expect(stack.pop()?.key).toBe('artist:1')
  })

  it('allows repeated kinds but not an identical top key', () => {
    const stack = createSheetStack<TestLayer>()
    stack.push(layer('artist', '1'))
    stack.push(layer('artist', '1'))
    stack.push(layer('artist', '2'))
    expect(stack.layers.value.map(item => item.key)).toEqual(['artist:1', 'artist:2'])
  })

  it('returns to an existing lower layer instead of adding a duplicate key', () => {
    const stack = createSheetStack<TestLayer>()
    stack.push(layer('artist', '1'))
    stack.push(layer('album', '2'))
    stack.push(layer('artist', '1'))

    expect(stack.layers.value.map(item => item.key)).toEqual(['artist:1'])
    expect(stack.renderLayers.value.map(item => item.key)).toEqual(['artist:1'])
  })

  it('rebuilds the stack from the overflow resolver when the layer limit is reached', () => {
    const resolveOverflow = vi.fn((next: TestLayer) => [
      layer('album', next.payload.id),
      next,
    ])
    const stack = createSheetStack<TestLayer>({
      maxLayers: 3,
      resolveOverflow,
    })

    stack.push(layer('artist', '1'))
    stack.push(layer('album', '2'))
    stack.push(layer('history', '3'))
    stack.push(layer('history', '4'))

    expect(resolveOverflow).toHaveBeenCalledOnce()
    expect(stack.layers.value.map(item => item.key)).toEqual(['album:4', 'history:4'])
  })

  it('ignores another push while the overflow transition is running', async () => {
    vi.useFakeTimers()
    const stack = createSheetStack<TestLayer>({
      maxLayers: 3,
      resolveOverflow: next => [next],
      overflowTransitionMs: 300,
    })

    stack.push(layer('artist', '1'))
    stack.push(layer('album', '2'))
    stack.push(layer('history', '3'))
    stack.push(layer('history', '4'))
    stack.push(layer('history', '5'))
    expect(stack.top.value?.key).toBe('history:4')

    await vi.advanceTimersByTimeAsync(300)
    stack.push(layer('history', '5'))
    expect(stack.top.value?.key).toBe('history:5')
    vi.useRealTimers()
  })

  it('keeps render keys unique when the overflow target already exists below the top', () => {
    const stack = createSheetStack<TestLayer>({
      maxLayers: 3,
      resolveOverflow: next => [next],
      overflowTransitionMs: 300,
    })

    stack.push(layer('artist', '1'))
    stack.push(layer('album', '2'))
    stack.push(layer('history', '3'))
    stack.push(layer('album', '2'))

    const keys = stack.renderLayers.value.map(item => item.key)
    expect(new Set(keys).size).toBe(keys.length)
    stack.clear()
  })

  it('restores trigger focus when the top layer closes', async () => {
    vi.useFakeTimers()
    const trigger = document.createElement('button')
    document.body.append(trigger)
    trigger.focus()
    const stack = createSheetStack<TestLayer>()
    stack.push(layer('artist', '1'))
    stack.pop()
    await vi.runAllTimersAsync()
    expect(document.activeElement).toBe(trigger)
    vi.useRealTimers()
  })
})
