<template>
  <section class="structured-panel" data-test="debate-structured-panel" aria-label="结构化论据区">
    <header class="structured-panel__header">
      <div class="structured-panel__title-wrap">
        <h2 class="structured-panel__heading">结构化论据与反驳</h2>
        <span class="structured-panel__sub">论点 → 站内证据 → 反驳三层结构；证据须引用至少一条站内资源</span>
      </div>

      <div class="structured-panel__toolbar">
        <div class="structured-panel__filters" role="group" aria-label="立场筛选">
          <button
            v-for="option in filterOptions"
            :key="option.value"
            type="button"
            class="structured-panel__filter"
            :class="{ 'is-active': stanceFilter === option.value }"
            :data-test="`structured-filter-${option.value}`"
            :aria-pressed="stanceFilter === option.value"
            @click="stanceFilter = option.value"
          >
            {{ option.label }}
          </button>
        </div>

        <template v-if="!archived">
          <PButton
            size="sm"
            variant="secondary"
            data-test="new-standalone-evidence-btn"
            @click="openCreate('evidence')"
          >
            补充独立证据
          </PButton>
          <PButton
            size="sm"
            data-test="new-claim-btn"
            @click="openCreate('claim')"
          >
            提出核心论点
          </PButton>
        </template>
      </div>
    </header>

    <div
      v-if="activeCreate && !activeCreate.parentId"
      class="structured-form"
      data-test="structured-create-form"
    >
      <div class="structured-form__head">
        <strong>{{ createFormHeading }}</strong>
        <button type="button" class="structured-form__close" @click="cancelCreate">取消</button>
      </div>

      <div v-if="activeCreate.entryType === 'claim'" class="structured-form__stances" role="group" aria-label="论点立场">
        <button
          type="button"
          class="structured-form__stance"
          :class="{ 'is-selected': createDraft.stance === 'support' }"
          data-test="create-stance-support"
          @click="createDraft.stance = 'support'"
        >
          支持方论点
        </button>
        <button
          type="button"
          class="structured-form__stance"
          :class="{ 'is-selected': createDraft.stance === 'oppose' }"
          data-test="create-stance-oppose"
          @click="createDraft.stance = 'oppose'"
        >
          反方论点
        </button>
      </div>

      <div v-else class="structured-form__stances" role="group" aria-label="证据倾向">
        <button
          type="button"
          class="structured-form__stance"
          :class="{ 'is-selected': createDraft.stance === 'support' }"
          data-test="create-stance-support"
          @click="createDraft.stance = 'support'"
        >
          支持倾向
        </button>
        <button
          type="button"
          class="structured-form__stance"
          :class="{ 'is-selected': createDraft.stance === 'oppose' }"
          data-test="create-stance-oppose"
          @click="createDraft.stance = 'oppose'"
        >
          反驳倾向
        </button>
        <button
          type="button"
          class="structured-form__stance"
          :class="{ 'is-selected': createDraft.stance === 'neutral' }"
          data-test="create-stance-neutral"
          @click="createDraft.stance = 'neutral'"
        >
          中立背景
        </button>
      </div>

      <PInput
        v-if="activeCreate.entryType === 'claim'"
        v-model="createDraft.title"
        data-test="create-entry-title"
        label="论点标题"
        placeholder="用一句话概括核心论点"
      />

      <DebateReferencePicker
        v-if="activeCreate.entryType === 'evidence'"
        :exclude-debate-id="debateId"
        @select="(token) => appendCreateToken(token)"
      />

      <PReferenceField
        v-model="createDraft.content"
        data-test="create-entry-content"
        variant="textarea"
        :rows="4"
        :label="activeCreate.entryType === 'evidence' ? '证据正文（必须包含至少一条 @类型:ID 站内引用）' : '详细说明'"
        :placeholder="activeCreate.entryType === 'evidence' ? '先通过上方检索或输入 @ 插入至少一条站内资料，再补充证据摘要...' : '展开说明该论点的推论路径...'"
      />

      <p v-if="formError || actionError" class="structured-form__error" data-test="structured-form-error" role="alert">
        {{ formError || actionError }}
      </p>

      <div class="structured-form__actions">
        <PButton type="button" size="sm" variant="secondary" @click="cancelCreate">取消</PButton>
        <PButton
          type="button"
          size="sm"
          data-test="submit-create-entry"
          :loading="mutating"
          :disabled="mutating"
          @click="submitCreate"
        >
          发布
        </PButton>
      </div>
    </div>

    <div v-if="loading" class="structured-panel__state" role="status">加载论据中...</div>
    <PEmpty
      v-else-if="visibleClaims.length === 0 && visibleStandaloneEvidence.length === 0"
      title="暂无结构化论点与证据"
      description="点击上方「提出核心论点」或「补充独立证据」，开始沉淀可追溯的依据。"
    />

    <div v-else class="structured-tree">
      <!-- Top-level claims with nested level-2 (evidence / direct rebuttal) and level-3 (rebuttal on evidence) -->
      <article
        v-for="claim in visibleClaims"
        :key="claim.id"
        class="entry-card entry-card--claim"
        :class="{ 'is-rejected': claim.status === 'rejected' }"
        :data-test="`entry-card-${claim.id}`"
      >
        <header class="entry-card__header">
          <div class="entry-card__badges">
            <span class="entry-card__stance" :class="`is-${claim.stance}`">
              {{ stanceLabel(claim.stance) }}
            </span>
            <span class="entry-card__type">核心论点</span>
            <span v-if="claim.status === 'rejected'" class="entry-card__rejected">已驳回</span>
          </div>
          <div class="entry-card__meta">
            <span>{{ claim.user?.username || '匿名' }}</span>
            <span aria-hidden="true">·</span>
            <time :datetime="claim.created_at">{{ formatDate(claim.created_at) }}</time>
          </div>
        </header>

        <h3 class="entry-card__title">{{ claim.title }}</h3>

        <template v-if="editingEntryId === claim.id">
          <div class="structured-inline-edit" :data-test="`edit-form-${claim.id}`">
            <PInput v-model="editDraft.title" data-test="edit-entry-title" label="论点标题" />
            <PReferenceField v-model="editDraft.content" data-test="edit-entry-content" variant="textarea" :rows="3" />
            <p v-if="formError || actionError" class="structured-form__error" role="alert">{{ formError || actionError }}</p>
            <div class="structured-form__actions">
              <PButton type="button" size="sm" variant="secondary" @click="cancelEdit">取消</PButton>
              <PButton type="button" size="sm" data-test="submit-edit-entry" :disabled="mutating" @click="submitEdit(claim)">
                保存修改
              </PButton>
            </div>
          </div>
        </template>
        <template v-else>
          <p class="entry-card__content">{{ claim.content }}</p>
          <PReferenceCardList v-if="claim.references?.length" :references="claim.references" :compact="true" />
        </template>

        <div v-if="!archived && editingEntryId !== claim.id" class="entry-card__actions">
          <button
            v-if="claim.status === 'active'"
            type="button"
            class="entry-action-link"
            :data-test="`add-evidence-to-${claim.id}`"
            @click="openCreate('evidence', claim)"
          >
            补充证据
          </button>
          <button
            v-if="claim.status === 'active'"
            type="button"
            class="entry-action-link"
            :data-test="`rebut-entry-${claim.id}`"
            @click="openCreate('rebuttal', claim)"
          >
            反驳论点
          </button>
          <button
            v-if="canEditEntry(claim)"
            type="button"
            class="entry-action-link"
            :data-test="`edit-entry-${claim.id}`"
            @click="startEdit(claim)"
          >
            编辑
          </button>
          <button
            v-if="canDeleteEntry(claim)"
            type="button"
            class="entry-action-link entry-action-link--danger"
            :data-test="`delete-entry-${claim.id}`"
            @click="confirmDeleteTarget = claim"
          >
            删除
          </button>
        </div>

        <!-- Inline child creation form targeting this claim -->
        <div
          v-if="activeCreate && activeCreate.parentId === claim.id"
          class="structured-form structured-form--nested"
          data-test="structured-create-form"
        >
          <div class="structured-form__head">
            <strong>{{ createFormHeading }}</strong>
            <button type="button" class="structured-form__close" @click="cancelCreate">取消</button>
          </div>
          <DebateReferencePicker
            v-if="activeCreate.entryType === 'evidence'"
            :exclude-debate-id="debateId"
            @select="(token) => appendCreateToken(token)"
          />
          <PReferenceField
            v-model="createDraft.content"
            data-test="create-entry-content"
            variant="textarea"
            :rows="3"
            :label="activeCreate.entryType === 'evidence' ? '证据内容（必须包含至少一条 @类型:ID 站内引用）' : '反驳说明'"
          />
          <p v-if="formError || actionError" class="structured-form__error" data-test="structured-form-error" role="alert">
            {{ formError || actionError }}
          </p>
          <div class="structured-form__actions">
            <PButton type="button" size="sm" variant="secondary" @click="cancelCreate">取消</PButton>
            <PButton type="button" size="sm" data-test="submit-create-entry" :disabled="mutating" @click="submitCreate">
              发布
            </PButton>
          </div>
        </div>

        <!-- Level 2 children under claim -->
        <div v-if="childrenOf(claim.id).length" class="entry-children">
          <div
            v-for="child in childrenOf(claim.id)"
            :key="child.id"
            class="entry-card entry-card--child"
            :class="{ 'is-rejected': child.status === 'rejected' }"
            :data-test="`entry-card-${child.id}`"
          >
            <header class="entry-card__header">
              <div class="entry-card__badges">
                <span class="entry-card__stance" :class="`is-${child.stance}`">
                  {{ stanceLabel(child.stance) }}
                </span>
                <span class="entry-card__type">{{ child.entry_type === 'evidence' ? '站内证据' : '反驳' }}</span>
                <span v-if="child.status === 'rejected'" class="entry-card__rejected">
                  已驳回
                </span>
                <span
                  v-else-if="child.open_challenge"
                  class="entry-card__challenge-pill"
                  :data-test="`entry-open-challenge-${child.id}`"
                >
                  质询中（{{ child.open_challenge.uphold_votes }} 支持 / {{ child.open_challenge.dismiss_votes }} 驳回）
                </span>
              </div>
              <div class="entry-card__meta">
                <span>{{ child.user?.username || '匿名' }}</span>
                <span aria-hidden="true">·</span>
                <time :datetime="child.created_at">{{ formatDate(child.created_at) }}</time>
              </div>
            </header>

            <template v-if="editingEntryId === child.id">
              <div class="structured-inline-edit" :data-test="`edit-form-${child.id}`">
                <DebateReferencePicker
                  v-if="child.entry_type === 'evidence'"
                  :exclude-debate-id="debateId"
                  @select="(token) => appendEditToken(token)"
                />
                <PReferenceField v-model="editDraft.content" data-test="edit-entry-content" variant="textarea" :rows="3" />
                <p v-if="formError || actionError" class="structured-form__error" role="alert">{{ formError || actionError }}</p>
                <div class="structured-form__actions">
                  <PButton type="button" size="sm" variant="secondary" @click="cancelEdit">取消</PButton>
                  <PButton type="button" size="sm" data-test="submit-edit-entry" :disabled="mutating" @click="submitEdit(child)">
                    保存修改
                  </PButton>
                </div>
              </div>
            </template>
            <template v-else>
              <p class="entry-card__content">{{ child.content }}</p>
              <PReferenceCardList v-if="child.references?.length" :references="child.references" :compact="true" />
            </template>

            <div v-if="!archived && editingEntryId !== child.id" class="entry-card__actions">
              <button
                v-if="child.entry_type === 'evidence' && child.status === 'active'"
                type="button"
                class="entry-action-link"
                :data-test="`rebut-entry-${child.id}`"
                @click="openCreate('rebuttal', child)"
              >
                反驳此证据
              </button>
              <button
                v-if="child.entry_type === 'evidence' && child.status === 'active' && !child.open_challenge"
                type="button"
                class="entry-action-link"
                :data-test="`challenge-entry-${child.id}`"
                @click="requestChallenge(child)"
              >
                质询引用
              </button>
              <button
                v-if="canEditEntry(child)"
                type="button"
                class="entry-action-link"
                :data-test="`edit-entry-${child.id}`"
                @click="startEdit(child)"
              >
                编辑
              </button>
              <button
                v-if="canDeleteEntry(child)"
                type="button"
                class="entry-action-link entry-action-link--danger"
                :data-test="`delete-entry-${child.id}`"
                @click="confirmDeleteTarget = child"
              >
                删除
              </button>
            </div>

            <!-- Inline level-3 rebuttal creation form targeting evidence -->
            <div
              v-if="activeCreate && activeCreate.parentId === child.id"
              class="structured-form structured-form--nested"
              data-test="structured-create-form"
            >
              <div class="structured-form__head">
                <strong>{{ createFormHeading }}</strong>
                <button type="button" class="structured-form__close" @click="cancelCreate">取消</button>
              </div>
              <PReferenceField
                v-model="createDraft.content"
                data-test="create-entry-content"
                variant="textarea"
                :rows="3"
                label="反驳说明"
              />
              <p v-if="formError || actionError" class="structured-form__error" data-test="structured-form-error" role="alert">
                {{ formError || actionError }}
              </p>
              <div class="structured-form__actions">
                <PButton type="button" size="sm" variant="secondary" @click="cancelCreate">取消</PButton>
                <PButton type="button" size="sm" data-test="submit-create-entry" :disabled="mutating" @click="submitCreate">
                  发布
                </PButton>
              </div>
            </div>

            <!-- Level 3 children (rebuttals on evidence) -->
            <div v-if="childrenOf(child.id).length" class="entry-grandchildren">
              <div
                v-for="grandchild in childrenOf(child.id)"
                :key="grandchild.id"
                class="entry-card entry-card--grandchild"
                :data-test="`entry-card-${grandchild.id}`"
              >
                <header class="entry-card__header">
                  <div class="entry-card__badges">
                    <span class="entry-card__stance" :class="`is-${grandchild.stance}`">
                      {{ stanceLabel(grandchild.stance) }}
                    </span>
                    <span class="entry-card__type">反驳</span>
                  </div>
                  <div class="entry-card__meta">
                    <span>{{ grandchild.user?.username || '匿名' }}</span>
                    <span aria-hidden="true">·</span>
                    <time :datetime="grandchild.created_at">{{ formatDate(grandchild.created_at) }}</time>
                  </div>
                </header>

                <template v-if="editingEntryId === grandchild.id">
                  <div class="structured-inline-edit" :data-test="`edit-form-${grandchild.id}`">
                    <PReferenceField v-model="editDraft.content" data-test="edit-entry-content" variant="textarea" :rows="3" />
                    <p v-if="formError || actionError" class="structured-form__error" role="alert">{{ formError || actionError }}</p>
                    <div class="structured-form__actions">
                      <PButton type="button" size="sm" variant="secondary" @click="cancelEdit">取消</PButton>
                      <PButton type="button" size="sm" data-test="submit-edit-entry" :disabled="mutating" @click="submitEdit(grandchild)">
                        保存修改
                      </PButton>
                    </div>
                  </div>
                </template>
                <template v-else>
                  <p class="entry-card__content">{{ grandchild.content }}</p>
                  <PReferenceCardList v-if="grandchild.references?.length" :references="grandchild.references" :compact="true" />
                </template>

                <div v-if="!archived && editingEntryId !== grandchild.id" class="entry-card__actions">
                  <button
                    v-if="canEditEntry(grandchild)"
                    type="button"
                    class="entry-action-link"
                    :data-test="`edit-entry-${grandchild.id}`"
                    @click="startEdit(grandchild)"
                  >
                    编辑
                  </button>
                  <button
                    v-if="canDeleteEntry(grandchild)"
                    type="button"
                    class="entry-action-link entry-action-link--danger"
                    :data-test="`delete-entry-${grandchild.id}`"
                    @click="confirmDeleteTarget = grandchild"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </article>

      <!-- Standalone evidence (top-level evidence with no parent_id) -->
      <article
        v-for="ev in visibleStandaloneEvidence"
        :key="ev.id"
        class="entry-card entry-card--standalone-evidence"
        :class="{ 'is-rejected': ev.status === 'rejected' }"
        :data-test="`entry-card-${ev.id}`"
      >
        <header class="entry-card__header">
          <div class="entry-card__badges">
            <span class="entry-card__stance" :class="`is-${ev.stance}`">{{ stanceLabel(ev.stance) }}</span>
            <span class="entry-card__type">独立站内证据</span>
            <span v-if="ev.status === 'rejected'" class="entry-card__rejected">已驳回</span>
            <span v-else-if="ev.open_challenge" class="entry-card__challenge-pill" :data-test="`entry-open-challenge-${ev.id}`">
              质询中（{{ ev.open_challenge.uphold_votes }} 支持 / {{ ev.open_challenge.dismiss_votes }} 驳回）
            </span>
          </div>
          <div class="entry-card__meta">
            <span>{{ ev.user?.username || '匿名' }}</span>
            <span aria-hidden="true">·</span>
            <time :datetime="ev.created_at">{{ formatDate(ev.created_at) }}</time>
          </div>
        </header>

        <template v-if="editingEntryId === ev.id">
          <div class="structured-inline-edit" :data-test="`edit-form-${ev.id}`">
            <DebateReferencePicker :exclude-debate-id="debateId" @select="(token) => appendEditToken(token)" />
            <PReferenceField v-model="editDraft.content" data-test="edit-entry-content" variant="textarea" :rows="3" />
            <p v-if="formError || actionError" class="structured-form__error" role="alert">{{ formError || actionError }}</p>
            <div class="structured-form__actions">
              <PButton type="button" size="sm" variant="secondary" @click="cancelEdit">取消</PButton>
              <PButton type="button" size="sm" data-test="submit-edit-entry" :disabled="mutating" @click="submitEdit(ev)">
                保存修改
              </PButton>
            </div>
          </div>
        </template>
        <template v-else>
          <p class="entry-card__content">{{ ev.content }}</p>
          <PReferenceCardList v-if="ev.references?.length" :references="ev.references" :compact="true" />
        </template>

        <div v-if="!archived && editingEntryId !== ev.id" class="entry-card__actions">
          <button
            v-if="ev.status === 'active'"
            type="button"
            class="entry-action-link"
            :data-test="`rebut-entry-${ev.id}`"
            @click="openCreate('rebuttal', ev)"
          >
            反驳此证据
          </button>
          <button
            v-if="ev.status === 'active' && !ev.open_challenge"
            type="button"
            class="entry-action-link"
            :data-test="`challenge-entry-${ev.id}`"
            @click="requestChallenge(ev)"
          >
            质询引用
          </button>
          <button
            v-if="canEditEntry(ev)"
            type="button"
            class="entry-action-link"
            :data-test="`edit-entry-${ev.id}`"
            @click="startEdit(ev)"
          >
            编辑
          </button>
          <button
            v-if="canDeleteEntry(ev)"
            type="button"
            class="entry-action-link entry-action-link--danger"
            :data-test="`delete-entry-${ev.id}`"
            @click="confirmDeleteTarget = ev"
          >
            删除
          </button>
        </div>

        <div
          v-if="activeCreate && activeCreate.parentId === ev.id"
          class="structured-form structured-form--nested"
          data-test="structured-create-form"
        >
          <div class="structured-form__head">
            <strong>{{ createFormHeading }}</strong>
            <button type="button" class="structured-form__close" @click="cancelCreate">取消</button>
          </div>
          <PReferenceField v-model="createDraft.content" data-test="create-entry-content" variant="textarea" :rows="3" label="反驳说明" />
          <p v-if="formError || actionError" class="structured-form__error" data-test="structured-form-error" role="alert">
            {{ formError || actionError }}
          </p>
          <div class="structured-form__actions">
            <PButton type="button" size="sm" variant="secondary" @click="cancelCreate">取消</PButton>
            <PButton type="button" size="sm" data-test="submit-create-entry" :disabled="mutating" @click="submitCreate">
              发布
            </PButton>
          </div>
        </div>

        <div v-if="childrenOf(ev.id).length" class="entry-grandchildren">
          <div
            v-for="reply in childrenOf(ev.id)"
            :key="reply.id"
            class="entry-card entry-card--grandchild"
            :data-test="`entry-card-${reply.id}`"
          >
            <header class="entry-card__header">
              <div class="entry-card__badges">
                <span class="entry-card__stance" :class="`is-${reply.stance}`">{{ stanceLabel(reply.stance) }}</span>
                <span class="entry-card__type">反驳</span>
              </div>
              <div class="entry-card__meta">
                <span>{{ reply.user?.username || '匿名' }}</span>
                <span aria-hidden="true">·</span>
                <time :datetime="reply.created_at">{{ formatDate(reply.created_at) }}</time>
              </div>
            </header>

            <template v-if="editingEntryId === reply.id">
              <div class="structured-inline-edit" :data-test="`edit-form-${reply.id}`">
                <PReferenceField v-model="editDraft.content" data-test="edit-entry-content" variant="textarea" :rows="3" />
                <p v-if="formError || actionError" class="structured-form__error" role="alert">{{ formError || actionError }}</p>
                <div class="structured-form__actions">
                  <PButton type="button" size="sm" variant="secondary" @click="cancelEdit">取消</PButton>
                  <PButton type="button" size="sm" data-test="submit-edit-entry" :disabled="mutating" @click="submitEdit(reply)">
                    保存修改
                  </PButton>
                </div>
              </div>
            </template>
            <template v-else>
              <p class="entry-card__content">{{ reply.content }}</p>
              <PReferenceCardList v-if="reply.references?.length" :references="reply.references" :compact="true" />
            </template>

            <div v-if="!archived && editingEntryId !== reply.id" class="entry-card__actions">
              <button
                v-if="canEditEntry(reply)"
                type="button"
                class="entry-action-link"
                :data-test="`edit-entry-${reply.id}`"
                @click="startEdit(reply)"
              >
                编辑
              </button>
              <button
                v-if="canDeleteEntry(reply)"
                type="button"
                class="entry-action-link entry-action-link--danger"
                :data-test="`delete-entry-${reply.id}`"
                @click="confirmDeleteTarget = reply"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      </article>
    </div>

    <PConfirm
      :show="Boolean(confirmDeleteTarget)"
      danger
      title="删除结构化条目"
      message="删除后其下挂证据或反驳，以及关联的未结案质询将一并清理，确定继续吗？"
      confirm-text="确认删除"
      @confirm="confirmDelete"
      @cancel="confirmDeleteTarget = null"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import DebateReferencePicker from '@/components/debate/DebateReferencePicker.vue'
