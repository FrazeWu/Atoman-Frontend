import { StateEffect, type Extension } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view'

import { parseResourceReferences, type ResourceReference } from '@/utils/resourceReferences'

export type ResourceReferenceState = 'active' | 'stale' | 'unavailable'

export interface ResourceReferenceLabel {
  title: string
  state?: ResourceReferenceState
  qualifierLabel?: string
}

export type ResourceReferenceLabels = Record<string, ResourceReferenceLabel>

export const updateResourceReferenceLabels = StateEffect.define<ResourceReferenceLabels>()

const kindLabels: Record<ResourceReference['kind'], string> = {
  post: '文章',
  thread: '主题',
  debate: '辩题',
  feed: '订阅源',
  article: '文章',
  artist: '艺术家',
  album: '专辑',
  song: '歌曲',
  playlist: '歌单',
  podcast: '播客',
  episode: '单集',
  video: '视频',
  person: '人物',
  event: '事件',
  channel: '频道',
  collection: '合集',
  comment: '评论',
}

const qualifierLabels = {
  support: '支撑',
  oppose: '反驳',
} as const

const stateLabels: Record<ResourceReferenceState, string> = {
  active: '有效',
  stale: '待确认',
  unavailable: '不可用',
}

class ResourceReferenceWidget extends WidgetType {
  readonly label: ResourceReferenceLabel

  constructor(
    readonly reference: ResourceReference,
    label: ResourceReferenceLabel,
  ) {
    super()
    this.label = { ...label }
  }

  eq(other: ResourceReferenceWidget) {
    return this.reference.raw === other.reference.raw
      && this.label.title === other.label.title
      && this.label.state === other.label.state
      && this.label.qualifierLabel === other.label.qualifierLabel
  }

  toDOM() {
    const state = this.label.state ?? 'active'
    const qualifierLabel = this.reference.qualifier
      ? (this.label.qualifierLabel ?? qualifierLabels[this.reference.qualifier])
      : ''
    const root = document.createElement('span')
    root.className = `resource-reference resource-reference--${state}`
    root.dataset.resourceReference = `${this.reference.kind}:${this.reference.id}`
    root.dataset.resourceReferenceState = state
    root.contentEditable = 'false'
    root.setAttribute(
      'aria-label',
      [kindLabels[this.reference.kind], this.label.title, qualifierLabel, stateLabels[state]]
        .filter(Boolean)
        .join('，'),
    )

    root.append(
      createPart('resource-reference__kind', kindLabels[this.reference.kind]),
      createPart('resource-reference__title', this.label.title),
    )
    if (qualifierLabel) {
      root.append(createPart('resource-reference__qualifier', qualifierLabel))
    }
    root.append(createPart('resource-reference__state', stateLabels[state]))
    return root
  }
}

function createPart(className: string, text: string) {
  const part = document.createElement('span')
  part.className = className
  part.textContent = text
  return part
}

function buildDecorations(
  view: EditorView,
  labels: ResourceReferenceLabels,
  references: ResourceReference[],
): DecorationSet {
  const ranges = view.state.selection.ranges
  const decorations = references.flatMap((reference) => {
    const selectionTouchesReference = view.hasFocus && ranges.some(
      selection => selection.from <= reference.to && selection.to >= reference.from,
    )
    if (selectionTouchesReference) return []

    const key = `${reference.kind}:${reference.id}`
    const label = labels[key] ?? { title: reference.id }
    return [Decoration.replace({
      widget: new ResourceReferenceWidget(reference, label),
    }).range(reference.from, reference.to)]
  })

  return Decoration.set(decorations, true)
}

const referenceTheme = EditorView.baseTheme({
  '.resource-reference': {
    display: 'inline-flex',
    alignItems: 'baseline',
    gap: '0.35rem',
    maxWidth: '100%',
    padding: '0.05rem 0.35rem',
    border: '1px solid var(--a-color-border-soft)',
    borderRadius: '4px',
    backgroundColor: 'var(--a-color-surface-muted)',
    color: 'var(--a-color-text)',
    verticalAlign: 'baseline',
  },
  '.resource-reference__kind, .resource-reference__qualifier, .resource-reference__state': {
    color: 'var(--a-color-muted)',
    fontSize: '0.78em',
    whiteSpace: 'nowrap',
  },
  '.resource-reference__title': {
    minWidth: '0',
    maxWidth: '18rem',
    overflow: 'hidden',
    fontWeight: '600',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  '.resource-reference--stale': {
    borderStyle: 'dashed',
  },
  '.resource-reference--stale .resource-reference__state': {
    color: 'var(--a-color-warning)',
  },
  '.resource-reference--unavailable': {
    textDecoration: 'line-through',
  },
  '.resource-reference--unavailable .resource-reference__state': {
    color: 'var(--a-color-danger)',
    textDecoration: 'none',
  },
})

export function resourceReferenceExtension(initialLabels: ResourceReferenceLabels = {}): Extension {
  const plugin = ViewPlugin.fromClass(class {
    decorations: DecorationSet
    private labels: ResourceReferenceLabels
    private references: ResourceReference[]

    constructor(view: EditorView) {
      this.labels = initialLabels
      this.references = parseResourceReferences(view.state.doc.toString())
      this.decorations = buildDecorations(view, this.labels, this.references)
    }

    update(update: ViewUpdate) {
      let labelsChanged = false
      for (const transaction of update.transactions) {
        for (const effect of transaction.effects) {
          if (effect.is(updateResourceReferenceLabels)) {
            this.labels = effect.value
            labelsChanged = true
          }
        }
      }

      if (update.docChanged) {
        this.references = parseResourceReferences(update.state.doc.toString())
      }

      if (labelsChanged || update.docChanged || update.selectionSet || update.focusChanged) {
        this.decorations = buildDecorations(update.view, this.labels, this.references)
      }
    }
  }, {
    decorations: value => value.decorations,
  })

  return [plugin, referenceTheme]
}
