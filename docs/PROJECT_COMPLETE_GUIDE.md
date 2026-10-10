# 5K 视频与导航平台完整项目说明

> 更新日期：2026-10-01  
> 本文是整个 5K 项目的总入口。源码、功能、线上地址、服务器部署、数据位置和专项文档都从这里查找。文中不保存账号、密码、API Token 或私钥。

## 1. 项目范围

当前系统不是单一代码库，而是由五个相互协作的项目组成：

| 子项目 | 本地源码目录 | 主要职责 |
| --- | --- | --- |
| 视频核心服务 | `E:\5kvideo\5KVIDEO` | 视频 API、采集目录、播放鉴权、后台、上传 Worker、旧版用户端 |
| 视频 H5 前端 | `E:\5kvideo\5knews` | 当前移动端首页、搜索、分类、播放页、推荐、收藏和性能采集 |
| 导航平台 | `E:\5kvideo\DAOHANG` | 文字导航前端、导航后台、导航 API、静态发布数据 |
| 广告平台 | `E:\5kvideo\5k-ad-platform` | Banner、弹窗、图标广告、投放、跳转、事件统计和统一管理后台 |
| 电视端 | `E:\5kvideo\5ktv` | Android TV APK 壳、遥控器交互和电视端下载包 |

参考设计项目保留在：

- 视频 H5 参考稿：`E:\5kvideo\5knews\project-13251168`
- 导航参考稿：`E:\5kvideo\DAOHANG\project-14274370`

## 2. 当前线上地址

### 2.1 用户端

| 功能 | 地址 | 部署位置 |
| --- | --- | --- |
| 视频 H5 | <https://5knews.wflhc.cn/> | 前端静态文件仍在原 Web 服务器 |
| 文字导航 | <https://daohang.wflhc.cn/> | 前端静态文件仍在原 Web 服务器 |
| 永久域名文案 | `5k.ag` | 页面品牌和入口用途 |

### 2.2 管理端

| 功能 | 地址 |
| --- | --- |
| 视频管理后台 | <https://897kg.cc/vdo/admin/> |
| 导航管理入口 | <https://897kg.cc/dhang/admin/> |
| 广告统一后台 | <https://897kg.cc/ads/admin> |
| 新闻/统计后台 | <https://897kg.cc/ne/admin/> |

`/dhang/admin/` 当前会跳转至广告统一后台的导航模块，这是现行设计，不是故障。

## 3. 当前生产架构

### 3.1 服务器分工

| 角色 | 地址 | SSH 端口 | 职责 |
| --- | --- | --- | --- |
| Web 前端服务器 | `156.224.147.194` | `11870` | 只保留视频 H5、导航静态页、APK 下载页及到中台的反向代理 |
| 130 中台服务器 | `154.91.16.130` | `43771` | 所有后台、API、数据库、Redis、视频采集与播放服务 |
| 中台业务副 IP | `154.91.19.108` | 80/443 | `897kg.cc` 的公网入口 |

### 3.2 请求关系

```text
用户
 ├─ daohang.wflhc.cn ──> 156.224.147.194 静态导航页
 │                         └─ /api、/ads/api、/site-data ──> 154.91.19.108
 ├─ 5knews.wflhc.cn ───> 156.224.147.194 视频 H5
 │                         └─ /vdo-api、/api、/ads/api ───> 154.91.19.108
 └─ 897kg.cc ──────────> 154.91.19.108 / 130 中台
                           ├─ 视频 API 4010
                           ├─ 导航 API 4020
                           ├─ 广告 API 4100
                           └─ 新闻/统计 API 4310
```

130 使用 Apache 对外提供 80/443，内部 API 端口只绑定 `127.0.0.1`，不直接暴露公网。

## 4. 130 中台运行服务

| 容器 | 本机端口 | 功能 | 数据来源 |
| --- | --- | --- | --- |
| `5kvideo-api` | `127.0.0.1:4010` | 视频、采集视频、播放、游客、收藏、分析 | JSON 数据与媒体目录 |
| `5k-navigation-api` | `127.0.0.1:4020` | 导航配置、发布、链接与行为统计 | `/opt/5k-middle-platform/navigation` |
| `5k-ad-platform` | `127.0.0.1:4100` | 广告管理、素材、投放与跳转统计 | PostgreSQL、Redis、导航素材目录 |
| `5knews-api` | `127.0.0.1:4310` | H5 用户、访问、搜索、播放和性能统计 | PostgreSQL、上传目录 |
| `5k-ad-postgres` | 容器网络 5432 | 广告与 H5 业务数据 | Docker Volume |
| `5k-ad-redis` | 容器网络 6379 | 缓存、会话及短期状态 | `/opt/5k-middle-platform/redis-data` |

