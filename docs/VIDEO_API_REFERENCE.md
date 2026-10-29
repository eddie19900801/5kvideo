# 5K Video API 接口文档

更新日期：2026-10-29

## 在线文档

- Swagger UI：`https://897kg.cc/vdo/api/docs`
- OpenAPI 3.1：`https://897kg.cc/vdo/api/v1/openapi.json`
- API 根地址：`https://897kg.cc/vdo/api/v1`
- 视频站同源代理：`https://<产品域名>/vdo-api/v1`

OpenAPI 文件是接口清单的权威来源。新增或删除接口时必须同步修改 `server/src/openapi.ts`。

## 鉴权与响应

管理员和登录用户接口使用 JWT：

```http
Authorization: Bearer <token>
```

成功响应统一包装为：

```json
{"data": {}}
```

失败响应统一包装为：

```json
{"error":{"code":"VALIDATION_ERROR","message":"参数不正确"}}
```

常见状态码：`200` 成功、`201` 已创建、`202` 已进入异步任务、`400` 参数错误、`401` 未登录、`403` 无权限、`404` 不存在、`409` 状态冲突、`429` 频率限制、`502/503` 外部服务不可用。

## 接口分组

| 分组 | 路径前缀 | 用途 |
|---|---|---|
| 系统 | `/health`、`/api/docs` | 健康检查和文档 |
| 登录 | `/api/v1/auth` | 游客、登录、绑定账号 |
| 用户 | `/api/v1/me` | 资料、收藏、历史、密码 |
| 视频 | `/api/v1/videos` | 列表、详情、播放签名、收藏和进度 |
| 采集视频 | `/api/v1/collected-videos` | 分类、搜索、推荐、详情和截图 |
| 元数据 | `/api/v1/tags`、`categories`、`chapter-tags` | 前端筛选数据 |
| 产品 | `/api/v1/product`、`products`、`channels` | 产品运行配置与渠道安装包 |
| 数据上报 | `/api/v1/analytics/events` | H5、Android、iOS 事件上报 |
| 管理后台 | `/api/v1/admin` | 用户、视频、片源、产品、渠道和数据分析 |

## 重要接口示例

### 获取产品运行配置

```http
GET /api/v1/product/runtime-config?host=91xueyuan.app.wflhc.cn
```

### 获取采集视频

```http
GET /api/v1/collected-videos?page=1&pageSize=20&q=动漫&category=&sort=recommended&duration=all&product=91xueyuan
```

搜索始终在全部资源中执行；有搜索词时不会被当前分类限制。

### 上报分析事件

```http
POST /api/v1/analytics/events
Content-Type: application/json

{
  "events": [{
    "eventName": "page_view",
    "installId": "设备安装标识",
    "sessionId": "会话标识",
    "platform": "web",
    "appVersion": "web",
    "channel": "direct",
    "metadata": {"productSlug": "91xueyuan"}
  }]
}
```

单次最多提交 50 条事件。服务端批量写入 PostgreSQL，避免每个事件单独写盘。

## 播放安全

- `/videos/{id}/playback` 签发短期播放地址。
- 播放签名绑定视频、观看者、内容模式和有效期。
- HLS 清单、分片和 MP4 代理均会验证签名。
- 播放地址签发和登录等敏感接口设置了频率限制。

## 性能基线

2026-10-29 在中台服务器本机测试，普通接口 P95 目标小于 100ms：

| 类型 | 优化后目标 |
|---|---:|
| 健康检查、产品配置、视频详情 | 10ms 内 |
| 普通列表和后台基础数据 | 30ms 内 |
| 产品分析 | 100ms 内 |
| 数据概览首次计算 | 2s 内，之后命中 30 秒缓存 |
| 采集首页启动数据 | 100ms 内，服务端缓存 5 分钟 |

性能脚本：`deploy/benchmark-video-api.sh`。脚本只压测安全的只读接口，不会在线上执行删除、发布、采集或上传。

## 数据库

线上运行使用 PostgreSQL 16。`db.json` 仅作为迁移前备份，不参与任何线上读写。主要关系表包括产品、用户、视频、收藏、进度、分析事件、渠道、片源、审计日志和媒体任务。
