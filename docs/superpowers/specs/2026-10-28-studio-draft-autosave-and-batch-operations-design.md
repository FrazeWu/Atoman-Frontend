# 创作者工作台 Studio 自动保存状态与批量操作反馈标准化设计规范

## 1. 概述与背景

在创作者工作台（Studio）与内容创作流中，创作者的核心资产是草稿与作品内容。当前系统在草稿生命周期管理与批量内容管理上存在以下体验与安全性短板：
1. **长文草稿指示器文案过长且带有内部技术排障信息**：`PostEditorTopbar` 的状态文案出现了诸如“云端草稿同步失败，当前仅保存在本地”、“请检查浏览器存储权限”等长句，违反了前端文案必须收敛为极简用户态的规范；
2. **短记创作区缺少本地自动防抖暂存**：`ShortNoteComposer` 尚无基于本地存储的即时自动保存机制，用户误关页面或刷新时正文和已上传附件容易丢失；
3. **工作台内容表格缺乏通用批量操作能力**：`StudioContentTable` 仅在检测到合集冲突时提供复选框，缺乏常规的多选、全选/半选、批量删除二次防误触拦截与明确的批量操作 Toast 结果反馈。

本设计规范旨在全盘标准化草稿生命周期指示器、引入短记自动暂存，并为工作台提供安全、扁平（0 阴影）、无缝联动的批量管理机制。

---

## 2. 设计原则与边界

1. **用户视角与文案收敛**：
   - 严禁向用户暴露开发者或系统内部排障词汇；
   - 状态提示只说当前事实，说明文案严格控制在单行内。
2. **纯白极简与 0 阴影设计**：
   - 批量操作浮栏、弹窗全部遵循扁平纯线框规范，严格声明 `box-shadow: none !important;`；
   - 统一采用 4px 标准圆角（`var(--a-radius-control)`）。
3. **数据一致性与防误操作**：
   - 批量删除属于不可逆高危动作，必须通过 `PConfirm` 触发明确的条目数量警告；
   - 切换路由、分页、筛选或频道时，自动清空多选状态，防止跨页误删。
4. **组件与顶栏稳定性**：
   - 用户特调的桌面端顶栏交互与视觉（`AppTopbarAuthControls.vue`）绝不修改任何 CSS/DOM。

---

## 3. 详细架构与接口规范

### 3.1 编辑器草稿生命周期状态收敛 (`usePostEditorDraftSession.ts`)

重构 `draftStatus` 计算属性，消除冗长技术句式，统一对齐简洁用户态：

```ts
export type DraftTone = 'ok' | 'warn' | 'muted'
export interface DraftStatus {
  text: string
  tone: DraftTone
}

// 映射规则：
// 1. 发布中：{ tone: 'warn', text: '发布中…' }
// 2. 草稿保存中 / 本地防抖中 / 云端同步中：{ tone: 'warn', text: '保存中…' }
// 3. 云端同步失败但本地已存：{ tone: 'warn', text: '仅保存在本地' }
// 4. 本地存储权限异常 / 写入失败：{ tone: 'warn', text: '保存失败' }
// 5. 检测到未保存草稿：{ tone: 'warn', text: '检测到未保存草稿' }
// 6. 已成功保存（取本地与云端最新时间）：{ tone: 'ok', text: `已保存 ${formatSavedTime(latestTime)}` }
// 7. 初始空内容状态：{ tone: 'muted', text: '自动保存' }
```

### 3.2 短记自动防抖暂存 (`ShortNoteComposer.vue`)

- **数据模型**：
  ```ts
  interface ShortNoteDraft {
    content: string
    mediaUrls: string[]
  }
  ```
- **存储机制**：
  - 调用通用组合式函数 `useAutoSave<ShortNoteDraft>`；
  - 存储 Key: `atoman:short_note_composer_draft`；防抖时间：500ms；
  - `shouldPersist`: 当且仅当 `content.trim().length > 0` 或 `mediaUrls.length > 0` 时持久化。
