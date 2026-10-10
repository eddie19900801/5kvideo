# 服务端架构

## 当前模块边界

```text
server/src/
├─ index.ts                 # 中间件与路由装配、进程启动
├─ config.ts                # 环境变量解析和运行配置
├─ contentMode.ts           # 普通/18+ 服务端数据分区规范化
├─ http.ts                  # 统一成功响应工具
├─ auth.ts                  # JWT 鉴权中间件
├─ db.ts                    # Repository 实例与旧调用兼容层
├─ media.ts                 # FFprobe/FFmpeg 媒体处理
├─ services/
│  ├─ playback.ts           # 播放签名、R2 URL、本地媒体路径和响应转换
│  ├─ mediaFiles.ts         # 日期目录和安全媒体文件名
│  └─ videoMetadata.ts      # 标签等视频资料规范化
├─ repositories/
│  ├─ database.ts           # 与存储实现无关的 read/transaction 契约
│  ├─ jsonDatabase.ts       # 当前 JSON 文件实现和首次初始化
│  ├─ video.ts              # 视频与推荐互动数据领域接口
│  ├─ jsonVideo.ts          # 视频 CRUD、标签同步、审计与互动实现
│  ├─ user.ts/jsonUser.ts   # 用户领域接口与 JSON 实现
│  └─ mediaJob.ts/jsonMediaJob.ts # 持久化媒体任务接口与 JSON 实现
├─ postgres/
│  ├─ client.ts             # 连接池和事务工具
│  ├─ migrate.ts            # 按版本执行 SQL migration
│  └─ importJson.ts         # JSON 全量数据幂等导入工具
├─ types.ts                 # 当前业务数据类型
├─ middleware/
│  ├─ rateLimit.ts          # 单实例限流及预设策略
│  └─ uploads.ts            # Multer 媒体与分片上传限制
└─ routes/
   ├─ auth.ts               # 游客、登录、账号绑定路由
   ├─ me.ts                 # 会话、资料、密码、收藏与历史查询
   ├─ userVideos.ts         # 播放计数、收藏与观看进度写入
   ├─ videos.ts             # 公开视频列表、推荐、详情和鉴权媒体流
   ├─ adminCatalog.ts       # 后台用户和标签目录
   ├─ adminVideos.ts        # 后台视频资料 CRUD
   ├─ adminMedia.ts         # 候选帧、封面保存和可恢复永久删除
   ├─ adminUploads.ts       # R2 直传、本地同步直传与分片上传处理
   ├─ adminMediaJobs.ts     # 异步上传、任务状态和失败重试
   ├─ analytics.ts          # 分析事件写入和后台聚合报表
   └─ publicMetadata.ts     # 公共标签与精彩标签聚合查询
```

`index.ts` 只负责装配模块和直接执行时启动监听。业务模块不得自行调用 `listen()`，因此测试可以
导入同一个 Express `app` 并绑定随机端口。

## 依赖方向

```text
index（应用装配）
  → routes（HTTP 参数与响应）
    → auth/db/media（业务能力与数据访问）
  → middleware（横切能力）
  → config/http（基础设施）
```

基础设施模块不得反向引用路由或应用入口。路由优先依赖 `DatabaseRepository`，迁移期间仍允许旧模块
通过 `db.ts` 的 `readDb/updateDb` 兼容层访问相同 JSON 实现。前端不得直接引用服务端源码；后续公共
API 类型应由 OpenAPI 生成。

## 后续拆分顺序

入口现已成为纯应用装配层。用户、视频、互动和媒体任务均有领域 Repository。封面替换和永久删除
具备文件/数据库失败补偿，过期分片会在启动时清理。异步上传通过 `202` 创建持久化任务，独立进程
使用 `npm run start:media-worker` 消费；旧同步接口继续兼容。

PostgreSQL 初始结构位于 `server/migrations/001_initial.sql`。配置 `DATABASE_URL` 后先执行
`npm run db:migrate`，再用 `npm run db:import-json` 幂等导入现有 JSON 数据。当前线上运行时仍默认
使用 JSON Repository；正式切换前需要将领域 Repository 的异步 PostgreSQL 实现接入并完成双写验证。

## 播放访问控制

API 使用 HttpOnly `playback_viewer` Cookie 标识登录用户或匿名会话。播放签名同时覆盖视频 ID、观看者、
内容模式和过期时间，HLS 清单与分片请求均重复验证；R2 分片由 API 验证后代理，不向播放器暴露可转发的
R2 签名地址。播放地址签发限制为每 IP 每分钟 60 次。媒体 Worker 的浏览器 CORS 仅允许
`https://5k.ag`、`https://www.5k.ag`、`https://admin.5k.ag` 和 `https://ikumep.cn`，无 Origin 的服务端/桌面客户端签名请求不受
浏览器 CORS 限制。

## 封面加密存储

- 后台保存最终封面时，服务端使用 AES-256-GCM 加密后上传 Cloudflare R2。
- 数据库只保存 `r2enc://桶名/对象键`，不保存固定域名或公开图片地址。
- 前端取得密文后在浏览器内解密为临时 Blob URL，直接打开密文接口不能显示图片。
- 旧本地封面和普通 R2 封面继续兼容；新保存的封面自动采用加密格式。
- 该方案用于防直链及普通采集，无法阻止终端截图或高级脚本提取已经呈现的画面。

1. 为 PostgreSQL 实现异步领域 Repository，并进行 JSON/PostgreSQL 双写校验。
2. 管理端接入异步上传任务状态，稳定后下线同步 FFmpeg 接口。
3. 将单进程 JSON 任务认领升级为 PostgreSQL `FOR UPDATE SKIP LOCKED` 或专用队列。

每抽离一个模块，必须保持现有 URL 和响应结构，并先补对应集成测试。数据库迁移前不得让路由
直接依赖新的 ORM，以免 HTTP 层与存储实现再次耦合。