所有业务容器使用 `restart=unless-stopped`。PostgreSQL 16 在 130 的 CentOS 7 旧内核上需要 `seccomp=unconfined` 兼容参数，否则初始化时会出现 `Operation not permitted`。

### 4.1 中台目录

```text
/opt/5k-middle-platform/
├─ admin/              # 视频、导航、广告、新闻后台静态文件
├─ edge/               # 897kg.cc 证书、APK 和边缘静态文件
├─ navigation/         # 导航 db.json、加密资源和 published-site
├─ news-uploads/       # H5 后台上传文件
├─ redis-data/         # Redis 持久化数据
├─ seed-backup/        # 迁移基线备份
├─ final/              # 最终一致性迁移包及恢复日志
└─ pre-final-snapshot/ # 最终切换前快照
```

视频核心服务仍使用：

```text
/root/5kvideo-release/server/data
```

## 5. 视频核心源码

根目录：`E:\5kvideo\5KVIDEO`

```text
5KVIDEO/
├─ server/         # Node.js + TypeScript 视频 API
├─ admin-web/      # 视频管理后台 React/Vite
├─ user-web/       # 早期视频用户端，当前生产 H5 以 5knews 为准
├─ upload-worker/  # 上传、分片、HLS、R2 相关 Worker
├─ deploy/         # Apache、Nginx、迁移与发布脚本
├─ scripts/        # 运维、迁移和数据处理脚本
├─ docs/           # 技术文档
└─ downloads/      # APK/客户端下载产物
```

### 5.1 视频后端主要模块

| 路径 | 职责 |
| --- | --- |
| `server/src/index.ts` | API 入口、路由装配、任务初始化 |
| `server/src/auth.ts` | 管理员、用户与 Token 认证 |
| `server/src/media.ts` | 媒体文件与流媒体处理 |
| `server/src/middleware/playbackAccess.ts` | 播放 Token、视频、会话和模式校验 |
| `server/src/middleware/rateLimit.ts` | 登录、签发、上传等接口限流 |
| `server/src/routes/collectedVideos.ts` | 采集视频列表、详情、搜索、专题 |
| `server/src/routes/analytics.ts` | PV、UV、播放、性能和错误事件 |
| `server/src/routes/adminCollectors.ts` | 采集源与采集任务管理 |
| `server/src/services/collectorCatalogSync.ts` | 外部资源站目录同步 |
| `server/src/services/collectorPreviewGenerator.ts` | 远程视频截图与预览队列 |
| `server/src/services/collectorTaxonomy.ts` | 分类、标签与专题整理 |
| `server/src/services/playback.ts` | 播放地址、时长裁剪与播放签名 |
| `server/src/services/highlightGenerator.ts` | 视频片段截图和快速跳转数据 |
| `server/src/services/encryptedCover.ts` | 封面加密/解密 |

### 5.2 视频功能

- 自有视频上传、媒体任务和 HLS 播放。
- 采集资源站 XML/JSON 目录，不要求将远程视频上传到 R2。
- 采集视频分类、搜索、详情、播放状态和定时更新。
- 播放时默认跳过开头 30 秒，并在结尾提前 30 秒结束。
- 视频片段截图、播放页截图滑动和点击定位。
- 游客身份自动创建、收藏、历史记录和推荐偏好。
- 搜索词、热搜次数、分类筛选和搜索历史。
- 播放量展示、推荐随机化和无限加载。
- 播放地址签名绑定用户/匿名会话、视频、有效期和内容模式。
- 播放签发限频、CORS 域名限制和播放错误明细。
- 后台采集视频管理、原生视频管理、数据概览、视频分析、性能分析。

### 5.3 视频后端开发命令

```powershell
cd E:\5kvideo\5KVIDEO\server
npm install
npm run dev
npm run build
npm test
```

## 6. 当前视频 H5 前端

根目录：`E:\5kvideo\5knews`

