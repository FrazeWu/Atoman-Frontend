# 全站统一通知、私信与拉黑设计

## 背景

Atoman 现在已经有基础通知和私信能力：

- 后端已有通用 `notifications` 表。
- 后端已有 `internal/modules/notification`，支持列表、未读数、标记已读、全部已读。
- 后端另有旧的 `internal/service/notification_service.go`，论坛通知仍主要通过旧服务创建。
- 前端已有 `notificationStore`、`dmStore` 和 `InboxPage`。
- 顶部通知入口已经汇总普通通知未读数和私信未读数。
- 私信已有一对一会话、文本/图片消息、未读数、WebSocket 推送和私信权限。

新设计目标是把通知从局部论坛提醒升级为全站统一通知模块，同时把私信作为通知入口内的独立会话系统整理清楚。

## 设计原则

1. 通知是打断用户的提醒，不是关注流。
2. 关注、收藏、订阅对象的普通更新由用户主动查看，不主动进入通知中心。
3. 所有模块使用统一通知核心，不各自维护通知规则。
4. 普通通知和私信入口统一，但数据模型保持独立。
5. 默认所有可通知事件都提醒，用户可以关闭某类或某个内容的普通提醒。
6. 拉黑是全站用户保护能力，不只是私信设置。
7. 第一版只做站内通知、站内私信和 WebSocket，不做邮件、浏览器推送、每日摘要。

## 参考产品取舍

YouTube 的订阅通知强调“全部 / 个性化 / 关闭”，但 Atoman 第一版不做订阅动态通知，也不做个性化算法。

Linux.do 使用 Discourse，Discourse 的社区通知层级适合参考“直接相关优先”和“静音减少打扰”，但 Atoman 不把关注主题变成通知源。

GitHub 通知的“收到原因”和收件箱处理体验适合参考。Atoman 通知详情需要明确说明用户为什么收到通知。

## 产品范围

### 做

- 顶部通知下拉框。
- 通知页分类侧边栏。
- 普通通知列表和详情。
- 按分类未读数。
- 标记单条已读。
- 按分类全部已读。
- 通知类型关闭。
- 某个内容不再提醒。
- 私信会话列表和聊天窗口。
- 私信权限：默认陌生人仅可发一条。
- 全站单向拉黑。
- 被拉黑用户内容折叠占位。
- 被拉黑用户普通通知跳过。
- 被拉黑用户私信拒收。

### 不做

- “全部”通知分类。
- 通知删除、归档、完成态。
- 关注对象普通动态通知。
- 点踩通知。
- 邮件通知。
- 浏览器系统推送。
- 每日/每周摘要。
- 拉黑列表搜索。
- 双向拉黑。
- 全站内容权限隐藏。

## 通知分类

通知页侧边栏固定为：

1. 点赞
2. 互动
3. @我
4. 回复我
5. 协作
6. 系统
7. 私信

没有“全部”分类。

### 点赞

只放真正的点赞通知。

点踩不通知。

### 互动

放非回复、非点赞的反馈事件：

- 收藏了我的内容。
- 采纳了我的回答或回复。
- 引用了我的内容。
- 使用了我的内容作为来源。

### @我

放明确提及当前用户的事件。

`@我` 不可关闭，不受“不再提醒此内容”影响，不受普通对象关闭影响。

全站拉黑优先级高于普通 `@我` 提醒。被我拉黑的用户提到我时，不生成普通 `@我` 通知。

### 回复我

放对当前用户内容的回复、评论、讨论回应。

普通回复可以被类型关闭或对象关闭。

### 协作

放 wiki、歌词、注释和共同编辑相关事件：

- 歌词修改影响了我的注释绑定。
- 我的注释需要重新绑定。
- 我参与的 wiki 内容被回滚。
- 我提交的协作内容被修改并需要确认。

协作分为普通协作提醒和必处理协作提醒。必处理协作提醒不可关闭。

