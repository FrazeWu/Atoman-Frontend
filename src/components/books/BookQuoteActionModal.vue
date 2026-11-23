<template>
  <PModal
    :model-value="open"
    :title="effectiveHasDraft ? '检测到已有博文草稿' : '引用写作'"
    size="sm"
    @update:model-value="emit('close')"
  >
    <div class="book-quote-action-modal">
      <blockquote v-if="item" class="book-quote-action-modal__preview">
        <p class="book-quote-action-modal__quote">“{{ item.text }}”</p>
        <cite class="book-quote-action-modal__cite">——《{{ bookTitle }}》{{ bookAuthor ? ` · ${bookAuthor}` : '' }}</cite>
      </blockquote>

      <!-- 如果存在已有草稿，显示冲突决策选项 -->
      <div v-if="effectiveHasDraft" class="book-quote-action-modal__conflict">
        <p class="book-quote-action-modal__desc">
          您有一篇正在编辑的草稿，请选择如何处理此段书摘：
        </p>

        <div class="book-quote-action-modal__options">
          <button
            type="button"
            class="book-quote-action-modal__option is-highlight"
            data-testid="quote-target-blog-append"
            @click="choose('blog_post', 'append')"
          >
            <div class="book-quote-action-modal__option-icon">
              <CornerDownRight :size="16" aria-hidden="true" />
            </div>
            <div class="book-quote-action-modal__option-text">
              <span class="book-quote-action-modal__option-title">追加到当前草稿末尾</span>
              <span class="book-quote-action-modal__option-sub">保留当前草稿内容，将书摘作为新引用追加</span>
            </div>
          </button>

          <button
            type="button"
            class="book-quote-action-modal__option"
            data-testid="quote-target-blog-replace"
            @click="choose('blog_post', 'replace')"
          >
            <div class="book-quote-action-modal__option-icon">
              <Plus :size="16" aria-hidden="true" />
            </div>
            <div class="book-quote-action-modal__option-text">
              <span class="book-quote-action-modal__option-title">作为新博文草稿</span>
              <span class="book-quote-action-modal__option-sub">另起一篇空白博文草稿并填入书摘</span>
            </div>
          </button>

          <button
            type="button"
            class="book-quote-action-modal__option"
            data-testid="quote-target-short-note"
            @click="choose('short_note', 'replace')"
          >
            <div class="book-quote-action-modal__option-icon">
              <MessageSquare :size="16" aria-hidden="true" />
            </div>
            <div class="book-quote-action-modal__option-text">
              <span class="book-quote-action-modal__option-title">转为随手短笺</span>
              <span class="book-quote-action-modal__option-sub">快速发布轻量阅读随笔与灵感</span>
            </div>
          </button>

          <button
            type="button"
            class="book-quote-action-modal__option"
            data-testid="quote-target-forum"
            @click="choose('forum', 'replace')"
          >
            <div class="book-quote-action-modal__option-icon">
              <MessagesSquare :size="16" aria-hidden="true" />
            </div>
            <div class="book-quote-action-modal__option-text">
              <span class="book-quote-action-modal__option-title">发起论坛讨论</span>
              <span class="book-quote-action-modal__option-sub">围绕此段摘录发起开放讨论主题</span>
            </div>
          </button>

          <button
            type="button"
            class="book-quote-action-modal__option"
            data-testid="quote-target-debate"
            @click="choose('debate', 'replace')"
          >
            <div class="book-quote-action-modal__option-icon">
              <Scale :size="16" aria-hidden="true" />
            </div>
            <div class="book-quote-action-modal__option-text">
              <span class="book-quote-action-modal__option-title">发起辩论命题</span>
              <span class="book-quote-action-modal__option-sub">基于书中观点发起正反方辩论</span>
            </div>
          </button>
        </div>
      </div>

      <!-- 常规目标选择（长文 / 短笺 / 论坛 / 辩论） -->
      <div v-else class="book-quote-action-modal__options">
        <button
          type="button"
          class="book-quote-action-modal__option"
          data-testid="quote-target-blog"
          @click="choose('blog_post', 'replace')"
        >
          <div class="book-quote-action-modal__option-icon">
            <FileText :size="16" aria-hidden="true" />
          </div>
          <div class="book-quote-action-modal__option-text">
            <span class="book-quote-action-modal__option-title">转为长文博文</span>
            <span class="book-quote-action-modal__option-sub">进入 Studio 撰写长评或专栏文章</span>
          </div>
        </button>

        <button
          type="button"
          class="book-quote-action-modal__option"
          data-testid="quote-target-short-note"
          @click="choose('short_note', 'replace')"
        >
          <div class="book-quote-action-modal__option-icon">
            <MessageSquare :size="16" aria-hidden="true" />
          </div>
          <div class="book-quote-action-modal__option-text">
            <span class="book-quote-action-modal__option-title">转为随手短笺</span>
            <span class="book-quote-action-modal__option-sub">快速发布轻量阅读随笔与灵感</span>
          </div>
        </button>

        <button
          type="button"
          class="book-quote-action-modal__option"
          data-testid="quote-target-forum"
          @click="choose('forum', 'replace')"
        >
          <div class="book-quote-action-modal__option-icon">
            <MessagesSquare :size="16" aria-hidden="true" />
          </div>
          <div class="book-quote-action-modal__option-text">
            <span class="book-quote-action-modal__option-title">发起论坛讨论</span>
            <span class="book-quote-action-modal__option-sub">围绕此段摘录发起开放讨论主题</span>
          </div>
        </button>

        <button
          type="button"
          class="book-quote-action-modal__option"
          data-testid="quote-target-debate"
          @click="choose('debate', 'replace')"
        >
          <div class="book-quote-action-modal__option-icon">
            <Scale :size="16" aria-hidden="true" />
          </div>
          <div class="book-quote-action-modal__option-text">
            <span class="book-quote-action-modal__option-title">发起辩论命题</span>
            <span class="book-quote-action-modal__option-sub">基于书中观点发起正反方辩论</span>
          </div>
        </button>
      </div>
    </div>

    <template #footer>
      <div class="book-quote-action-modal__footer">
        <PButton variant="ghost" size="sm" @click="emit('close')">取消</PButton>
      </div>
    </template>
  </PModal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { CornerDownRight, FileText, MessageSquare, MessagesSquare, Plus, Scale } from 'lucide-vue-next'
