<template>
  <div class="mail-recipient">
    <PInput :model-value="modelValue" :label="label" :aria-label="label" type="text" :disabled="disabled" :placeholder="placeholder" autocomplete="off" @update:model-value="change" @focus="open = true" @blur="closeSoon" @keydown.down.prevent="move(1)" @keydown.up.prevent="move(-1)" @keydown.enter="pickFocused" @keydown.esc="open=false" />
    <div v-if="open && matches.length" class="mail-recipient__menu" role="listbox" :aria-label="label+'联系人建议'">
      <button v-for="(contact,i) in matches" :key="contact.id" type="button" class="mail-recipient__option" :class="{ 'is-active': i===highlight }" role="option" :aria-selected="i===highlight" @mousedown.prevent="pick(contact)">
        <strong>{{ contact.name || contact.email }}</strong><small>{{ contact.email }}</small>
      </button>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import PInput from '@/components/ui/PInput.vue'
import type { MailContact } from '@/api/mailClient'
const props = defineProps<{modelValue:string;label:string;placeholder:string;contacts:MailContact[];disabled?:boolean}>()
const emit = defineEmits<{ 'update:modelValue':[value:string] }>()
const open=ref(false),highlight=ref(0)
let closeTimer:ReturnType<typeof setTimeout>|undefined
const current=computed(()=>props.modelValue.split(/[,;]/).pop()?.trim().toLowerCase()||'')
const matches=computed(()=>current.value.length < 2 ? [] : props.contacts.filter(row=>(row.name+' '+row.email).toLowerCase().includes(current.value)).slice(0,6))
function change(text:string){highlight.value=0;open.value=true;emit('update:modelValue',text)}
function move(d:number){if(!matches.value.length)return;open.value=true;highlight.value=(highlight.value+d+matches.value.length)%matches.value.length}
function pick(contact:MailContact){
 const parts=props.modelValue.split(/[,;]/);parts.pop()
 const next=parts.map(v=>v.trim()).filter(Boolean)
 // No new Bcc/To sharing: only addresses explicitly selected by the writer.
 next.push(contact.email)
 emit('update:modelValue',next.join(', ')+', ')
 open.value=false
}
function pickFocused(e:KeyboardEvent){if(!open.value||!matches.value.length)return;e.preventDefault();pick(matches.value[highlight.value]!)}
function closeSoon(){closeTimer=setTimeout(()=>open.value=false,130)}
onBeforeUnmount(()=>clearTimeout(closeTimer))
</script>
<style scoped>
.mail-recipient {position:relative;min-width:0;}
.mail-recipient__menu {position:absolute;top:100%;left:0;right:0;z-index:50;max-height:240px;overflow:auto;background:var(--a-color-bg);border:1px solid var(--a-color-border-soft);border-radius:var(--a-radius-control);box-shadow:0 7px 20px rgba(0,0,0,.08);}
.mail-recipient__option {display:grid;gap:3px;width:100%;padding:10px 12px;border:0;background:transparent;color:var(--a-color-fg);text-align:left;cursor:pointer;}
.mail-recipient__option:hover,.mail-recipient__option.is-active {background:var(--a-color-surface-muted);}
.mail-recipient__option strong {font-size:13px;font-weight:600;}
.mail-recipient__option small {font-size:12px;color:var(--a-color-muted);overflow-wrap:anywhere;}
</style>
