<template>
  <main class="debate-rules a-page-xl">
    <PPageHeader title="辩论规则" mb="1.5rem" />

    <div class="debate-rules__layout">
      <nav data-test="debate-rule-nav" class="debate-rules__nav" aria-label="辩论规则目录">
        <a v-for="section in sections" :key="section.id" :href="`#${section.id}`">{{ section.label }}</a>
      </nav>

      <div class="debate-rules__content">
        <section id="purpose" class="debate-rules__section">
          <p class="debate-rules__label">为什么存在</p>
          <h2>让冲突成为可检验的论证</h2>
          <p>观点冲突不会自然消失。这个模块希望把冲突转化为可追溯的论证：什么结论暂时成立、它由哪些依据支撑、又可能被什么理由推翻，都可以被继续检验。</p>
        </section>

        <section id="wiki" class="debate-rules__section">
          <p class="debate-rules__label">正文与版本</p>
          <h2>辩题是持续修订的共同文本</h2>
          <p>所有辩题都以不确定的问题提出。标题和正文使用 Wiki 方式管理，后续讨论用于辅助正文撰写，但不会替代正文。</p>
        </section>

        <section id="references" class="debate-rules__section">
          <p class="debate-rules__label">引用</p>
          <h2>用已有结论连接辩题</h2>
          <p>只有已经形成结论的辩题可以被引用。引用写在正文中，使用 <code>@debate:&lt;id&gt;:support|oppose</code>；引用者决定它是支撑还是反驳。</p>
          <p>引用会随正文自动加入或退出关系，不需要在图中手动连线。</p>
        </section>

        <section id="conclusion" class="debate-rules__section">
          <p class="debate-rules__label">结论与投票</p>
          <h2>结论始终可以被检验</h2>
          <p>任何人都可以投票。任一方向的投票超过 <strong>3/4</strong> 时形成结论；另一方向之后超过 3/4 时，结论会反转。投票不会中断讨论或正文修订。</p>
        </section>

        <section id="discussion" class="debate-rules__section">
          <p class="debate-rules__label">讨论</p>
          <h2>讨论推动正文，而非取代正文</h2>
          <p>所有人都可以继续讨论或补充论据。其他用户可以对引用发起反驳；反驳经投票通过后，该引用会被驳回。来源结论变化时，已有引用需要重新确认。</p>
        </section>

        <section id="views" class="debate-rules__section">
          <p class="debate-rules__label">树与关系图</p>
          <h2>用两种视角阅读关系</h2>
          <p>辩论树只连接支撑当前辩题的论点，用于阅读论证脉络。关系图展示与当前辩题相关的全部节点，并在连线上标出支撑或反驳。</p>
        </section>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import PPageHeader from '@/components/ui/PPageHeader.vue'

const sections = [
  { id: 'purpose', label: '为什么存在' },
  { id: 'wiki', label: '正文与版本' },
  { id: 'references', label: '引用' },
  { id: 'conclusion', label: '结论与投票' },
  { id: 'discussion', label: '讨论' },
  { id: 'views', label: '树与关系图' },
]
</script>

<style scoped>
.debate-rules { padding-top: 52px; padding-bottom: 88px; }
.debate-rules__header { max-width: 780px; padding-bottom: 40px; border-bottom: 1px solid var(--a-color-border-soft); }
.debate-rules__eyebrow, .debate-rules__label { margin: 0; color: var(--a-color-muted); font-size: 12px; font-weight: 600; letter-spacing: 0; }
.debate-rules h1 { margin: 12px 0 0; font-size: 34px; font-weight: 650; line-height: 1.2; }
.debate-rules__layout { display: grid; grid-template-columns: 184px minmax(0, 720px); gap: 72px; padding-top: 40px; }
.debate-rules__nav { position: sticky; top: 24px; display: grid; align-content: start; gap: 4px; }
.debate-rules__nav a { min-height: 36px; padding: 8px 10px; color: var(--a-color-muted); font-size: 13px; line-height: 20px; text-decoration: none; }
.debate-rules__nav a:hover, .debate-rules__nav a:focus-visible { color: var(--a-color-text); background: var(--a-color-bg); outline: none; }
.debate-rules__content { min-width: 0; }
.debate-rules__section { scroll-margin-top: 28px; padding: 4px 0 40px; border-bottom: 1px solid var(--a-color-border-soft); }
.debate-rules__section + .debate-rules__section { padding-top: 40px; }
.debate-rules__section:last-child { border-bottom: 0; }
.debate-rules h2 { margin: 10px 0 14px; font-size: 21px; font-weight: 650; line-height: 1.35; }
.debate-rules__section p:not(.debate-rules__label) { max-width: 680px; margin: 0; color: var(--a-color-text-secondary); font-size: 16px; line-height: 1.75; }
.debate-rules__section p + p { margin-top: 12px; }
.debate-rules code { padding: 2px 5px; border: 1px solid var(--a-color-border-soft); background: var(--a-color-bg); color: var(--a-color-text); font-family: monospace; font-size: 0.9em; overflow-wrap: anywhere; }
.debate-rules strong { color: var(--a-color-text); font-weight: 650; }

@media (max-width: 720px) {
  .debate-rules { padding: 28px 16px 64px; }
  .debate-rules__header { padding-bottom: 28px; }
  .debate-rules h1 { font-size: 28px; }
  .debate-rules__layout { grid-template-columns: minmax(0, 1fr); gap: 28px; padding-top: 24px; }
  .debate-rules__nav { position: static; display: flex; overflow-x: auto; gap: 0; padding-bottom: 2px; border-bottom: 1px solid var(--a-color-border-soft); }
  .debate-rules__nav a { flex: 0 0 auto; min-height: 44px; padding: 12px 14px; white-space: nowrap; }
  .debate-rules__section { padding-bottom: 32px; }
  .debate-rules__section + .debate-rules__section { padding-top: 32px; }
}
</style>