import PButton from '@/components/ui/PButton.vue'
import PModal from '@/components/ui/PModal.vue'
import { hasExistingBlogPostDraft, type DiscussionQuoteTarget } from '@/stores/draftStaging'
import type { BookAnnotation } from '@/api/books'

const props = withDefaults(
  defineProps<{
    open: boolean
    item: BookAnnotation | null
    bookTitle: string
    bookAuthor?: string
    hasExistingDraft?: boolean
  }>(),
  {
    bookAuthor: '',
    hasExistingDraft: undefined,
  }
)

const emit = defineEmits<{
  close: []
  select: [payload: { target: DiscussionQuoteTarget; mode: 'append' | 'replace' }]
}>()

const effectiveHasDraft = computed(() => {
  if (typeof props.hasExistingDraft === 'boolean') {
    return props.hasExistingDraft
  }
  return hasExistingBlogPostDraft()
})

const choose = (target: DiscussionQuoteTarget, mode: 'append' | 'replace') => {
  emit('select', { target, mode })
}
</script>

<style scoped>
.book-quote-action-modal {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.book-quote-action-modal__preview {
  margin: 0;
  padding: 0.75rem 0.875rem;
  background: var(--a-color-bg-subtle, #f9fafb);
  border-left: 3px solid var(--a-color-primary, #10b981);
  border-radius: var(--a-radius-control, 4px);
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.book-quote-action-modal__quote {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--a-color-text);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.book-quote-action-modal__cite {
  font-size: 0.75rem;
  color: var(--a-color-text-muted);
  font-style: normal;
  text-align: right;
}

.book-quote-action-modal__desc {
  margin: 0 0 0.75rem;
  font-size: 0.8125rem;
  color: var(--a-color-text-secondary);
}

.book-quote-action-modal__options {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.book-quote-action-modal__option {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem 0.875rem;
  background: var(--a-color-bg, #ffffff);
  border: 1px solid var(--a-color-border-soft, #e5e7eb);
  border-radius: var(--a-radius-control, 4px);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.book-quote-action-modal__option:hover {
  border-color: var(--a-color-primary, #10b981);
  background: color-mix(in srgb, var(--a-color-primary, #10b981) 4%, #ffffff);
}

.book-quote-action-modal__option.is-highlight {
  border-color: color-mix(in srgb, var(--a-color-primary, #10b981) 40%, var(--a-color-border-soft));
}

.book-quote-action-modal__option-icon {
  margin-top: 0.125rem;
  color: var(--a-color-primary, #10b981);
  flex-shrink: 0;
}

.book-quote-action-modal__option-text {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.book-quote-action-modal__option-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--a-color-text);
}

.book-quote-action-modal__option-sub {
  font-size: 0.75rem;
  color: var(--a-color-text-muted);
  line-height: 1.4;
}

.book-quote-action-modal__footer {
  display: flex;
  justify-content: flex-end;
}
</style>
