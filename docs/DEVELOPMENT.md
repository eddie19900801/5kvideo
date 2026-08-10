# 本地开发与 APP 构建

> `5KVIDEO` 根目录不再包含前端源码或 `package.json`。请进入对应的独立工程构建，避免混淆用户端、管理端与服务端。

| 目录 | 用途 | 构建产物 |
|---|---|---|
| `user-web/` | `https://5k.ag/` 用户前端及 APP WebView | `user-web/out/` |
| `admin-web/` | `https://5k.ag/admin/` 管理后台前端 | `admin-web/dist/` |
| `server/` | `/api/v1/` Node.js API 后端 | `server/dist/` |
| `upload-worker/` | Cloudflare R2 上传 Worker | Worker 部署产物 |

不要把 `user-web/out` 部署到 `/admin/`，也不要把 `admin-web/dist` 部署到站点根目录。

## 本地启动

需要 Node.js 22 LTS。分别打开三个终端：

```bash
cd server && npm install && npm run dev
cd user-web && npm install && npm run dev
cd admin-web && npm install && npm run dev
```

服务端提交或部署前运行：

```bash
cd server
npm run type-check
npm test
```

`npm test` 会先构建服务端，再使用 Node.js 内置测试运行独立临时数据库上的真实 HTTP 集成测试。
测试覆盖游客绑定、昵称与密码修改、重新登录、普通/18+ 收藏与历史隔离，以及后台视频修改字段白名单。
测试结束会关闭临时监听并删除临时数据。

复制各工程 `.env.example` 为 `.env` 可修改服务地址。管理后台开发账号为 `admin`，密码为 `Admin123!`，生产部署必须修改。

开发 API 使用 `server/data/db.json` 自动初始化，方便一键运行；生产环境按开发计划切换 PostgreSQL，并使用 Redis/BullMQ 执行转码。

## Android APP

```bash
cd user-web
npx cap add android
npm run app:android
```

静态网页资源会打入安装包，API、图片和 HLS 从服务器加载。Android 模拟器访问宿主 API 时，把 `VITE_API_URL` 改为 `http://10.0.2.2:4000/api/v1`。生产必须使用 HTTPS。

## 生产安全配置

服务端在 `NODE_ENV=production` 时必须配置 `JWT_SECRET`。首次创建数据文件时还必须配置
`ADMIN_INITIAL_PASSWORD`，可通过 `ADMIN_INITIAL_ACCOUNT` 修改初始管理员账号。生产环境禁止沿用
示例值，后台登录页不会预填密码。

服务端默认按一层反向代理解析客户端 IP，可通过 `TRUST_PROXY_HOPS` 调整。登录、游客会话创建、
播放计数和分析事件接口包含单实例内存限流；扩展为多实例部署前，应替换为 Redis 共享限流。

视频修改接口只接受明确列出的业务字段，未知字段会返回 `400 VALIDATION_ERROR`。上传接口会按
字段区分视频和图片 MIME 类型；FFprobe 仍负责后续媒体有效性检查。

## 用户会话与数据同步

用户端账号体系以 API 为唯一数据源。首次访问创建并持久化游客 Token；绑定账号会沿用游客 ID，
从而保留该游客已经产生的服务端数据。登录、改昵称和修改密码均由服务端校验，浏览器不再保存
账号密码，启动时会清理旧版 Mock 用户数据。

收藏和观看历史以服务端数据为准，并按 `normal` 与 `adult` 两种内容模式隔离。本地存储只保存按
`用户 ID + 内容模式` 划分的弱网缓存。切换账号或内容模式时会重新同步对应的数据，删除历史记录
也会同步删除服务端记录。

服务端入口导出 Express `app` 和 `startServer()`：直接执行 `dist/index.js` 时正常监听端口，被测试
或后续 Worker 进程导入时不会自行监听。这是后续按领域拆分路由、服务和数据仓储层的回归基线。
当前模块边界与后续拆分顺序见 [SERVER_ARCHITECTURE.md](./SERVER_ARCHITECTURE.md)。

## iOS APP

在 macOS、Xcode 环境执行：

```bash
cd user-web
npx cap add ios
npm run app:ios
```

网页修改后执行 `npm run app:sync`。原生目录应提交 Git，证书和签名密钥禁止提交。

## 视频接入

后台当前可录入已上传的 HLS/MP4 地址用于联调。生产阶段接入对象存储分片上传与 FFmpeg Worker。用户端的 `src/services/player.ts` 统一处理 Safari 原生 HLS 和其他浏览器的 hls.js。
