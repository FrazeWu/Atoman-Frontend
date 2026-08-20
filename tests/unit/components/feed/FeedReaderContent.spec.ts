import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'

// @ts-expect-error Isolated TypeScript diagnostics do not load the Vue SFC module resolver.
import FeedReaderContent from '../../../../src/components/feed/FeedReaderContent.vue'

describe('FeedReaderContent', () => {
  it('sanitizes unsafe markup and preserves semantic article structure', () => {
    const wrapper = mount(FeedReaderContent, {
      props: {
        html: '<h2>标题</h2><p style="color:red" onclick="alert(1)">正文</p><script>alert(1)</script><pre><code>const x = 1;\n  return x;</code></pre>',
      },
    })

    expect(wrapper.html()).toContain('<h2>标题</h2>')
    expect(wrapper.html()).toContain('const x = 1;\n  return x;')
    expect(wrapper.html()).not.toContain('<script')
    expect(wrapper.html()).not.toContain('onclick')
    expect(wrapper.html()).not.toContain('style=')
  })

  it('normalizes external links and reports failed images without layout overflow', async () => {
    const wrapper = mount(FeedReaderContent, {
      props: {
        html: '<p><a href="https://outside.example/post">外部链接</a></p><img src="https://outside.example/missing.jpg" alt="示例图" width="1200" height="800">',
      },
    })
    await nextTick()

    const link = wrapper.get('a')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toContain('noopener')

    const image = wrapper.get('img')
    expect(image.attributes('loading')).toBe('lazy')
    expect(image.classes()).toContain('feed-reader-image--sized')
    expect(image.attributes('style')).toContain('--feed-reader-image-ratio: 1200 / 800')
    await image.trigger('error')
    expect(wrapper.text()).toContain('图片无法加载：示例图')
    expect(image.classes()).toContain('feed-reader-image--failed')

    wrapper.unmount()
  })
})
