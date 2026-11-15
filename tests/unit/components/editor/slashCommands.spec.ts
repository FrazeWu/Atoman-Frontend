import { describe, expect, it, vi } from 'vitest'
import {
  getSlashCommands,
  filterSlashCommands,
  type SlashActionContext,
} from '@/components/shared/editor/slashCommands'

describe('slashCommands', () => {
  it('returns default commands including basic formatting and insert items', () => {
    const commands = getSlashCommands()
    const ids = commands.map((c) => c.id)

    expect(ids).toContain('heading1')
    expect(ids).toContain('heading2')
    expect(ids).toContain('heading3')
    expect(ids).toContain('bulletList')
    expect(ids).toContain('orderedList')
    expect(ids).toContain('blockquote')
    expect(ids).toContain('horizontalRule')
    expect(ids).toContain('codeBlock')
    expect(ids).toContain('table')
    expect(ids).toContain('math')
    expect(ids).toContain('image')
    expect(ids).toContain('reference')
    expect(ids).toContain('postEmbed')
    expect(ids).toContain('musicEmbed')
    expect(ids).toContain('videoEmbed')
  })

  it('respects feature flags to disable embeds, mentions, or images', () => {
    const commands = getSlashCommands({
      enableEmbeds: false,
      enableMentions: false,
      enableImageUpload: false,
    })
    const ids = commands.map((c) => c.id)

    expect(ids).not.toContain('image')
    expect(ids).not.toContain('reference')
    expect(ids).not.toContain('postEmbed')
    expect(ids).not.toContain('musicEmbed')
    expect(ids).not.toContain('videoEmbed')
    expect(ids).toContain('heading1')
    expect(ids).toContain('codeBlock')
  })

  it('filters commands by prefix, label, hint, and keywords', () => {
    const commands = getSlashCommands()

    expect(filterSlashCommands(commands, 'h1')).toHaveLength(1)
    expect(filterSlashCommands(commands, 'h1')[0].id).toBe('heading1')

    expect(filterSlashCommands(commands, '标题').length).toBeGreaterThanOrEqual(3)

    expect(filterSlashCommands(commands, 'code')[0].id).toBe('codeBlock')
    expect(filterSlashCommands(commands, 'table')[0].id).toBe('table')
    expect(filterSlashCommands(commands, 'math')[0].id).toBe('math')
  })

  it('executes heading1 by dispatching markdown heading prefix', () => {
    const commands = getSlashCommands()
    const h1 = commands.find((c) => c.id === 'heading1')!
    const dispatch = vi.fn()
    const focus = vi.fn()

    const mockContext: SlashActionContext = {
      cmView: { dispatch, focus } as any,
      from: 0,
      to: 3,
      triggerImageUpload: vi.fn(),
      insertEmbed: vi.fn(),
      insertReference: vi.fn(),
    }

    h1.execute(mockContext)

    expect(dispatch).toHaveBeenCalledWith({
      changes: { from: 0, to: 3, insert: '# ' },
      selection: { anchor: 2 },
    })
    expect(focus).toHaveBeenCalled()
  })

  it('executes image command by clearing trigger range and calling triggerImageUpload', () => {
    const commands = getSlashCommands()
    const img = commands.find((c) => c.id === 'image')!
    const dispatch = vi.fn()
    const triggerImageUpload = vi.fn()

    const mockContext: SlashActionContext = {
      cmView: { dispatch, focus: vi.fn() } as any,
      from: 10,
      to: 16,
      triggerImageUpload,
      insertEmbed: vi.fn(),
      insertReference: vi.fn(),
    }

    img.execute(mockContext)

    expect(dispatch).toHaveBeenCalledWith({
      changes: { from: 10, to: 16, insert: '' },
    })
    expect(triggerImageUpload).toHaveBeenCalled()
  })
})
