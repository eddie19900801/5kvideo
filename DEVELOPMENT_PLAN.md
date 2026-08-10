# 5K视频产品开发文档

> 文档版本：v1.0  
> 编制日期：2026-08-02  
> 产品域名：`5k.ag`  
> 当前基础：已有 React 移动端交互原型，正式研发将接入独立后端、数据库、对象存储与管理后台。

## 1. 建设目标

5K视频是一个由平台管理员维护内容、用户浏览和播放内容的移动端视频平台。首期建设包括三个相互独立、通过 API 协作的工程：

1. **用户前端（user-web）**：移动端视频浏览、搜索、播放、收藏、历史记录、账号和 18+ 模式；同一份构建同时支持手机网页和 Capacitor APP。
2. **管理后台（admin-web）**：管理员登录、视频上传与发布、分类标签、用户、内容审核和运营数据管理。
3. **业务后端（server）**：认证、视频、播放、收藏、历史记录、上传、转码任务和后台管理 API。

用户不能上传或发布视频。现有原型的页面布局、深色视觉、暖橙品牌色和主要交互应尽量保留。

## 2. 项目范围

### 2.1 首期必须交付

- 手机号或账号密码登录，支持游客身份和游客账号绑定。
- 首页视频流、标签筛选、关键词搜索和分页加载。
- HLS 在线播放，MP4 兜底，横竖屏自适应。
- 播放进度保存、跨设备断点续播和播放历史。
- 收藏、取消收藏、收藏列表。
- 普通/18+ 内容模式及 4 位 PIN 验证。
- 管理员上传、编辑、上下架和删除视频。
- 自动转码、封面生成、转码状态查询和失败重试。
- 标签、分类、用户和管理员管理。
- 基础数据看板和操作日志。

### 2.2 首期不包含

- 用户投稿、创作者中心、直播、弹幕和评论。
- 会员支付、广告投放和收益结算。
- 原生 iOS/Android 客户端。
- 智能推荐算法；首期采用规则排序和人工权重。

## 3. 总体技术架构

```text
用户手机浏览器                 管理员浏览器
      │                            │
  user-web                    admin-web
      └──────── HTTPS / JSON API ──┘
                       │
                 Nginx / API 网关
                       │
                  Node.js Server
                 ┌─────┼─────────┐
             PostgreSQL Redis   对象存储
                                  │
                         FFmpeg 转码 Worker
                                  │
                           HLS / MP4 / WebP
                                  │
                                 CDN
```

### 3.1 工程目录约定

```text
5kvideo/
├── user-web/          # 用户移动端，独立 package.json
├── admin-web/         # Web 管理后台，独立 package.json
├── server/            # API 与异步任务，独立 package.json
├── deploy/            # Docker、Nginx、部署配置
└── docs/              # API、数据库、部署、测试文档
```

三个业务工程禁止互相通过相对路径引用源码。公共接口类型由 OpenAPI 自动生成，避免手工复制类型造成不一致。

## 4. 技术选型

### 4.1 用户前端 user-web

| 类别 | 方案 | 说明 |
|---|---|---|
| 框架 | React 19 + TypeScript + Vite | 延续现有原型，迁移成本最低 |
| 路由 | React Router 7 | 页面路由与权限拦截 |
| 样式 | Tailwind CSS 3 | 保留现有设计系统和移动端安全区 |
| 服务端状态 | TanStack Query | API 缓存、分页、重试和失效刷新 |
| 本地状态 | Zustand | 播放器、筛选条件和临时 UI 状态 |
| 表单 | React Hook Form + Zod | 表单状态及前后端参数校验 |
| 播放器 | 原生 video + hls.js | Safari 原生 HLS，其余浏览器使用 hls.js |
| APP 容器 | Capacitor 7 | 静态资源打包进 Android/iOS，复用用户端代码 |
| API | Axios 或 fetch 封装 | Token 刷新、错误归一化和请求取消 |
| 测试 | Vitest + Testing Library + Playwright | 单元、组件与关键流程测试 |