import PReferenceCardList from '@/components/shared/PReferenceCardList.vue'
import PReferenceField from '@/components/shared/PReferenceField.vue'
import PButton from '@/components/ui/PButton.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PInput from '@/components/ui/PInput.vue'
import { useAuthStore } from '@/stores/auth'
import type {
  CreateDebateEntryInput,
  DebateEntry,
  DebateEntryStance,
  DebateEntryType,
  UpdateDebateEntryInput,
} from '@/types'
import { hasInvalidDebateReferenceSyntax, parseResourceReferences } from '@/utils/resourceReferences'

const props = withDefaults(defineProps<{
  debateId: string
  archived?: boolean
  entries: DebateEntry[]
  loading?: boolean
  canModerate?: boolean
  currentUserId?: string
  mutating?: boolean
  actionError?: string
}>(), {
  archived: false,
  loading: false,
  canModerate: false,
  currentUserId: '',
  mutating: false,
  actionError: '',
})

const emit = defineEmits<{
  create: [input: CreateDebateEntryInput]
  update: [entryId: string, input: UpdateDebateEntryInput]
  delete: [entryId: string]
  challenge: [payload: { targetType: 'entry'; targetId: string; targetLabel: string }]
}>()

const authStore = useAuthStore()
const router = useRouter()