```text
5knews/
├─ src/pages/home/       # 首页、分类、搜索、瀑布流
├─ src/pages/video/      # 播放页、播放器、截图跳转
├─ src/pages/profile/    # 个人中心
├─ src/components/       # 下载浮窗、反馈、收藏分组等
├─ src/services/         # API、缓存、推荐、统计、性能
├─ public/               # 静态资源
├─ app-download/         # APK 下载落地页资源
├─ deploy/               # 前端发布配置
└─ project-13251168/     # 原始参考设计
```

主要功能包括：

- 首页推荐、分类折叠、瀑布流和骨架屏。
- 搜索、所有分类、热搜及本地最近搜索。
- 每用户随机推荐，返回列表时保持原顺序，仅“换一批”刷新。
- 播放页、自定义播放器、播放截图、相关推荐无限下拉。
- 收藏、分享复制链接、播放历史、个人中心。
- 游客账号与设备标识。
- APP 下载浮窗、PC 二维码落地页和 Android 直接下载。
- 广告 Banner、图标广告、首页弹窗和播放页广告。
- 页面性能、图片加载、接口耗时、播放错误和行为事件上报。
- 同源 API 路由，避免把旧域名硬编码到前端。

开发命令：

```powershell
cd E:\5kvideo\5knews
npm install
npm run dev
npm run build
npm test
```

## 7. 导航平台源码

根目录：`E:\5kvideo\DAOHANG`

```text
DAOHANG/
├─ apps/web/       # 当前文字导航前端
├─ apps/admin/     # 导航管理后台
├─ apps/api/       # 导航 API
├─ packages/       # 共享类型与组件
├─ deploy/         # 发布、源站和 CDN 配置
├─ docs/           # 导航架构文档
└─ project-14274370/ # 参考设计
```

主要功能包括：

- 纯文字站点网格，不加载站点图片。
- 分类切换、紧凑布局、商务联系入口。
- 后台维护分类、站点、排序、广告关系与发布状态。
- 发布静态 `published-site` 数据，前端优先读取静态内容。
- 加密素材、访问、链接曝光、点击和性能事件。
- 可作为 iframe 嵌入其他站点；跨域上级域名和搜索词受浏览器同源及 Referrer Policy 限制。

开发命令：

```powershell
cd E:\5kvideo\DAOHANG
npm install
npm run dev
npm run build
npm run type-check
```

## 8. 广告平台源码

根目录：`E:\5kvideo\5k-ad-platform`

```text
5k-ad-platform/
├─ apps/api/       # Express 广告 API
├─ apps/admin/     # React 管理后台
├─ packages/models # 数据模型
├─ packages/sdk/   # 前端接入 SDK
├─ db/             # 数据库迁移与种子数据
├─ deploy/         # Docker/发布配置
└─ docs/           # 开发说明
```

主要功能包括：

- 广告产品、广告位、素材库和素材分类。
- Banner、弹窗、图标、导航站推荐等展示模式。
- 广告跳转签名、展示/点击事件、渠道与页面统计。
- 每日产品数据、成本、收入和收益分析。
- 导航管理模块统一嵌入广告后台。
- PostgreSQL 持久化、Redis 缓存。

## 9. 电视端源码

根目录：`E:\5kvideo\5ktv`

- Android/Kotlin/Gradle 工程。
- 面向电视遥控器和横屏布局。
- APK 发布产物位于 `releases` 和 `deploy-download`。
- PC 可通过下载落地页扫码，Android 设备直接下载 APK。

构建入口：

```powershell
cd E:\5kvideo\5ktv
.\build-debug.ps1
```

## 10. 数据、缓存与统计

### 10.1 视频数据

- 视频核心当前主要使用 JSON 数据仓储。
- 生产数据位于 130 的 `/root/5kvideo-release/server/data`。
- `collected-catalog.json`：采集视频目录。
- `collected-taxonomy.json`：采集分类/标签体系。
- `collected-search-stats.json`：采集搜索统计。
- `db.json`：视频、用户、收藏、事件等主数据。
- `media/`：封面、截图、媒体与队列数据。

### 10.2 导航数据

- `/opt/5k-middle-platform/navigation/db.json`：导航管理主数据。
- `assets/`：加密图片及素材。
- `published-site/`：前端静态发布数据。

### 10.3 广告与 H5 数据

