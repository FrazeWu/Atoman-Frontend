# 全站原生弹窗 (window.alert / window.confirm) 彻底淘汰与标准化设计规范

## 1. 背景与目标
在前端现代化重构与多端适配中，原生的阻塞式浏览器对话框（`window.alert` 与 `window.confirm`）存在以下严重问题：
1. **多端体验不一致**: 在移动端 Web 与 iOS App WebView 容器中，系统弹窗会冻结主渲染线程，样式与品牌风格割裂，无法进行自定义布局；
2. **无障碍访问性缺失**: 原生弹窗无法与应用的 ARIA 区域或无障碍树协同，无法定制焦点还原与平滑过渡；
3. **风格与 Token 违和**: 无法遵循全站 0 阴影、4px 圆角与语义色 Token 规范。

**目标**:
彻底拔除全站源码中仅存的 3 处原生 `window.alert` / `window.confirm`，统合至标准 `<PModal>` 与 `<PConfirm>` 组件体系，并建立全站静态契约测试防止回退。

---

## 2. 治理清单与设计方案

### 2.1 推荐流依据弹窗 (`FeedRecommendedView.vue`)
- **现状**:
  用户在推荐列表卡片点击「为什么推荐？」时，调用 `showRecommendationReason(item)`，直接弹出 `window.alert(...)`。
- **重构方案**:
  - 在 `FeedRecommendedView.vue` 中定义 `activeReasonItem = ref<RecommendationItem | null>(null)`；
  - 点击时设置 `activeReasonItem.value = item`；
  - 接入标准 `<PModal :show="Boolean(activeReasonItem)" size="sm" title="推荐依据" @close="activeReasonItem = null">`；
  - 弹窗内容清晰展示算法依据（如标签分值或综合画像说明），底部配备标准 `PButton`「知道了」，支持 ESC 键与遮罩关闭。

### 2.2 读书笔记删除确认 (`BookNotesView.vue`)
- **现状**:
  用户点击读书笔记卡片的「删除」按钮时，使用 `window.confirm('确定删除该读书笔记吗？')` 阻塞询问。
- **重构方案**:
  - 定义 `deletingNote = ref<BookAnnotation | null>(null)` 与 `isDeletingNote = ref(false)`；
  - 引入 `<PConfirm>` 弹窗组件：
    ```html
    <PConfirm
      :show="Boolean(deletingNote)"
      title="删除读书笔记"
      message="确定要删除该读书笔记吗？此操作不可撤销。"
      :danger="true"
      confirm-text="删除"
      cancel-text="取消"
      :loading="isDeletingNote"
      @confirm="executeDeleteNote"
      @cancel="deletingNote = null"
    />
    ```
  - 同步更新 `BookNotesView.spec.ts` 单测，覆盖确认删除与取消删除分支。

### 2.3 订阅规则即时应用确认 (`useFeedSubscriptionManager.ts` & `FeedView.vue`)
- **现状**:
  规则保存成功后，`useFeedSubscriptionManager.ts` 调用 `confirmApplySavedRule`，使用 `window.confirm("规则已保存，是否立即应用到已有订阅？")` 询问用户是否批量应用。
- **重构方案**:
  - `useFeedSubscriptionManager` 暴露状态 `pendingRuleToApply = ref<{ id: string } | null>(null)` 及方法 `executeApplySavedRule` 与 `cancelApplySavedRule`；
  - `FeedView.vue` 挂载 `<PConfirm>`：
    ```html
    <PConfirm
      :show="Boolean(pendingRuleToApply)"
      title="应用规则"
      message="规则已保存，是否立即应用到已有订阅？"
      confirm-text="立即应用"
      cancel-text="暂不应用"
      @confirm="executeApplySavedRule"
      @cancel="cancelApplySavedRule"
    />
    ```
  - 保持原有的业务时序（保存规则 -> 提示应用 -> 触发更新）。

---

## 3. 防回退契约与质量保障

新增静态契约测试 `tests/unit/system/native-dialog-contract.spec.ts`：
1. 扫描 `src/` 与 `apps/mobile/` 目录下的所有 `.vue` 与 `.ts` 源文件；
2. 严格断言代码中不再出现 `window.alert`、`window.confirm`；
3. 将全站原生弹窗实例数量恒定锁定为 0。

---

## 4. 全局约束
- 严格遵循 0 阴影 (`box-shadow: none !important;`) 与 4px 圆角体系；
- 遵循语义色 Token，严禁硬编码 hex 颜色；
- 遵循真数据原则，杜绝 Mock 数据；
- `bun run type-check` 严格 0 error。