### 系统

放站点、账号、权限、审核相关事件：

- 审核结果。
- 权限变化。
- 账号安全。
- 站点公告。

账号安全和关键权限变化不可关闭。

### 私信

私信不写入 `notifications`。

私信未读数来自 `dm_messages.read_at`。

私信只在入口、侧边栏和通知页内统一展示。

## 顶部通知入口

顶部通知按钮显示全站未读总数。

全站未读总数等于：

- 普通通知未读总数。
- 私信未读消息总数。

点击顶部通知按钮打开下拉框。下拉框只显示分类和未读数，不显示最近通知预览：

- 点赞
- 互动
- @我
- 回复我
- 协作
- 系统
- 私信

点击某一项进入通知页对应分类。

示例：

- 点赞：`/feed/inbox?tab=like`
- 互动：`/feed/inbox?tab=interaction`
- @我：`/feed/inbox?tab=mention`
- 回复我：`/feed/inbox?tab=reply`
- 协作：`/feed/inbox?tab=collaboration`
- 系统：`/feed/inbox?tab=system`
- 私信：`/feed/inbox?tab=dm`

## 通知页

通知页左侧是固定侧边栏：

- 点赞
- 互动
- @我
- 回复我
- 协作
- 系统
- 私信

侧边栏每项显示未读数。

普通通知分类使用三栏结构：

- 左侧：分类侧边栏。
- 中间：通知列表。
- 右侧：通知详情。

私信分类使用聊天结构：

- 左侧：分类侧边栏。
- 中间：会话列表。
- 右侧：聊天窗口。

## 普通通知详情

每条普通通知显示：

- 标题。
- 分类。
- 来源模块。
- 来源对象。
- 收到原因。
- 时间。
- 正文摘要。
- 操作按钮。

操作按钮：

- 前往来源。
- 标记已读。
- 不再提醒此类。
- 不再提醒此内容。

收到原因示例：

- 因为有人点赞了你的内容。
- 因为有人收藏了你的内容。
- 因为 Alice 回复了你的帖子。
- 因为有人提到了你。
- 因为歌词修改影响了你的注释绑定。
- 因为这是账号安全通知。

## 通知设置

通知设置放在全局设置页，不放通知页内。

通知设置包含：

- 通知类型开关。
- 已关闭内容列表。
- 恢复提醒操作。
- 不可关闭项说明。

可关闭：

- 点赞。
- 收藏、采纳、引用等互动。
- 普通回复。
- 普通协作提醒。
- 普通系统提醒。

不可关闭：

- @我。
- 私信。
- 账号安全。
- 关键权限变化。
- 协作必处理事件。

这里的不可关闭指通知类型开关和内容不再提醒不能关闭这些事件。全站拉黑是更高优先级的用户保护规则，会屏蔽被拉黑用户触发的普通 `@我` 通知。

## 不再提醒

用户可以关闭两种普通提醒：

1. 不再提醒此类通知。
2. 不再提醒此内容。

类型关闭影响同类普通通知。

内容关闭影响同一来源对象的普通通知。

内容关闭不影响：

- @我。
- 私信。
- 账号安全。
- 关键权限变化。
- 协作必处理事件。

这里的不影响只针对“不再提醒此内容”。全站拉黑仍会屏蔽被拉黑用户触发的普通提醒。

## 私信系统

私信是通知入口里的独立子系统。

现有模型可以继续使用：

- `dm_conversations`
- `dm_messages`

私信默认权限为：陌生人仅可发一条。

规则：

- 我关注的人可以正常私信。
- 陌生人可以发第一条。
- 我回复后，双方可以继续对话。
- 我未回复前，对方不能连续发第二条。
- 用户可以在设置页改成“所有人可发”或“仅我关注的人”。

私信支持：

- 文本。
- 图片。
- 会话未读数。
- 会话标记已读。
- WebSocket 实时消息。

