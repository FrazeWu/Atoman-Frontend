# Frontend Testing Rules

## 断言优先级

能用行为 / 渲染断言验证的，不要用源码字符串断言。

- 行为 / 渲染断言（首选）：`mount` 后查询 DOM、类名、属性、事件与 `emit`，验证组件对外可见的行为。
- 源码守卫断言（受限使用）：用 `readFileSync` 读取组件或配置文件源码后做字符串 / 正则断言。仅在 happy-dom 无法覆盖的场合使用：
  - CSS 布局、级联、响应式规则与设计 token 取值（happy-dom 不参与布局计算）
  - 懒加载 / 代码分割边界（`import()` 与静态 `import` 的取舍）
  - 模块分层与导入方向（`*-layering`、`*.contract`）
  - 构建与部署配置（`vite.config.ts`、`wrangler` 配置等）

## 源码守卫断言只允许断言稳定契约

允许：设计 token / CSS 变量、本仓库公开的类名契约、导入边界、路由 / 配置结构。

禁止：断言第三方库的内部实现，例如图标库的导入说明符或渲染类名（`IconStarFilled as StarFilled`、`lucide-*` 之类）。依赖升级会直接破坏这类断言。

出现上述反例时，优先改为行为断言；确实无法行为化时，改为断言本仓库自身的稳定契约（组件公开 props、公开 class、可访问名称等），而不是依赖库的内部命名。

## 参考

- 现存的意图性守卫文件：`tests/unit/system/*-layering.spec.ts`、`tests/unit/system/runtime-loading.contract.spec.ts`、`tests/unit/ui/ui-guidelines.spec.ts`、`tests/unit/config/*.spec.ts`
