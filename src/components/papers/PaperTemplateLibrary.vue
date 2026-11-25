<template>
  <section class="paper-templates" aria-label="论文模板库">
    <div class="paper-templates__toolbar">
      <div>
        <h3>论文模板库</h3>
        <p>从可编辑的章节结构开始，或导入会议提供的正式模板。</p>
      </div>
      <input v-model.trim="search" aria-label="搜索论文模板" placeholder="搜索模板" />
    </div>
    <nav class="paper-templates__filters" aria-label="模板分类">
      <button v-for="item in paperTemplateCategories" :key="item.value" type="button" :aria-pressed="category===item.value" @click="category=item.value">{{ item.label }}</button>
    </nav>
    <div class="paper-templates__grid">
      <article v-for="template in visible" :key="template.id" class="paper-templates__card" :class="{selected:selectedId===template.id}">
        <div class="paper-templates__title">
          <strong>{{ template.name }}</strong>
          <span>{{ template.compiler==='xelatex'?'XeLaTeX':'pdfLaTeX' }}</span>
        </div>
        <p>{{ template.description }}</p>
        <p class="paper-templates__sections">{{ template.sections.join(' · ') }}</p>
        <p v-if="template.official" class="paper-templates__note">写作起始稿 · 非官方投稿格式</p>
        <p v-else-if="template.category==='chinese'" class="paper-templates__note">需已开放的中文 XeLaTeX 环境</p>
        <div class="paper-templates__actions">
          <PButton type="button" size="sm" :variant="selectedId===template.id?'primary':'secondary'" :disabled="disabled" :aria-pressed="selectedId===template.id" @click="$emit('select',template.id)">{{ selectedId===template.id?'已选择':'选择模板' }}</PButton>
          <a v-if="template.official" :href="template.official.url" target="_blank" rel="noopener noreferrer">官方模板与说明</a>
        </div>
        <p v-if="template.official&&selectedId===template.id" class="paper-templates__note">{{ template.official.guidance }}</p>
      </article>
    </div>
    <p v-if="!visible.length" role="status">未找到匹配的论文模板。</p>
    <p class="paper-templates__note">需要正式投稿或学校指定格式时，请下载官方模板，并使用上方「上传 ZIP」或「上传文件夹」。请保留样式、文献及图片文件，核对主文件和编译器。模板不会自动从第三方网站获取，也不会向第三方发送项目内容。</p>
  </section>
</template>
<script setup lang="ts">
import {computed,ref} from 'vue'
import PButton from '@/components/ui/PButton.vue'
import {paperTemplateCategories,paperTemplates} from './templateCatalog'
defineProps<{selectedId:string;disabled:boolean}>()
defineEmits<{select:[id:string]}>()
const category=ref<typeof paperTemplateCategories[number]['value']>('all')
const search=ref('')
const visible=computed(()=>paperTemplates.filter(template=>(category.value==='all'||template.category===category.value)&&[template.name,template.description,...template.sections].join(' ').toLowerCase().includes(search.value.toLowerCase())))
</script>
<style scoped>
.paper-templates{display:grid;gap:12px;margin-bottom:16px;padding-top:12px;border-top:1px solid var(--a-color-border-soft,#d9dce2)}
.paper-templates__toolbar,.paper-templates__title,.paper-templates__actions,.paper-templates__filters{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.paper-templates__toolbar{justify-content:space-between;align-items:flex-start}
.paper-templates__toolbar h3{font-size:1rem;margin:0 0 4px;font-weight:650}
.paper-templates p{font-size:.84rem;line-height:1.6;margin:0;overflow-wrap:anywhere}
.paper-templates__toolbar input{max-width:100%;min-width:0;border:1px solid var(--a-color-border-soft,#ddd);padding:7px 9px;border-radius:6px;background:var(--a-color-bg,#fff);color:inherit;font:inherit}
.paper-templates__filters button{border:1px solid var(--a-color-border-soft,#ddd);background:transparent;color:inherit;border-radius:5px;padding:5px 8px;font-size:.8rem;cursor:pointer}
.paper-templates__filters button[aria-pressed=true]{background:var(--a-color-bg-subtle,#e7edf3);font-weight:650}
.paper-templates__grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:9px}
.paper-templates__card{display:flex;flex-direction:column;gap:8px;min-width:0;border:1px solid var(--a-color-border-soft,#ddd);border-radius:8px;padding:12px}
.paper-templates__card.selected{border-color:var(--a-color-text-secondary,#64748b);background:var(--a-color-bg-subtle,#f6f7f9)}
.paper-templates__title{justify-content:space-between}
.paper-templates__title strong{font-size:.92rem;min-width:0}
.paper-templates__title span,.paper-templates__sections,.paper-templates__note,.paper-templates__toolbar p{color:var(--a-color-text-secondary,#697281);font-size:.78rem}
.paper-templates__actions{margin-top:auto}
.paper-templates__actions a{font-size:.8rem;text-decoration:underline;color:inherit}
</style>
