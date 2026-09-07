# Frontend Design and UI Rules

## General UI

- UI implementations must follow the design guidelines in this file.
- Date input components must enforce a strict sequential YYYY/MM/DD input layout.

## Desktop Content Layout

桌面端页面固定为两个外层区域：左侧边栏和右侧内容区。内容区再由内层内容容器承载主内容区与推荐/附加内容区。

- 桌面侧边栏宽度为 `12rem`，折叠桌面宽度为 `4.5rem`；推荐区不参与侧边栏宽度计算。
- 外层内容区必须填满侧边栏右侧的剩余空间；最大宽度、内边距和居中只属于 `.a-content-frame` 内层容器。
- 双栏布局使用共享 token：主内容区占剩余空间，推荐区使用 `var(--a-recommendation-width)`（标准值 `20rem`），列间距使用 `var(--a-content-column-gap)`（标准值 `2rem`）。目标视觉比例约为主内容 `70%`、推荐区 `30%`。评论/讨论 Sheet 使用 `var(--a-comment-sheet-width)`（标准值 `42rem`），不改变推荐区本身的宽度。
- 主内容区在可用宽度不足以保持约 `36rem` 的阅读宽度时，推荐区改为单栏内容，不压缩主内容。
- 页面不得自行引入第三种推荐栏宽度；紧凑导航也使用共享推荐区 token。

## Desktop Sheet Scope

桌面端右侧 `PSheet` 只有两种宽度契约：

1. `full`：从可见侧边栏右侧开始，覆盖整个外层内容区，到窗口右边结束。
2. `partial`：只覆盖推荐/附加内容区；普通推荐内容使用 `var(--a-recommendation-width)`，评论/讨论内容使用 `var(--a-comment-sheet-width)`，或由实际锚点计算。两者都必须使用共享 token，组件不得自行写死宽度。

`partial` 不得使用组件级 `42rem` 等自定义面板宽度冒充推荐区。完整编辑、详情和创建流程使用 `full`；评论、相关推荐和附加信息使用 `partial`。Sheet 通过 Teleport 渲染时，边界仍以外层内容区为准，不能受内层最大宽度影响。

- 桌面右侧 Sheet 的左侧 rail 空白区和内容区外侧空白 padding 都是关闭区；点击只关闭最上层一层。点击正文、表单控件、导航按钮或下层 Sheet 不关闭当前层。

## Sheet and Drawer Design

- All sheets and drawers (`PSheet.vue`) must use a solid white background:
  ```css
  background: #ffffff;
  ```
- Do not use backdrop blur or semi-transparent background color-mixing for sheets and drawers.

## Overlay Layering and Route Rules

This section is the contract for all frontend sheets, drawers, modals, confirms, and route-driven overlays.

### Layer Tokens

Use the tokens in `src/style.css`; do not invent feature-specific z-index values for overlays.

From low to high:

- Dropdown: `40`
- Popover: `45`
- Navigation: `100`
- Normal sheet backdrop: `300`
- Normal sheet panel: `310`
- Global overlay: `480`
- Normal modal backdrop: `500`
- Normal modal panel: `510`
- Player lyrics: `700`
- Player queue: `710`
- Player: `720`
- Above-player sheet backdrop: `730`
- Above-player sheet panel: `740`
- Above-player modal backdrop: `750`
- Above-player modal panel: `760`
- Lightbox: `800`
- Toast: `900`
- Global menu and search: `950`

A local z-index is allowed only for controls inside an already-owned component stacking context. It must not create a second page-level overlay system.

### Component Contracts

- Use `PSheet` for sheets and drawers, `PModal` for modal dialogs, and `PConfirm` for confirmations.
- Do not implement page-level overlays with ad hoc fixed elements, custom teleport targets, or custom z-index tokens.
- A normal overlay must not cover the player.
- `above-player` is an explicit exception. Add it only when the overlay must remain usable above the player, and keep the decision visible at the call site.
- A teleported `PModal` or `PConfirm` inside an `above-player` Sheet must also receive `above-player`; Vue nesting does not inherit page-level z-index across the Teleport boundary. Reusable child components should expose this as an explicit prop.
- `PSheet` and drawers use a solid background. Do not add backdrop blur, translucent panel backgrounds, or color-mixing backgrounds to the panel.
- A sheet backdrop is a pointer-capture layer. It may be visually transparent, but it still blocks interaction outside the active sheet.
- Only the top sheet may own the active backdrop and close on `Esc`. Lower sheet layers remain mounted, are inert, and can be activated through the sheet rail.

### Sidebar and Teleport Rules

- A right sheet and its backdrop must begin to the right of the visible desktop sidebar. They must not visually cover or intercept sidebar controls.
- A bottom sheet on mobile may use the full viewport because the mobile sidebar is hidden or collapsed.
- `PSheet` is teleported to `body` by default. CSS variables declared only inside a layout element do not cross that teleport boundary.
- Any teleported overlay that depends on sidebar width must receive that width through a root-level variable, a global route/layout state, or an explicit component contract. Never assume a scoped `.layout` variable is inherited by the teleported sheet.
- Verify both visual bounds and pointer behavior. A transparent backdrop can still make a sidebar appear usable while preventing clicks.

### Route-Driven Overlays

- A route-driven overlay is represented by the URL and rendered through a named `RouterView` such as `name="overlay"`.
- The base route and the overlay route must share the same stable parent route.
- The default/base component reference must be shared when the overlay route also renders the base view. Navigating to an editor must not remount or replace the page underneath.
- Closing a route overlay must follow the existing router history contract. Do not add a second local visibility state that can diverge from the URL.
- Refreshing an overlay URL must restore the overlay. This is expected route restoration, not an animation bug.

### Studio Rules

- Studio is a base workspace, not an overlay around the whole application.
- Keep the Studio header, shared `AppSidebar`, and `.a-main-content` in the base layer.
- Blog, podcast, and video create/edit routes render their base content through the default view and their editor through the named `overlay` view.
- Desktop Studio editors use a right sheet. Mobile Studio editors use a bottom sheet.
- `StudioRouteSheet` must use the standard `PSheet` contract. Do not add Studio-only z-index rules, disable teleport/backdrop behavior, or force `position: relative` to bypass the overlay system.
- The current Studio editor explicitly uses `above-player`; do not change that player relationship without a product decision.
- Studio's teleported sheet must still receive the correct desktop sidebar boundary. The `.studio-layout` scoped variable alone is insufficient.

## Verification Checklist

When adding or changing an overlay:

1. Confirm the component is `PSheet`, `PModal`, or `PConfirm`.
2. Confirm whether it is normal or explicitly `above-player`.
3. Confirm the panel background is solid and has no backdrop blur.
4. Confirm the backdrop and panel use the shared tokens.
5. Confirm the overlay does not intercept the sidebar unexpectedly.
6. For route overlays, confirm the base parent and base component remain stable.
7. Add or update a contract test for layer order, route reuse, stack behavior, or sidebar bounds as appropriate.
8. Run `bun run type-check`, the focused overlay/module tests, and `git diff --check`.
