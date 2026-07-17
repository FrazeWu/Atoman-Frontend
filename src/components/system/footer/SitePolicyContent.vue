<script setup lang="ts">
import { computed } from 'vue'

type PolicyKind = 'terms' | 'privacy'
type PolicySection = { title: string; paragraphs: string[] }

const props = defineProps<{ kind: PolicyKind }>()

const documents: Record<PolicyKind, { title: string; intro: string; sections: PolicySection[] }> = {
  terms: {
    title: '使用条款',
    intro: '使用凹凸庵，即表示你理解并同意以下条款。',
    sections: [
      { title: '账号与使用', paragraphs: ['请妥善保管登录凭证，并对账号下的活动负责。'] },
      { title: '内容与行为', paragraphs: ['不得发布违反良法、侵权的内容，也不得骚扰、冒充他人或破坏平台安全。'] },
      { title: '内容权利', paragraphs: ['你保留所发布内容的权利，并授予凹凸庵提供发布、展示和分发所必需的非独占许可。'] },
      { title: '服务说明', paragraphs: ['我们会尽力维持服务稳定，但不保证服务始终不中断或没有错误。'] },
      { title: '联系方式', paragraphs: ['对本条款有疑问，可发送邮件至 support@atoman.org。'] },
    ],
  },
  privacy: {
    title: '隐私政策',
    intro: '凹凸庵只处理提供账号、发布、订阅、通知和互动功能所必需的数据。',
    sections: [
      { title: '我们处理的数据', paragraphs: ['包括账号资料、发布内容、互动记录，以及保障服务安全所需的技术信息。'] },
      { title: '数据用途', paragraphs: ['这些数据用于身份验证、内容展示、通知、服务安全和问题排查。'] },
      { title: '公开与非公开信息', paragraphs: ['公开资料和公开内容可能被任何人访问；邮箱、密码哈希和私信不会作为公开资料展示。私信目前并非端到端加密。'] },
      { title: '保存与注销', paragraphs: ['你可以在设置中注销账号，并按页面提供的选项处理公开内容。'] },
      { title: '联系方式', paragraphs: ['对个人数据处理有疑问，可发送邮件至 support@atoman.org。'] },
    ],
  },
}

const document = computed(() => documents[props.kind])
</script>

<template>
  <article class="site-policy-content">
    <h2>{{ document.title }}</h2>
    <p class="site-policy-updated">更新日期：2026 年 7 月 13 日</p>
    <p class="site-policy-intro">{{ document.intro }}</p>
    <section v-for="section in document.sections" :key="section.title">
      <h3>{{ section.title }}</h3>
      <p v-for="paragraph in section.paragraphs" :key="paragraph">{{ paragraph }}</p>
    </section>
  </article>
</template>

<style scoped>
.site-policy-content { color: var(--a-color-fg); }
.site-policy-content h2 { margin: 0; font-size: 2rem; font-weight: var(--a-font-weight-black); line-height: 1.2; }
.site-policy-updated { margin: var(--a-space-2) 0 0; color: var(--a-color-muted); font-size: var(--a-text-xs); }
.site-policy-intro,
.site-policy-content section p { color: var(--a-color-ink-muted); font-size: var(--a-text-md); line-height: 1.75; }
.site-policy-intro { margin: var(--a-space-5) 0 0; }
.site-policy-content section { margin-top: 2.25rem; padding-top: var(--a-space-5); border-top: var(--a-border); }
.site-policy-content h3 { margin: 0 0 var(--a-space-3); font-size: var(--a-text-md); font-weight: var(--a-font-weight-black); }
.site-policy-content section p { margin: 0; }
.site-policy-content section p + p { margin-top: var(--a-space-3); }
@media (max-width: 640px) { .site-policy-content h2 { font-size: 1.625rem; } }
</style>
