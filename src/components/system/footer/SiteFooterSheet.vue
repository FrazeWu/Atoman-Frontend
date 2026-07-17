<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Copy, ExternalLink, Mail, MessageCircle } from 'lucide-vue-next'
import type { FootbarPanel } from '@/config/moduleRooms'
import PSheet from '@/components/ui/PSheet.vue'
import SiteAboutContent from './SiteAboutContent.vue'
import SitePolicyContent from './SitePolicyContent.vue'

const props = defineProps<{ panel: FootbarPanel | null }>()
defineEmits<{ close: [] }>()

const supportEmail = 'support@atoman.org'
const copied = ref(false)
const title = computed(() => ({
  about: '关于',
  contact: '联系我们',
  feedback: '问题反馈',
  terms: '使用条款',
  privacy: '隐私政策',
}[props.panel ?? 'about']))

watch(() => props.panel, () => {
  copied.value = false
})

async function copyEmail() {
  await navigator.clipboard.writeText(supportEmail)
  copied.value = true
}
</script>

<template>
  <PSheet
    :show="panel !== null"
    :title="title"
    side="bottom"
    close-type="header"
    panel-class="site-footer-sheet"
    height="min(82dvh, 820px)"
    reading-mode
    @close="$emit('close')"
  >
    <SiteAboutContent v-if="panel === 'about'" />

    <article v-else-if="panel === 'contact'" class="footer-sheet-content">
      <h2>联系我们</h2>
      <p class="footer-sheet-lead">合作、版权或其他事务，请通过邮件联系我们。</p>
      <a class="footer-sheet-email" :href="`mailto:${supportEmail}`">{{ supportEmail }}</a>
      <div class="footer-sheet-actions">
        <a class="footer-sheet-action footer-sheet-action--primary" :href="`mailto:${supportEmail}`">
          <Mail :size="16" aria-hidden="true" />
          发送邮件
        </a>
        <button class="footer-sheet-action" type="button" data-footer-action="copy-email" @click="copyEmail">
          <Copy :size="16" aria-hidden="true" />
          {{ copied ? '邮箱已复制' : '复制邮箱' }}
        </button>
      </div>
    </article>

    <article v-else-if="panel === 'feedback'" class="footer-sheet-content">
      <h2>问题反馈</h2>
      <p class="footer-sheet-lead">遇到功能异常或有改进建议，请选择合适的反馈方式。</p>
      <div class="footer-feedback-channels">
        <section>
          <h3>公开反馈</h3>
          <p>适合可公开讨论的功能异常和改进建议。</p>
          <a
            class="footer-sheet-action footer-sheet-action--primary"
            data-footer-action="github-issues"
            href="https://github.com/FrazeWu/Atoman/issues"
            target="_blank"
            rel="noopener noreferrer"
          >
            前往 GitHub
            <ExternalLink :size="16" aria-hidden="true" />
          </a>
        </section>
        <section>
          <h3>私信站长</h3>
          <p>适合涉及账号、隐私或希望直接沟通的问题。</p>
          <a class="footer-sheet-action" data-footer-action="message-owner" href="/inbox?tab=dm&amp;user=fazong">
            <MessageCircle :size="16" aria-hidden="true" />
            发起私信
          </a>
        </section>
      </div>
    </article>

    <SitePolicyContent v-else-if="panel === 'terms'" kind="terms" />
    <SitePolicyContent v-else-if="panel === 'privacy'" kind="privacy" />
  </PSheet>
</template>

<style>
.site-footer-sheet .sheet-content { padding: clamp(1.25rem, 4vw, 2.5rem); overscroll-behavior: contain; }
.site-footer-sheet .header-close-btn { width: 44px; height: 44px; padding: 0; }
.footer-sheet-content { color: var(--a-color-fg); }
.footer-sheet-content h2 { margin: 0; font-size: 2rem; font-weight: var(--a-font-weight-black); line-height: 1.2; }
.footer-sheet-lead { margin: var(--a-space-5) 0 0; color: var(--a-color-ink-muted); font-size: var(--a-text-md); line-height: 1.75; }
.footer-sheet-email { display: block; margin-top: var(--a-space-6); padding: var(--a-space-5) 0; border-block: var(--a-border); color: var(--a-color-fg); font-size: 1.875rem; font-weight: var(--a-font-weight-black); overflow-wrap: anywhere; text-decoration: none; }
.footer-sheet-actions { display: flex; flex-wrap: wrap; gap: var(--a-space-3); margin-top: var(--a-space-5); }
.footer-sheet-action { display: inline-flex; align-items: center; justify-content: center; gap: var(--a-space-2); min-height: 48px; padding: 0 var(--a-space-5); border: var(--a-border); background: var(--a-color-bg); color: var(--a-color-fg); font: inherit; font-size: var(--a-text-sm); font-weight: var(--a-font-weight-strong); text-decoration: none; cursor: pointer; }
.footer-sheet-action--primary,
.footer-sheet-action:hover { background: var(--a-color-fg); color: var(--a-color-bg); }
.footer-feedback-channels { margin-top: var(--a-space-6); border-top: var(--a-border); }
.footer-feedback-channels section { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: var(--a-space-4); padding: var(--a-space-6) 0; border-bottom: var(--a-border); }
.footer-feedback-channels h3,
.footer-feedback-channels p { margin: 0; }
.footer-feedback-channels p { margin-top: var(--a-space-2); color: var(--a-color-ink-muted); font-size: var(--a-text-sm); }
@media (max-width: 640px) {
  .site-footer-sheet { height: calc(100dvh - max(2rem, env(safe-area-inset-top))) !important; max-height: calc(100dvh - var(--a-content-bottom-offset)); }
  .footer-sheet-email { font-size: 1.25rem; }
  .footer-sheet-actions { display: grid; grid-template-columns: 1fr 1fr; }
  .footer-feedback-channels section { grid-template-columns: 1fr; }
}
</style>
