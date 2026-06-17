<template>
  <section class="music-explore-view">
    <header class="page-header">
      <p class="a-font-meta kicker">MUSIC INDEX / EXPLORE</p>
      <h1 class="page-title">探索</h1>
      <p class="page-desc">从风格、年代和新入库记录切入音乐档案，像翻阅一叠刚拆封的唱片目录。</p>
    </header>

    <div class="index-grid" aria-label="音乐探索入口">
      <article class="index-card feature-card">
        <span class="card-num">01</span>
        <p class="a-font-meta card-label">NEW ARRIVALS</p>
        <h2>新入库档案</h2>
        <p>查看最近补全的艺术家、专辑与曲目。</p>
      </article>

      <article class="index-card">
        <span class="card-num">02</span>
        <p class="a-font-meta card-label">GENRE SHELF</p>
        <h2>按风格翻找</h2>
        <p>从摇滚、民谣、电子或实验音乐开始浏览。</p>
      </article>

      <article class="index-card">
        <span class="card-num">03</span>
        <p class="a-font-meta card-label">TIMELINE</p>
        <h2>年代索引</h2>
        <p>沿时间线回看不同阶段的音乐现场。</p>
      </article>
    </div>
  </section>
</template>

<style scoped>
.music-explore-view {
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
}

.page-header {
  max-width: 760px;
  border-left: 8px solid var(--a-color-ink);
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

.index-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.25rem;
}

.index-card {
  position: relative;
  min-height: 220px;
  padding: 1.5rem;
  border: 2px solid var(--a-color-ink);
  background: var(--a-color-paper);
  box-shadow: 8px 8px 0 rgba(0, 0, 0, 0.08);
}

.feature-card {
  transform: rotate(-1deg);
}

.card-num {
  position: absolute;
  top: 1rem;
  right: 1rem;
  font-family: var(--a-font-meta);
  font-size: 2.75rem;
  font-weight: 900;
  line-height: 1;
  opacity: 0.08;
}

.card-label {
  margin: 0 0 2rem;
  color: var(--a-color-muted);
}

.index-card h2 {
  margin: 0 0 0.75rem;
  font-size: 1.5rem;
  font-weight: 900;
  letter-spacing: -0.04em;
}

.index-card p:last-child {
  margin: 0;
  color: var(--a-color-muted);
  line-height: 1.7;
}
</style>
