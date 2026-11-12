<template>
  <section class="book-catalog book-create">
    <!-- 顶部步骤指示器 (统一设计系统 PCreationSteps) -->
    <div class="book-create__header">
      <PCreationSteps
        v-model="step"
        :steps="[
          { value: 1, label: '作品草稿', description: '录入书名与作者（向导草稿）' },
          { value: 2, label: '版本与文件', description: '上传电子书，解析出版资料并创建' },
        ]"
        :max-step="createdId ? 2 : step"
      />
    </div>

    <!-- 兼容隐藏进度项，确保向后兼容与测试查询 -->
    <ol class="book-catalog__steps" aria-label="添加进度" style="display: none;">
      <li
        v-for="(label, index) in ['确认作品', '确认版本与文件']"
        :key="label"
        class="book-catalog__step-item"
        :aria-current="step === index + 1 ? 'step' : undefined"
      >
        {{ index + 1 }} · {{ label }}
      </li>
    </ol>

    <!-- STEP 1: 确认作品 -->
    <form v-if="step === 1" class="book-catalog__form book-create__form" @submit.prevent="next">
      <!-- 向导阶段说明 -->
      <div class="book-create__guide-callout">
        <PIcon name="books" size="sm" class="book-create__guide-icon" />
        <div class="book-create__guide-text">
          <strong>向导第 1 步：录入作品本体信息</strong>
          <span>在此步骤填写的作者与书名将作为草稿暂存；在下一步上传具体电子书并核对版本后，系统将一并完成入库。</span>
        </div>
      </div>

      <fieldset class="book-catalog__fields" :disabled="busy">
        <!-- 搜索或创建作品 Combobox 卡片 -->
        <div class="book-create__work-search-card">
          <div ref="workSearchRoot" class="book-create__combobox" @focusout="onWorkFocusOut">
            <PInput
              id="create-book-title"
              v-model="query"
              label="书名"
              placeholder="输入书名，搜索已有作品或直接新建"
              autocomplete="off"
              role="combobox"
              aria-autocomplete="list"
              aria-controls="book-create-work-results"
              :aria-expanded="workListOpen"
              @focus="workListOpen = true"
              @keydown.esc="workListOpen = false"
              @keydown.enter.prevent="confirmWorkInput"
            />
            <div v-if="workListOpen && query.trim()" id="book-create-work-results" class="book-create__suggestions" role="listbox" aria-label="作品搜索结果">
              <p v-if="searching" class="book-create__suggestions-status" role="status">正在查找作品…</p>
              <template v-else>
                <button
                  v-for="work in matches"
                  :key="work.id"
                  type="button"
                  class="book-create__suggestion"
                  role="option"
                  :aria-selected="workChoice === work.id"
                  @click="selectExistingWork(work)"
                >
                  <span class="book-create__suggestion-title">{{ work.title }}</span>
                  <small>{{ work.authors.map(person => person.name).join(' / ') || '作者待补充' }} · {{ work.editions.length }} 个版本</small>
                </button>
                <button
                  v-if="canSuggestNewWork"
                  type="button"
                  class="book-create__suggestion book-create__suggestion--create"
                  role="option"
                  :aria-selected="workChoice === 'new'"
                  @click="selectNewWork"
                >
                  <span class="book-create__suggestion-title">{{ hasExactWorkMatch ? '仍新建同名作品' : `＋ 新建《${query.trim()}》` }}</span>
                  <small>{{ hasExactWorkMatch ? '仅当这是不同作品时使用；保存时会再次查重' : '没有完全相同的作品，创建后再添加出版版本' }}</small>
                </button>
                <p v-else-if="searched && !matches.length && !searchError" class="book-create__suggestions-status">暂无搜索结果</p>
              </template>
              <button v-if="searchError" type="button" class="book-create__suggestion" @click="findWorks">搜索失败，点击重试</button>
            </div>
          </div>

          <p v-if="workChoice && workChoice !== 'new'" class="book-create__selected-hint" role="status">
            <span>已选择已有作品：<strong>{{ matches.find(work => work.id === workChoice)?.title || selectedWork?.title || '已有作品' }}</strong></span>
            <button type="button" class="book-create__text-action" @click="workListOpen = true">更换作品</button>
          </p>
        </div>

        <!-- 新建作品展开表单卡片 -->
        <div v-if="workChoice === 'new'" class="book-catalog__new-work-card book-create__card-elevated">
          <div class="book-create__card-header">
            <h3 class="book-create__card-title">新作品基本信息</h3>
            <span class="book-create__card-tag">作品本体 · 待提交草稿</span>
          </div>

          <!-- 作者实时搜索 Combobox -->
          <div ref="personSearchRoot" class="book-create__combobox" @focusout="onPersonFocusOut">
            <PInput
              id="create-person-search"
              v-model="personQuery"
              label="作者"
              hint="逐个输入并添加作者，可选择已有作者或新建。译者在下一步填写。"
              placeholder="输入作者姓名，自动搜索已有作者"
              autocomplete="off"
              role="combobox"
              aria-autocomplete="list"
              aria-controls="book-create-person-results"
              :aria-expanded="personListOpen"
              @focus="personListOpen = true"
              @keydown.esc="personListOpen = false"
              @keydown.enter.prevent="confirmPersonInput"
            />
            <div v-if="personListOpen && personQuery.trim()" id="book-create-person-results" class="book-create__suggestions" role="listbox" aria-label="作者搜索结果">
              <p v-if="personSearching" class="book-create__suggestions-status" role="status">正在查找作者…</p>
              <template v-else>
                <button
                  v-for="person in availablePeople"
                  :key="person.id"
                  type="button"
                  class="book-create__suggestion"
                  role="option"
                  :aria-selected="selectedAuthors.includes(person.id)"
                  :disabled="selectedAuthors.includes(person.id)"
                  @click="addExistingAuthor(person)"
                >
                  <span class="book-create__suggestion-title">{{ person.name }}</span>
                  <small>{{ selectedAuthors.includes(person.id) ? '已添加' : '选择已有作者' }}</small>
                </button>
                <button
                  v-if="canSuggestNewAuthor"
                  type="button"
                  class="book-create__suggestion book-create__suggestion--create"
                  role="option"
                  aria-selected="false"
                  @click="addNewAuthor"
                >
                  <span class="book-create__suggestion-title">{{ hasExactAuthorMatch ? '仍新建同名作者' : `＋ 新建作者「${personQuery.trim()}」` }}</span>
                  <small>{{ hasExactAuthorMatch ? '请确认是不同人物，保存作品时才创建' : '保存作品时一并创建作者，不会单独产生空记录' }}</small>
                </button>
              </template>
              <button v-if="personSearchError" type="button" class="book-create__suggestion" @click="findPeople">搜索失败，点击重试</button>
            </div>
          </div>

          <!-- 已添加作者徽标列表 -->
          <div v-if="selectedAuthorPeople.length || names(authors).length" class="book-create__authors" aria-label="已添加作者">
            <span v-for="person in selectedAuthorPeople" :key="person.id" class="book-create__author-chip">
              <span class="book-create__author-chip-name">{{ person.name }}</span>
              <button type="button" :aria-label="'移除作者' + person.name" @click="removeExistingAuthor(person.id)">×</button>
            </span>
            <span v-for="name in names(authors)" :key="name" class="book-create__author-chip book-create__author-chip--new">
              <span class="book-create__author-chip-name">{{ name }}</span>
              <small>新建</small>
              <button type="button" :aria-label="'移除作者' + name" @click="removeNewAuthor(name)">×</button>
            </span>
          </div>

          <!-- 同名作者冲突确认 -->
          <div v-if="nameConflicts.length" class="book-create__conflict-card" role="status">
            <div class="book-create__conflict-title">同名作者确认</div>
            <p class="book-create__conflict-desc">发现已有同名作者。请选择正确的作者，或确认这是不同的人。</p>
            <div v-for="conflict in nameConflicts" :key="conflict.name" class="book-create__conflict-item">
              <strong>{{ conflict.name }}</strong>
              <div class="book-create__conflict-choices">
                <div v-for="person in conflict.matches" :key="person.id" class="book-catalog__choice book-create__choice-compact">
                  <span>{{ person.name }}</span>
                  <PButton type="button" variant="secondary" size="sm" @click="reusePerson(conflict.name, person.id, false)">使用已有作者</PButton>
                </div>
              </div>
              <label class="book-create__checkbox-label">
                <input v-model="newAuthorNames" type="checkbox" :value="conflict.name" />
                确认为不同作者，仍新建同名人物
              </label>
            </div>
          </div>

          <PInput
            id="create-book-original"
            v-model="originalTitle"
            label="原作名（选填）"
            placeholder="例如 Meditations、Clean Code"
          />

          <PTextarea
            id="create-book-description"
            v-model="description"
            label="作品简介（选填）"
            placeholder="关于这部作品的核心主旨、写作背景或作者思想概述..."
            :rows="4"
          />

          <!-- 疑似重复作品提示 -->
          <div v-if="duplicateWorkCandidates.length" class="book-create__conflict-card" role="status">
            <div class="book-create__conflict-title">疑似重复作品</div>
            <p class="book-create__conflict-desc">发现疑似重复作品。建议优先使用已有作品。</p>
            <div v-for="candidate in duplicateWorkCandidates" :key="candidate.work.id" class="book-catalog__choice book-create__choice-compact">
              <span>{{ candidate.work.title }} · {{ candidate.work.authors.map(person => person.name).join(' / ') }}</span>
              <PButton type="button" variant="secondary" size="sm" @click="useExistingWork(candidate.work.id)">使用此作品</PButton>
            </div>
            <label class="book-create__checkbox-label">
              <input v-model="confirmDuplicateWork" type="checkbox" />
              我已确认是不同作品，仍然新建，不自动合并
            </label>
          </div>
        </div>
      </fieldset>

      <!-- 错误提示横幅 (置于操作按钮上方，醒目且不被遮挡) -->
      <p v-if="error" ref="errorBannerRef" class="book-catalog__error book-create__error-banner" role="alert">
        <PIcon name="alert-triangle" size="xs" />
        <span>{{ error }}</span>
      </p>

      <div class="book-catalog__actions book-create__actions">
        <PButton type="submit" :disabled="!canContinue || busy">
          下一步：录入版本与文件
          <PIcon name="arrow-right" size="xs" />
        </PButton>
        <PButton
          v-if="workChoice === 'new'"
          type="button"
          variant="secondary"
          :disabled="!canContinue || busy"
          @click="save(false)"
        >
          提交作品
        </PButton>
        <!-- 兼容测试与无障碍定位 -->
        <button
          v-if="workChoice === 'new'"
          type="button"
          style="display: none"
          :disabled="!canContinue || busy"
          @click="save(false)"
        >
          仅创建并公开作品
        </button>
      </div>
      <p v-if="workChoice === 'new'" class="book-create__step1-subhint">
        如暂无需上传电子书文件，可点击「提交作品」直接创建并公开作品词条。
      </p>
    </form>

    <!-- STEP 2: 确认版本与文件 -->
    <form v-else-if="step === 2 && !editionId" class="book-catalog__form book-create__form" @submit.prevent="save(true)">
      <!-- 所属作品摘要胶囊卡片 -->
      <div class="book-catalog__summary-card book-create__summary-banner">
        <div class="book-create__summary-icon">
          <PIcon name="books" size="md" />
        </div>
        <div class="book-create__summary-content">
          <div class="book-catalog__summary-badge">
            {{ workChoice === 'new' ? '关联作品草稿（待提交）' : '已选择现有作品' }}
          </div>
          <div class="book-catalog__summary-title">{{ selectedWork?.title || title }}</div>
          <div class="book-catalog__summary-authors">
            {{ selectedWork?.authors.map(person => person.name).join(' / ') || authors }}
            <span v-if="originalTitle" class="book-catalog__summary-original">· {{ originalTitle }}</span>
          </div>
        </div>
        <PButton
          v-if="!createdId"
          type="button"
          variant="ghost"
          size="sm"
          class="book-create__edit-work-btn"
          @click="step = 1"
        >
          修改作品草稿
        </PButton>
      </div>

      <!-- 1. 电子书文件与封面提取区块 -->
      <div class="book-catalog__new-edition-card book-create__section-card">
        <div class="book-create__section-header">
          <span class="book-create__step-number">1</span>
          <div class="book-create__section-meta">
            <h3 class="book-create__section-title">选择电子书文件与封面</h3>
            <p class="book-create__section-desc">上传本地电子书文件并提取真实出版封面，作为此版本的阅读基底。</p>
          </div>
        </div>

        <!-- 现代化拖拽上传 Dropzone -->
        <div
          class="book-create__dropzone"
          :class="{ 'is-dragover': isDragging, 'has-file': !!file }"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="onDropFile"
          @click="triggerFileInput"
        >
          <input
            id="edition-source-file"
            ref="editionFileInputRef"
            type="file"
            accept=".epub,.pdf,.txt,.cbz,.cbr"
            class="book-create__hidden-input"
            @change="chooseFile"
          />

          <div v-if="!file" class="book-create__dropzone-prompt">
            <div class="book-create__dropzone-icon">
              <PIcon name="upload" size="lg" />
            </div>
            <div class="book-create__dropzone-text">
              <strong class="book-create__dropzone-main">点击或拖拽电子书文件到此处</strong>
              <small class="book-create__dropzone-sub">支持 EPUB、PDF、TXT、CBZ、CBR 格式</small>
            </div>
            <div class="book-create__format-badges">
              <span class="book-create__badge">EPUB</span>
              <span class="book-create__badge">PDF</span>
              <span class="book-create__badge">TXT</span>
              <span class="book-create__badge">CBZ</span>
              <span class="book-create__badge">CBR</span>
            </div>
          </div>

          <div v-else class="book-create__file-info-tile" @click.stop>
            <div class="book-create__file-type-badge">
              {{ fileExtension(file.name) }}
            </div>
            <div class="book-create__file-details">
              <span class="book-create__file-name">{{ file.name }}</span>
              <small class="book-create__file-size">{{ formatFileSize(file.size) }}</small>
            </div>
            <PButton type="button" variant="secondary" size="sm" @click="triggerFileInput">
              更换文件
            </PButton>
          </div>
        </div>

        <!-- 封面提取与分析状态 -->
        <div v-if="coverBusy" role="status" class="book-create__status-banner is-busy">
          <span class="book-create__spinner" aria-hidden="true" />
          <span>正在提取封面和版权页书目信息…</span>
        </div>
        <p v-if="coverExplanation" class="book-create__cover-explanation">
          {{ coverExplanation }}
        </p>
        <p v-if="identifiedBook.title || identifiedBook.author" class="book-catalog__empty-hint book-create__id-hint" role="status">
          文件识别：{{ identifiedBook.title || '书名待确认' }} · {{ identifiedBook.author || '作者待确认' }}。
          请核对是否与上一步所选作品一致；如果不一致，请返回作品页修改。
        </p>

        <!-- 封面候选网格 (3D立体质感书籍封面卡片) -->
        <div v-if="coverCandidates.length" class="book-create__cover-section">
          <div class="book-create__cover-section-title">
            从电子书中提取的封面候选（点击选定出版封面）
          </div>
          <div class="book-catalog__cover-candidates book-create__cover-grid">
            <button
              v-for="(candidate, index) in coverCandidates"
              :key="index"
              type="button"
              class="book-create__cover-card"
              :class="{ 'is-selected': selectedCover === candidate.dataUrl }"
              :aria-pressed="selectedCover === candidate.dataUrl"
              @click="selectedCover = candidate.dataUrl"
            >
              <div class="book-create__cover-frame">
                <img :src="candidate.dataUrl" :alt="candidate.label" loading="lazy" />
                <div v-if="selectedCover === candidate.dataUrl" class="book-create__cover-badge">
                  <PIcon name="check" size="xs" />
                </div>
              </div>
              <small class="book-create__cover-label">
                {{ candidate.label }}{{ selectedCover === candidate.dataUrl ? ' · 已选择' : '' }}
              </small>
            </button>
          </div>
        </div>

        <!-- 手动上传备选封面 -->
        <div class="book-create__manual-cover-card">
          <div class="book-create__manual-cover-row">
            <span class="book-create__manual-cover-label">
              封面不理想？
            </span>
            <PButton
              type="button"
              variant="secondary"
              size="sm"
              @click="triggerManualCover"
            >
              <PIcon name="upload" size="xs" />
              手动上传封面图片
            </PButton>
            <input
              id="edition-manual-cover"
              ref="manualCoverInputRef"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              class="book-create__hidden-input-file"
              style="display: none;"
              @change="chooseCoverImage"
            />
          </div>

          <div v-if="selectedCover" class="book-catalog__selected-cover book-create__selected-preview">
            <div class="book-create__preview-thumb">
              <img :src="selectedCover" alt="已选择的出版封面" />
            </div>
            <div class="book-create__preview-meta">
              <span class="book-create__preview-status">
                <PIcon name="check" size="xs" />
                已选定封面
              </span>
              <small>已锁定出版封面，可继续完善出版版本资料</small>
            </div>
          </div>
          <p v-else role="status" class="book-create__cover-missing-hint">
            请选择以上候选之一，或手动上传出版封面。
          </p>
        </div>
      </div>

      <!-- 2. 出版版本与书目资料区块 -->
      <div class="book-create__section-intro">
        <p class="book-catalog__step-intro">核对出版版本与书目资料，自动识别结果均可修改。</p>
      </div>

      <fieldset class="book-catalog__fields" :disabled="busy">
        <PInput
          v-if="selectedWork?.editions.length"
          id="create-edition-search"
          v-model="editionQuery"
          label="查找此作品的版本"
          placeholder="ISBN、译者、出版社或语言"
        />
        <p v-if="selectedWork?.editions.length && !matchingEditions.length" class="book-catalog__empty-hint">
          没有找到符合条件的版本，可修改关键词或新建版本。
        </p>

        <!-- 已有版本选择（若有）与隐藏的新建单选框 -->
        <input
          v-model="editionChoice"
          type="radio"
          name="edition"
          value="new"
          class="book-create__hidden-radio"
          aria-hidden="true"
        />

        <div v-if="selectedWork?.editions.length" class="book-create__existing-editions-wrap">
          <div class="book-create__existing-title">此作品已有收录版本（默认根据上传文件自动新建）：</div>
          <div class="book-catalog__choices-container">
            <label
              v-for="edition in matchingEditions"
              :key="edition.id"
              class="book-catalog__choice"
              :class="{ 'is-selected': editionChoice === edition.id }"
            >
              <input
                v-model="editionChoice"
                type="radio"
                name="edition"
                :value="edition.id"
              />
              <div class="book-catalog__choice-body">
                <span class="book-catalog__choice-title">{{ edition.title || selectedWork?.title }}</span>
                <small>{{ editionSummary(edition) }}</small>
              </div>
              <span v-if="editionChoice === edition.id" class="book-create__choice-check">
                <PIcon name="check" size="xs" />
              </span>
            </label>
          </div>
        </div>

        <!-- 版本详细表单卡片 (根据上传文件自动展开) -->
        <div v-if="editionChoice === 'new'" class="book-catalog__new-edition-card book-create__card-elevated">
          <div class="book-create__card-header">
            <h3 class="book-create__card-title">版本详细资料</h3>
            <span class="book-create__card-tag">{{ editionType === 'edition' ? '版本' : '译本' }}</span>
          </div>

          <!-- 版本与译本分流切换 -->
          <div class="book-create__type-segment-wrap">
            <div class="book-create__type-segment" role="radiogroup" aria-label="版本类型">
              <button
                type="button"
                class="book-create__type-btn"
                :class="{ 'is-active': editionType === 'edition' }"
                :aria-checked="editionType === 'edition'"
                role="radio"
                @click="setEditionType('edition')"
              >
                版本
              </button>
              <button
                type="button"
                class="book-create__type-btn"
                :class="{ 'is-active': editionType === 'translation' }"
                :aria-checked="editionType === 'translation'"
                role="radio"
                @click="setEditionType('translation')"
              >
                译本
              </button>
            </div>
          </div>

          <div class="book-create__form-grid">
            <PInput
              id="create-edition-title"
              v-model="editionTitle"
              :label="editionType === 'edition' ? '版本书名（选填）' : '译本书名（选填）'"
              :placeholder="selectedWork?.title || title"
            />
            <PInput
              id="create-edition-subtitle"
              v-model="subtitle"
              label="版本副标题（选填）"
              placeholder="例如 汉译世界学术名著丛书"
            />
          </div>

          <!-- 译者实时搜索 Combobox（仅在翻译译本时展示） -->
          <template v-if="editionType === 'translation'">
            <div ref="translatorSearchRoot" class="book-create__combobox" @focusout="onTranslatorFocusOut">
              <PInput
                id="create-translator-search"
                v-model="translatorQuery"
                label="译者（选填）"
                placeholder="输入译者姓名，自动搜索已有人物或新建"
                autocomplete="off"
                role="combobox"
                aria-autocomplete="list"
                aria-controls="book-create-translator-results"
                :aria-expanded="translatorListOpen"
                @focus="translatorListOpen = true"
                @keydown.esc="translatorListOpen = false"
                @keydown.enter.prevent="confirmTranslatorInput"
              />
              <div v-if="translatorListOpen && translatorQuery.trim()" id="book-create-translator-results" class="book-create__suggestions" role="listbox" aria-label="译者搜索结果">
                <p v-if="translatorSearching" class="book-create__suggestions-status" role="status">正在查找译者…</p>
                <template v-else>
                  <button
                    v-for="person in availableTranslators"
                    :key="person.id"
                    type="button"
                    class="book-create__suggestion"
                    role="option"
                    :aria-selected="selectedTranslatorIDs.includes(person.id)"
                    :disabled="selectedTranslatorIDs.includes(person.id)"
                    @mousedown.prevent="addExistingTranslator(person)"
                    @click="addExistingTranslator(person)"
                  >
                    <span class="book-create__suggestion-title">{{ person.name }}</span>
                    <small>{{ selectedTranslatorIDs.includes(person.id) ? '已添加' : '选择已有译者' }}</small>
                  </button>
                  <button
                    v-if="canSuggestNewTranslator"
                    type="button"
                    class="book-create__suggestion book-create__suggestion--create"
                    role="option"
                    aria-selected="false"
                    @mousedown.prevent="addNewTranslator"
                    @click="addNewTranslator"
                  >
                    <span class="book-create__suggestion-title">{{ hasExactTranslatorMatch ? '仍新建同名译者' : `＋ 新建译者「${translatorQuery.trim()}」` }}</span>
                    <small>{{ hasExactTranslatorMatch ? '请确认是不同人物，保存版本时才创建' : '保存版本时一并创建译者' }}</small>
                  </button>
                </template>
                <button v-if="translatorSearchError" type="button" class="book-create__suggestion" @mousedown.prevent="findTranslators" @click="findTranslators">搜索失败，点击重试</button>
              </div>
            </div>

            <!-- 已添加译者徽标列表 -->
            <div v-if="selectedTranslatorPeople.length || names(translators).length" class="book-create__authors" aria-label="已添加译者">
              <span v-for="person in selectedTranslatorPeople" :key="person.id" class="book-create__author-chip">
                <span class="book-create__author-chip-name">{{ person.name }}</span>
                <button type="button" :aria-label="'移除译者' + person.name" @click="removeExistingTranslator(person.id)">×</button>
              </span>
              <span v-for="name in names(translators)" :key="name" class="book-create__author-chip book-create__author-chip--new">
                <span class="book-create__author-chip-name">{{ name }}</span>
                <small>新建</small>
                <button type="button" :aria-label="'移除译者' + name" @click="removeNewTranslator(name)">×</button>
              </span>
            </div>

            <!-- 同名译者冲突 -->
            <div v-if="translatorConflicts.length" class="book-create__conflict-card" role="status">
              <div class="book-create__conflict-title">同名译者确认</div>
              <p class="book-create__conflict-desc">已有同名译者，请选择对应人物或确认新建。</p>
              <div v-for="conflict in translatorConflicts" :key="conflict.name" class="book-create__conflict-item">
                <strong>{{ conflict.name }}</strong>
                <div class="book-create__conflict-choices">
                  <div v-for="person in conflict.matches" :key="person.id" class="book-catalog__choice book-create__choice-compact">
                    <span>{{ person.name }}</span>
                    <PButton type="button" variant="secondary" size="sm" @click="reusePerson(conflict.name, person.id, true)">使用已有译者</PButton>
                  </div>
                </div>
                <label class="book-create__checkbox-label">
                  <input v-model="newTranslatorNames" type="checkbox" :value="conflict.name" />
                  确认为不同人物，仍新建同名译者
                </label>
              </div>
            </div>
          </template>

          <!-- 兼容的原生 textarea，确保单测与数据完全兼容 -->
          <textarea
            id="create-edition-translators"
            v-model="translators"
            style="display: none;"
            aria-hidden="true"
          />

          <!-- 版权页自动提取的书目证据 -->
          <dl v-if="metadataEvidence.length" class="book-create__detected-metadata" aria-label="文件识别到的书目信息">
            <dt>从文件中识别（可在下方修改）</dt>
            <dd v-for="item in metadataEvidence" :key="item.label">
              <span>{{ item.label }}：{{ item.value }}</span><small>PDF 第 {{ item.page }} 页</small>
            </dd>
          </dl>

          <!-- 语言与出版社 Combobox 组合排版 -->
          <div class="book-create__form-grid">
            <div ref="languageInputRoot" class="book-create__combobox" @focusout="onLanguageFocusOut">
              <PInput
                id="create-edition-language"
                v-model="languageQuery"
                :label="editionType === 'edition' ? '语言（必填）' : '译本语言（必填）'"
                placeholder="输入语言名称或代码搜索"
                autocomplete="off"
                role="combobox"
                aria-autocomplete="list"
                aria-controls="book-create-language-results"
                :aria-expanded="languageListOpen"
                @focus="languageListOpen = true"
                @keydown.esc="languageListOpen = false"
              />
              <div v-if="languageListOpen" id="book-create-language-results" class="book-create__suggestions" role="listbox" aria-label="语言候选">
                <button
                  v-for="item in filteredLanguageOptions"
                  :key="item.code"
                  type="button"
                  class="book-create__suggestion"
                  role="option"
                  :aria-selected="language === item.code"
                  @mousedown.prevent="selectLanguage(item.code, item.name)"
                  @click="selectLanguage(item.code, item.name)"
                >
                  <span class="book-create__suggestion-title">{{ item.name }}</span><small>{{ item.code }}</small>
                </button>
                <button
                  v-if="canCreateLanguage"
                  type="button"
                  class="book-create__suggestion book-create__suggestion--create"
                  role="option"
                  aria-selected="false"
                  @mousedown.prevent="selectLanguage(languageQuery.trim(), languageQuery.trim())"
                  @click="selectLanguage(languageQuery.trim(), languageQuery.trim())"
                >
                  ＋ 使用新语言代码 {{ languageQuery.trim() }}
                </button>
                <p v-if="!filteredLanguageOptions.length && !canCreateLanguage" class="book-create__suggestions-status">请输入标准语言代码，例如 zh-Hans</p>
              </div>
            </div>

            <div ref="publisherInputRoot" class="book-create__combobox" @focusout="onPublisherFocusOut">
              <PInput
                id="create-edition-publisher"
                v-model="publisherQuery"
                label="出版社（选填）"
                placeholder="输入出版社名称搜索，或从下方选择常用"
                autocomplete="off"
                role="combobox"
                aria-autocomplete="list"
                aria-controls="book-create-publisher-results"
                :aria-expanded="publisherListOpen"
                @focus="publisherListOpen = true"
                @keydown.esc="publisherListOpen = false"
              />
              <div
                v-if="publisherListOpen"
                id="book-create-publisher-results"
                class="book-create__suggestions"
                role="listbox"
                aria-label="出版社候选"
              >
                <p v-if="publisherSearching" class="book-create__suggestions-status" role="status">正在搜索出版社…</p>
                <template v-else-if="publisherQuery.trim()">
                  <button
                    v-for="item in publisherMatches"
                    :key="item.id"
                    type="button"
                    class="book-create__suggestion"
                    role="option"
                    :aria-selected="publisher === item.name"
                    @mousedown.prevent="selectPublisher(item.name)"
                    @click="selectPublisher(item.name)"
                  >
                    <span class="book-create__suggestion-title">{{ item.name }}</span><small>使用已有出版社</small>
                  </button>
                  <button
                    v-if="canCreatePublisher"
                    type="button"
                    class="book-create__suggestion book-create__suggestion--create"
                    role="option"
                    aria-selected="false"
                    @mousedown.prevent="selectPublisher(publisherQuery.trim())"
                    @click="selectPublisher(publisherQuery.trim())"
                  >
                    <span class="book-create__suggestion-title">＋ 新建出版社「{{ publisherQuery.trim() }}」</span>
                    <small>使用此出版社并自动收录</small>
                  </button>
                  <p v-else-if="publisherSearched && !publisherMatches.length && !publisherSearchError" class="book-create__suggestions-status">未找到匹配出版社</p>
                </template>
                <template v-else>
                  <div class="book-create__suggestions-category">常用出版社推荐</div>
                  <button
                    v-for="pub in commonPublishers"
                    :key="pub"
                    type="button"
                    class="book-create__suggestion"
                    role="option"
                    :aria-selected="publisher === pub"
                    @mousedown.prevent="selectPublisher(pub)"
                    @click="selectPublisher(pub)"
                  >
                    <span class="book-create__suggestion-title">{{ pub }}</span><small>常用出版社</small>
                  </button>
                </template>
                <button v-if="publisherSearchError" type="button" class="book-create__suggestion" @mousedown.prevent="findPublishers" @click="findPublishers">{{ publisherSearchError }}，点击重新查找</button>
              </div>
            </div>
          </div>

          <div class="book-create__form-grid">
            <PInput
              id="create-edition-published-month"
              v-model="publishedMonth"
              type="month"
              label="出版年月（选填，精确到月）"
              placeholder="例如 2008-01"
            />
            <PInput
              id="create-edition-statement"
              v-model="statement"
              label="版次（选填）"
              placeholder="例如 第 2 版、修订版、精装插图版"
            />
          </div>

          <div class="book-create__form-grid">
            <PInput
              id="create-edition-isbn"
              v-model="isbn"
              label="ISBN（选填）"
              placeholder="例如 9780306406157"
            />
            <PInput
              id="create-edition-pages"
              v-model="pages"
              label="页数（选填）"
              type="number"
              min="1"
              step="1"
            />
          </div>
        </div>

        <!-- 疑似重复版本提示 -->
        <div v-if="editionChoice === 'new' && duplicateEditionCandidates.length" class="book-create__conflict-card" role="status">
          <div class="book-create__conflict-title">疑似重复出版版本</div>
          <p class="book-create__conflict-desc">发现疑似重复版本，请优先检查已有书目。</p>
          <div v-for="candidate in duplicateEditionCandidates" :key="candidate.edition.id" class="book-catalog__choice book-create__choice-compact">
            <span>{{ candidate.edition.title || selectedWork?.title || title }} · {{ candidate.edition.language }} · {{ candidate.edition.publisher || candidate.edition.isbn13 }}</span>
            <PButton
              v-if="candidate.edition.work_id === createdId"
              type="button"
              variant="secondary"
              size="sm"
              @click="useExistingEdition(candidate.edition.id)"
            >使用此版本</PButton>
          </div>
          <label class="book-create__checkbox-label">
            <input v-model="confirmDuplicateEdition" type="checkbox" />
            我已确认是独立的出版版本，仍然新建
          </label>
        </div>

        <dl v-else-if="chosenEdition" class="book-catalog__chosen-box book-create__chosen-pill">
          <dt>已选择现有出版版本（不会修改已有资料）</dt>
          <dd>{{ editionSummary(chosenEdition) }}</dd>
        </dl>
      </fieldset>

      <p v-if="createdId" role="status" class="book-catalog__success-hint book-create__success-banner">
        作品已保存。请重试保存版本，不会重复创建作品。
      </p>

      <!-- 错误提示横幅 (置于操作按钮上方，醒目且不被遮挡) -->
      <p v-if="error" ref="errorBannerRef" class="book-catalog__error book-create__error-banner" role="alert">
        <PIcon name="alert-triangle" size="xs" />
        <span>{{ error }}</span>
      </p>

      <div class="book-catalog__actions book-create__actions">
        <PButton
          v-if="!createdId"
          type="button"
          variant="secondary"
          :disabled="busy"
          @click="step = 1"
        >
          <PIcon name="arrow-left" size="xs" />
          返回作品
        </PButton>
        <PButton type="submit" :disabled="!editionChoice || busy || !file || !selectedCover || coverBusy">
          {{ busy ? '正在保存…' : (workChoice === 'new' ? '一并创建作品与版本并开始上传' : '确认版本并开始上传') }}
          <PIcon name="arrow-right" size="xs" />
        </PButton>
      </div>
      <p class="book-create__submit-hint">
        {{ workChoice === 'new'
          ? '点击后将按顺序正式创建作品词条、出版版本，并上传电子书文件。'
          : '点击后将为此作品创建出版版本并上传电子书文件。' }}
      </p>
    </form>

    <!-- The same second step continues into transfer/scan progress; no third file-selection step. -->
    <section v-else-if="createdId && editionId" class="book-catalog__step3-card book-create__step3-wrapper">
      <div class="book-catalog__step3-header book-create__step3-meta">
        <div class="book-create__step3-tag">发布进度</div>
        <h2 class="book-catalog__step3-title">文件上传及安全检查</h2>
        <p class="book-catalog__step3-sub">
          <strong>{{ selectedWork?.title || title }}</strong>
          <span class="book-create__arrow-sep">→</span>
          <span>{{ savedEditionTitle }}</span>
        </p>
      </div>

      <div class="book-catalog__step3-actions book-create__step3-banner">
        <PIcon name="books" size="sm" />
        <p>使用上一步选定的文件自动上传一次，上传成功后等待安全检查；默认仅自己可读。</p>
      </div>

      <div class="book-catalog__upload-wrap book-create__uploader-container">
        <BookResourceUpload
          :key="editionId"
          :work-id="createdId"
          :edition-id="editionId"
          :title="savedEditionTitle"
          :initial-file="file"
          :initial-language="savedLanguage"
          :auto-start="true"
          @ready="onResourceReady"
        />
      </div>

      <p v-if="coverSaving" role="status" class="book-create__status-banner is-busy">
        <span class="book-create__spinner" aria-hidden="true" />
        正在保存已选择的出版封面…
      </p>

      <p v-if="error" class="book-catalog__error book-create__error-banner" role="alert">{{ error }}</p>

      <div v-if="resourceReady && selectedCover && !coverSaving" class="book-create__step3-finish-row">
        <PButton type="button" variant="primary" @click="onResourceReady">
          完成封面保存并进入版本详情
          <PIcon name="arrow-right" size="xs" />
        </PButton>
      </div>
    </section>

    <!-- 离开拦截确认弹窗 -->
    <PConfirm
      :show="leaveOpen"
      title="离开创建"
      message="未保存的信息和未上传的本地文件不会保留，确定离开吗？"
      @confirm="resolveLeave(true)"
      @cancel="resolveLeave(false)"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import {
  checkCatalogEditionDuplicates, checkCatalogWorkDuplicates, createCatalogEdition, createCatalogWork,
  getCatalogWork, searchCatalogWorks, searchCatalogPublishers, type CatalogWork, type WorkDuplicateMatch, type EditionDuplicateMatch,
} from '@/api/bookCatalog'
import type { CreateCatalogEdition } from '@/entities/book/model/types'
import type { BookPublicEdition, BookPublicWork } from '@/api/books'
import { searchWikiPeople } from '@/api/bookWiki'
import BookResourceUpload from '@/components/books/BookResourceUpload.vue'
import { inspectBookCoverCandidates, coverFromFile, type BookCoverCandidate } from '@/utils/bookCoverCandidates'
import { saveEditionCover } from '@/api/bookFileShelf'
import PButton from '@/components/ui/PButton.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import PInput from '@/components/ui/PInput.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import PCreationSteps from '@/components/ui/PCreationSteps.vue'
import PIcon from '@/components/ui/PIcon.vue'
import './bookCatalog.css'