现有 `Context` 可在迁移期保留，但用户、收藏和历史等服务端数据最终交由 TanStack Query 管理；`localStorage` 只保存匿名 ID、主题、短期播放进度缓存等非敏感信息。

### 4.2 管理后台 admin-web

| 类别 | 方案 | 说明 |
|---|---|---|
| 框架 | React 19 + TypeScript + Vite | 与用户端统一基础技术，但独立构建和部署 |
| UI | Ant Design 5 | 表格、表单、上传、弹窗和权限菜单成熟 |
| 状态/请求 | TanStack Query + Zustand | 远程数据与界面状态分离 |
| 图表 | ECharts | 播放、用户和内容趋势 |
| 表单校验 | React Hook Form + Zod | 复杂视频表单校验 |
| 测试 | Vitest + Playwright | 后台权限和发布流程回归 |

### 4.3 业务后端 server

| 类别 | 方案 | 说明 |
|---|---|---|
| 运行时 | Node.js 22 LTS + TypeScript | 与前端统一语言 |
| Web 框架 | NestJS | 模块化、依赖注入、鉴权和 OpenAPI 支持完善 |
| ORM | Prisma | 类型安全迁移和 PostgreSQL 支持 |
| 数据库 | PostgreSQL 16 | 用户、内容和业务关系数据 |
| 缓存/队列 | Redis + BullMQ | 热门数据、限流、异步转码任务 |
| 文件存储 | S3 兼容对象存储 | 原片、HLS、封面和预览图分离存储 |
| 视频处理 | FFmpeg + ffprobe | 探测、转码、切片、截图和雪碧图 |
| 接口文档 | OpenAPI / Swagger | 联调和客户端类型生成 |
| 日志 | Pino | JSON 结构化日志 |
| 监控 | Prometheus + Grafana + Sentry | 指标、告警和错误追踪 |
| 测试 | Jest + Supertest | 服务、接口和权限测试 |

## 5. 视频技术方案

### 5.1 文件与编码

- 管理后台接受 MP4、MOV 等常见源文件，源文件存入私有对象存储。
- 统一转码为 **H.264 视频 + AAC 音频**。
- 正式播放使用多码率 **HLS（`.m3u8` + 分片）**。
- 保留一份优化过的 MP4 作为兼容兜底和内部预览。
- 封面使用 WebP，必要时提供 JPEG 兜底。
- 首期输出 480p、720p、1080p；不对低分辨率源文件做无意义放大。
- HLS 分片建议 4～6 秒，关键帧间隔约 2 秒。

### 5.2 上传与转码流程

```text
后台创建视频草稿
  → API 生成分片上传凭证
  → 浏览器直传原片到对象存储
  → 后端确认上传完成
  → BullMQ 创建转码任务
  → Worker 使用 ffprobe 检测媒体
  → FFmpeg 生成多码率 HLS、MP4、封面和预览图
  → 校验产物
  → 状态更新为“待发布”
  → 管理员预览并发布
```

大文件使用对象存储 Multipart Upload，支持上传暂停和失败重传。API 服务不转发视频文件，避免占满服务器带宽和内存。

### 5.3 断点播放

断点播放分为两部分：

1. **网络断开后继续加载**：HLS 按分片请求，播放器负责重试和恢复；MP4 兜底资源必须支持 HTTP Range。
2. **再次打开继续观看**：客户端每 10 秒上报进度，并在暂停、切换、退出和页面隐藏时补充上报。

进度保存规则：

- 播放超过 10 秒才生成历史记录。
- 同一用户和视频只保留最新进度，接口采用幂等 upsert。
- 距离结尾不足 20 秒或观看超过 95% 时标记完成。
- 已完成视频默认从头播放，用户仍可从历史记录选择继续。
- 游客进度先保存在本地；绑定或登录账号后执行合并。
- 为减少写入，服务端可先写 Redis，再异步归并 PostgreSQL；暂停和退出请求直接持久化。

