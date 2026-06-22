<template>
  <section class="music-starred-view">
    <header class="page-header">
      <p class="a-font-meta kicker">PRIVATE CLIPS / STARRED</p>
      <h1 class="page-title">我的收藏</h1>
      <p class="page-desc">把想反复听、想继续校对或想留作线索的音乐档案夹在这里。</p>
    </header>

    <div class="empty-paper" role="status">
      <span class="p-tab a-font-meta">STARRED</span>
      <p class="a-font-meta empty-label">NO CLIPS YET</p>
      <h2>还没有收藏的音乐档案</h2>
      <p>在艺术家或专辑页面点击收藏后，它们会像纸夹一样出现在这里。</p>
    </div>
  </section>
</template>

<style scoped>
.music-starred-view {
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
}

.page-header {
  max-width: 760px;
  border-left: 4px solid var(--a-color-line-soft);
  padding-left: 1.25rem;
}

.kicker {
  margin: 0 0 0.75rem;
  color: var(--a-color-muted);
}

.page-title {
  margin: 0;
  font-family: var(--a-font-serif);
  font-size: clamp(3rem, 8vw, 6rem);
  font-style: italic;
  font-weight: 900;
  line-height: 0.9;
}

.page-desc {
  margin: 1rem 0 0;
  color: var(--a-color-muted);
  font-size: 1.05rem;
  line-height: 1.8;
}

.empty-paper {
  position: relative;
  max-width: 680px;
  min-height: 260px;
  padding: 3rem 2rem 2rem;
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper);
  box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.15);
}

.p-tab {
  position: absolute;
  top: -1px;
  right: 2rem;
  padding: 0.65rem 1rem;
  border: 1px solid var(--a-color-line-soft);
  border-top: 0;
  background: var(--a-color-paper);
}

.empty-label {
  margin: 0 0 1.5rem;
  color: var(--a-color-muted);
}

.empty-paper h2 {
  margin: 0 0 0.75rem;
  font-size: 1.75rem;
  font-weight: 900;
  letter-spacing: -0.04em;
}

.empty-paper p:last-child {
  margin: 0;
  color: var(--a-color-muted);
  line-height: 1.7;
}
</style>
