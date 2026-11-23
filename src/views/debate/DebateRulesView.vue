<template>
  <section class="debate-rules a-page-xl">
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
          <h2>辩题是持续修订的共同文本，论据在其下沉淀</h2>
          <p>所有辩题都以不确定的问题提出。标题和背景说明采用 Wiki 方式协作修订，编辑讨论仅用于辅助正文撰稿，不会取代正文；核心论点、站内证据与反驳则以结构化三层关系沉淀在正文下方。</p>
        </section>

        <section id="references" class="debate-rules__section">
          <p class="debate-rules__label">引用</p>
          <h2>所有证据须可核查，关联辩题自动成图</h2>
          <p>只有已经形成结论的辩题可以被作为立场关系引用，写在正文中，使用 <code>@debate:&lt;id&gt;:support|oppose</code>；引用者决定它是支撑还是反驳，并自动进入辩论关系图。</p>
          <p>正文也可以通过 <code>@debate:&lt;id&gt;</code> 进行不带立场的背景参考，或引用站内文章、短笺、人物、时间线事件等资料。结构化证据区强制至少附带一条站内资源引用，不能只提交无依据陈述或纯外部链接。</p>
        </section>

        <section id="conclusion" class="debate-rules__section">
          <p class="debate-rules__label">结论与投票</p>
          <h2>支持度与证据充分度双维度独立评估</h2>
          <p>参与者对立场倾向（是 / 否）与证据充分性（充分 / 部分充分 / 不足）分别投票，互不阻塞。默认至少 5 人参与立场投票且任一方向严格超过 <strong>75%（3/4）</strong> 时形成结论（具体阈值由站点配置决定）；另一方向之后超过阈值时，结论会反转。</p>
          <p>若有效结构化证据为 0 条或过半数证据评价为“不足”，结论页面会给出“证据薄弱”温和提示。</p>
        </section>

        <section id="discussion" class="debate-rules__section">
          <p class="debate-rules__label">讨论</p>
          <h2>社区质询独立裁决引用与证据质量</h2>
          <p>任何人都可以提出论点、补充证据或对论点/证据发起反驳（最多三层，避免无限嵌套）。针对关联辩题关系、正文普通引用或结构化证据，社区成员可发起带原因分类的引用质询。</p>
          <p>质询完全由社区投票裁决（支持质询 / 驳回质询），达到法定人数与比例阈值后自动驳回失效引用或保留原依据。来源辩题结论变化时，已有关系引用仍需重新确认。</p>
        </section>

        <section id="views" class="debate-rules__section">
          <p class="debate-rules__label">树与关系图</p>
          <h2>用两种视角阅读关系</h2>
          <p>辩论树只连接支撑当前辩题的论点，用于阅读论证脉络。关系图展示与当前辩题相关的全部节点，并在连线上标出支撑或反驳。</p>
        </section>
      </div>
    </div>
  </section>
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
.debate-rules h1 { margin: 12px 0 0; font-size: 34px; font-weight: 500; line-height: 1.2; }
.debate-rules__layout { display: grid; grid-template-columns: 12rem minmax(0, 1fr); gap: var(--a-content-column-gap, 2rem); padding-top: 40px; }
.debate-rules__nav { position: sticky; top: calc(var(--a-topbar-height, 56px) + 1.5rem); display: grid; align-content: start; gap: 4px; }
.debate-rules__nav a { min-height: 36px; padding: 8px 10px; color: var(--a-color-muted); font-size: 13px; line-height: 20px; text-decoration: none; }
.debate-rules__nav a:hover, .debate-rules__nav a:focus-visible { color: var(--a-color-text); background: var(--a-color-bg); outline: none; }
.debate-rules__content { min-width: 0; }
.debate-rules__section { scroll-margin-top: 28px; padding: 4px 0 40px; border-bottom: 1px solid var(--a-color-border-soft); }
.debate-rules__section + .debate-rules__section { padding-top: 40px; }
.debate-rules__section:last-child { border-bottom: 0; }
.debate-rules h2 { margin: 10px 0 14px; font-size: 21px; font-weight: 500; line-height: 1.35; }
.debate-rules__section p:not(.debate-rules__label) { max-width: 680px; margin: 0; color: var(--a-color-text-secondary); font-size: 16px; line-height: 1.75; }
.debate-rules__section p + p { margin-top: 12px; }
.debate-rules code { padding: 2px 5px; border: 1px solid var(--a-color-border-soft); background: var(--a-color-bg); color: var(--a-color-text); font-family: monospace; font-size: 0.9em; overflow-wrap: anywhere; }
.debate-rules strong { color: var(--a-color-text); font-weight: 600; }

@media (max-width: 720px) {
  .debate-rules { padding: 28px 0 64px; }
  .debate-rules__header { padding-bottom: 28px; }
  .debate-rules h1 { font-size: 28px; }
  .debate-rules__layout { grid-template-columns: minmax(0, 1fr); gap: 28px; padding-top: 24px; }
  .debate-rules__nav { position: static; display: flex; overflow-x: auto; gap: 0; padding-bottom: 2px; border-bottom: 1px solid var(--a-color-border-soft); }
  .debate-rules__nav a { flex: 0 0 auto; min-height: 44px; padding: 12px 14px; white-space: nowrap; }
  .debate-rules__section { padding-bottom: 32px; }
  .debate-rules__section + .debate-rules__section { padding-top: 32px; }
}
</style>