第一版不新增群聊。

## 私信页面

点击侧边栏“私信”后，通知页切换到聊天结构：

- 中间为会话列表。
- 右侧为当前聊天窗口。

聊天窗口顶部显示对方用户名和拉黑入口。

历史消息保留。

被拉黑用户的会话仍保留在列表中，输入框禁用，显示“已拉黑此用户”。

取消拉黑后恢复发送能力。

## 全站拉黑

拉黑是单向的。

我拉黑某个用户后：

- 我不再接收他的私信。
- 我不再接收他触发的普通通知。
- 我看到他的公开内容时，内容折叠为占位。
- 他仍能看到我的公开内容。
- 他仍能在公开场景发言，但我侧默认折叠。

管理员和版主视角不受普通用户拉黑影响。

## 拉黑入口

所有用户名字菜单都提供拉黑入口：

- 私信会话顶部。
- 论坛帖子作者。
- 论坛回复作者。
- 评论作者。
- 音乐注释作者。
- 博客作者。
- 时间线作者。
- 辩题发言者。
- 个人主页。

菜单规则：

- 未拉黑：显示“拉黑”。
- 已拉黑：显示“取消拉黑”。

拉黑需要二次确认。

确认文案说明：

- 不再接收他的私信。
- 不再接收他的普通通知。
- 他的内容会被折叠隐藏。

## 被拉黑用户内容展示

被拉黑用户的公开内容默认折叠占位。

占位文案：

```text
已隐藏一条来自已拉黑用户的内容
```

可以提供“临时查看”按钮。

临时查看不解除拉黑。

## 拉黑与协作事件

如果被拉黑用户触发普通事件：

- 点赞、收藏、回复、普通 @、普通互动通知跳过。

如果被拉黑用户触发协作必处理事件：

- 仍然生成协作通知。
- 隐藏对方身份。
- 隐藏对方内容摘要。
- 只显示需要处理的事实。

示例：

```text
歌词修改影响了你的注释绑定
```

详情只显示：

- 歌曲。
- 注释片段。
- 需要处理的动作。

## 数据模型

### `notifications`

用户可见通知。

保留现有字段：

- `id`
- `recipient_id`
- `actor_id`
- `type`
- `source_type`
- `source_id`
- `meta`
- `read_at`
- `created_at`
- `updated_at`

补充或明确字段：

- `category`
- `reason`
- `aggregate_key`
- `actor_count`
- `latest_actor_id`
- `latest_at`

`category` 取值：

- `like`
- `interaction`
- `mention`
- `reply`
- `collaboration`
- `system`

### `notification_events`

PostgreSQL 事件表队列。

字段：

- `id`
- `event_type`
- `actor_id`
- `subject_type`
- `subject_id`
- `payload`
- `status`
- `attempts`
- `last_error`
- `available_at`
- `processed_at`
- `created_at`
- `updated_at`

状态：

- `pending`
- `processing`
- `done`
- `skipped`
- `failed`

### `notification_preferences`

用户按类型关闭提醒。

字段：

- `id`
- `user_id`
- `category`
- `event_type`
- `enabled`
- `created_at`
- `updated_at`

### `notification_mutes`

用户对某个内容对象不再提醒。

字段：

- `id`
- `user_id`
- `source_type`
- `source_id`
- `reason`
- `created_at`
- `updated_at`

### `user_blocks`

全站单向拉黑。

字段：

- `id`
- `blocker_id`
- `blocked_id`
- `created_at`

`blocker_id + blocked_id` 唯一。

## 通知事件处理

业务模块不直接写 `notifications`。

业务模块写入 `notification_events`。

主服务进程启动 notification worker。

worker 处理流程：

