<script setup lang="ts">
import { computed } from 'vue'

type PolicyKind = 'terms' | 'privacy'
type PolicyBullet = { label?: string; text: string }
type PolicySection = { title: string; paragraphs?: string[]; bullets?: PolicyBullet[] }
type PolicyDocument = { title: string; intro: string; sections: PolicySection[] }

const props = withDefaults(defineProps<{
  kind: PolicyKind
  headingLevel?: 'h1' | 'h2'
}>(), {
  headingLevel: 'h2',
})

const documents: Record<PolicyKind, PolicyDocument> = {
  terms: {
    title: '使用条款',
    intro: '使用凹凸庵，即表示你理解并同意以下条款。',
    sections: [
      { title: '1. 账号与使用', paragraphs: ['请妥善保管登录凭证，并对账号下的活动负责。不得冒用、买卖账号或利用账号干扰他人正常使用。'] },
      {
        title: '2. 内容与行为',
        bullets: [
          { text: '不得发布违反良法、侵权的内容。' },
          { text: '不得骚扰、威胁、冒充他人或恶意泄露个人信息。' },
          { text: '不得发送垃圾信息、恶意操纵服务或破坏平台安全。' },
          { text: '对事实和观点存在分歧本身，不作为删除内容或限制账号的理由。' },
        ],
      },
      {
        title: '3. 内容权利',
        paragraphs: [
          '你保留所发布内容的权利，并授予凹凸庵为提供发布、展示、订阅和 RSS 分发所必需的非独占许可。',
          '删除内容后，凹凸庵将停止继续公开展示；已经被外部 RSS 客户端或第三方获取的副本，凹凸庵无法代为撤回。',
        ],
      },
      { title: '4. 内容与账号处置', paragraphs: ['对于违反上述规则的内容或账号，凹凸庵可根据实际情况采取隐藏、删除或限制账号等必要措施。'] },
      { title: '5. 服务说明', paragraphs: ['我们会尽力维持服务稳定，但不保证服务始终不中断或没有错误。请自行保留重要内容的备份。'] },
      { title: '6. 条款更新', paragraphs: ['条款发生变化时，我们会更新本页日期。重大变化将在站内以合理方式提示。'] },
      { title: '7. 联系方式', paragraphs: ['对本条款有疑问，可发送邮件至 support@atoman.org，或私信站长 @fazong。'] },
    ],
  },
  privacy: {
    title: '隐私政策',
    intro: '凹凸庵只处理提供账号、发布、订阅、通知和互动功能所必需的数据。我们不会出售你的个人信息，也不会将其用于定向广告。',
    sections: [
      {
        title: '1. 我们处理的数据',
        bullets: [
          { label: '账号信息：', text: '邮箱、用户名、密码哈希，以及你填写的显示名称、头像、简介、网站和所在地。' },
          { label: '内容与互动：', text: '你发布、上传或保存的文章、评论、订阅、收藏、播放与阅读进度、修订记录及其他互动。' },
          { label: '私信：', text: '私信文字和图片会被存储，用于向会话双方提供私信功能。私信不会公开展示，但目前并非端到端加密。' },
          { label: '技术信息：', text: '服务请求可能记录 IP 地址、访问时间、请求路径、设备或浏览器信息，用于安全、防滥用和故障排查。' },
        ],
      },
      { title: '2. 数据用途', paragraphs: ['我们使用这些数据完成身份验证、内容发布与展示、订阅与推荐、互动通知、私信、文件存储、服务安全和问题排查。不会将数据用于与这些目的无关的营销。'] },
      {
        title: '3. 公开与非公开信息',
        paragraphs: [
          '用户名、显示名称、头像、简介以及你选择公开发布的内容可能被任何人访问，并可能通过 RSS 或分享链接传播。',
          '邮箱、密码哈希、登录凭证和私信不会作为公开资料展示。私信接收方仍可保存或转发其收到的内容。',
        ],
      },
      { title: '4. 浏览器本地数据', paragraphs: ['凹凸庵会在浏览器本地保存登录状态、界面偏好、草稿、过滤规则以及播放或阅读进度。这些数据用于维持你的使用状态，不用于跨站广告追踪。你可以通过退出登录或清理浏览器数据移除其中部分内容。'] },
      { title: '5. 服务提供方', paragraphs: ['为运行服务，必要数据可能由以下服务提供方处理：Cloudflare 提供页面托管、CDN、人机验证和对象存储；Neon 提供数据库；Resend 用于发送邮箱验证码。访问外部链接或播放第三方媒体时，对方也可能收到必要的网络请求信息。'] },
      {
        title: '6. 保存与注销',
        paragraphs: [
          '账号有效期间，我们会保存提供服务所需的数据。你可以在设置中注销账号，并选择删除公开内容，或保留内容但移除账号关联。默认选择删除公开内容。',
          '注销后，账号将停止使用，公开个人资料不再展示。为保障安全、处理争议或完成备份轮换，部分必要记录可能在有限期限内继续保存。',
        ],
      },
      { title: '7. 你的选择', paragraphs: ['你可以查看和修改公开资料、删除自己有权管理的内容、调整隐私与私信设置，并在设置中注销账号。'] },
      { title: '8. 联系方式', paragraphs: ['对个人数据处理有疑问，可发送邮件至 support@atoman.org，或私信站长 @fazong。'] },
    ],
  },
}

const document = computed(() => documents[props.kind])
</script>

<template>
  <article class="site-policy-content">
    <component :is="headingLevel" class="site-policy-title">{{ document.title }}</component>
    <p class="site-policy-updated">更新日期：2026 年 7 月 13 日</p>
    <p class="site-policy-intro">{{ document.intro }}</p>

    <section v-for="section in document.sections" :key="section.title" class="site-policy-section">
      <h3>{{ section.title }}</h3>
      <p v-for="paragraph in section.paragraphs" :key="paragraph">{{ paragraph }}</p>
      <ul v-if="section.bullets">
        <li v-for="bullet in section.bullets" :key="bullet.text">
          <strong v-if="bullet.label">{{ bullet.label }}</strong>{{ bullet.text }}
        </li>
      </ul>
    </section>
  </article>
</template>

<style scoped>
.site-policy-content {
  color: var(--a-color-fg);
}

.site-policy-title {
  margin: 0;
  font-size: 2rem;
  font-weight: var(--a-font-weight-black);
  line-height: 1.2;
  letter-spacing: 0;
}

.site-policy-updated {
  margin: var(--a-space-2) 0 0;
  color: var(--a-color-muted);
  font-size: var(--a-text-xs);
}

.site-policy-intro,
.site-policy-section p,
.site-policy-section li {
  color: var(--a-color-text-secondary);
  font-size: var(--a-text-md);
  line-height: 1.75;
}

.site-policy-intro {
  margin: var(--a-space-5) 0 0;
}

.site-policy-section {
  margin-top: 2.25rem;
  padding-top: var(--a-space-5);
  border-top: var(--a-border);
}

.site-policy-section h3 {
  margin: 0 0 var(--a-space-3);
  font-size: var(--a-text-md);
  font-weight: var(--a-font-weight-black);
}

.site-policy-section p {
  margin: 0;
}

.site-policy-section p + p {
  margin-top: var(--a-space-3);
}

.site-policy-section ul {
  margin: 0;
  padding-left: 1.25rem;
}

.site-policy-section li + li {
  margin-top: var(--a-space-2);
}

@media (max-width: 640px) {
  .site-policy-title {
    font-size: 1.625rem;
  }
}
</style>