- PostgreSQL 容器：`5k-ad-postgres`。
- Redis 容器：`5k-ad-redis`。
- 不要直接修改 Docker Volume 文件，应通过数据库工具或应用迁移脚本操作。

### 10.4 统计口径

- PV：页面访问事件数量。
- UV：按日期去重后的访客/设备标识。
- 独立 IP：按日期去重后的客户端 IP。
- 新增设备：首次出现的设备标识。
- 游客/注册账号：按账号创建类型统计。
- 次留、3 日留、7 日留：首次日期后的指定日期再次活跃。
- 播放/有效播放：播放开始与达到有效阈值的播放事件。
- 性能：页面开始、首屏、图片完成、API 耗时、LCP 等事件。
- 播放错误：错误类型、媒体 URL 类型、浏览器、网络和阶段信息。

## 11. 发布与回滚

### 11.1 当前生产部署文件

- `deploy/897kg-130-apache.conf`：130 上的 `897kg.cc` Apache 入口。
- `deploy/migrate-public-proxies-to-130.py`：两个公开前端切换到 130 API 的脚本。
- `deploy/cutover-cloudflare-897kg.py`：DNS 切换脚本，运行时从安全环境读取凭证。
- `deploy/897kg-vdo.locations.conf`：视频后台/API 的 Nginx 路由参考。

### 11.2 迁移备份

旧 Web 服务器：

```text
/opt/5k-migration-backups/20261001-181607
/opt/5k-migration-final-20261001
```

130 中台：

```text
/opt/5k-middle-platform/seed-backup
/opt/5k-middle-platform/final
/opt/5k-middle-platform/pre-final-snapshot
```

旧服务器上的旧 API、PostgreSQL 和 Redis 容器只是停止，没有删除。紧急回滚时应先停止新端写入、同步增量数据，再恢复旧端容器和 DNS，不能让两端同时写入。

## 12. 安全要求

- 文档和 Git 中禁止保存密码、JWT Secret、数据库密码、Cloudflare Token、R2 密钥和 SSH 私钥。
- Cloudflare 凭证从安全环境文件读取，不复制到项目文档。
- 播放 Token 必须绑定视频、用户/匿名会话、有效期和内容模式。
- 上传和播放签发接口必须限流。
- CORS 只允许业务域名与管理域名，不使用宽泛的 `*`。
- 4010/4020/4100/4310 只能监听回环地址。
- 数据迁移后只能保留一个写入端，避免收藏、统计和广告数据分叉。

## 13. 现有专项文档索引

### 视频

- `E:\5kvideo\5KVIDEO\FEATURE_DOCS.md`：早期产品功能与交互说明。
- `E:\5kvideo\5KVIDEO\docs\SERVER_ARCHITECTURE.md`：视频后端模块边界。
- `E:\5kvideo\5KVIDEO\docs\DEVELOPMENT.md`：本地开发、APP 和生产配置。
- `E:\5kvideo\5KVIDEO\docs\COVER_EDITOR.md`：封面编辑器。
- `E:\5kvideo\5knews\OPTIMIZATION_PLAN.md`：当前 H5 优化与发布记录。

### 导航

- `E:\5kvideo\DAOHANG\DEVELOPMENT.md`：导航开发、构建与发布。
- `E:\5kvideo\DAOHANG\docs\NAVIGATION_ADMIN_ARCHITECTURE.md`：导航后台结构。
- `E:\5kvideo\DAOHANG\CDN_CONFIGURATION.md`：旧 CDN 配置，部分内容已被 2026-10-01 架构替代。

### 广告与电视

- `E:\5kvideo\5k-ad-platform\README.md`
- `E:\5kvideo\5k-ad-platform\docs\DEVELOPMENT.md`
- `E:\5kvideo\5ktv\README.md`

## 14. 接手项目时的检查顺序

1. 先阅读本文，确认源码目录、域名和服务器分工。
2. 再阅读目标子项目的开发文档。
3. 修改前检查本地 Git 状态，不能覆盖已有未提交改动。
4. 构建并完成对应项目的测试/type-check。
5. 先发布到版本目录或新容器，使用 Host/resolve 方式验证。
6. 再切反向代理或 DNS，不直接覆盖唯一线上版本。
7. 验证首页、后台静态资源、关键 API、数据库写入和错误日志。
8. 保留可恢复备份，并记录发布日期和回滚命令。