const stanceFilter = ref<'all' | 'support' | 'oppose'>('all')
const filterOptions: ReadonlyArray<{ value: 'all' | 'support' | 'oppose'; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'support', label: '支持方' },
  { value: 'oppose', label: '反方' },
]

const activeCreate = ref<{ entryType: DebateEntryType; parentId?: string } | null>(null)
const createDraft = ref<{ stance: DebateEntryStance; title: string; content: string }>({
  stance: 'support',
  title: '',
  content: '',
})

const editingEntryId = ref('')
const editDraft = ref<{ stance: DebateEntryStance; title: string; content: string }>({
  stance: 'support',
  title: '',
  content: '',
})

const formError = ref('')
const confirmDeleteTarget = ref<DebateEntry | null>(null)

const visibleClaims = computed(() => props.entries.filter((entry) => (
  entry.entry_type === 'claim'
  && (stanceFilter.value === 'all' || entry.stance === stanceFilter.value)
)))

const visibleStandaloneEvidence = computed(() => props.entries.filter((entry) => (
  entry.entry_type === 'evidence'
  && !entry.parent_id
  && (stanceFilter.value === 'all' || entry.stance === stanceFilter.value)
)))

const childrenByParent = computed(() => {
  const map = new Map<string, DebateEntry[]>()
  for (const entry of props.entries) {
    if (!entry.parent_id) continue
    const list = map.get(entry.parent_id) ?? []
    list.push(entry)
    map.set(entry.parent_id, list)
  }
  return map
})

