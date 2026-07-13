<template>
  <main class="unknown-site">
    <section class="unknown-card">
      <p class="unknown-kicker">UNKNOWN SPACE</p>
      <h1>这个空间不存在</h1>
      <p>请检查子域名是否正确，或返回 Atoman 门户。</p>
      <a :href="portalUrl" class="unknown-link">返回门户</a>
    </section>
  </main>
</template>

<script setup lang="ts">
const portalUrl = `${window.location.protocol}//atoman.org/`
</script>

<style scoped>
.unknown-site {
  min-height: calc(100vh - 56px);
  display: grid;
  place-items: center;
  padding: 2rem;
  background: var(--a-color-surface-muted, #f8f7f4);
}

.unknown-card {
  max-width: 560px;
  background: var(--a-color-surface, #fff);
  border: 1px solid var(--a-color-ink, #111);
  box-shadow: none;
  padding: 2rem;
}

.unknown-kicker {
  margin: 0 0 1rem;
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0;
}

.unknown-card h1 {
  margin: 0 0 1rem;
}

.unknown-link {
  display: inline-block;
  margin-top: 1rem;
  color: var(--a-color-ink, #111);
  font-weight: 500;
}
</style>
