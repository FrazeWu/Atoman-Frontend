<template>
  <div class="a-page-md interaction-showcase">
    <div class="interaction-showcase__header">
      <h1>极简互动按钮展示 (Interaction Controls)</h1>
      <p>无需加载全站业务，专用于直观测试点赞、收藏与评论按钮的交互与细节。</p>
    </div>

    <div class="interaction-showcase__grid">
      <!-- 实时可点击的交互体验区 -->
      <section class="interaction-showcase__card">
        <h2>1. 动态交互体验 (Live Interactive Demo)</h2>
        <p class="interaction-showcase__desc">点击下方按钮可实时切换点赞与收藏状态，体验极简微弹力 Touch 反馈：</p>
        <div class="interaction-showcase__demo-box">
          <InteractionBar
            :liked="demoLiked"
            :like-count="demoLikeCount"
            show-bookmark
            :bookmarked="demoBookmarked"
            :bookmark-count="demoBookmarkCount"
            :comment-count="18"
            comment-href="#comments"
            @like="handleDemoLike"
            @unlike="handleDemoUnlike"
            @bookmark="handleDemoBookmark"
            @unbookmark="handleDemoUnbookmark"
          />
        </div>
      </section>

      <!-- 各种状态对比区 -->
      <section class="interaction-showcase__card">
        <h2>2. 视觉状态静态对比 (States Comparison)</h2>
        <div class="interaction-showcase__states">
          <div class="interaction-showcase__state-row">
            <span class="interaction-showcase__state-label">未点赞 / 未收藏：</span>
            <InteractionBar
              :liked="false"
              :like-count="42"
              show-bookmark
              :bookmarked="false"
              :bookmark-count="15"
              :comment-count="8"
            />
          </div>

          <div class="interaction-showcase__state-row">
            <span class="interaction-showcase__state-label">已点赞（高亮绯红）：</span>
            <InteractionBar
              :liked="true"
              :like-count="43"
              show-bookmark
              :bookmarked="false"
              :bookmark-count="15"
              :comment-count="8"
            />
          </div>

          <div class="interaction-showcase__state-row">
            <span class="interaction-showcase__state-label">已收藏（高亮金琥珀）：</span>
            <InteractionBar
              :liked="false"
              :like-count="42"
              show-bookmark
              :bookmarked="true"
              :bookmark-count="16"
              :comment-count="8"
            />
          </div>

          <div class="interaction-showcase__state-row">
            <span class="interaction-showcase__state-label">点赞 + 收藏均已激活：</span>
            <InteractionBar
              :liked="true"
              :like-count="43"
              show-bookmark
              :bookmarked="true"
              :bookmark-count="16"
              :comment-count="8"
            />
          </div>

          <div class="interaction-showcase__state-row">
            <span class="interaction-showcase__state-label">禁用态 (Disabled)：</span>
            <InteractionBar
              :liked="false"
              :like-count="0"
              show-bookmark
              :bookmarked="false"
              disabled
            />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import InteractionBar from '@/components/shared/InteractionBar.vue'

const demoLiked = ref(false)
const demoLikeCount = ref(42)
const demoBookmarked = ref(false)
const demoBookmarkCount = ref(15)

function handleDemoLike() {
  demoLiked.value = true
  demoLikeCount.value += 1
}

function handleDemoUnlike() {
  demoLiked.value = false
  demoLikeCount.value -= 1
}

function handleDemoBookmark() {
  demoBookmarked.value = true
  demoBookmarkCount.value += 1
}

function handleDemoUnbookmark() {
  demoBookmarked.value = false
  demoBookmarkCount.value -= 1
}
</script>

<style scoped>
.interaction-showcase {
  padding-top: 2rem;
  padding-bottom: 4rem;
}

.interaction-showcase__header {
  margin-bottom: 2rem;
}

.interaction-showcase__header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 0.5rem;
  color: var(--a-color-fg);
}

.interaction-showcase__header p {
  margin: 0;
  color: var(--a-color-muted);
  font-size: 0.9rem;
}

.interaction-showcase__grid {
  display: grid;
  gap: 1.5rem;
}

.interaction-showcase__card {
  padding: 1.5rem;
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  box-shadow: var(--a-shadow-sm);
}

.interaction-showcase__card h2 {
  margin: 0 0 0.75rem;
  font-size: 1.1rem;
  font-weight: 650;
  color: var(--a-color-fg);
}

.interaction-showcase__desc {
  margin: 0 0 1rem;
  color: var(--a-color-muted);
  font-size: 0.875rem;
}

.interaction-showcase__demo-box {
  padding: 1.25rem;
  background: var(--a-color-surface-muted);
  border: 1px dashed var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  display: flex;
  align-items: center;
}

.interaction-showcase__states {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.interaction-showcase__state-row {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 0.75rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.interaction-showcase__state-row:last-child {
  border-bottom: 0;
}

.interaction-showcase__state-label {
  width: 12rem;
  font-size: 0.875rem;
  color: var(--a-color-muted);
  font-weight: 500;
}

@media (max-width: 640px) {
  .interaction-showcase__state-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  .interaction-showcase__state-label {
    width: auto;
  }
}
</style>
