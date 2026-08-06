<template>
  <div class="a-page-md interaction-showcase">
    <MusicCreationFlowDrawer />

    <div class="interaction-showcase__header">
      <h1>极简组件与双栏 Studio 展示页</h1>
      <p>无需加载繁重全站业务，快速体验组件细节与重构后的“双栏 Studio 专辑创建页”。</p>
    </div>

    <div class="interaction-showcase__grid">
      <!-- 0. 双栏 Studio 专辑创建页一键体验 -->
      <section class="interaction-showcase__card is-highlight">
        <div class="interaction-showcase__studio-header">
          <div>
            <h2>🎵 双栏 Studio 专辑创建页 (2-Column Album Studio)</h2>
            <p class="interaction-showcase__desc" style="margin-bottom: 0;">点击下方按钮即可弹窗体验全新打造的左右双栏 Studio 专辑创建流：</p>
          </div>
          <PButton variant="primary" @click="openDemoCreationFlow">
            打开专辑创建页
          </PButton>
        </div>
      </section>

      <!-- 1. 组合组件 + 百分比横条 (Percentage Bar) -->
      <section class="interaction-showcase__card">
        <h2>1. 赞/踩百分比组合 (Like/Dislike Composite & Ratio Bar)</h2>
        <p class="interaction-showcase__desc">真实数字精准展示 (如 100 赞，12 踩)，点击可实时测试百分比与比例条更新：</p>
        <div class="interaction-showcase__demo-box">
          <PInteractionActions
            :liked="compositeState.liked"
            :like-count="compositeState.likeCount"
            :disliked="compositeState.disliked"
            :dislike-count="compositeState.dislikeCount"
            :bookmarked="compositeState.bookmarked"
            :bookmark-count="compositeState.bookmarkCount"
            show-ratio-bar
            variant="bordered"
            @like-change="handleLikeChange"
            @dislike-change="handleDislikeChange"
            @bookmark-change="handleBookmarkChange"
          />
        </div>
      </section>

      <!-- 2. 原子组件单独使用 (Atomic Components) -->
      <section class="interaction-showcase__card">
        <h2>2. 原子组件单独使用 (Atomic Components)</h2>
        <p class="interaction-showcase__desc">大拇指点赞与中性深灰线条独立控件：</p>
        <div class="interaction-showcase__atomic-row">
          <div class="interaction-showcase__atomic-item">
            <span>PLikeButton (大拇指点赞):</span>
            <PLikeButton
              :liked="atomicLike"
              :count="100"
              variant="bordered"
              @click="atomicLike = $event"
            />
          </div>

          <div class="interaction-showcase__atomic-item">
            <span>PDislikeButton (点踩):</span>
            <PDislikeButton
              :disliked="atomicDislike"
              :count="12"
              variant="bordered"
              @click="atomicDislike = $event"
            />
          </div>

          <div class="interaction-showcase__atomic-item">
            <span>PBookmarkButton (收藏):</span>
            <PBookmarkButton
              :bookmarked="atomicBookmark"
              :count="45"
              variant="bordered"
              @click="atomicBookmark = $event"
            />
          </div>
        </div>
      </section>

      <!-- 3. 不同百分比真实数据对照 -->
      <section class="interaction-showcase__card">
        <h2>3. 真实数量比例横条对照 (Ratio Progress Examples)</h2>
        <div class="interaction-showcase__states">
          <div class="interaction-showcase__state-row">
            <span class="interaction-showcase__state-label">89% 好评 (100 赞 · 12 踩)：</span>
            <PInteractionActions
              :like-count="100"
              :dislike-count="12"
              :bookmark-count="45"
              show-ratio-bar
              variant="bordered"
            />
          </div>

          <div class="interaction-showcase__state-row">
            <span class="interaction-showcase__state-label">50% 五五开评价 (100 赞 · 100 踩)：</span>
            <PInteractionActions
              :like-count="100"
              :dislike-count="100"
              :bookmark-count="20"
              show-ratio-bar
              variant="bordered"
            />
          </div>

          <div class="interaction-showcase__state-row">
            <span class="interaction-showcase__state-label">20% 低分评价 (20 赞 · 80 踩)：</span>
            <PInteractionActions
              :like-count="20"
              :dislike-count="80"
              :bookmark-count="5"
              show-ratio-bar
              variant="bordered"
            />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import PBookmarkButton from '@/components/ui/PBookmarkButton.vue'
import PButton from '@/components/ui/PButton.vue'
import PDislikeButton from '@/components/ui/PDislikeButton.vue'
import PInteractionActions from '@/components/ui/PInteractionActions.vue'
import PLikeButton from '@/components/ui/PLikeButton.vue'
import MusicCreationFlowDrawer from '@/components/music/MusicCreationFlowDrawer.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'

const { openMusicCreationFlow } = useMusicDrawers()

function openDemoCreationFlow() {
  openMusicCreationFlow({ startStep: 'albumDetails' })
}

const compositeState = reactive({
  liked: false,
  likeCount: 100,
  disliked: false,
  dislikeCount: 12,
  bookmarked: false,
  bookmarkCount: 45,
})

const atomicLike = ref(false)
const atomicDislike = ref(false)
const atomicBookmark = ref(false)

function handleLikeChange(nextLiked: boolean) {
  compositeState.liked = nextLiked
  if (nextLiked) {
    compositeState.likeCount += 1
    if (compositeState.disliked) {
      compositeState.disliked = false
      compositeState.dislikeCount -= 1
    }
  } else {
    compositeState.likeCount -= 1
  }
}

function handleDislikeChange(nextDisliked: boolean) {
  compositeState.disliked = nextDisliked
  if (nextDisliked) {
    compositeState.dislikeCount += 1
    if (compositeState.liked) {
      compositeState.liked = false
      compositeState.likeCount -= 1
    }
  } else {
    compositeState.dislikeCount -= 1
  }
}

function handleBookmarkChange(nextBookmarked: boolean) {
  compositeState.bookmarked = nextBookmarked
  if (nextBookmarked) {
    compositeState.bookmarkCount += 1
  } else {
    compositeState.bookmarkCount -= 1
  }
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
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  display: flex;
  align-items: center;
}

.interaction-showcase__atomic-row {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
}

.interaction-showcase__atomic-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.875rem;
  color: var(--a-color-muted);
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
  width: 16rem;
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
.interaction-showcase__card.is-highlight {
  border-color: var(--a-color-primary);
  background: var(--a-color-surface-muted);
}

.interaction-showcase__studio-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
}

@media (max-width: 640px) {
  .interaction-showcase__studio-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