const createFormHeading = computed(() => {
  if (!activeCreate.value) return ''
  if (activeCreate.value.entryType === 'claim') return '提出核心论点'
  if (activeCreate.value.entryType === 'evidence') return activeCreate.value.parentId ? '为论点补充站内证据' : '补充独立站内证据'
  return '发表反驳说明'
})

watch(() => props.entries, () => {
  activeCreate.value = null
  editingEntryId.value = ''
  formError.value = ''
})

function childrenOf(parentId: string) {
  return childrenByParent.value.get(parentId) ?? []
}

function canEditEntry(entry: DebateEntry) {
  if (entry.status === 'rejected') return false
  return Boolean(props.canModerate || (props.currentUserId && entry.user_id === props.currentUserId))
}

function canDeleteEntry(entry: DebateEntry) {
  return Boolean(props.canModerate || (props.currentUserId && entry.user_id === props.currentUserId))
}

function stanceLabel(stance: DebateEntryStance) {
  if (stance === 'support') return '支持'
  if (stance === 'oppose') return '反驳'
  return '中立'
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}/${month}/${day}`
}

async function ensureAuthenticated(): Promise<boolean> {
  if (authStore.isAuthenticated || (await authStore.restoreSession())) return true
  await router.push('/login')
  return false
}

async function openCreate(entryType: DebateEntryType, parent?: DebateEntry) {
  if (!(await ensureAuthenticated())) return
  editingEntryId.value = ''
  formError.value = ''
  let defaultStance: DebateEntryStance = 'support'
  if (parent) {
    if (entryType === 'evidence') {
      defaultStance = parent.stance
    } else if (entryType === 'rebuttal') {
      defaultStance = parent.stance === 'support' ? 'oppose' : parent.stance === 'oppose' ? 'support' : 'neutral'
    }
  }
  activeCreate.value = { entryType, parentId: parent?.id }
  createDraft.value = { stance: defaultStance, title: '', content: '' }
}

function cancelCreate() {
  activeCreate.value = null
  formError.value = ''
}

function appendCreateToken(token: string) {
  const current = createDraft.value.content.trimEnd()
  createDraft.value.content = current ? `${current} ${token}` : token
  formError.value = ''
}

function appendEditToken(token: string) {
  const current = editDraft.value.content.trimEnd()
  editDraft.value.content = current ? `${current} ${token}` : token
  formError.value = ''
}

function validateEntryDraft(entryType: DebateEntryType, title: string, content: string): string {
  if (entryType === 'claim' && !title.trim()) {
    return '请填写核心论点标题'
  }
  if (!content.trim()) {
    return '请填写内容'
  }
  if (hasInvalidDebateReferenceSyntax(content)) {
    return '内容包含无效的 @站内资源 引用格式'
  }
  if (entryType === 'evidence' && parseResourceReferences(content).length === 0) {
    return '证据必须至少引用一条站内资源（可通过上方检索插入 @类型:ID）'
  }
  return ''
}

function submitCreate() {
  if (!activeCreate.value) return
  const msg = validateEntryDraft(activeCreate.value.entryType, createDraft.value.title, createDraft.value.content)
  if (msg) {
    formError.value = msg
    return
  }
  formError.value = ''
  emit('create', {
    parent_id: activeCreate.value.parentId,
    entry_type: activeCreate.value.entryType,
    stance: createDraft.value.stance,
    title: activeCreate.value.entryType === 'claim' ? createDraft.value.title.trim() : undefined,
    content: createDraft.value.content.trim(),
  })
}

function startEdit(entry: DebateEntry) {
  activeCreate.value = null
  formError.value = ''
  editingEntryId.value = entry.id
  editDraft.value = {
    stance: entry.stance,
    title: entry.title || '',
    content: entry.content,
  }
}

function cancelEdit() {
  editingEntryId.value = ''
  formError.value = ''
}

function submitEdit(entry: DebateEntry) {
  const msg = validateEntryDraft(entry.entry_type, editDraft.value.title, editDraft.value.content)
  if (msg) {
    formError.value = msg
    return
  }
  formError.value = ''
  emit('update', entry.id, {
    stance: editDraft.value.stance,
    title: entry.entry_type === 'claim' ? editDraft.value.title.trim() : undefined,
    content: editDraft.value.content.trim(),
  })
}

async function requestChallenge(entry: DebateEntry) {
  if (!(await ensureAuthenticated())) return
  const trimmed = entry.content.trim()
  const preview = trimmed.length > 60 ? `${trimmed.slice(0, 60)}…` : trimmed
  emit('challenge', {
    targetType: 'entry',
    targetId: entry.id,
    targetLabel: preview || '结构化证据',
  })
}

function confirmDelete() {
  const target = confirmDeleteTarget.value
  if (!target) return
  confirmDeleteTarget.value = null
  emit('delete', target.id)
}
</script>

<style scoped>
.structured-panel {
  display: grid;
  gap: 16px;
  margin-top: 28px;
  padding-top: 24px;
  border-top: 1px solid var(--a-color-border-soft);
}

.structured-panel__header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.structured-panel__title-wrap {
  display: grid;
  gap: 4px;
}

.structured-panel__heading {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--a-color-text);
}

.structured-panel__sub {
  color: var(--a-color-muted);
  font-size: 12px;
}

.structured-panel__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.structured-panel__filters {
  display: inline-flex;
  gap: 4px;
}

.structured-panel__filter,
.structured-form__stance {
  min-height: 34px;
  padding: 0 10px;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  color: var(--a-color-text-secondary);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
}

.structured-panel__filter.is-active,
.structured-form__stance.is-selected {
  border-color: var(--a-color-primary);
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
  font-weight: 600;
}

.structured-panel__state {
  padding: 28px 0;
  color: var(--a-color-muted);
  text-align: center;
  font-size: 13px;
}

.structured-form,
.structured-inline-edit {
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-bg);
}

.structured-form--nested {
  margin-top: 8px;
  background: var(--a-color-surface-muted);
}

.structured-form__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 13px;
}

.structured-form__close {
  border: 0;
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
}

.structured-form__stances {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.structured-form__error {
  margin: 0;
  color: var(--a-color-danger);
  font-size: 13px;
}

.structured-form__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.structured-tree {
  display: grid;
  gap: 14px;
}

.entry-card {
  display: grid;
  gap: 10px;
  padding: 16px;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-bg);
}

.entry-card.is-rejected {
  opacity: 0.72;
  border-color: var(--a-color-danger);
}

.entry-card--child,
.entry-card--grandchild {
  padding: 12px;
  background: var(--a-color-bg);
}

.entry-children,
.entry-grandchildren {
  display: grid;
  gap: 10px;
  padding-left: 14px;
  border-left: 2px solid var(--a-color-border-soft);
}

.entry-card__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.entry-card__badges,
.entry-card__meta,
.entry-card__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.entry-card__stance,
.entry-card__type,
.entry-card__rejected,
.entry-card__challenge-pill {
  padding: 2px 7px;
  border-radius: var(--a-radius-control);
  font-size: 11px;
  font-weight: 500;
}

.entry-card__stance.is-support {
  background: color-mix(in srgb, var(--a-color-primary) 12%, var(--a-color-bg));
  color: var(--a-color-primary);
}

.entry-card__stance.is-oppose {
  background: color-mix(in srgb, var(--a-color-danger) 12%, var(--a-color-bg));
  color: var(--a-color-danger);
}

.entry-card__stance.is-neutral {
  background: var(--a-color-surface-muted);
  color: var(--a-color-text-secondary);
}

.entry-card__type {
  border: 1px solid var(--a-color-border-soft);
  color: var(--a-color-muted);
}

.entry-card__rejected {
  border: 1px solid var(--a-color-danger);
  color: var(--a-color-danger);
}

.entry-card__challenge-pill {
  border: 1px solid var(--a-color-warning);
  color: var(--a-color-warning);
}

.entry-card__meta {
  color: var(--a-color-muted);
  font-size: 12px;
}

.entry-card__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--a-color-text);
  overflow-wrap: anywhere;
}

.entry-card__content {
  margin: 0;
  color: var(--a-color-text-secondary);
  font-size: 14px;
  line-height: 1.65;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.entry-action-link {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
}

.entry-action-link:hover {
  color: var(--a-color-primary);
}

.entry-action-link--danger:hover {
  color: var(--a-color-danger);
}
</style>