1. 获取 `pending` 或可重试事件。
2. 标记为 `processing`。
3. 解析事件类型和 payload。
4. 计算接收人。
5. 计算分类。
6. 计算跳转来源。
7. 检查自触发。
8. 检查用户拉黑。
9. 检查通知偏好。
10. 检查对象不再提醒。
11. 判断是否聚合。
12. 创建或更新通知。
13. 推送 WebSocket。
14. 标记事件为 `done`。

正常跳过标记为 `skipped`。

真正异常重试 3 次后标记为 `failed`。

## 聚合规则

只聚合低价值高频事件：

- 点赞。
- 收藏。
- 普通互动反馈。

不聚合：

- @我。
- 回复我。
- 私信。
- 协作必处理。
- 账号安全。
- 关键权限变化。

聚合方式：

同一 `recipient_id + category + event_type + source_type + source_id` 有未读通知时，更新原通知：

- `actor_count`
- `latest_actor_id`
- `latest_at`
- `meta.recent_actors`
- `read_at = NULL`

旧通知已读后，新事件创建新通知。

## 后端 API

### 通知

```http
GET /api/v1/notifications?category=like&page=1
GET /api/v1/notifications/unread-counts
PUT /api/v1/notifications/:id/read
PUT /api/v1/notifications/:category/read-all
GET /api/v1/notifications/preferences
PUT /api/v1/notifications/preferences
POST /api/v1/notifications/mutes
DELETE /api/v1/notifications/mutes/:id
```

`GET /notifications/unread-counts` 返回：

```json
{
  "total": 18,
  "items": {
    "like": 7,
    "interaction": 2,
    "mention": 1,
    "reply": 4,
    "collaboration": 3,
    "system": 1,
    "dm": 0
  }
}
```

### 私信

保留现有 API：

```http
GET /api/v1/dm/conversations
GET /api/v1/dm/conversations/:username
POST /api/v1/dm/conversations/:username
PUT /api/v1/dm/conversations/:username/read
GET /api/v1/dm/unread-count
POST /api/v1/dm/upload
```

扩展：

- 发送私信时检查 `user_blocks`。
- 会话列表返回 `is_blocked`。
- 消息页返回 `is_blocked`。

### 拉黑

```http
POST /api/v1/users/:id/block
DELETE /api/v1/users/:id/block
GET /api/v1/users/blocked
```

## WebSocket

普通通知继续使用现有 user hub 推送 `notification` 事件。

私信继续使用现有 `dm` 事件。

顶部未读数以 `GET /notifications/unread-counts` 作为初始化来源。

WebSocket 到达后，前端更新对应分类未读数。

## 迁移策略

第一阶段：

- 保留现有 `notifications` 表。
- 扩展 `notifications` 字段。
- 新增事件表、偏好表、不再提醒表、拉黑表。
- 新增 worker。
- 新事件走 `notification_events`。

第二阶段：

- 将旧论坛通知从 `internal/service/notification_service.go` 迁移到统一事件流。
- 收敛重复的通知创建逻辑。

第三阶段：

- 接入歌词/wiki 协作通知。
- 接入博客、评论、辩题、音乐其它互动通知。

## 测试策略

后端测试：

- 事件入队。
- worker 消费。
- 事件状态转换。
- 按分类未读数。
- 单条已读。
- 分类全部已读。
- 类型关闭。
- 内容不再提醒。
- 未读聚合。
- 已读后新建。
- 拉黑后普通通知跳过。
- 拉黑后私信拒收。
- 拉黑后协作必处理匿名通知。
- 陌生人仅可发一条。
- 回复后可继续私信。

前端测试：

- 顶部下拉显示各分类未读数。
- 点击下拉分类进入对应 tab。
- 通知页侧边栏显示固定分类。
- 普通通知分类显示列表和详情。
- 通知详情显示收到原因。
- 通知菜单可以触发不再提醒。
- 私信 tab 显示会话列表和聊天窗口。
- 拉黑后私信输入框禁用。
- 设置页显示通知开关。
- 设置页显示不再提醒内容。
- 设置页显示已拉黑用户。
