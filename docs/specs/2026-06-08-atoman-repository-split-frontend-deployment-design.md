# Atoman 仓库拆分：前端部署模型设计

## 一、目标

为 Atoman 一次性拆分为三个并列独立 Git 仓库后的前端部署模型定案，解决 `atoman-backend` 不再拥有 `web/` 目录后，生产部署如何获得并运行前端的问题。

最终拆分后的仓库只有：

1. `atoman-frontend`
2. `atoman-backend`
3. `atoman-ios`

不保留总仓，不新增 infra / deploy / coordination 第四仓。

## 二、已确认的仓库边界

### 2.1 仓库命名

采用“产品名 + 角色”命名：

- `atoman-frontend`
- `atoman-backend`
- `atoman-ios`

### 2.2 主要目录迁移

- `web/` -> `atoman-frontend`
- `server/` -> `atoman-backend`
- `ios/` -> `atoman-ios`
- `nginx/` -> `atoman-backend`
- `docker-compose.dev.yml` / `docker-compose.prod.yml` -> `atoman-backend`
- `docs/` 按职责拆分，系统级和 API 契约文档归 `atoman-backend`
- `.github/workflows/` 拆到各仓
- `README.md` 拆成各仓 README
- `Folo-dev/` 不进入最终三仓工作区

### 2.3 权威归属

- API 契约唯一权威在 `atoman-backend`
- 部署 / infra 在 `atoman-backend`
- `ios/` 已经按 standalone Git repository 方向组织，最终独立为 `atoman-ios`

## 三、当前生产链路与拆分断点

当前真实请求链路是：

```text
浏览器 -> Nginx -> 前端静态文件 或 /api /ws 反代 -> Go backend -> GORM -> PostgreSQL
```

因此 Nginx 是系统入口和 edge gateway，更适合归属 `atoman-backend`，而不是 `atoman-frontend`。

当前生产 Compose 的断点是：

```yaml
nginx:
  build:
    context: ./web
    dockerfile: Dockerfile
```

拆仓后 `atoman-backend` 不再拥有本地 `./web`，不能继续在部署仓内直接构建前端镜像。

## 四、备选方案

### 4.1 方案 A：`atoman-frontend` 自己产出镜像，`atoman-backend` 部署时引用镜像

`atoman-frontend` 负责：

1. 持有 Vue 源码
2. 运行前端测试、类型检查和构建
3. 构建前端 runtime 镜像
4. 发布镜像到 registry

镜像引用不在规格中硬编码 registry owner，由部署变量统一提供：

```text
${ATOMAN_FRONTEND_IMAGE}:${ATOMAN_FRONTEND_VERSION}
```

`atoman-backend` 负责：

1. 持有生产 `docker-compose.prod.yml`
2. 持有 edge gateway Nginx 配置
3. 引用已发布的 frontend 镜像
4. 编排 frontend、backend、PostgreSQL、Redis、初始化任务等服务

生产 Compose 中不再从本地 `./web` build，而是引用镜像：

```yaml
frontend:
  image: ${ATOMAN_FRONTEND_IMAGE}:${ATOMAN_FRONTEND_VERSION}
  expose:
    - "80"
```

edge gateway 继续由 `atoman-backend` 管理：

```yaml
gateway:
  image: nginx:stable-alpine
  volumes:
    - ./nginx/conf.d:/etc/nginx/conf.d:ro
    - ./nginx/ssl:/etc/nginx/ssl:ro
  ports:
    - "80:80"
    - "443:443"
  depends_on:
    backend:
      condition: service_healthy
    frontend:
      condition: service_started
```

Nginx gateway 的职责是：

1. TLS
2. Cloudflare / real IP
3. `/api/` 反代到 Go backend
4. `/ws` 和 `/api/collab/ws/` 反代到 Go backend
5. `/` 和静态资源转发到 frontend runtime 容器

示例：

```nginx
location / {
    proxy_pass http://frontend:80;
}
```

### 4.2 方案 B：`atoman-frontend` 只产出静态构建物，由 `atoman-backend` / gateway 再封装

`atoman-frontend` 负责：

1. 构建 `dist/`
2. 发布 `dist.tar.gz` 或 CI artifact

`atoman-backend` 负责：

1. 在构建或部署 gateway 时下载 artifact
2. 将静态文件封装进 gateway Nginx 镜像
3. 运行最终 gateway 镜像

该方案避免运行时出现 frontend runtime 容器，但会让 backend 发布流程重新依赖 frontend artifact。

## 五、方案比较

### 5.1 方案 A 优点

1. 仓库职责最清晰：frontend 对自己的 runtime 镜像负责，backend 对部署编排负责。
2. 符合拆仓后的物理边界：backend 不需要读取 frontend 源码或 artifact 细节。
3. 自托管体验更好：用户只需要拉镜像并运行 Compose，不需要本地安装 Bun 或 clone 三个仓。
4. 发布可追踪：Compose 可以通过 `ATOMAN_FRONTEND_VERSION` 明确锁定前端版本。
5. 回滚简单：回滚镜像 tag 即可。
6. 生产机更干净：不需要前端构建依赖和源码。
7. 适合官方镜像、自建 registry、离线镜像包等自托管分发方式。

### 5.2 方案 A 缺点

1. `atoman-frontend` 需要维护镜像发布 CI。
2. `atoman-backend` 需要管理 frontend / backend 版本兼容关系。
3. frontend runtime 镜像可能也使用 Nginx，会与 backend gateway Nginx 形成两层 Nginx。

