<script setup lang="ts">
import { computed } from 'vue'

import { sitePolicyDocuments, sitePolicyUpdated, type PolicyKind } from './sitePolicyDocuments'

const props = withDefaults(defineProps<{
  kind: PolicyKind
  headingLevel?: 'h1' | 'h2'
  showTitle?: boolean
}>(), {
  headingLevel: 'h2',
  showTitle: true,
})



const document = computed(() => sitePolicyDocuments[props.kind])
</script>

<template>
  <article class="site-policy-content">
    <component v-if="showTitle" :is="headingLevel" class="site-policy-title">{{ document.title }}</component>
    <p class="site-policy-updated" :class="{ 'site-policy-updated--flush': !showTitle }">更新日期：{{ sitePolicyUpdated }}</p>
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
  font-weight: 500;
  line-height: 1.2;
  letter-spacing: 0;
}

.site-policy-updated {
  margin: var(--a-space-2) 0 0;
  color: var(--a-color-muted);
  font-size: var(--a-text-xs);
}

.site-policy-updated--flush {
  margin-top: 0;
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
  font-weight: 500;
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