## 6. 功能模块

### 6.1 用户前端

- 启动页：首页、搜索建议、标签筛选、无限滚动。
- 视频播放：HLS、播放控制、倍速、全屏、上下切换、AB 循环、章节和预览图。
- 用户中心：游客、注册绑定、登录、退出、用户名和密码修改。
- 用户数据：收藏、历史记录、观看时长统计和断点续播。
- 内容模式：普通模式过滤成人内容，18+ 模式通过 PIN 解锁。

### 6.2 管理后台

- 登录与权限：管理员登录、角色、菜单权限和操作权限。
- 控制台：视频总量、播放量、活跃用户、收藏和转码任务概览。
- 视频管理：草稿、上传、转码、预览、编辑、发布、下架和软删除。
- 内容资料：标题、简介、横竖版、标签、章节、封面、成人标记和推荐权重。
- 分类标签：增删改查、排序、启用/停用和国家标签配置。
- 用户管理：用户查询、状态冻结、基础统计和安全操作。
- 任务中心：转码进度、错误原因、重试和产物检查。
- 系统管理：管理员、角色权限、配置和审计日志。

### 6.3 后端模块

```text
auth          认证、Token、密码与游客身份
users         用户资料、状态和 PIN
videos        视频元数据、上下架和详情
media         上传签名、媒体资源和播放签名
transcoding   转码队列、Worker 和状态回调
tags          分类、标签和排序
favorites     收藏关系
history       观看历史与播放进度
search        首期 PostgreSQL 搜索，预留搜索引擎接口
analytics     播放事件与后台统计
admin         管理员、RBAC 和审计日志
```

## 7. 核心数据模型

| 表 | 关键字段 | 用途 |
|---|---|---|
| users | id, account, password_hash, nickname, status | 用户账号 |
| guest_identities | id, device_id, merged_user_id | 游客身份和账号合并 |
| admins | id, account, password_hash, role_id, status | 后台管理员 |
| roles / permissions | id, code, name | RBAC 权限 |
| videos | id, title, description, duration, orientation, adult, status, weight | 视频主数据 |
| video_assets | video_id, type, resolution, url/key, bitrate, status | 原片、HLS、MP4、封面等资源 |
| tags / video_tags | id, name, type, sort / 关联键 | 标签和视频关系 |
| chapters | video_id, title, time_sec, sort | 章节时间点 |
| favorites | user_id, video_id, created_at | 收藏关系，联合唯一 |
| watch_progress | user_id, video_id, progress_sec, duration_sec, completed | 最新播放进度 |
| watch_events | user_id, video_id, event, position_sec, created_at | 播放统计事件 |
| transcode_jobs | video_id, status, progress, error, retry_count | 转码任务 |
| audit_logs | admin_id, action, target_type, target_id, detail | 管理操作审计 |

所有业务主键建议使用 UUIDv7；所有表使用 UTC 时间存储，前端按用户时区展示。删除视频采用软删除，媒体文件进入延迟清理队列。

## 8. API 设计原则

- API 前缀：`/api/v1`；后台接口位于 `/api/v1/admin`。
- 访问令牌短时有效，刷新令牌使用 HttpOnly、Secure、SameSite Cookie。
- 密码使用 Argon2id 哈希，禁止存储明文密码和明文 PIN。
- 列表统一游标分页；响应统一包含 `data`、`requestId`，错误统一包含错误码和消息。
- 收藏、进度保存、发布和上下架接口保证幂等。
- HLS 播放地址使用短期签名 URL 或 CDN 签名 Cookie。
- 上传接口使用文件类型、大小、魔数和媒体探测多层校验。

核心接口示例：