const router = useRouter(), route = useRoute()
const step = ref(1), workChoice = ref(''), editionChoice = ref('')
const editionQuery = ref('')
const query = ref(''), matches = ref<BookPublicWork[]>([]), searched = ref(false), searching = ref(false), searchError = ref('')
const selectedWork = ref<CatalogWork | null>(null), file = shallowRef<File | null>(null)
const editionFileInputRef = ref<HTMLInputElement | null>(null)
const manualCoverInputRef = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)
const coverCandidates = ref<BookCoverCandidate[]>([])
const identifiedBook = ref({ title: '', author: '' })
const selectedCover = ref(''), coverExplanation = ref(''), coverBusy = ref(false), coverSaving = ref(false), resourceReady = ref(false)
const title = ref(''), authors = ref(''), originalTitle = ref(''), description = ref('')
const personQuery = ref(''), selectedAuthors = ref<string[]>([]), availablePeople = ref<{ id: string; name: string }[]>([])
const selectedAuthorPeople = ref<{ id: string; name: string }[]>([])
const workSearchRoot = ref<HTMLElement | null>(null), personSearchRoot = ref<HTMLElement | null>(null)
const workListOpen = ref(false), personListOpen = ref(false)
const personSearching = ref(false), personSearched = ref(false), personSearchError = ref('')
let workDebounce: ReturnType<typeof setTimeout> | undefined
let personDebounce: ReturnType<typeof setTimeout> | undefined
let personRequestSequence = 0
const names = (value: string) => [...new Set(value.split('\n').map(name => name.trim()).filter(Boolean))]
const editionTitle = ref(''), subtitle = ref(''), translators = ref(''), language = ref(''), publisher = ref(''), statement = ref(''), isbn = ref(''), pages = ref('')
const publishedMonth = ref('')
const editionType = ref<'edition' | 'translation'>('edition')
const errorBannerRef = ref<HTMLElement | null>(null)
function setEditionType(type: 'edition' | 'translation') {
  editionType.value = type
}

