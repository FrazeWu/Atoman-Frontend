<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

onMounted(() => {
  void router.replace({ path: '/feed', query: { manage_subscriptions: '1' } })
})
</script>

<template>
  <div />
</template>