```text
POST   /api/v1/auth/guest
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
GET    /api/v1/videos
GET    /api/v1/videos/:id
GET    /api/v1/videos/:id/playback
PUT    /api/v1/videos/:id/progress
PUT    /api/v1/videos/:id/favorite
DELETE /api/v1/videos/:id/favorite
GET    /api/v1/me/history
GET    /api/v1/me/favorites

POST   /api/v1/admin/uploads
POST   /api/v1/admin/videos
PATCH  /api/v1/admin/videos/:id
POST   /api/v1/admin/videos/:id/publish
POST   /api/v1/admin/videos/:id/transcode/retry
```

## 9. 安全与合规基线

- 全站 HTTPS，生产环境启用 HSTS、CSP、安全响应头和严格 CORS 白名单。
- 登录、验证码、播放地址、搜索和进度接口实施分级限流。
- 管理后台建议启用 TOTP 双因素认证和登录 IP/设备审计。
- 成人内容必须默认隐藏，并配置年龄确认、内容标识和地区合规策略。
- 18+ PIN 不能以明文存入 `localStorage`；登录用户服务端保存哈希，游客端使用 Web Crypto 加密或只保留短期会话。
- 对象存储 Bucket 默认私有，禁止目录列表，源片不对公网暴露。
- 审计管理员的发布、下架、删除、冻结和权限变更操作。
- 日志中禁止记录密码、Token、Cookie、签名 URL 和个人敏感数据。
- 上线前根据实际运营地区完成隐私政策、用户协议、版权投诉和内容治理流程。

## 10. 研发阶段

以下按 2 周一个迭代规划；若人员较少，可保持顺序并延长周期。

### 阶段 0：需求冻结与工程准备（第 1 周）

- 确认首期范围、页面清单、后台字段和验收标准。
- 将现有原型标记为 UI 基线，整理颜色、字体、间距和组件规范。
- 建立 `user-web`、`admin-web`、`server`、`deploy`、`docs` 独立目录。
- 配置代码规范、环境变量模板、CI、分支策略和提交规范。
- 输出数据库 ER 图、OpenAPI 草案和部署拓扑。

**退出标准**：范围无阻塞项；三个工程可独立启动；CI 能完成检查和空项目构建。

### 阶段 1：后端基础与账号体系（第 2～3 周）

- 搭建 NestJS、Prisma、PostgreSQL、Redis 和 Swagger。
- 完成用户、游客、管理员、角色权限和 Token 刷新机制。
- 实现视频、标签、章节基础表及后台 CRUD API。
- 完成统一异常、日志、限流、审计和数据库迁移流程。

**退出标准**：认证和 RBAC 自动化测试通过；Swagger 可供前端联调；权限越权测试通过。

### 阶段 2：媒体上传与转码（第 4～5 周）

- 对接对象存储分片直传和上传确认。
- 建立 BullMQ 转码队列与独立 Worker。
- 生成多码率 HLS、MP4 兜底、封面和预览图。
- 完成转码状态、失败重试、幂等、超时和垃圾文件清理。
- 接入 CDN 和签名播放地址。

**退出标准**：短、中、长及横竖版样本均可成功处理；断点上传、失败重试和 HLS 播放验证通过。

### 阶段 3：管理后台（第 6～7 周）

- 完成后台登录、框架布局、菜单和权限控制。
- 完成视频上传、编辑、转码进度、预览、发布和下架。
- 完成标签分类、章节、用户、管理员和审计日志页面。
- 完成基础统计看板。

**退出标准**：管理员可从上传原片完整走通至用户端可播放；不同角色只能访问授权功能。

### 阶段 4：用户前端真实数据接入（第 8～9 周）

- 从现有原型迁移为真实 API，移除 Mock 用户和 Mock 视频依赖。
- 接入视频列表、搜索、标签、详情、收藏和历史记录。
- 使用 hls.js 重构播放器，保留现有主要播放交互。
- 完成匿名身份、登录绑定、18+ 模式和异常/空状态。