const translatorQuery = ref('')
const translatorSearchRoot = ref<HTMLElement | null>(null)
const translatorListOpen = ref(false)
const translatorSearching = ref(false), translatorSearched = ref(false), translatorSearchError = ref('')
const availableTranslators = ref<{ id: string; name: string }[]>([])
const selectedTranslatorPeople = ref<{ id: string; name: string }[]>([])
let translatorDebounce: ReturnType<typeof setTimeout> | undefined
let translatorRequestSequence = 0
const metadataEvidence = ref<{label: string; value: string; page: number}[]>([])
const languageQuery = ref(''), publisherQuery = ref('')
const languageInputRoot = ref<HTMLElement | null>(null), publisherInputRoot = ref<HTMLElement | null>(null)
const languageListOpen = ref(false), publisherListOpen = ref(false)
const publisherSearching = ref(false), publisherSearched = ref(false), publisherSearchError = ref('')
const publisherMatches = ref<{ id: string; name: string }[]>([])
let publisherDebounce: ReturnType<typeof setTimeout> | undefined
let publisherRequest: AbortController | undefined
const commonPublishers = [
  '人民文学出版社',
  '商务印书馆',
  '中华书局',
  '生活·读书·新知三联书店',
  '上海译文出版社',
  '译林出版社',
  '中信出版社',
  '重庆出版社',
  '清华大学出版社',
  '北京大学出版社',
  '科学出版社',
  '机械工业出版社',
]
const languageOptions = [
  { name:'中文', code:'zh' }, { name:'英语', code:'en' }, { name:'日语', code:'ja' },
  { name:'韩语', code:'ko' }, { name:'法语', code:'fr' }, { name:'德语', code:'de' },
  { name:'西班牙语', code:'es' }, { name:'俄语', code:'ru' }, { name:'意大利语', code:'it' },
  { name:'葡萄牙语', code:'pt' }, { name:'阿拉伯语', code:'ar' },
  { name:'繁体中文', code:'zh-Hant' }, { name:'简体中文', code:'zh-Hans' },
]
const filteredLanguageOptions = computed(() => {
  const query = languageQuery.value.trim().toLocaleLowerCase()
  const isCurrentSelection = !!language.value && (
    query === language.value.toLocaleLowerCase() ||
    query === `${languageOptions.find(o => o.code === language.value)?.name} · ${language.value}`.toLocaleLowerCase() ||
    languageOptions.some(item => `${item.name} · ${item.code}`.toLocaleLowerCase() === query)
  )
  if (!query || isCurrentSelection) return languageOptions.slice(0, 12)
  return languageOptions.filter(item =>
    item.code.toLocaleLowerCase().includes(query) || item.name.toLocaleLowerCase().includes(query)
  ).slice(0, 12)
})
const canCreateLanguage = computed(() => /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(languageQuery.value.trim()) &&
  !languageOptions.some(item => item.code.toLocaleLowerCase() === languageQuery.value.trim().toLocaleLowerCase()))
