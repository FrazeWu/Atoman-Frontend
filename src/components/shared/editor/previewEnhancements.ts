export function enhancePreviewCodeBlocks(root: HTMLElement | null) {
  if (!root) return

  root.querySelectorAll('pre > code').forEach((code) => {
    const pre = code.parentElement
    if (!pre || pre.dataset.enhanced === 'true') return
    pre.dataset.enhanced = 'true'

    const titlebar = document.createElement('div')
    titlebar.className = 'code-block-titlebar'

    const lights = document.createElement('div')
    lights.className = 'code-block-lights'
    lights.innerHTML = '<span class="code-block-dot dot-red"></span><span class="code-block-dot dot-yellow"></span><span class="code-block-dot dot-green"></span>'
    titlebar.append(lights)

    const language = code.className.match(/(?:language|lang)-(\w+)/)?.[1]
    if (language) {
      const label = document.createElement('span')
      label.className = 'code-block-lang'
      label.textContent = language
      titlebar.append(label)
    }

    const copyButton = document.createElement('button')
    copyButton.type = 'button'
    copyButton.className = 'code-block-copy'
    copyButton.textContent = '复制'
    copyButton.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(code.textContent || '')
        copyButton.textContent = '已复制'
      } catch {
        copyButton.textContent = '复制失败'
      }
      window.setTimeout(() => { copyButton.textContent = '复制' }, 1500)
    })
    titlebar.append(copyButton)
    pre.prepend(titlebar)
  })
}