**退出标准**：核心页面适配主流手机浏览器；真实视频列表、播放、收藏和登录链路通过。

### 阶段 5：断点续播、统计与体验优化（第 10 周）

- 完成进度定时上报、本地兜底、服务端 upsert 和跨设备恢复。
- 完成游客数据合并及播放完成规则。
- 接入播放事件和运营看板统计。
- 优化首屏、图片、HLS 起播、预加载、缓存和弱网重试。

**退出标准**：刷新、退出、断网恢复、换设备四种场景可续播；统计口径经产品验收。

### 阶段 6：测试、安全与上线（第 11～12 周）

- 执行功能、兼容、性能、弱网、安全、备份恢复和容量测试。
- 完成依赖漏洞扫描、越权检查、上传攻击检查和敏感信息检查。
- 建立灰度、回滚、监控、告警、值班和事故处理流程。
- 生产初始化、CDN 缓存验证、域名和证书配置。

**退出标准**：P0/P1 缺陷清零；回滚演练成功；监控告警有效；上线检查表签字完成。

## 11. 测试与验收指标

### 11.1 功能测试

- 用户：首页、搜索、筛选、播放、收藏、历史、登录、绑定和 PIN。
- 后台：上传、转码、预览、发布、下架、权限和审计。
- 视频：横版、竖版、不同时长、不同码率、无音轨和异常文件。
- 续播：刷新、关闭页面、切换视频、断网、Token 过期和跨设备。

### 11.2 首期性能目标

- API 常规读接口 P95 小于 300ms（不含媒体下载）。
- 首页首屏在良好 4G 环境下 LCP 目标小于 2.5 秒。
- 已缓存播放器起播目标小于 1.5 秒，未缓存目标小于 3 秒。
- 核心 API 月可用性目标不低于 99.9%。
- 进度保存接口需要容忍重复、乱序和短时离线。

具体容量指标需在明确日活、峰值并发、日上传量和平均视频大小后补充压测模型。

## 12. CI/CD 与环境

环境分为 `local`、`test`、`staging`、`production`。每个工程独立构建镜像和发布：

```text
提交代码
 → lint / type-check / unit test
 → build
 → dependency & image scan
 → 推送镜像
 → 部署 test/staging
 → E2E 与冒烟测试
 → 人工批准
 → 生产灰度
 → 健康检查
 → 全量或自动回滚
```

- 数据库变更只允许通过版本化 migration。
- 密钥存放在部署平台 Secret，不提交到 Git。
- 前后端配置均提供 `.env.example`，但不包含真实凭据。
- 媒体文件不进入 Git、应用镜像或数据库备份。

## 13. 交付物

- `user-web` 用户端完整源码及 README。
- `admin-web` 管理后台完整源码及 README。
- `server` API 与转码 Worker 完整源码及 README。
- OpenAPI 接口文档和前端生成类型。
- 数据库模型、迁移、初始化脚本和 ER 图。
- Docker、Nginx、环境变量和部署说明。
- 测试用例、测试报告、上线检查表和回滚手册。
- 运维监控、告警、备份与恢复说明。

## 14. 开发前待确认事项

以下信息不影响工程骨架搭建，但必须在相关阶段开始前确定：

1. 首发地区、成人内容的法律与年龄验证要求。
2. 预计日活、峰值同时在线、日上传量、单文件上限和最长视频时长。
3. 对象存储及 CDN 厂商、部署地区和预算。
4. 是否开放用户自主注册，还是仅保留游客绑定和管理员创建账号。
5. 视频删除后的保留周期、版权投诉和内容审核流程。
6. 后台角色划分以及是否强制双因素认证。
7. 推荐排序规则、播放量口径和统计数据保留周期。

---

本文件是研发基线。需求、数据模型或接口发生变化时，应同步更新文档版本、变更原因及受影响的验收标准。