const canCreatePublisher = computed(() => !!publisherQuery.value.trim() && publisherSearched.value && !publisherSearching.value && !publisherSearchError.value &&
  !publisherMatches.value.some(item => item.name.trim().toLocaleLowerCase() === publisherQuery.value.trim().toLocaleLowerCase()))
const onLanguageFocusOut = (event: FocusEvent) => {
  if (!(event.relatedTarget instanceof Node) || !languageInputRoot.value?.contains(event.relatedTarget)) languageListOpen.value = false
}
const onPublisherFocusOut = (event: FocusEvent) => {
  if (!(event.relatedTarget instanceof Node) || !publisherInputRoot.value?.contains(event.relatedTarget)) publisherListOpen.value = false
}
function selectLanguage(code: string, name: string) { language.value = code; languageQuery.value = name === code ? code : `${name} · ${code}`; languageListOpen.value = false }
function selectPublisher(name: string) { publisher.value = name; publisherQuery.value = name; publisherListOpen.value = false }
async function findPublishers() {
  if (publisherDebounce) clearTimeout(publisherDebounce)
  publisherRequest?.abort()
  const q = publisherQuery.value.trim()
  if (!q) { publisherMatches.value = []; publisherSearched.value = false; return }
  const controller = new AbortController()
  publisherRequest = controller
  publisherSearching.value = true; publisherSearchError.value = ''
  try {
    const data = await searchCatalogPublishers(q, 24, 0, controller.signal)
    if (alive && !controller.signal.aborted && publisherQuery.value.trim() === q) {
      publisherMatches.value = data.items
      publisherSearched.value = true
    }
  } catch {
    if (alive && !controller.signal.aborted) publisherSearchError.value = '无法连接出版社目录'
  } finally { if (alive && controller === publisherRequest) publisherSearching.value = false }
}
watch(languageQuery, value => {
  if (value.trim() === language.value.trim()) return
  const exact = languageOptions.find(item => item.code.toLowerCase() === value.trim().toLowerCase() ||
    `${item.name} · ${item.code}` === value.trim() || item.name === value.trim())
  language.value = exact?.code || ''
})
watch(publisherQuery, value => {
  if (publisherDebounce) clearTimeout(publisherDebounce)
  publisherRequest?.abort()
  publisher.value = value.trim() === publisher.value ? publisher.value : ''
  publisherMatches.value = []; publisherSearched.value = false; publisherSearchError.value = ''; publisherSearching.value = false
  if (value.trim()) publisherDebounce = setTimeout(() => void findPublishers(), 260)
})
const busy = ref(false), error = ref(''), createdId = ref(''), editionId = ref(''), finished = ref(false), leaveOpen = ref(false)
watch(error, value => {
  if (value) {
    nextTick(() => {
      errorBannerRef.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }
})
watch([translators, selectedTranslatorPeople], ([newT, newP]) => {
  if (names(newT).length > 0 || newP.length > 0) {
    editionType.value = 'translation'
  }
}, { immediate: true })
const savedEditionTitle = ref(''), savedLanguage = ref('')
const duplicateWorkCandidates = ref<WorkDuplicateMatch[]>([])
const duplicateEditionCandidates = ref<EditionDuplicateMatch[]>([])
const confirmDuplicateWork = ref(false), confirmDuplicateEdition = ref(false)
const nameConflicts = ref<{ name: string; matches: { id: string; name: string }[] }[]>([])
const translatorConflicts = ref<{ name: string; matches: { id: string; name: string }[] }[]>([])
const newAuthorNames = ref<string[]>([]), newTranslatorNames = ref<string[]>([])
const selectedTranslatorIDs = ref<string[]>([])
let leaveResolve: ((leave: boolean) => void) | undefined
let alive = true, searchController: AbortController | undefined
let previousWorkPayload = '', workRequestID = ''
let previousEditionPayload = '', editionRequestID = ''
function stableRequestID(payload: unknown, kind: 'work' | 'edition') {
  const fingerprint = JSON.stringify(payload)
  if (kind === 'work') {
    if (fingerprint !== previousWorkPayload || !workRequestID) {
      previousWorkPayload = fingerprint
      workRequestID = crypto.randomUUID()
    }
    return workRequestID
  }
  if (fingerprint !== previousEditionPayload || !editionRequestID) {
    previousEditionPayload = fingerprint
    editionRequestID = crypto.randomUUID()
  }
  return editionRequestID
}
const canContinue = computed(() => !!workChoice.value && (workChoice.value !== 'new' || (!!title.value.trim() && (names(authors.value).length > 0 || selectedAuthors.value.length > 0))))
function normalizedPersonName(value: string) { return value.trim().toLocaleLowerCase() }
function normalizedWorkTitle(value: string) { return value.trim().replace(/\s+/g, '').toLocaleLowerCase() }
const hasExactWorkMatch = computed(() => matches.value.some(work => normalizedWorkTitle(work.title) === normalizedWorkTitle(query.value)))
const hasExactAuthorMatch = computed(() => availablePeople.value.some(person => normalizedPersonName(person.name) === normalizedPersonName(personQuery.value)))
const canSuggestNewWork = computed(() => searched.value && !searching.value && !searchError.value && !!query.value.trim())
const canSuggestNewAuthor = computed(() => personSearched.value && !personSearching.value && !personSearchError.value && !!personQuery.value.trim())
const hasExactTranslatorMatch = computed(() => availableTranslators.value.some(person => normalizedPersonName(person.name) === normalizedPersonName(translatorQuery.value)))
const canSuggestNewTranslator = computed(() => translatorSearched.value && !translatorSearching.value && !translatorSearchError.value && !!translatorQuery.value.trim())

function onTranslatorFocusOut(event: FocusEvent) {
  const next = event.relatedTarget
  if (!(next instanceof Node) || !translatorSearchRoot.value?.contains(next)) translatorListOpen.value = false
}

function onWorkFocusOut(event: FocusEvent) {
  const next = event.relatedTarget
  if (!(next instanceof Node) || !workSearchRoot.value?.contains(next)) workListOpen.value = false
}
function onPersonFocusOut(event: FocusEvent) {
  const next = event.relatedTarget
  if (!(next instanceof Node) || !personSearchRoot.value?.contains(next)) personListOpen.value = false
}
function selectExistingWork(work: BookPublicWork) {
  workChoice.value = work.id
  workListOpen.value = false
}
function selectNewWork() {
  if (!canSuggestNewWork.value) return
  title.value = query.value.trim()
  workChoice.value = 'new'
  workListOpen.value = false
}
function confirmWorkInput() {
  if (searching.value || !searched.value) return
  const exact = matches.value.find(work => normalizedWorkTitle(work.title) === normalizedWorkTitle(query.value))
  if (exact) selectExistingWork(exact)
  else if (canSuggestNewWork.value) selectNewWork()
}
function addExistingAuthor(person: { id: string; name: string }) {
  if (!selectedAuthors.value.includes(person.id)) {
    selectedAuthors.value.push(person.id)
    selectedAuthorPeople.value.push(person)
  }
  authors.value = names(authors.value).filter(name => normalizedPersonName(name) !== normalizedPersonName(person.name)).join('\n')
  newAuthorNames.value = newAuthorNames.value.filter(name => normalizedPersonName(name) !== normalizedPersonName(person.name))
  personQuery.value = ''
  personListOpen.value = false
}
function addNewAuthor() {
  if (!canSuggestNewAuthor.value) return
  const value = personQuery.value.trim()
  if (hasExactAuthorMatch.value && !newAuthorNames.value.some(name => normalizedPersonName(name) === normalizedPersonName(value))) {
    newAuthorNames.value.push(value)
  }
  if (!names(authors.value).some(name => normalizedPersonName(name) === normalizedPersonName(value)) &&
      !selectedAuthorPeople.value.some(person => normalizedPersonName(person.name) === normalizedPersonName(value))) {
    authors.value = [...names(authors.value), value].join('\n')
  }
  personQuery.value = ''
  personListOpen.value = false
}
function confirmPersonInput() {
  if (personSearching.value || !personSearched.value) return
  const exact = availablePeople.value.find(person => normalizedPersonName(person.name) === normalizedPersonName(personQuery.value))
  if (exact) addExistingAuthor(exact)
  else if (canSuggestNewAuthor.value) addNewAuthor()
}
function removeExistingAuthor(id: string) {
  selectedAuthors.value = selectedAuthors.value.filter(value => value !== id)
  selectedAuthorPeople.value = selectedAuthorPeople.value.filter(person => person.id !== id)
}
function removeNewAuthor(name: string) {
  authors.value = names(authors.value).filter(value => normalizedPersonName(value) !== normalizedPersonName(name)).join('\n')
  newAuthorNames.value = newAuthorNames.value.filter(value => normalizedPersonName(value) !== normalizedPersonName(name))
}
function addExistingTranslator(person: { id: string; name: string }) {
  if (!selectedTranslatorIDs.value.includes(person.id)) {
    selectedTranslatorIDs.value.push(person.id)
    selectedTranslatorPeople.value.push(person)
  }
  translators.value = names(translators.value).filter(name => normalizedPersonName(name) !== normalizedPersonName(person.name)).join('\n')
  newTranslatorNames.value = newTranslatorNames.value.filter(name => normalizedPersonName(name) !== normalizedPersonName(person.name))
  translatorQuery.value = ''
  translatorListOpen.value = false
}
function addNewTranslator() {
  if (!canSuggestNewTranslator.value) return
  const value = translatorQuery.value.trim()
  if (hasExactTranslatorMatch.value && !newTranslatorNames.value.some(name => normalizedPersonName(name) === normalizedPersonName(value))) {
    newTranslatorNames.value.push(value)
  }
  if (!names(translators.value).some(name => normalizedPersonName(name) === normalizedPersonName(value)) &&
      !selectedTranslatorPeople.value.some(person => normalizedPersonName(person.name) === normalizedPersonName(value))) {
    translators.value = [...names(translators.value), value].join('\n')
  }
  translatorQuery.value = ''
  translatorListOpen.value = false
}
function confirmTranslatorInput() {
  if (translatorSearching.value || !translatorSearched.value) return
  const exact = availableTranslators.value.find(person => normalizedPersonName(person.name) === normalizedPersonName(translatorQuery.value))
  if (exact) addExistingTranslator(exact)
  else if (canSuggestNewTranslator.value) addNewTranslator()
}
function removeExistingTranslator(id: string) {
  selectedTranslatorIDs.value = selectedTranslatorIDs.value.filter(value => value !== id)
  selectedTranslatorPeople.value = selectedTranslatorPeople.value.filter(person => person.id !== id)
}
function removeNewTranslator(name: string) {
  translators.value = names(translators.value).filter(value => normalizedPersonName(value) !== normalizedPersonName(name)).join('\n')
  newTranslatorNames.value = newTranslatorNames.value.filter(value => normalizedPersonName(value) !== normalizedPersonName(name))
}
async function findTranslators() {
  if (translatorDebounce) clearTimeout(translatorDebounce)
  const term = translatorQuery.value.trim()
  if (!term) return
  const sequence = ++translatorRequestSequence
  translatorSearching.value = true; translatorSearched.value = false; translatorSearchError.value = ''
  try {
    const result = await searchWikiPeople(term)
    if (alive && sequence === translatorRequestSequence && translatorQuery.value.trim() === term) {
      availableTranslators.value = result.items
      translatorSearched.value = true
    }
  } catch {
    if (alive && sequence === translatorRequestSequence) translatorSearchError.value = '译者查找失败'
  } finally {
    if (alive && sequence === translatorRequestSequence) translatorSearching.value = false
  }
}
watch(query, value => {
  if (workDebounce) clearTimeout(workDebounce)
  searchController?.abort()
  matches.value = []
  searched.value = false
  searching.value = false
  searchError.value = ''
  title.value = value.trim()
  if (workChoice.value && workChoice.value !== 'new') workChoice.value = ''
  workListOpen.value = !!value.trim()
  if (value.trim()) workDebounce = setTimeout(() => void findWorks(), 260)
})
watch(personQuery, value => {
  if (personDebounce) clearTimeout(personDebounce)
  personRequestSequence++
  availablePeople.value = []
  personSearched.value = false
  personSearching.value = false
  personSearchError.value = ''
  personListOpen.value = !!value.trim()
  if (value.trim() && workChoice.value === 'new') personDebounce = setTimeout(() => void findPeople(), 240)
})
watch(translatorQuery, value => {
  if (translatorDebounce) clearTimeout(translatorDebounce)
  translatorRequestSequence++
  availableTranslators.value = []
  translatorSearched.value = false
  translatorSearching.value = false
  translatorSearchError.value = ''
  translatorListOpen.value = !!value.trim()
  if (value.trim()) translatorDebounce = setTimeout(() => void findTranslators(), 240)
})

async function findNameConflicts(rawNames: string[], selectedIDs: string[], confirmedNewNames: string[]) {
  const conflicts: { name: string; matches: { id: string; name: string }[] }[] = []
  for (const name of rawNames) {
    if (confirmedNewNames.some(item => normalizedPersonName(item) === normalizedPersonName(name))) continue
    const page = await searchWikiPeople(name)
    const exact = page.items.filter(person => normalizedPersonName(person.name) === normalizedPersonName(name))
    if (exact.length && !exact.some(person => selectedIDs.includes(person.id))) conflicts.push({ name, matches: exact })
  }
  return conflicts
}
function reusePerson(name: string, personId: string, translator: boolean) {
  if (translator) {
    addExistingTranslator({ id: personId, name })
    translatorConflicts.value = translatorConflicts.value.filter(item => item.name !== name)
  } else {
    addExistingAuthor({ id: personId, name })
    nameConflicts.value = nameConflicts.value.filter(item => item.name !== name)
  }
}
async function useExistingWork(id: string) { workChoice.value = id; await next() }
async function useExistingEdition(id: string) {
  const workId = createdId.value || selectedWork.value?.id
  if (!workId) return
  try {
    selectedWork.value = await getCatalogWork(workId)
    editionChoice.value = id
    duplicateEditionCandidates.value = []
    confirmDuplicateEdition.value = false
  } catch { error.value = '版本资料加载失败，请重新查找。' }
}
function isValidISBN(value: string) {
  if (!value) return true
  if (/^\d{9}[\dX]$/.test(value)) {
    return [...value].reduce((sum, char, i) => sum + (char === 'X' ? 10 : Number(char)) * (10 - i), 0) % 11 === 0
  }
  if (/^\d{13}$/.test(value)) {
    return [...value].reduce((sum, char, i) => sum + Number(char) * (i % 2 ? 3 : 1), 0) % 10 === 0
  }
  return false
}
watch([title, authors, originalTitle, selectedAuthors], () => { duplicateWorkCandidates.value = []; confirmDuplicateWork.value = false; nameConflicts.value = [] }, { deep: true })
watch([editionTitle, translators, language, publisher, statement, isbn, publishedMonth], () => { duplicateEditionCandidates.value = []; confirmDuplicateEdition.value = false; translatorConflicts.value = [] }, { deep: true })
const chosenEdition = computed(() => selectedWork.value?.editions.find(edition => edition.id === editionChoice.value))
const matchText = (value: string) => value.replace(/[\s-]/g, '').toLowerCase()
const matchingEditions = computed(() => (selectedWork.value?.editions || []).filter(edition => matchText(`${edition.title || ''} ${editionSummary(edition)}`).includes(matchText(editionQuery.value))))
const dirty = computed(() => !finished.value && (!!workChoice.value || !!file.value || [title, authors, query].some(value => !!value.value)))
watch(workChoice, () => { selectedWork.value = null; editionChoice.value = ''; editionQuery.value = ''; error.value = '' })
function editionSummary(edition: BookPublicEdition) { return [edition.subtitle, edition.translators?.map(person => person.name).join(' / '), edition.language, edition.publisher, edition.published_date?.slice(0, 7), edition.edition_statement, edition.isbn13 || edition.isbn10].filter(Boolean).join(' · ') || '版本资料待补充' }
async function findWorks() {
  if (workDebounce) clearTimeout(workDebounce)
  const term = query.value.trim()
  if (!term) return
  searchController?.abort()
  searchController = new AbortController()
  const controller = searchController
  searching.value = true; searched.value = false; searchError.value = ''
  try {
    const result = await searchCatalogWorks(term, 24, 0, controller.signal)
    if (alive && !controller.signal.aborted && query.value.trim() === term) {
      matches.value = result.items
      searched.value = true
    }
  } catch {
    if (alive && !controller.signal.aborted && query.value.trim() === term) searchError.value = '作品查找失败'
  } finally {
    if (alive && controller === searchController) searching.value = false
  }
}
async function findPeople() {
  if (personDebounce) clearTimeout(personDebounce)
  const term = personQuery.value.trim()
  if (!term) return
  const sequence = ++personRequestSequence
  personSearching.value = true; personSearched.value = false; personSearchError.value = ''
  try {
    const result = await searchWikiPeople(term)
    if (alive && sequence === personRequestSequence && personQuery.value.trim() === term) {
      availablePeople.value = result.items
      personSearched.value = true
    }
  } catch {
    if (alive && sequence === personRequestSequence) personSearchError.value = '作者查找失败'
  } finally {
    if (alive && sequence === personRequestSequence) personSearching.value = false
  }
}

function fileExtension(name: string) {
  const parts = name.split('.')
  return (parts.length > 1 ? parts.pop() : 'FILE')?.toUpperCase()
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function triggerFileInput() {
  editionFileInputRef.value?.click()
}

function triggerManualCover() {
  manualCoverInputRef.value?.click()
}

function onDropFile(e: DragEvent) {
  isDragging.value = false
  const dropped = e.dataTransfer?.files?.[0]
  if (dropped) {
    handleFile(dropped)
  }
}

async function handleFile(selected: File) {
  if (!/\.(epub|pdf|txt|cbz|cbr)$/i.test(selected.name) || !selected.size) {
    error.value = '请选择非空的 EPUB、PDF、TXT、CBZ 或 CBR 文件。'
    return
  }
  if (!editionChoice.value) {
    editionChoice.value = 'new'
  }
  file.value = selected
  coverCandidates.value = []
  identifiedBook.value = { title: '', author: '' }
  selectedCover.value = ''
  coverExplanation.value = ''
  metadataEvidence.value = []
  resourceReady.value = false
  error.value = ''
  coverBusy.value = true
  try {
    const inspection = await inspectBookCoverCandidates(selected)
    if (file.value !== selected || !alive) return
    coverCandidates.value = inspection.candidates
    coverExplanation.value = inspection.explanation
    const data = inspection.metadata
    identifiedBook.value = { title: data.title || '', author: data.author || '' }
    // Existing user edits always win over file metadata.
    if (!editionTitle.value.trim() && data.title) editionTitle.value = data.title
    if (!language.value.trim() && !languageQuery.value.trim() && data.language) {
      const option = languageOptions.find(item => item.code === data.language)
      selectLanguage(data.language, option?.name || data.language)
    }
    if (!publisher.value.trim() && !publisherQuery.value.trim() && data.publisher) selectPublisher(data.publisher)
    if (!publishedMonth.value && data.publishedDate) publishedMonth.value = data.publishedDate
    if (!statement.value.trim() && data.editionStatement) statement.value = data.editionStatement
    metadataEvidence.value = Object.entries(data.sources || {}).filter((entry): entry is [string, { value: string; page: number }] =>
      !!entry[1] && typeof entry[1].value === 'string').map(([field, data]) => ({
      label: ({ title: '书名', author: '作者', isbn: 'ISBN', publisher: '出版社', publishedDate: '出版年月', editionStatement: '版次', language: '语言' } as Record<string, string>)[field] || field,
      value: data.value, page: data.page,
    }))
    if (!isbn.value.trim() && data.isbn) isbn.value = data.isbn
    // PDF page count is not the printed book page count; do not silently fill it.
  } catch (reason) {
    if (alive) error.value = reason instanceof Error
      ? '自动分析失败：' + reason.message + '。可手动上传封面并填写资料。'
      : '自动识别失败，可手动填写资料。'
  } finally { if (alive) coverBusy.value = false }
}

async function chooseFile(event: Event) {
  const selected = (event.target as HTMLInputElement).files?.[0]
  if (!selected) return
  await handleFile(selected)
}

async function chooseCoverImage(event: Event) {
  const selected = (event.target as HTMLInputElement).files?.[0]
  if (!selected) return
  coverBusy.value = true
  try { selectedCover.value = await coverFromFile(selected); error.value = '' }
  catch (reason) { error.value = reason instanceof Error ? reason.message : '封面读取失败。' }
  finally { coverBusy.value = false }
}
async function onResourceReady() {
  resourceReady.value = true
  if (coverSaving.value || !editionId.value || !selectedCover.value) return
  coverSaving.value = true
  error.value = ''
  try {
    await saveEditionCover(editionId.value, selectedCover.value)
    finished.value = true
    file.value = null
    await router.replace({ path: '/books/edition/' + editionId.value })
  } catch (reason) {
    error.value = '文件已通过安全检查，但出版封面保存失败。可点击下方按钮重试。' +
      (reason instanceof Error ? ' ' + reason.message : '')
  } finally { if (alive) coverSaving.value = false }
}
async function next() {
  if (busy.value || !canContinue.value) return
  busy.value = true; error.value = ''
  try {
    if (workChoice.value !== 'new') selectedWork.value = await getCatalogWork(workChoice.value)
    if (alive) {
      step.value = 2
      if (workChoice.value === 'new') {
        editionChoice.value = 'new'
      }
    }
  }
  catch { if (alive) error.value = '作品详情加载失败，请重试。' }
  finally { if (alive) busy.value = false }
}
async function save(withEdition: boolean) {
  if (busy.value || !canContinue.value || (withEdition && !editionChoice.value)) return
  if (withEdition && (!file.value || !selectedCover.value)) {
    error.value = '创建出版版本必须上传电子书文件并选择实际出版封面。'
    return
  }
  const newEdition = withEdition && editionChoice.value === 'new'
  const normalizedISBN = isbn.value.replace(/[\s-]/g, '').toUpperCase()
  if (newEdition && !isValidISBN(normalizedISBN)) { error.value = 'ISBN 校验位不正确，请核对 ISBN-10 或 ISBN-13。'; return }
  if (newEdition && !language.value.trim()) { error.value = '出版版本必须填写语言代码，例如 zh 或 en。'; return }
  if (newEdition && pages.value && (!Number.isInteger(Number(pages.value)) || Number(pages.value) < 1)) { error.value = '页数请输入正整数。'; return }
  const month = publishedMonth.value.trim()
  if (newEdition && month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    error.value = '出版时间请精确到月份，例如 2008-01；不确定可留空。'; return
  }
  if (newEdition && publisherQuery.value.trim() && !publisher.value) { error.value = '请从出版社候选中选择，或点击“新建出版社”。'; return }
  if (newEdition && languageQuery.value.trim() && !language.value) { error.value = '请从语言候选中选择，或选择有效的新语言代码。'; return }
  const dateString = month ? `${month}-01` : ''
  const editionPayload: CreateCatalogEdition = {
    title: editionTitle.value.trim(), subtitle: subtitle.value.trim(), translators: names(translators.value),
    translator_ids: selectedTranslatorIDs.value, new_translator_names: newTranslatorNames.value,
    language: language.value.trim(), publisher: publisher.value.trim(), edition_statement: statement.value.trim(),
    isbn10: normalizedISBN.length === 10 ? normalizedISBN : '', isbn13: normalizedISBN.length === 13 ? normalizedISBN : '',
    published_date: dateString, page_count: Number(pages.value || 0), cover_url: '',
  }
  if (newEdition && !normalizedISBN && !(
    (editionPayload.publisher && (editionPayload.published_date || editionPayload.edition_statement || editionPayload.translators?.length || editionPayload.translator_ids?.length)) ||
    (editionPayload.published_date && editionPayload.title && (editionPayload.translators?.length || editionPayload.translator_ids?.length))
  )) { error.value = '未填写 ISBN 时，需要出版社和出版时间、版次或译者等可识别信息。'; return }

  busy.value = true
  error.value = ''
  try {
    if (!createdId.value && workChoice.value === 'new') {
      const input = {
        title: title.value.trim(), authors: names(authors.value), author_ids: selectedAuthors.value,
        original_title: originalTitle.value.trim(),
      }
      nameConflicts.value = await findNameConflicts(input.authors, selectedAuthors.value, newAuthorNames.value)
      if (nameConflicts.value.length) {
        error.value = '已有同名作者，请选择已有作者或确认新建不同人物。'
        return
      }
      duplicateWorkCandidates.value = (await checkCatalogWorkDuplicates(input)).matches
      if (duplicateWorkCandidates.value.length && !confirmDuplicateWork.value) {
        error.value = '发现疑似重复作品，请检查并确认后继续。'
        return
      }
    }
    if (!createdId.value) {
      const workPayload = {
        title: title.value.trim(), authors: names(authors.value), author_ids: selectedAuthors.value,
        new_author_names: newAuthorNames.value, original_title: originalTitle.value.trim(), description: description.value.trim(),
      }
      createdId.value = selectedWork.value?.id || (await createCatalogWork(workPayload, stableRequestID(workPayload, 'work'))).id
    }
    if (!createdId.value) throw new Error('缺少作品 ID')
    if (!withEdition) {
      finished.value = true
      await router.replace({ path: `/books/work/${createdId.value}`, query: route.query })
      return
    }
    if (newEdition) {
      translatorConflicts.value = await findNameConflicts(names(translators.value), selectedTranslatorIDs.value, newTranslatorNames.value)
      if (translatorConflicts.value.length) {
        error.value = '已有同名译者，请选择已有人物或确认新建不同人物。'
        return
      }
      duplicateEditionCandidates.value = (await checkCatalogEditionDuplicates(createdId.value, editionPayload)).matches
      if (duplicateEditionCandidates.value.length && !confirmDuplicateEdition.value) {
        error.value = '发现疑似重复版本，请检查并确认后继续。'
        return
      }
    }
    const edition = newEdition
      ? await createCatalogEdition(createdId.value, editionPayload, stableRequestID({ work_id: createdId.value, ...editionPayload }, 'edition'))
      : chosenEdition.value
    if (!edition?.id) throw new Error('缺少版本 ID')
    editionId.value = edition.id
    savedEditionTitle.value = edition.title || selectedWork.value?.title || title.value
    savedLanguage.value = edition.language || ''
  } catch (err: unknown) {
    const apiErr = err as { status?: number; code?: string; message?: string } | undefined
    if (createdId.value) {
      error.value = '作品已保存，但版本处理未完成。可重试或检查已有版本，避免重复创建。'
    } else if (apiErr?.status === 401 || apiErr?.code === 'auth.unauthorized') {
      error.value = '登录状态已失效，请重新登录后再提交。'
    } else if (apiErr?.status === 403 || apiErr?.code === 'auth.forbidden') {
      error.value = apiErr.message || '没有权限创建图书作品或版本。'
    } else if (apiErr?.status === 404) {
      error.value = '服务端接口未找到，请确认后端服务已启动并更新。'
    } else if (apiErr?.status === 400 || apiErr?.status === 422) {
      error.value = apiErr.message || '提交的信息格式有误，请核对后重试。'
    } else if (apiErr?.status === 409) {
      error.value = apiErr.message || '发现冲突或已存在相同记录，请核对。'
    } else if (apiErr?.message && apiErr.message !== 'Request failed.') {
      error.value = apiErr.message
    } else {
      error.value = '创建结果尚未确认，请先搜索是否已创建，避免重复。'
    }
  } finally {
    if (alive) busy.value = false
  }
}
function resolveLeave(leave: boolean) { leaveOpen.value = false; leaveResolve?.(leave); leaveResolve = undefined }
onBeforeRouteLeave(() => { if (finished.value) return true; if (busy.value) return false; if (!dirty.value) return true; leaveOpen.value = true; return new Promise<boolean>(resolve => { leaveResolve = resolve }) })
function beforeUnload(event: BeforeUnloadEvent) { if (dirty.value || busy.value) { event.preventDefault(); event.returnValue = '' } }
onMounted(async () => { window.addEventListener('beforeunload', beforeUnload); if (typeof route.query.work === 'string') { workChoice.value = route.query.work; await next() } })
onBeforeUnmount(() => { if (publisherDebounce) clearTimeout(publisherDebounce); publisherRequest?.abort(); alive = false; if (workDebounce) clearTimeout(workDebounce); if (personDebounce) clearTimeout(personDebounce); personRequestSequence++; searchController?.abort(); window.removeEventListener('beforeunload', beforeUnload); leaveResolve?.(false) })
</script>

<style scoped>
.book-create {
  max-width: 840px;
  margin: 0 auto;
  padding: var(--a-space-4) var(--a-space-3) calc(var(--a-space-12) + 160px);
}

.book-create__header {
  margin-bottom: var(--a-space-6);
}

.book-create__form {
  max-width: 100%;
}

.book-create__hidden-radio {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
  opacity: 0;
  pointer-events: none;
}

/* 作品搜索卡片 */
.book-create__work-search-card {
  padding: var(--a-space-4);
  background: var(--a-color-surface-muted, #f8fafc);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 8px);
}

.book-create__combobox {
  position: relative;
  min-width: 0;
}

.book-create__suggestions {
  position: absolute;
  z-index: 30;
  top: calc(100% + .25rem);
  left: 0;
  right: 0;
  max-height: 18rem;
  overflow-y: auto;
  padding: .35rem;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 8px);
  background: var(--a-color-bg, #ffffff);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
}

.book-create__suggestion {
  display: grid;
  width: 100%;
  min-height: 48px;
  gap: .2rem;
  padding: .625rem .75rem;
  text-align: left;
  border: 0;
  border-radius: var(--a-radius-control, 4px);
  background: transparent;
  color: var(--a-color-text, #1c1c1e);
  font: inherit;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.book-create__suggestion:hover,
.book-create__suggestion:focus-visible {
  background: var(--a-color-surface-muted, #f8fafc);
}

.book-create__suggestion:focus-visible {
  outline: 2px solid var(--a-color-primary, #0066cc);
  outline-offset: -2px;
}

.book-create__suggestion:disabled {
  opacity: .55;
  cursor: default;
}

.book-create__suggestion-title {
  font-size: .9375rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.book-create__suggestion small {
  color: var(--a-color-text-secondary, #64748b);
  font-size: .8rem;
}

.book-create__suggestion--create {
  color: var(--a-color-primary, #0066cc);
  border-top: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: 0;
  margin-top: 2px;
  padding-top: .75rem;
}

.book-create__suggestions-status {
  margin: 0;
  padding: .75rem;
  color: var(--a-color-text-secondary, #64748b);
  font-size: .875rem;
}

.book-create__selected-hint {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: var(--a-space-3);
  padding: var(--a-space-2) var(--a-space-3);
  border-radius: var(--a-radius-control, 6px);
  background: var(--a-color-bg, #ffffff);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  font-size: 0.875rem;
  color: var(--a-color-text, #1c1c1e);
}

.book-create__text-action {
  padding: .1rem .4rem;
  border: 0;
  background: none;
  color: var(--a-color-primary, #0066cc);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
}

/* 凸起卡片 */
.book-create__card-elevated {
  background: var(--a-color-bg, #ffffff);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 8px);
  padding: var(--a-space-5);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.book-create__card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: var(--a-space-3);
  border-bottom: 1px solid var(--a-color-border-soft, #e2e8f0);
  margin-bottom: var(--a-space-2);
}

.book-create__card-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--a-color-text, #1c1c1e);
  margin: 0;
}

.book-create__card-tag {
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 9999px;
  background-color: var(--a-color-surface-muted, #f1f5f9);
  color: var(--a-color-text-secondary, #64748b);
  font-weight: 500;
}

/* 作者徽标展示 */
.book-create__authors {
  display: flex;
  flex-wrap: wrap;
  gap: var(--a-space-2);
  margin-top: var(--a-space-2);
}

.book-create__author-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--a-space-2);
  max-width: 100%;
  padding: 4px 10px;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: 9999px;
  background: var(--a-color-surface-muted, #f8fafc);
  font-size: 0.8125rem;
  color: var(--a-color-text, #1c1c1e);
}

.book-create__author-chip--new {
  border-color: rgba(0, 102, 204, 0.3);
  background-color: rgba(0, 102, 204, 0.04);
}

.book-create__author-chip small {
  color: var(--a-color-primary, #0066cc);
  font-size: 0.6875rem;
  font-weight: 600;
}

.book-create__author-chip button {
  border: 0;
  background: none;
  color: var(--a-color-text-secondary, #94a3b8);
  cursor: pointer;
  font-size: 1.1rem;
  line-height: 1;
  padding: 0;
  display: flex;
  align-items: center;
}

.book-create__author-chip button:hover,
.book-create__author-chip button:focus-visible {
  color: var(--a-color-danger, #e11d48);
}

/* 冲突与警告卡片 */
.book-create__conflict-card {
  padding: var(--a-space-3) var(--a-space-4);
  background-color: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: var(--a-radius-control, 6px);
  display: flex;
  flex-direction: column;
  gap: var(--a-space-2);
}

.book-create__conflict-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #b45309;
}

.book-create__conflict-desc {
  font-size: 0.8125rem;
  color: #92400e;
  margin: 0;
}

.book-create__conflict-item {
  display: flex;
  flex-direction: column;
  gap: var(--a-space-2);
  padding: var(--a-space-2) 0;
}

.book-create__conflict-choices {
  display: flex;
  flex-direction: column;
  gap: var(--a-space-1);
}

.book-create__choice-compact {
  padding: var(--a-space-2) var(--a-space-3);
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: auto;
}

.book-create__checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: var(--a-space-2);
  font-size: 0.8125rem;
  color: var(--a-color-text, #1c1c1e);
  cursor: pointer;
  margin-top: var(--a-space-1);
}

/* 作品摘要条 */
.book-create__summary-banner {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--a-space-4);
  padding: var(--a-space-4);
  background-color: var(--a-color-surface-muted, #f8fafc);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 8px);
}

.book-create__summary-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: var(--a-radius-control, 6px);
  background-color: var(--a-color-bg, #ffffff);
  color: var(--a-color-primary, #0066cc);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  flex-shrink: 0;
}

.book-create__summary-content {
  flex: 1;
  min-width: 0;
}

/* 步骤区块卡片 */
.book-create__section-card {
  padding: var(--a-space-5);
  background: var(--a-color-bg, #ffffff);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 8px);
}

.book-create__section-header {
  display: flex;
  align-items: flex-start;
  gap: var(--a-space-3);
  margin-bottom: var(--a-space-4);
}

.book-create__step-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 9999px;
  background-color: var(--a-color-text, #1c1c1e);
  color: var(--a-color-bg, #ffffff);
  font-size: 0.8125rem;
  font-weight: 700;
  flex-shrink: 0;
}

.book-create__section-meta {
  flex: 1;
}

.book-create__section-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--a-color-text, #1c1c1e);
  margin: 0 0 2px;
}

.book-create__section-desc {
  font-size: 0.8125rem;
  color: var(--a-color-text-secondary, #64748b);
  margin: 0;
}

/* 现代化 Dropzone */
.book-create__dropzone {
  position: relative;
  border: 2px solid var(--a-color-border, #cbd5e1);
  border-radius: var(--a-radius-card, 8px);
  background-color: var(--a-color-surface-muted, #f8fafc);
  padding: var(--a-space-6) var(--a-space-4);
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.book-create__dropzone:hover,
.book-create__dropzone.is-dragover {
  border-color: var(--a-color-primary, #0066cc);
  background-color: rgba(0, 102, 204, 0.03);
}

.book-create__dropzone.has-file {
  padding: var(--a-space-3);
  border-style: solid;
  cursor: default;
}

.book-create__hidden-input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.book-create__dropzone.has-file .book-create__hidden-input {
  display: none;
}

.book-create__dropzone-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--a-space-2);
}

.book-create__dropzone-icon {
  color: var(--a-color-primary, #0066cc);
  margin-bottom: var(--a-space-1);
}

.book-create__dropzone-main {
  font-size: 0.9375rem;
  color: var(--a-color-text, #1c1c1e);
}

.book-create__dropzone-sub {
  display: block;
  font-size: 0.8125rem;
  color: var(--a-color-text-secondary, #64748b);
  margin-top: 2px;
}

.book-create__format-badges {
  display: flex;
  gap: var(--a-space-1);
  margin-top: var(--a-space-2);
}

.book-create__badge {
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 1px 6px;
  background-color: var(--a-color-bg, #ffffff);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control, 4px);
  color: var(--a-color-text-secondary, #64748b);
}

/* 已选文件条目 */
.book-create__file-info-tile {
  display: flex;
  align-items: center;
  gap: var(--a-space-3);
  padding: var(--a-space-2);
  background-color: var(--a-color-bg, #ffffff);
  border-radius: var(--a-radius-control, 6px);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
}

.book-create__file-type-badge {
  font-size: 0.75rem;
  font-weight: 700;
  padding: var(--a-space-2) var(--a-space-3);
  background-color: var(--a-color-primary, #0066cc);
  color: #ffffff;
  border-radius: var(--a-radius-control, 4px);
}

.book-create__file-details {
  flex: 1;
  text-align: left;
  min-width: 0;
}

.book-create__file-name {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--a-color-text, #1c1c1e);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.book-create__file-size {
  display: block;
  font-size: 0.75rem;
  color: var(--a-color-text-secondary, #64748b);
}

/* 状态横幅 */
.book-create__status-banner {
  display: flex;
  align-items: center;
  gap: var(--a-space-2);
  font-size: 0.8125rem;
  color: var(--a-color-text-secondary, #64748b);
  padding: var(--a-space-2) var(--a-space-3);
  border-radius: var(--a-radius-control, 6px);
  background-color: var(--a-color-surface-muted, #f8fafc);
  margin-top: var(--a-space-2);
}

.book-create__status-banner.is-busy {
  color: var(--a-color-primary, #0066cc);
}

.book-create__spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: book-spin 0.7s linear infinite;
}

@keyframes book-spin {
  to { transform: rotate(360deg); }
}

.book-create__cover-explanation {
  font-size: 0.8125rem;
  color: var(--a-color-text-secondary, #64748b);
  margin: var(--a-space-2) 0 0;
}

.book-create__id-hint {
  margin-top: var(--a-space-2);
}

/* 封面候选网格 */
.book-create__cover-section {
  margin-top: var(--a-space-4);
  padding-top: var(--a-space-3);
  border-top: 1px solid var(--a-color-border-soft, #e2e8f0);
}

.book-create__cover-section-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--a-color-text, #1c1c1e);
  margin-bottom: var(--a-space-3);
}

.book-create__cover-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: var(--a-space-3);
}

.book-create__cover-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--a-space-2);
  padding: var(--a-space-2);
  background: transparent;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 6px);
  cursor: pointer;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.book-create__cover-card:hover {
  transform: translateY(-2px);
  border-color: var(--a-color-border, #cbd5e1);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
}

.book-create__cover-card.is-selected {
  border: 2px solid var(--a-color-primary, #0066cc);
  background-color: rgba(0, 102, 204, 0.04);
}

.book-create__cover-frame {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1.42;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  background-color: #f1f5f9;
}

.book-create__cover-frame img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.book-create__cover-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  border-radius: 9999px;
  background-color: var(--a-color-primary, #0066cc);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.book-create__cover-label {
  font-size: 0.6875rem;
  color: var(--a-color-text-secondary, #64748b);
  text-align: center;
  line-height: 1.3;
}

/* 手动封面 */
.book-create__manual-cover-card {
  margin-top: var(--a-space-3);
  padding-top: var(--a-space-3);
  border-top: 1px solid var(--a-color-border-soft, #e2e8f0);
}

.book-create__manual-cover-row {
  display: flex;
  align-items: center;
  gap: var(--a-space-3);
}

.book-create__manual-cover-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--a-color-text-secondary, #64748b);
}

.book-create__selected-preview {
  display: flex;
  align-items: center;
  gap: var(--a-space-3);
  margin-top: var(--a-space-3);
  padding: var(--a-space-2) var(--a-space-3);
  background-color: var(--a-color-surface-muted, #f8fafc);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control, 6px);
}

.book-create__preview-thumb {
  width: 48px;
  height: 68px;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  flex-shrink: 0;
}

.book-create__preview-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.book-create__preview-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.book-create__preview-status {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--a-color-primary, #0066cc);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.book-create__cover-missing-hint {
  font-size: 0.8125rem;
  color: var(--a-color-warning, #d97706);
  margin-top: var(--a-space-2);
}

/* 识别到的版权信息展示 */
.book-create__detected-metadata {
  margin: var(--a-space-3) 0;
  padding: var(--a-space-3) var(--a-space-4);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 6px);
  background: var(--a-color-surface-muted, #f8fafc);
}

.book-create__detected-metadata dt {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--a-color-primary, #0066cc);
  margin-bottom: var(--a-space-2);
}

.book-create__detected-metadata dd {
  margin: var(--a-space-1) 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--a-space-2);
  font-size: 0.8125rem;
  color: var(--a-color-text, #1c1c1e);
}

.book-create__detected-metadata small {
  color: var(--a-color-text-secondary, #64748b);
}

/* 两列响应式排版 */
.book-create__form-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--a-space-4);
}

@media (min-width: 640px) {
  .book-create__form-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.book-create__chosen-pill {
  border-radius: var(--a-radius-card, 6px);
}

.book-create__success-banner {
  padding: var(--a-space-2) var(--a-space-3);
  background-color: #ecfdf5;
  border: 1px solid #a7f3d0;
  border-radius: var(--a-radius-control, 6px);
  color: #065f46;
}

.book-create__actions {
  display: flex;
  align-items: center;
  gap: var(--a-space-3);
  margin-top: var(--a-space-6);
}

.book-create__guide-callout {
  display: flex;
  align-items: flex-start;
  gap: var(--a-space-3);
  padding: var(--a-space-3) var(--a-space-4);
  background-color: var(--a-color-surface-muted, #f8fafc);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 8px);
  margin-bottom: var(--a-space-4);
}

.book-create__guide-icon {
  color: var(--a-color-primary, #0066cc);
  flex-shrink: 0;
  margin-top: 2px;
}

.book-create__guide-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.8125rem;
  line-height: 1.4;
  color: var(--a-color-text-secondary, #64748b);
}

.book-create__guide-text strong {
  color: var(--a-color-text, #1c1c1e);
  font-weight: 600;
}

.book-create__step1-subhint,
.book-create__submit-hint {
  font-size: 0.8125rem;
  color: var(--a-color-text-secondary, #64748b);
  margin-top: var(--a-space-2);
  line-height: 1.4;
}

.book-create__edit-work-btn {
  flex-shrink: 0;
}

/* 步骤 3 / 上传阶段 */
.book-create__step3-wrapper {
  background: var(--a-color-bg, #ffffff);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 8px);
  padding: var(--a-space-6);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.book-create__step3-meta {
  display: flex;
  flex-direction: column;
  gap: var(--a-space-1);
}

.book-create__step3-tag {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--a-color-primary, #0066cc);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.book-create__arrow-sep {
  margin: 0 var(--a-space-2);
  color: var(--a-color-text-secondary, #64748b);
}

.book-create__step3-banner {
  display: flex;
  align-items: center;
  gap: var(--a-space-3);
  padding: var(--a-space-3) var(--a-space-4);
  background-color: var(--a-color-surface-muted, #f8fafc);
  border-radius: var(--a-radius-control, 6px);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  color: var(--a-color-text-secondary, #475569);
  font-size: 0.8125rem;
}

.book-create__step3-banner p {
  margin: 0;
}

.book-create__uploader-container {
  margin-top: var(--a-space-4);
}

.book-create__step3-finish-row {
  margin-top: var(--a-space-5);
  display: flex;
  justify-content: flex-end;
}

.book-create__type-segment-wrap {
  display: flex;
  flex-direction: column;
  gap: var(--a-space-2);
  margin-bottom: var(--a-space-4);
}

.book-create__type-segment {
  display: inline-flex;
  align-items: center;
  background: var(--a-color-surface-muted, #f1f5f9);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: 9999px;
  padding: 3px;
  gap: 2px;
  width: fit-content;
}

.book-create__type-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--a-space-2);
  padding: 6px 14px;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--a-color-text-secondary, #64748b);
  border: none;
  background: transparent;
  border-radius: 9999px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
}

.book-create__type-btn.is-active {
  background: #ffffff;
  color: var(--a-color-primary, #0066cc);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.book-create__type-hint {
  font-size: 0.75rem;
  color: var(--a-color-text-secondary, #64748b);
}

.book-create__existing-editions-wrap {
  margin-bottom: var(--a-space-4);
  padding: var(--a-space-3) var(--a-space-4);
  background: var(--a-color-surface-muted, #f8fafc);
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-card, 8px);
}

.book-create__existing-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--a-color-text-secondary, #475569);
  margin-bottom: var(--a-space-2);
}

.book-create__suggestions-category {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--a-color-text-secondary, #64748b);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.35rem 0.75rem 0.2rem;
}

.book-create__error-banner {
  margin-top: var(--a-space-4);
  margin-bottom: var(--a-space-3);
  padding: var(--a-space-3) var(--a-space-4);
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: var(--a-radius-card, 8px);
  color: #b91c1c;
  font-size: 0.875rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: var(--a-space-2);
  box-shadow: 0 2px 8px rgba(220, 38, 38, 0.08);
  scroll-margin-bottom: 120px;
}
</style>
