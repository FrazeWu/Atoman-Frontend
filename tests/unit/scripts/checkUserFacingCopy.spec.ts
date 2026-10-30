import { describe, expect, it } from 'vitest'
import {
  scanTextForForbiddenCopy,
  type CopyIssue,
} from '@/../scripts/check-user-facing-copy'

describe('scanTextForForbiddenCopy', () => {
  it('detects COMING SOON in template content', () => {
    const code = `
      <template>
        <div>COMING SOON</div>
      </template>
    `
    const issues = scanTextForForbiddenCopy(code, 'src/views/Example.vue')
    expect(issues.length).toBeGreaterThan(0)
    expect(issues[0].keyword).toMatch(/coming soon/i)
  })

  it('detects dev-facing moderation keywords such as 审核理由 and 投稿说明', () => {
    const code = `
      <template>
        <p>审核理由：不符合规定</p>
        <span>投稿说明</span>
      </template>
    `
    const issues = scanTextForForbiddenCopy(code, 'src/views/Example.vue')
    expect(issues.map(i => i.keyword)).toContain('审核理由')
    expect(issues.map(i => i.keyword)).toContain('投稿说明')
  })

  it('detects non-standard action words like 退藏 and 移出队列', () => {
    const code = `
      <button>退藏</button>
      <button>移出队列</button>
    `
    const issues = scanTextForForbiddenCopy(code, 'src/views/Actions.vue')
    expect(issues.map(i => i.keyword)).toContain('退藏')
    expect(issues.map(i => i.keyword)).toContain('移出队列')
  })

  it('detects internal error exposures in user facing strings', () => {
    const code = `
      showToast('系统内部错误，请重试')
    `
    const issues = scanTextForForbiddenCopy(code, 'src/composables/useAction.ts')
    expect(issues.some(i => i.keyword.includes('内部错误'))).toBe(true)
  })

  it('ignores standard system font declarations like -apple-system', () => {
    const code = `
      <style>
        .title { font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
      </style>
    `
    const issues = scanTextForForbiddenCopy(code, 'src/components/Font.vue')
    expect(issues.length).toBe(0)
  })

  it('ignores code identifiers containing system like isSystemNotification', () => {
    const code = `
      const isSystemNotification = computed(() => type === 'system')
    `
    const issues = scanTextForForbiddenCopy(code, 'src/components/Notification.vue')
    expect(issues.length).toBe(0)
  })

  it('allows compliant user-state wording like 尚未开放 and 取消收藏', () => {
    const code = `
      <template>
        <button>取消收藏</button>
        <button>取消稍后阅读</button>
        <p>该功能尚未开放</p>
      </template>
    `
    const issues = scanTextForForbiddenCopy(code, 'src/views/Good.vue')
    expect(issues.length).toBe(0)
  })
})
