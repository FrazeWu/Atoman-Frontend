<template>
  <main class="design-system-view">
    <ASurface class="design-system-view__page" :layer="2">
      <section class="design-system-view__hero">
        <div>
          <p class="design-system-view__kicker">Control Language</p>
          <h1 class="design-system-view__title">Paper<br><em>Actions</em></h1>
          <p class="design-system-view__copy">
            Every operation should feel like an editor touching a page: tag it, index it, clip it, press it, reject it, or jump through bookmarks.
          </p>
        </div>
        <ACard>
          <strong class="design-system-view__note-title">Design Rule</strong>
          <p class="design-system-view__copy">关闭不是窗口按钮，而是书签上的 ×；点名字跳转，点 × 收回这一层。</p>
        </ACard>
      </section>

      <section class="design-system-view__grid" aria-label="Paper Actions examples">
        <ACard>
          <ASectionHeader title="PaperTab" description="筛选与切换。像贴在纸边的栏目签，active 时露出更多。" />
          <div class="design-system-view__demo-row">
            <PaperTab label="Featured" active />
            <PaperTab label="Latest" />
            <PaperTab label="Draft" />
          </div>
        </ACard>

        <ACard>
          <ASectionHeader title="PaperLink" description="目录索引式链接。黑点、底线和箭头明确告诉用户这里能点。" />
          <div class="design-system-view__demo-stack">
            <PaperLink to="/" label="View Channel" />
            <PaperLink href="https://example.com" label="Open Source" external target="_blank" />
          </div>
        </ACard>

        <ACard class="design-system-view__card-stage">
          <ASectionHeader title="PaperClip" description="收藏、订阅、加入合集。像把一张小纸条夹到稿件上。" />
          <div class="design-system-view__mini-paper">
            <strong>频道卡片</strong>
            <PaperClip class="design-system-view__clip" label="Clip" />
          </div>
        </ACard>

        <ACard>
          <ASectionHeader title="PaperPress" description="发布、保存、提交。像把动作条压在稿件上。" />
          <div class="design-system-view__demo-row">
            <PaperPress label="Publish" />
            <PaperPress label="Save Draft" variant="secondary" />
          </div>
        </ACard>

        <ACard class="design-system-view__card-stage">
          <ASectionHeader title="PaperReject" description="删除、移除、取消发布。像撤稿贴纸贴在纸边。" />
          <div class="design-system-view__mini-paper">
            <strong>草稿条目</strong>
            <PaperReject class="design-system-view__reject" label="Reject" />
          </div>
        </ACard>

        <ACard>
          <ASectionHeader title="PaperBookmarkTab" description="关闭与跳转覆纸层。书签左侧有 ×，中间写纸页名称，尾部有 tape。" />
          <div class="design-system-view__bookmark-stage">
            <ASurface class="design-system-view__bookmark-sheet" />
            <div class="design-system-view__bookmark-stack">
              <PaperBookmarkTab label="法堂首页" />
              <PaperBookmarkTab label="文章详情" active />
            </div>
          </div>
        </ACard>

        <ACard>
          <ASectionHeader title="AEmpty" description="空状态保持纸面留白，只暴露一个明确动作。" />
          <AEmpty title="暂无内容" description="还没有发布任何内容。">
            <template #action>
              <PaperPress label="Create" />
            </template>
          </AEmpty>
        </ACard>
      </section>
    </ASurface>
  </main>
</template>

<script setup lang="ts">
import ACard from '@/components/ui/ACard.vue'
import AEmpty from '@/components/ui/AEmpty.vue'
import ASectionHeader from '@/components/ui/ASectionHeader.vue'
import ASurface from '@/components/ui/ASurface.vue'
import PaperBookmarkTab from '@/components/ui/PaperBookmarkTab.vue'
import PaperClip from '@/components/ui/PaperClip.vue'
import PaperLink from '@/components/ui/PaperLink.vue'
import PaperPress from '@/components/ui/PaperPress.vue'
import PaperReject from '@/components/ui/PaperReject.vue'
import PaperTab from '@/components/ui/PaperTab.vue'
</script>

<style scoped>
.design-system-view {
  min-height: 100vh;
  background: #f6f7f8;
  padding: 36px;
}

.design-system-view__page {
  max-width: 1120px;
  margin: 0 auto;
  overflow: hidden;
  padding: 56px 64px 70px;
}

.design-system-view__hero {
  display: grid;
  grid-template-columns: 1fr 300px;
  align-items: end;
  gap: 48px;
  padding-bottom: 34px;
  border-bottom: 8px solid var(--a-color-ink);
}

.design-system-view__kicker {
  margin: 0;
  color: var(--a-color-ink-soft);
  font-family: var(--a-font-meta);
  font-size: 12px;
  font-weight: 950;
  letter-spacing: 0.36em;
  text-transform: uppercase;
}

.design-system-view__title {
  margin: 18px 0;
  color: var(--a-color-ink);
  font-size: clamp(64px, 8vw, 112px);
  font-weight: 950;
  letter-spacing: -0.075em;
  line-height: 0.78;
}

.design-system-view__title em {
  display: block;
  color: #dfe3e8;
  font-style: italic;
}

.design-system-view__copy {
  margin: 0;
  color: var(--a-color-ink-muted);
  font-size: 16px;
  font-weight: 560;
  line-height: 1.72;
}

.design-system-view__note-title {
  display: block;
  margin-bottom: 10px;
  font-size: 13px;
  font-weight: 950;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.design-system-view__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 28px;
  margin-top: 44px;
}

.design-system-view__demo-row,
.design-system-view__demo-stack {
  display: flex;
  gap: 14px;
  margin-top: 24px;
}

.design-system-view__demo-row {
  align-items: center;
  flex-wrap: wrap;
}

.design-system-view__demo-stack {
  flex-direction: column;
}

.design-system-view__mini-paper {
  position: relative;
  min-height: 104px;
  margin-top: 24px;
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper-soft);
  padding: 18px;
}

.design-system-view__clip,
.design-system-view__reject {
  position: absolute;
  top: 18px;
  right: -9px;
}

.design-system-view__bookmark-stage {
  position: relative;
  width: 230px;
  height: 140px;
  margin-top: 24px;
  padding-left: 40px;
}

.design-system-view__bookmark-sheet {
  position: absolute;
  inset: 12px 0 0 42px;
  background: var(--a-color-paper-soft);
}

.design-system-view__bookmark-stack {
  position: absolute;
  top: 22px;
  left: 0;
  z-index: 2;
  display: grid;
  gap: 8px;
}

.design-system-view__bookmark-stack > :nth-child(2) {
  transform: translateX(10px);
}

@media (max-width: 980px) {
  .design-system-view {
    padding: 20px;
  }

  .design-system-view__page {
    padding: 42px 28px 54px;
  }

  .design-system-view__hero,
  .design-system-view__grid {
    grid-template-columns: 1fr;
  }
}
</style>