- **生命周期动作**：
  - `onMounted`: 调用 `loadDraft()`，若存在历史草稿则自动回填；
  - 提交成功后：调用 `clearDraft()` 清空本地草稿缓存。

### 3.3 工作台内容表格多选扩展 (`StudioContentTable.vue`)

- **Props 扩展**：
  ```ts
  interface Props {
    items: StudioContentItem[]
    selectedIds?: string[]
    // ... 原有 props
  }
  ```
- **Emits 扩展**：
  ```ts
  defineEmits<{
    (e: 'toggleSelect', id: string): void
    (e: 'toggleSelectAll', selectAll: boolean): void
    // ... 原有 emits
  }>()
  ```
- **DOM 与无障碍规范**：
  - 表头首列：
    ```html
    <th class="studio-content-table__col-select">
      <input
        type="checkbox"
        :checked="isAllSelected"
        :indeterminate="isIndeterminate"
        aria-label="全选本页内容"
        @change="emit('toggleSelectAll', !isAllSelected)"
      />
    </th>
    ```
  - 每行首列：
    ```html
    <td class="studio-content-table__col-select">
      <input
        type="checkbox"
        :checked="selectedIds.includes(item.id)"
        :aria-label="`选择《${item.title || config.itemLabel}》`"
        @change="emit('toggleSelect', item.id)"
      />
    </td>
    ```

### 3.4 批量操作栏与防误触拦截 (`StudioContentView.vue`)

- **状态管理**：
  ```ts
  const selectedIDs = ref(new Set<string>())
  const batchDeleteConfirmVisible = ref(false)
  ```
- **操作栏 DOM 结构**：
  ```html
  <div v-if="selectedIDs.size > 0" class="studio-content__batch-bar" role="toolbar" aria-label="批量操作">
    <span class="studio-content__batch-count">已选择 {{ selectedIDs.size }} 项</span>
    <div class="studio-content__batch-actions">
      <PButton variant="danger" size="sm" :disabled="mutationBusy" @click="batchDeleteConfirmVisible = true">
        批量删除
      </PButton>
      <PButton variant="ghost" size="sm" @click="selectedIDs.clear()">
        取消
      </PButton>
    </div>
  </div>
  ```
- **删除逻辑与 Toast 联动**：
  - 确认弹窗：
    ```html
    <PConfirm
      :show="batchDeleteConfirmVisible"
      title="批量删除内容"
      :message="`确定删除选中的 ${selectedIDs.size} 项内容吗？此操作不可恢复。`"
      confirm-text="删除"
      danger
      :loading="mutationBusy"
      @confirm="confirmBatchDelete"
      @cancel="batchDeleteConfirmVisible = false"
    />
    ```
  - 删除执行：并发/逐项调用 `studio.deleteContent(module.value, id)`，成功后提示 `toast.success(`已删除 ${count} 项内容`)`，清空 `selectedIDs` 并重新载入页面数据。

---

## 4. 样式与视觉规范

- 批量操作栏样式：
  ```css
  .studio-content__batch-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.625rem 1rem;
    border: 1px solid var(--a-color-border-soft);
    border-radius: var(--a-radius-card);
    background: var(--a-color-bg);
    box-shadow: none !important;
  }
  ```

---

## 5. 质量保证与测试计划

1. **长文草稿指示器单测**：
   - 验证各状态下映射出的文案为“保存中…”、“已保存 18:00”、“仅保存在本地”、“保存失败”、“自动保存”；
   - 绝不出现冗长技术句子。
2. **短记自动暂存单测**：
   - 输入内容与添加图片时触发防抖持久化；
   - 重新挂载组件恢复内容；
   - 提交成功清除草稿。
3. **工作台全选与批量操作单测**：
   - 单选/全选/半选状态计算正确；
   - 批量删除弹窗展示数量断言正确；
   - 批量删除完成后 Toast 调用与列表刷新。
