<template>
  <label class="p-checkbox" :class="{'p-checkbox--disabled':disabled}">
    <input type="checkbox" :checked="modelValue" :disabled="disabled" :aria-label="ariaLabel" @change="emit('update:modelValue',($event.target as HTMLInputElement).checked)" />
    <span><slot>{{ label }}</slot></span>
  </label>
</template>
<script setup lang="ts">
withDefaults(defineProps<{modelValue?:boolean;disabled?:boolean;label?:string;ariaLabel?:string}>(),{modelValue:false,disabled:false,label:''})
const emit=defineEmits<{'update:modelValue':[checked:boolean]}>()
</script>
<style scoped>
.p-checkbox{display:flex;align-items:flex-start;gap:8px;min-width:0;font:inherit;color:var(--a-color-text);cursor:pointer;overflow-wrap:anywhere}
.p-checkbox input{flex:none;inline-size:16px;block-size:16px;margin:2px 0 0;accent-color:var(--a-color-primary);cursor:inherit}
.p-checkbox input:focus-visible{outline:2px solid var(--a-color-primary);outline-offset:2px}
.p-checkbox--disabled{opacity:.55;cursor:not-allowed}
.p-checkbox>span{min-width:0}
</style>
