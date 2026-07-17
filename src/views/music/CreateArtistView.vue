<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const router = useRouter()
const route = useRoute()

onMounted(async () => {
  const query = new URLSearchParams({ editor: 'artist-create' })
  const seedName = typeof route.query.name === 'string' ? route.query.name.trim() : ''

  if (seedName) {
    query.set('name', seedName)
  }

  await router.replace(`/music?${query.toString()}`)
})
</script>
