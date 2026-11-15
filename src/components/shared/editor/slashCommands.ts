import type { EditorView } from '@codemirror/view'
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Minus,
  Code,
  Table,
  Sigma,
  Image,
  AtSign,
  FileText,
  Music,
  Video,
} from 'lucide-vue-next'
import type { Component } from 'vue'

export interface SlashActionContext {
  cmView: EditorView
  from: number
  to: number
  triggerImageUpload: () => void
  insertEmbed: (kind: 'post' | 'music' | 'video') => void
  insertReference: () => void
}

export interface SlashMenuItem {
  id: string
  label: string
  hint?: string
  icon: Component
  group: 'basic' | 'insert'
  keywords: string[]
  execute: (context: SlashActionContext) => void
}

export interface SlashCommandsOptions {
  enableEmbeds?: boolean
  enableMentions?: boolean
  enableImageUpload?: boolean
}

export function getSlashCommands(options: SlashCommandsOptions = {}): SlashMenuItem[] {
  const {
    enableEmbeds = true,
    enableMentions = true,
    enableImageUpload = true,
  } = options

  const commands: SlashMenuItem[] = [
    {
      id: 'heading1',
      label: '一级标题',
      hint: '#',
      icon: Heading1,
      group: 'basic',
      keywords: ['h1', '1', 'biaoti', 'yiji', 'title', 'heading'],
      execute: ({ cmView, from, to }) => {
        cmView.dispatch({
          changes: { from, to, insert: '# ' },
          selection: { anchor: from + 2 },
        })
        cmView.focus()
      },
    },
    {
      id: 'heading2',
      label: '二级标题',
      hint: '##',
      icon: Heading2,
      group: 'basic',
      keywords: ['h2', '2', 'biaoti', 'erji', 'title', 'heading'],
      execute: ({ cmView, from, to }) => {
        cmView.dispatch({
          changes: { from, to, insert: '## ' },
          selection: { anchor: from + 3 },
        })
        cmView.focus()
      },
    },
    {
      id: 'heading3',
      label: '三级标题',
      hint: '###',
      icon: Heading3,
      group: 'basic',
      keywords: ['h3', '3', 'biaoti', 'sanji', 'title', 'heading'],
      execute: ({ cmView, from, to }) => {
        cmView.dispatch({
          changes: { from, to, insert: '### ' },
          selection: { anchor: from + 4 },
        })
        cmView.focus()
      },
    },
    {
      id: 'bulletList',
      label: '无序列表',
      hint: '-',
      icon: List,
      group: 'basic',
      keywords: ['ul', 'list', 'wuxu', 'liebiao', 'bullet'],
      execute: ({ cmView, from, to }) => {
        cmView.dispatch({
          changes: { from, to, insert: '- ' },
          selection: { anchor: from + 2 },
        })
        cmView.focus()
      },
    },
    {
      id: 'orderedList',
      label: '有序列表',
      hint: '1.',
      icon: ListOrdered,
      group: 'basic',
      keywords: ['ol', 'ordered', 'youxu', 'liebiao', 'number'],
      execute: ({ cmView, from, to }) => {
        cmView.dispatch({
          changes: { from, to, insert: '1. ' },
          selection: { anchor: from + 3 },
        })
        cmView.focus()
      },
    },
    {
      id: 'blockquote',
      label: '引用区块',
      hint: '>',
      icon: Quote,
      group: 'basic',
      keywords: ['quote', 'yinyong', 'blockquote'],
      execute: ({ cmView, from, to }) => {
        cmView.dispatch({
          changes: { from, to, insert: '> ' },
          selection: { anchor: from + 2 },
        })
        cmView.focus()
      },
    },
    {
      id: 'horizontalRule',
      label: '分割线',
      hint: '---',
      icon: Minus,
      group: 'basic',
      keywords: ['hr', 'fengexian', 'divider', 'rule', 'line'],
      execute: ({ cmView, from, to }) => {
        const text = '\n---\n'
        cmView.dispatch({
          changes: { from, to, insert: text },
          selection: { anchor: from + text.length },
        })
        cmView.focus()
      },
    },
    {
      id: 'codeBlock',
      label: '代码块',
      hint: '```',
      icon: Code,
      group: 'insert',
      keywords: ['code', 'daima', 'codeblock', 'pre'],
      execute: ({ cmView, from, to }) => {
        const text = '```txt\n\n```\n'
        cmView.dispatch({
          changes: { from, to, insert: text },
          selection: { anchor: from + 7 },
        })
        cmView.focus()
      },
    },
    {
      id: 'table',
      label: '表格',
      hint: 'table',
      icon: Table,
      group: 'insert',
      keywords: ['table', 'biaoge', 'grid'],
      execute: ({ cmView, from, to }) => {
        const text = '\n| 标题 | 标题 | 标题 |\n| --- | --- | --- |\n| 内容 | 内容 | 内容 |\n'
        cmView.dispatch({
          changes: { from, to, insert: text },
          selection: { anchor: from + text.length },
        })
        cmView.focus()
      },
    },
    {
      id: 'math',
      label: '数学公式',
      hint: '$$',
      icon: Sigma,
      group: 'insert',
      keywords: ['math', 'gongshi', 'shuxue', 'latex', 'katex'],
      execute: ({ cmView, from, to }) => {
        const text = '$$\n\n$$\n'
        cmView.dispatch({
          changes: { from, to, insert: text },
          selection: { anchor: from + 3 },
        })
        cmView.focus()
      },
    },
  ]

  if (enableImageUpload) {
    commands.push({
      id: 'image',
      label: '插入图片',
      hint: 'img',
      icon: Image,
      group: 'insert',
      keywords: ['image', 'tupian', 'picture', 'upload', 'photo'],
      execute: ({ cmView, from, to, triggerImageUpload }) => {
        cmView.dispatch({ changes: { from, to, insert: '' } })
        triggerImageUpload()
      },
    })
  }

  if (enableMentions) {
    commands.push({
      id: 'reference',
      label: '站内引用',
      hint: '@',
      icon: AtSign,
      group: 'insert',
      keywords: ['reference', 'yinyong', 'guanlian', 'at', '@'],
      execute: ({ cmView, from, to, insertReference }) => {
        cmView.dispatch({ changes: { from, to, insert: '' } })
        insertReference()
      },
    })
  }

  if (enableEmbeds) {
    commands.push(
      {
        id: 'postEmbed',
        label: '文章卡片',
        hint: 'post',
        icon: FileText,
        group: 'insert',
        keywords: ['post', 'wenzhang', 'kapian', 'embed'],
        execute: ({ cmView, from, to, insertEmbed }) => {
          cmView.dispatch({ changes: { from, to, insert: '' } })
          insertEmbed('post')
        },
      },
      {
        id: 'musicEmbed',
        label: '音乐卡片',
        hint: 'music',
        icon: Music,
        group: 'insert',
        keywords: ['music', 'yinle', 'gequ', 'song', 'album'],
        execute: ({ cmView, from, to, insertEmbed }) => {
          cmView.dispatch({ changes: { from, to, insert: '' } })
          insertEmbed('music')
        },
      },
      {
        id: 'videoEmbed',
        label: '视频卡片',
        hint: 'video',
        icon: Video,
        group: 'insert',
        keywords: ['video', 'shipin', 'movie'],
        execute: ({ cmView, from, to, insertEmbed }) => {
          cmView.dispatch({ changes: { from, to, insert: '' } })
          insertEmbed('video')
        },
      },
    )
  }

  return commands
}

export function filterSlashCommands(commands: SlashMenuItem[], rawQuery: string): SlashMenuItem[] {
  const q = rawQuery.trim().toLowerCase()
  if (!q) return commands

  return commands.filter((cmd) => {
    return (
      cmd.id.toLowerCase().includes(q) ||
      cmd.label.toLowerCase().includes(q) ||
      (cmd.hint && cmd.hint.toLowerCase().includes(q)) ||
      cmd.keywords.some((k) => k.toLowerCase().includes(q))
    )
  })
}