两层 Nginx 的边界应明确：

- backend gateway Nginx 是系统 edge，负责 TLS、真实 IP、API / WS 路由和部署级策略。
- frontend 镜像内的 Nginx 只是静态文件 runtime，负责服务 SPA 文件和 fallback。

### 5.3 方案 B 优点

1. 运行时拓扑更简单，最终可只有一个 gateway Nginx 直接持有静态文件。
2. 所有 edge 配置集中在 `atoman-backend`。
3. 避免 frontend runtime 容器和 gateway 之间的内部 HTTP 转发。

### 5.4 方案 B 缺点

1. backend 发布流程会重新耦合 frontend 产物，只是从源码耦合变成 artifact 耦合。
2. 跨仓 artifact 下载、权限、缓存、版本匹配会增加部署脆弱性。
3. 自托管用户需要理解 artifact 获取或依赖 backend 构建流程封装，不如镜像直观。
4. backend 仓会承担“封装前端发布物”的协调角色，接近被否定的第四仓职责。
5. 离线部署和私有镜像源场景不如直接拉镜像自然。

## 六、自托管产品判断

Atoman 是自托管发布与讨论平台，部署入口应优先满足：

1. 用户不需要本地构建前端。
2. 用户不需要同时 clone 三个仓。
3. Compose 文件可以声明完整运行系统。
4. 版本可以锁定、回滚、镜像化和离线分发。
5. 官方发布和用户自定义构建可以复用同一模型。

按这些标准，镜像比静态 artifact 更适合作为前端交付边界。

artifact 更适合内部 SaaS 流水线；镜像更适合自托管产品分发。

## 七、最终决策

采用方案 A 作为标准生产模型：

> `atoman-frontend` 自己产出可运行前端镜像，`atoman-backend` 的部署编排直接引用该镜像。

最终职责边界：

### 7.1 `atoman-frontend`

负责：

1. Vue 源码
2. 前端构建、类型检查、lint、测试
3. 前端 Dockerfile
4. 前端 runtime 镜像发布
5. 前端 README

不负责：

1. TLS
2. Cloudflare real IP
3. API / WebSocket gateway 路由
4. 数据库、Redis、后端服务编排
5. 系统级部署文档的唯一权威

### 7.2 `atoman-backend`

负责：

1. Go backend 源码
2. API 契约唯一权威
3. 数据库迁移和初始化任务
4. 部署 Compose
5. Nginx edge gateway
6. 系统级部署文档
7. 引用 frontend 镜像版本

不负责：

1. 构建 frontend 源码
2. 下载 frontend artifact 再封装
3. 持有 frontend 源码副本

### 7.3 `atoman-ios`

负责：

1. iOS app 源码
2. iOS 构建、测试、发布说明
3. 消费 `atoman-backend` 提供的 API 契约

## 八、版本与配置建议

`atoman-backend` 的部署环境变量应显式声明 frontend 镜像：

```env
ATOMAN_FRONTEND_IMAGE=example-registry/atoman-frontend
ATOMAN_FRONTEND_VERSION=1.0.0
ATOMAN_BACKEND_VERSION=1.0.0
```

Compose 使用这些变量引用镜像：

```yaml
frontend:
  image: ${ATOMAN_FRONTEND_IMAGE}:${ATOMAN_FRONTEND_VERSION}
  expose:
    - "80"
```

版本兼容关系由 `atoman-backend` 的 API 契约和 release notes 表达。当前阶段不引入独立 compatibility matrix 文件，避免新增协调文档。

## 九、迁移后的生产拓扑

推荐生产拓扑：

```text
浏览器
  ↓
backend 仓管理的 Nginx gateway
  ├─ /api/* -> backend:8080
  ├─ /ws* -> backend:8080
  ├─ /api/collab/ws/* -> backend:8080
  └─ /* -> frontend:80
        ↓
     frontend runtime 镜像内的静态文件服务
```

这个拓扑保留 backend 仓对系统入口的控制，同时让 frontend 仓独立交付自己的运行产物。

## 十、明确不采用

本次明确不采用：

1. 不在拆仓后保留总仓。
2. 不新增 infra / deploy / coordination 第四仓。
3. 不让 `atoman-backend` 从本地 `web/` 构建前端。
4. 不让 `atoman-backend` 下载 frontend artifact 再封装为官方默认路径。
5. 不把 Nginx edge gateway 归入 `atoman-frontend`。

## 十一、后续实施方向

实施拆仓时应按以下方向落地：

1. 将 `web/Dockerfile` 随 `web/` 迁入 `atoman-frontend`，作为 frontend runtime 镜像构建入口。
2. 在 `atoman-frontend` 配置镜像发布流程。
3. 将 `docker-compose.prod.yml` 迁入 `atoman-backend` 后，把原 `nginx build: ./web` 改为独立 `gateway` + `frontend image` 服务。
4. 保留并调整 `nginx/conf.d/default.conf`，使 `/` 代理到 `frontend:80`，API 和 WebSocket 继续代理到 `backend:8080`。
5. 在 `atoman-backend` README 中说明自托管用户只需要拉取 backend compose 引用的官方镜像。
6. 在 `atoman-frontend` README 中说明如何构建和发布自定义 frontend 镜像，并通过 `ATOMAN_FRONTEND_IMAGE` / `ATOMAN_FRONTEND_VERSION` 接入 backend 部署。
