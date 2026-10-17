<template>
  <section class="private-books">
    <h2>评分与书评</h2>
    <p v-if="rating">{{ rating.rating_active ? `信誉加权评分 ${rating.weighted_rating_score}` : `评分暂未生效，需至少 ${rating.minimum_rating_count} 名有效评分者` }} · {{ rating.rating_count }} 人评分</p>
    <div v-if="authenticated" class="private-books__toolbar"><label>我的评分<select v-model="score"><option :value="0">请选择</option><option v-for="number in 10" :key="number" :value="number">{{ number }} 分</option></select></label><PButton :disabled="busy || !score" @click="rate(false)">保存评分</PButton><PButton v-if="rating?.viewer_rating" variant="ghost" :disabled="busy" @click="rate(true)">撤销评分</PButton></div>
    <p v-if="error" role="alert">{{ error }}</p>
    <PButton v-if="!rating" variant="secondary" @click="load">重新加载评分与书评</PButton>
    <p v-if="!reviews.length">还没有公开长评。</p>
    <article v-for="review in reviews" :key="review.content_id" class="book-catalog__row">
      <details v-if="review.spoiler"><summary>含剧透：{{ review.title }}</summary><RouterLink :to="review.target_path">阅读书评</RouterLink><p>{{ review.summary }}</p></details>
      <template v-else><RouterLink :to="review.target_path">{{ review.title }}</RouterLink><p>{{ review.summary }}</p></template>
      <PButton v-if="review.author_id === auth.user?.uuid" variant="ghost" :disabled="busy" @click="unlink(review.content_id)">解除关联</PButton>
    </article>
    <PButton v-if="reviews.length < total" variant="secondary" @click="more">更多书评</PButton>
    <details v-if="authenticated"><summary>关联我的博客长评</summary><form class="private-books__toolbar" @submit.prevent="link"><label>博客文章链接或 ID<input v-model="contentId" required placeholder="粘贴自己文章的 /post/ 链接" /></label><label><input v-model="spoiler" type="checkbox" />包含剧透</label><PButton type="submit" :disabled="busy">关联长评</PButton><PButton to="/studio/blog/new" variant="ghost">创作长评</PButton></form></details>
    <CommentSection :target="{ kind: 'book_work', resourceId: workId }" noun="讨论" />
  </section>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getWorkRating, setWorkRating, removeWorkRating, listWorkReviews, linkWorkReview, unlinkWorkReview, type WorkRating, type BookReviewLink } from '@/api/bookCommunity'
import PButton from '@/components/ui/PButton.vue'
import CommentSection from '@/components/comment/CommentSection.vue'
const props = defineProps<{ workId: string; authenticated: boolean }>()
const auth = useAuthStore(), rating = ref<WorkRating>(), reviews = ref<BookReviewLink[]>([]), score = ref(0), total = ref(0), busy = ref(false), error = ref(''), contentId = ref(''), spoiler = ref(false)
async function load() { error.value = ''; try { rating.value = await getWorkRating(props.workId); score.value = rating.value.viewer_rating || 0; const page = await listWorkReviews(props.workId); reviews.value = page.items; total.value = page.total } catch { error.value = '评分或书评加载失败，请重试。' } }
async function rate(remove: boolean) { busy.value = true; try { rating.value = remove ? await removeWorkRating(props.workId) : await setWorkRating(props.workId, score.value); score.value = rating.value.viewer_rating || 0; error.value = '' } catch { error.value = '评分保存失败，请重试。' } finally { busy.value = false } }
async function more() { try { const page = await listWorkReviews(props.workId, reviews.value.length); reviews.value.push(...page.items); total.value = page.total } catch { error.value = '书评加载失败。' } }
async function link() { const value = contentId.value.trim().split('/post/').pop()?.split(/[?#]/)[0] || ''; busy.value = true; try { await linkWorkReview(props.workId, value, spoiler.value); contentId.value = ''; await load() } catch { error.value = '关联失败：只能关联自己的博客文章。草稿和非公开文章不会在此展示。' } finally { busy.value = false } }
async function unlink(id: string) { busy.value = true; try { await unlinkWorkReview(props.workId, id); await load() } catch { error.value = '解除关联失败，请重试。' } finally { busy.value = false } }
onMounted(load)
</script>
