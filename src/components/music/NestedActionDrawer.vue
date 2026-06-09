<!-- web/src/components/music/NestedActionDrawer.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import PaperSheet from '@/components/ui/PaperSheet.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'

const { state, closeNestedAction } = useMusicDrawers()
const isOpen = computed(() => state.value.nestedAction !== null)

const titleMap: Record<string, string> = {
  revise: '修订专辑',
  revise_artist: '修订艺术家',
  history: '版本历史',
  add_album: '添加新专辑',
  add_artist: '新建艺术家',
  discussion: '社区讨论'
}

const displayTitle = computed(() => titleMap[state.value.nestedAction || ''] || 'Action')
</script>

<template>
  <PaperSheet 
    :show="isOpen" 
    @close="closeNestedAction" 
    width="500px" 
  >
    <div class="drawer-header">
      <h3 class="title">{{ displayTitle }}</h3>
    </div>
    
    <div class="drawer-body">
      <!-- Form placeholder -->
      <div v-if="state.nestedAction === 'revise' || state.nestedAction === 'add_album'">
        <div class="form-group">
          <label class="form-label">标题</label>
          <input type="text" class="form-input">
        </div>
        <button class="a-btn-primary" @click="closeNestedAction">提交</button>
      </div>
      
      <!-- History placeholder -->
      <div v-else-if="state.nestedAction === 'history'">
        <div class="history-item">
          <div><strong>v8 (PENDING)</strong></div>
          <div>修改简介</div>
        </div>
      </div>
    </div>
  </PaperSheet>
</template>

<style scoped>
.drawer-header { padding: 1.5rem 2rem; border-bottom: 2px solid var(--a-color-ink); background: var(--a-color-paper); }
.title { font-family: var(--a-font-serif); font-size: 1.5rem; margin: 0; }
.drawer-body { padding: 2rem; }

.form-group { margin-bottom: 1.5rem; }
.form-label { display: block; font-weight: bold; margin-bottom: 0.5rem; font-family: var(--a-font-meta); font-size: 0.8rem; }
.form-input { width: 100%; border: 1.5px solid var(--a-color-ink); padding: 0.75rem; font-size: 1rem; font-family: inherit; }
.a-btn-primary { width: 100%; border: 1.5px solid var(--a-color-ink); padding: 0.75rem 1.5rem; font-weight: bold; background: var(--a-color-ink); color: white; cursor: pointer; font-family: var(--a-font-meta); text-transform: uppercase; }

.history-item { margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px dashed var(--a-color-line-soft); }
</style>
