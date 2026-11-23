<template>
  <PModal
    :model-value="open"
    title="发起讨论"
    size="sm"
    :above-player="abovePlayer"
    @update:model-value="emit('close')"
  >
    <div class="quote-discuss-modal">
      <blockquote class="quote-discuss-modal__preview">
        <p class="quote-discuss-modal__quote">“{{ displayQuote }}”</p>
        <cite v-if="sourceTitle || sourceSubtitle" class="quote-discuss-modal__cite">
          ——《{{ sourceTitle }}》{{ sourceSubtitle ? ` · ${sourceSubtitle}` : '' }}
        </cite>
      </blockquote>

      <div class="quote-discuss-modal__options">
        <button
          type="button"
          class="quote-discuss-modal__option"
          data-testid="discuss-target-short-note"
          @click="choose('short_note', 'replace')"
        >
          <div class="quote-discuss-modal__option-icon">
            <MessageSquare :size="16" aria-hidden="true" />
          </div>
          <div class="quote-discuss-modal__option-text">
            <span class="quote-discuss-modal__option-title">发短笺</span>
            <span class="quote-discuss-modal__option-sub">附上片段和来源引用快速发表看法</span>
          </div>
        </button>

        <button
          type="button"
          class="quote-discuss-modal__option"
          data-testid="discuss-target-forum"
          @click="choose('forum', 'replace')"
        >
          <div class="quote-discuss-modal__option-icon">
            <MessagesSquare :size="16" aria-hidden="true" />
          </div>
          <div class="quote-discuss-modal__option-text">
            <span class="quote-discuss-modal__option-title">发起论坛讨论</span>
            <span class="quote-discuss-modal__option-sub">围绕此内容发起开放主题帖</span>
          </div>
        </button>

        <button
          type="button"
          class="quote-discuss-modal__option"
          data-testid="discuss-target-debate"
          @click="choose('debate', 'replace')"
        >
          <div class="quote-discuss-modal__option-icon">
            <Scale :size="16" aria-hidden="true" />
          </div>
          <div class="quote-discuss-modal__option-text">
            <span class="quote-discuss-modal__option-title">发起辩论命题</span>
            <span class="quote-discuss-modal__option-sub">提炼争议点并发起正反辩论</span>
          </div>
        </button>

        <template v-if="effectiveHasBlogDraft">
          <div class="quote-discuss-modal__draft-note">检测到已有未发布博文草稿：</div>
          <button
            type="button"
            class="quote-discuss-modal__option is-highlight"
            data-testid="discuss-target-blog-append"
            @click="choose('blog_post', 'append')"
          >
            <div class="quote-discuss-modal__option-icon">
              <CornerDownRight :size="16" aria-hidden="true" />
            </div>
            <div class="quote-discuss-modal__option-text">
              <span class="quote-discuss-modal__option-title">追加到当前博文草稿</span>
              <span class="quote-discuss-modal__option-sub">保留现有草稿，将引文追加到正文末尾</span>
            </div>
          </button>

          <button
            type="button"
            class="quote-discuss-modal__option"
            data-testid="discuss-target-blog-replace"
            @click="choose('blog_post', 'replace')"
          >
            <div class="quote-discuss-modal__option-icon">
              <Plus :size="16" aria-hidden="true" />
            </div>
            <div class="quote-discuss-modal__option-text">
              <span class="quote-discuss-modal__option-title">新建空白博文草稿</span>
              <span class="quote-discuss-modal__option-sub">另起一篇长文并自动填入来源引用</span>
            </div>
          </button>
        </template>

        <button
          v-else
          type="button"
          class="quote-discuss-modal__option"
          data-testid="discuss-target-blog"
          @click="choose('blog_post', 'replace')"
        >
          <div class="quote-discuss-modal__option-icon">
            <FileText :size="16" aria-hidden="true" />
          </div>
          <div class="quote-discuss-modal__option-text">
            <span class="quote-discuss-modal__option-title">写长文博文</span>
            <span class="quote-discuss-modal__option-sub">进入 Studio 撰写长评或深度回应</span>
          </div>
        </button>
      </div>
    </div>

    <template #footer>
      <div class="quote-discuss-modal__footer">
        <PButton variant="ghost" size="sm" @click="emit('close')">取消</PButton>
      </div>
    </template>
  </PModal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  CornerDownRight,
  FileText,
  MessageSquare,
  MessagesSquare,
  Plus,
  Scale,
} from 'lucide-vue-next'
import PButton from '@/components/ui/PButton.vue'
import PModal from '@/components/ui/PModal.vue'
import { hasExistingBlogPostDraft, type DiscussionQuoteTarget } from '@/stores/draftStaging'

const props = withDefaults(defineProps<{
  open: boolean
  quoteText: string
  sourceTitle: string
  sourceSubtitle?: string
  hasExistingBlogDraft?: boolean
  abovePlayer?: boolean
}>(), {
  sourceSubtitle: '',
  hasExistingBlogDraft: undefined,
  abovePlayer: true,
})

const emit = defineEmits<{
  close: []
  select: [payload: { target: DiscussionQuoteTarget; mode: 'append' | 'replace' }]
}>()

const displayQuote = computed(() => props.quoteText.trim() || props.sourceTitle.trim() || '阅读摘录')

const effectiveHasBlogDraft = computed(() => {
  if (typeof props.hasExistingBlogDraft === 'boolean') {
    return props.hasExistingBlogDraft
  }
  return hasExistingBlogPostDraft()
})

function choose(target: DiscussionQuoteTarget, mode: 'append' | 'replace') {
  emit('select', { target, mode })
}
</script>

<style scoped>
.quote-discuss-modal {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.quote-discuss-modal__preview {
  margin: 0;
  padding: 0.75rem 0.875rem;
  background: var(--a-color-bg-subtle, rgba(15, 23, 42, 0.03));
  border-left: 3px solid var(--a-color-primary);
  border-radius: var(--a-radius-control, 4px);
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.quote-discuss-modal__quote {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--a-color-fg);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.quote-discuss-modal__cite {
  font-size: 0.75rem;
  font-style: normal;
  color: var(--a-color-muted);
}

.quote-discuss-modal__draft-note {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: var(--a-color-muted);
}

.quote-discuss-modal__options {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.quote-discuss-modal__option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.7rem 0.85rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card, 4px);
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  text-align: left;
  cursor: pointer;
  box-shadow: none;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.quote-discuss-modal__option:hover,
.quote-discuss-modal__option.is-highlight {
  border-color: var(--a-color-primary);
  background: var(--a-color-bg-subtle, rgba(15, 23, 42, 0.02));
}

.quote-discuss-modal__option-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--a-color-primary);
}

.quote-discuss-modal__option-text {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.quote-discuss-modal__option-title {
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.3;
}

.quote-discuss-modal__option-sub {
  font-size: 0.75rem;
  color: var(--a-color-muted);
  line-height: 1.35;
}

.quote-discuss-modal__footer {
  display: flex;
  justify-content: flex-end;
  width: 100%;
}
</style>
