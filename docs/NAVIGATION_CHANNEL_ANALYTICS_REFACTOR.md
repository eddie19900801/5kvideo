# 5K 导航渠道与广告统计后台重构开发文档

> 文档状态：待开发  
> 编写日期：2026-10-22  
> 适用系统：5K 导航后台、导航前端、5K 广告中心、广告 SDK、应用包落地页  
> 管理后台：`https://897kg.cc/dhang/admin/`  
> 主要代码仓库：`E:\5kvideo\DAOHANG`  

## 1. 文档目标

本次重构解决以下问题：

1. 导航访问渠道和广告投放渠道概念混用。
2. 数据总览、每日整体数据、流量与留存、数据统计、代理与渠道、广告分析之间存在大量重复。
3. 图标、Banner、弹窗、交友等内容分别使用不同统计结构，维护和对账困难。
4. 无法清晰回答“某个导航渠道带来的用户最终点击了什么”。
5. 统计数据库保存大量访客数组，数据体积和后台查询时间持续增长。
6. 后台菜单过多，相同指标在多个页面展示，口径不统一。

重构后的系统必须能够回答以下核心问题：

- 用户从哪个渠道进入？
- 用户进入了哪个导航站？
- 用户看过哪些分类和内容？
- 用户点击了哪个图标、Banner、交友卡片或广告产品？
- 不同渠道的 PV、UV、点击率和后续下载转化分别是多少？
- 广告中心将什么产品投放到了哪个媒体、站点和广告位？

## 2. 范围说明

### 2.1 本期包含

- 导航站点维度。
- 导航推广渠道归因。
- 广告媒体渠道归因。
- 统一前端行为事件。
- 统一内容展示与点击统计。
- 后台统计菜单重构。
- 每日聚合与明细数据保留策略。
- 现有数据迁移与兼容读取。
- 查询性能和数据库体积优化。

### 2.2 本期不包含

- 收益与利润结算。
- 广告主在线充值。
- 自动分成与代理佣金结算。
- IP 地区库和国家解析。
- 用户实名系统。
- 跨设备用户身份合并。

## 3. 现状分析

### 3.1 当前后台菜单

当前导航后台包含：

- 数据总览
- 每日整体数据
- 流量与留存
- 数据统计
- 代理与渠道
- 应用包管理
- 交友管理
- 导航内容
- Banner 管理
- 首屏弹窗
- 底部飘窗
- 站点配置

其中前三项均包含 PV、UV、会话和每日趋势；“数据统计”又分别展示图标、交友、Banner、弹窗数据，重复程度较高。

### 3.2 当前主要统计结构

现有 API 已经保存部分渠道数据：

- `traffic.channelDaily`
- `traffic.channelVisitors`
- `traffic.channelHourly`
- `analytics.iconDaily[*].channels`
- `analytics.elementDaily[*][type][id].channels`
- `adCenter.daily[*][deliveryId].channels`
- `appPackageDaily`

当前主要问题：

- 多处字段都叫 `channel`，无法从名称判断是导航来源渠道还是广告投放渠道。
- 图标统计和其他内容统计采用两套结构。
- 总量字段和每日字段同时累积，容易出现历史数据口径不一致。
- 唯一访客、唯一点击依赖字符串数组，数据量持续膨胀。
- 广告中心仍保留复杂的投放计划数据模型，但产品上线即投放的业务不再需要它。

## 4. 统一业务概念

### 4.1 导航站点 `site`

表示用户实际访问的导航站实例。

示例：

| site_id | 名称 | 域名 |
|---|---|---|
| `NAV_MAIN` | 主导航 | `daohang.wflhc.cn` |
| `NAV_91MF` | 91免费导航 | `daohang1.wflhc.cn` |
| `NAV_VLOG` | 破解VLOG导航 | `daohang2.wflhc.cn` |

所有页面访问、内容展示、点击和应用下载事件必须携带 `site_id`。

### 4.2 导航来源渠道 `nav_channel`

表示用户通过哪个推广入口进入导航。

推荐链接格式：

```text
https://daohang.wflhc.cn/?cid=NAV_A001
```

无有效 `cid` 时归入系统渠道：

```text
NATURAL
```

### 4.3 广告投放渠道 `ad_channel`

表示广告中心面向哪个媒体、站点、合作方或广告接入账户提供广告。

它与 `nav_channel` 是两个独立字段：

```text
nav_channel_id = 用户从哪里来
ad_channel_id  = 广告投放给谁
```

### 4.4 访客与会话

- `visitor_id`：浏览器端生成的匿名 ID，长期保存。
- `session_id`：一次访问会话 ID，30 分钟无行为后创建新会话。
- 服务端只保存加盐哈希后的访客标识。
- 不保存原始 IP；IP 仅在请求期间用于临时去重或安全控制。

## 5. 渠道归因规则

### 5.1 首次渠道与最近渠道

客户端本地保存：

```json
{
  "firstNavChannel": "NAV_A001",
  "lastNavChannel": "NAV_A001",
  "channelUpdatedAt": "2026-10-22T10:00:00+08:00"
}
```

规则：

1. 第一次通过有效 `cid` 进入时，同时写入首次渠道和最近渠道。
2. 后续通过另一个有效 `cid` 进入时，只更新最近渠道。
3. 首次直接访问时，首次渠道记录为 `NATURAL`。
4. 已存在有效渠道、本次 URL 没有 `cid` 时，继续使用最近渠道。
5. 渠道有效期默认 30 天，后台以后可以配置。
6. 后台默认按最近渠道统计，并允许切换首次渠道口径。

### 5.2 渠道合法性

- 前端不得直接信任任意 `cid`。
- API 根据启用的渠道表校验渠道号。
- 不存在、禁用或格式错误的渠道统一记录为 `UNKNOWN`。
- 渠道编号只允许大写字母和数字，长度 4～30。

### 5.3 跨页面传递

- 导航站内部切换分类不要求 URL 始终保留 `cid`，从本地归因数据读取。
- 跳转落地页时将渠道写入目标链接。
- 广告 SDK 请求同时携带 `site_id`、`nav_channel_id` 和 `ad_channel_id`。
- APP 下载链接携带 `attribution_id`，安装后首次启动回传该 ID。

## 6. 新数据模型

建议从单一大型 JSON 结构逐步迁移至 SQLite 或 PostgreSQL。第一阶段可以继续使用现有服务，但必须按下述逻辑拆分存储。

### 6.1 站点表 `sites`

```sql
CREATE TABLE sites (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  domain          TEXT NOT NULL UNIQUE,
  status          TEXT NOT NULL DEFAULT 'active',
  created_at      DATETIME NOT NULL,
  updated_at      DATETIME NOT NULL
);
```

### 6.2 导航渠道表 `nav_channels`

```sql
CREATE TABLE nav_channels (
  id              TEXT PRIMARY KEY,
  code            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  owner_account_id TEXT,
  status          TEXT NOT NULL DEFAULT 'active',
  attribution_days INTEGER NOT NULL DEFAULT 30,
  created_at      DATETIME NOT NULL,
  updated_at      DATETIME NOT NULL
);
```

### 6.3 广告媒体渠道表 `ad_channels`

```sql
CREATE TABLE ad_channels (
  id              TEXT PRIMARY KEY,
  code            TEXT NOT NULL UNIQUE,
  publisher_id    TEXT NOT NULL,
  site_id         TEXT,
  name            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active',
  created_at      DATETIME NOT NULL,
  updated_at      DATETIME NOT NULL
);
```

### 6.4 明细事件表 `analytics_events`

```sql
CREATE TABLE analytics_events (
  id                  TEXT PRIMARY KEY,
  occurred_at         DATETIME NOT NULL,
  event_day           DATE NOT NULL,
  event_hour          INTEGER NOT NULL,
  event_type          TEXT NOT NULL,
  site_id             TEXT NOT NULL,
  nav_channel_id      TEXT NOT NULL,
  first_nav_channel_id TEXT,
  ad_channel_id       TEXT,
  visitor_hash        TEXT,
  session_id          TEXT,
  content_type        TEXT,
  content_id          TEXT,
  category_id         TEXT,
  placement_id        TEXT,
  product_id          TEXT,
  search_keyword      TEXT,
  referrer            TEXT,
  page_path           TEXT,
  device_type         TEXT,
  platform            TEXT,
  metadata_json       TEXT
);
```

推荐索引：

```sql
CREATE INDEX idx_events_day_site_channel
  ON analytics_events(event_day, site_id, nav_channel_id);

CREATE INDEX idx_events_content
  ON analytics_events(event_day, content_type, content_id);

CREATE INDEX idx_events_visitor
  ON analytics_events(visitor_hash, occurred_at);
```

### 6.5 每日聚合表 `analytics_daily`

```sql
CREATE TABLE analytics_daily (
  day                 DATE NOT NULL,
  site_id             TEXT NOT NULL,
  nav_channel_id      TEXT NOT NULL,
  ad_channel_id       TEXT NOT NULL DEFAULT '',
  content_type        TEXT NOT NULL DEFAULT '',
  content_id          TEXT NOT NULL DEFAULT '',
  category_id         TEXT NOT NULL DEFAULT '',
  placement_id        TEXT NOT NULL DEFAULT '',
  product_id          TEXT NOT NULL DEFAULT '',
  pv                   INTEGER NOT NULL DEFAULT 0,
  uv                   INTEGER NOT NULL DEFAULT 0,
  sessions             INTEGER NOT NULL DEFAULT 0,
  new_visitors         INTEGER NOT NULL DEFAULT 0,
  impressions          INTEGER NOT NULL DEFAULT 0,
  unique_impressions   INTEGER NOT NULL DEFAULT 0,
  clicks               INTEGER NOT NULL DEFAULT 0,
  unique_clicks        INTEGER NOT NULL DEFAULT 0,
  searches             INTEGER NOT NULL DEFAULT 0,
  downloads            INTEGER NOT NULL DEFAULT 0,
  installs             INTEGER NOT NULL DEFAULT 0,
  launches             INTEGER NOT NULL DEFAULT 0,
  errors               INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (
    day, site_id, nav_channel_id, ad_channel_id,
    content_type, content_id, category_id, placement_id, product_id
  )
);
```

### 6.6 聚合计算原则

- PV：`page_view` 事件数量。
- UV：按日去重的 `visitor_hash` 数量。
- 会话：按日去重的 `session_id` 数量。
- 新访客：首次访问日期等于统计日期的访客数。
- 展示：进入可视区域并满足至少 50% 可见、持续 500ms 后记录。
- 唯一展示：按日、内容、访客去重。
- 点击：有效点击事件数量。
- 唯一点击：按日、内容、访客去重。
- CTR：`点击 / 展示 × 100%`。
- UV CTR：`唯一点击 / 唯一展示 × 100%`。

## 7. 统一事件规范

### 7.1 事件类型

只保留以下公共事件：

| event_type | 用途 |
|---|---|
| `page_view` | 页面访问 |
| `category_view` | 分类进入或曝光 |
| `content_impression` | 图标、Banner、交友、弹窗等内容展示 |
| `content_click` | 内容点击 |
| `search` | 用户搜索 |
| `landing_view` | 应用落地页展示 |
| `download_click` | 用户点击下载按钮 |
| `download_start` | APK 或描述文件开始下载 |
| `app_install` | APP 安装激活 |
| `app_launch` | APP 启动 |
| `load_error` | 页面、图片或广告加载错误 |

内容类型通过 `content_type` 区分：

```text
icon | banner | profile | popup | floating | ad_icon | ad_banner
```

### 7.2 事件请求示例

```json
{
  "eventType": "content_click",
  "occurredAt": "2026-10-22T10:00:00+08:00",
  "siteId": "NAV_MAIN",
  "navChannelId": "NAV_A001",
  "firstNavChannelId": "NAV_A001",
  "adChannelId": "AD_PUBLISHER_01",
  "visitorId": "client-generated-id",
  "sessionId": "session-id",
  "contentType": "ad_icon",
  "contentId": "creative_91_icon",
  "categoryId": "movie",
  "placementId": "movie_grid",
  "productId": "product_91",
  "pagePath": "/",
  "referrer": "https://source.example/path"
}
```

### 7.3 事件写入要求

- 支持单条和批量事件。
- 浏览器优先使用 `navigator.sendBeacon`。
- 不支持时使用 `fetch(..., { keepalive: true })`。
- 前端队列每 2 秒或累计 20 条时批量上报。
- 页面退出时立即上报剩余队列。
- 服务端按 `event_id` 幂等去重。
- 单个访客每分钟最大 240 条普通事件。
- 蜘蛛和已知自动化请求写入独立计数，不进入业务指标。

## 8. API 设计

### 8.1 客户端配置

```http
GET /api/v2/analytics/context?host=daohang.wflhc.cn&cid=NAV_A001
```

返回：

```json
{
  "data": {
    "siteId": "NAV_MAIN",
    "navChannelId": "NAV_A001",
    "channelValid": true,
    "attributionDays": 30
  }
}
```

### 8.2 事件上报

```http
POST /api/v2/events/batch
Content-Type: application/json
```

```json
{
  "events": []
}
```

### 8.3 总览查询

```http
GET /api/v2/admin/analytics/overview
  ?from=2026-10-01
  &to=2026-10-22
  &siteId=NAV_MAIN
  &navChannelId=NAV_A001
  &platform=h5
```

### 8.4 每日趋势

```http
GET /api/v2/admin/analytics/daily
  ?from=2026-10-01
  &to=2026-10-22
  &siteId=NAV_MAIN
  &navChannelId=NAV_A001
  &page=1
  &pageSize=20
```

### 8.5 渠道排行

```http
GET /api/v2/admin/analytics/channels
  ?from=2026-10-01
  &to=2026-10-22
  &siteId=NAV_MAIN
  &attribution=last
```

### 8.6 内容分析

```http
GET /api/v2/admin/analytics/content
  ?from=2026-10-01
  &to=2026-10-22
  &siteId=NAV_MAIN
  &navChannelId=NAV_A001
  &contentType=icon
  &page=1
  &pageSize=20
```

### 8.7 用户路径

```http
GET /api/v2/admin/analytics/journeys
  ?date=2026-10-22
  &siteId=NAV_MAIN
  &navChannelId=NAV_A001
  &page=1
  &pageSize=20
```

返回匿名化路径，不返回原始 IP 或完整设备指纹。

## 9. 后台信息架构

重构后侧边栏只保留六个一级菜单：

1. 数据总览
2. 导航分析
3. 广告中心
4. 渠道管理
5. 内容管理
6. 应用与站点

### 9.1 全局筛选栏

所有统计页面共用同一个筛选栏：

- 日期：今天、昨天、最近7天、最近30天、自定义。
- 导航站点。
- 导航渠道。
- 终端：全部、H5、Android APK、iOS书签。
- 归因口径：最近渠道、首次渠道。

筛选条件写入 URL 查询参数，刷新页面后不能丢失，并支持复制当前分析链接。

### 9.2 数据总览

只展示经营判断需要的核心信息。

核心指标：

- PV
- UV
- 新访客
- 会话数
- 内容展示
- 内容点击
- CTR
- 搜索次数
- 下载数
- 安装激活

下方模块：

- 每日趋势图
- 渠道效果排行
- 分类点击排行
- 产品点击排行
- 异常提醒

不在总览展示来源明细、设备明细、搜索词长表格。

### 9.3 导航分析

内部标签页：

#### 每日趋势

| 日期 | PV | UV | 新访客 | 回访访客 | 会话 | 展示 | 点击 | CTR |
|---|---:|---:|---:|---:|---:|---:|---:|---:|

- 每页 20 条。
- 支持日期筛选。
- 支持 CSV 导出。

#### 渠道分析

| 渠道 | PV | UV | 新访客 | 会话 | 展示 | 点击 | 点击UV | CTR | 人均点击 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|

点击渠道进入详情页：

- 每日趋势
- 站点分布
- 分类排行
- 产品排行
- 来源排行
- 搜索词排行
- 设备分布
- 匿名用户路径

#### 内容分析

类型筛选：图标、Banner、交友、弹窗、底部飘窗、广告图标、广告 Banner。

| 内容 | 分类 | 展示 | 展示UV | 点击 | 点击UV | CTR | UV CTR |
|---|---|---:|---:|---:|---:|---:|---:|

原“图标详情”功能并入内容详情页。

#### 来源与搜索

来源站点：

| 来源完整路径 | PV | UV | 会话 | 内容点击 | CTR |
|---|---:|---:|---:|---:|---:|

搜索词：

| 搜索词 | 搜索次数 | 搜索UV | 点击 | 点击率 | 最常点击产品 |
|---|---:|---:|---:|---:|---|

#### 用户环境

保留：

- 设备类型
- 操作系统
- 浏览器
- 屏幕宽度
- 网络类型
- H5/APK/iOS书签
- 页面加载性能
- 图片和广告加载错误

移除：原始 IP、国家代码、完整 User-Agent。

### 9.4 广告中心

内部标签页：

- 产品管理
- 素材管理
- 媒体与广告位
- 广告数据

删除“投放计划”页面和相关表单。

产品或素材只保留：

- 上架/下架
- 推荐状态
- 分类标签
- 支持的广告形式
- 跳转链接
- 素材资源

广告数据筛选：日期、媒体主、媒体站点、广告位、广告类型、广告渠道、产品。

指标：请求、填充、展示、展示UV、点击、点击UV、CTR、转化。

### 9.5 渠道管理

内部标签页：

#### 导航推广渠道

字段：

- 渠道名称
- 渠道号
- 负责人
- 状态
- 可用导航站
- 推广链接
- 今日 PV
- 今日 UV
- 今日内容点击
- 创建时间

渠道链接由系统生成，不允许人工拼接。

#### 媒体广告渠道

字段：

- 媒体主
- 站点
- API Key
- 广告位数量
- 状态
- 今日请求
- 今日展示
- 今日点击
- CTR

#### 代理账号

如果继续保留代理登录，一个代理账号可以管理多个导航渠道；账号和渠道不再一对一绑定。

### 9.6 内容管理

合并以下原菜单：

- 导航内容
- Banner管理
- 交友管理
- 首屏弹窗
- 底部飘窗

内部标签：分类与图标、Banner、交友、弹窗、底部飘窗。

统一支持：

- 排序
- 上架/下架
- 图片
- 跳转链接
- 分类
- 推荐/热门状态
- 保存
- 发布

### 9.7 应用与站点

内部标签页：

- 应用包
- 站点配置
- 发布记录

应用包保留渠道落地页、APK、iOS书签和导航配置文件管理。

## 10. 移除和合并清单

### 10.1 一级菜单移除

以下菜单不再作为一级菜单：

- 每日整体数据：并入“导航分析 / 每日趋势”。
- 流量与留存：并入“数据总览”和“导航分析”。
- 数据统计：并入“导航分析 / 内容分析”。
- 交友管理：并入“内容管理”。
- 导航内容：并入“内容管理”。
- Banner管理：并入“内容管理”。
- 首屏弹窗：并入“内容管理”。
- 底部飘窗：并入“内容管理”。
- 站点配置：并入“应用与站点”。

### 10.2 功能移除

- 广告投放计划。
- 开始时间、结束时间。
- 手工输入投放渠道。
- 投放设备配置。
- 每日展示上限。
- 单用户频控表单。
- 原始 IP 明细页。
- 国家代码字段。
- 完整 User-Agent。
- 重复的统计总计卡片。

旧代码先隐藏一个发布周期，验证新功能后再删除。

## 11. 数据保留与性能

### 11.1 保存周期

| 数据 | 保存周期 |
|---|---|
| 原始明细事件 | 30天 |
| 小时聚合 | 90天 |
| 每日聚合 | 长期 |
| 错误明细 | 30天 |
| 发布记录 | 长期 |

### 11.2 定时任务

- 每 5 分钟聚合最近 15 分钟事件。
- 每天 00:10 重新核算上一日数据。
- 每天 03:00 删除超过 30 天的明细事件。
- 每天 03:30 删除超过 90 天的小时聚合。
- 每天 04:00 做统计表维护和数据库压缩。

### 11.3 查询缓存

- 总览：缓存 60 秒。
- 每日趋势：缓存 3 分钟。
- 历史日期：缓存 30 分钟。
- 内容详情：缓存 3 分钟。
- 配置、上下架和发布操作后主动清除相关缓存。

## 12. 兼容与迁移方案

### 阶段 A：增加新字段，不改旧页面

1. 建立 `sites`、`nav_channels`、`ad_channels`。
2. 现有渠道导入 `nav_channels`。
3. 为已知导航域名建立站点记录。
4. 前端事件同时写旧接口和新批量接口。
5. 对比新旧指标差异。

### 阶段 B：迁移历史聚合数据

映射规则：

- `traffic.daily` → 全站每日访问聚合。
- `traffic.channelDaily` → 导航渠道每日聚合。
- `analytics.iconDaily` → 图标内容每日聚合。
- `analytics.elementDaily` → Banner、弹窗、交友每日聚合。
- `adCenter.daily` → 广告投放每日聚合。
- `appPackageDaily` → 落地页、下载、安装、启动聚合。

无法识别站点的历史数据写入 `LEGACY_SITE`；没有渠道的历史数据写入 `NATURAL`。

### 阶段 C：上线新后台

1. 新后台读取 `/api/v2/admin/analytics/*`。
2. 旧统计页面隐藏但保留访问开关。
3. 连续观察 7 天。
4. 新旧 PV、UV、点击误差不得超过约定范围。

### 阶段 D：清理旧结构

1. 停止双写。
2. 备份旧数据库。
3. 删除不再使用的访客数组。
4. 删除投放计划前端入口和接口。
5. 保留只读迁移脚本和回滚包。

## 13. 开发阶段与任务拆分

### 第一阶段：渠道与事件基础

- [ ] 新增站点管理数据结构。
- [ ] 拆分导航渠道和广告渠道。
- [ ] 实现首次渠道、最近渠道归因。
- [ ] 实现 `NATURAL` 和 `UNKNOWN`。
- [ ] 所有导航事件增加 `siteId` 和 `navChannelId`。
- [ ] 广告 SDK 增加 `siteId`、`navChannelId`、`adChannelId`。
- [ ] 建立统一批量事件接口。
- [ ] 添加接口限流和幂等去重。

### 第二阶段：聚合与查询

- [ ] 建立明细事件存储。
- [ ] 建立每日和小时聚合。
- [ ] 编写历史数据迁移脚本。
- [ ] 实现总览查询接口。
- [ ] 实现渠道、内容、来源、搜索查询接口。
- [ ] 增加分页、排序和 CSV 导出。
- [ ] 增加缓存和缓存失效机制。

### 第三阶段：后台重构

- [ ] 侧边栏缩减为六个一级菜单。
- [ ] 新增全局筛选栏。
- [ ] 重做数据总览。
- [ ] 新增导航分析五个标签页。
- [ ] 合并内容管理。
- [ ] 合并应用与站点。
- [ ] 删除投放计划入口。
- [ ] 增加渠道详情和内容详情。

### 第四阶段：切换与清理

- [ ] 新旧数据连续对账 7 天。
- [ ] 修复异常渠道和自然流量归类。
- [ ] 切换新后台为默认入口。
- [ ] 停止旧结构写入。
- [ ] 清理历史访客数组。
- [ ] 部署数据库定时维护任务。
- [ ] 完成备份和回滚演练。

## 14. 验收标准

### 14.1 渠道归因

- 使用 `?cid=NAV_A001` 打开导航后，页面访问和图标点击均归入 `NAV_A001`。
- 切换分类、刷新页面后渠道不丢失。
- 没有 `cid` 的新访客归入 `NATURAL`。
- 非法渠道归入 `UNKNOWN`。
- 同一用户通过第二个渠道进入后，首次渠道不变，最近渠道更新。

### 14.2 内容统计

- 图标、Banner、交友、弹窗和飘窗使用统一口径。
- 内容未进入可视区域时不计算展示。
- 同一访客重复展示正确计入展示，但每日展示 UV 只计一次。
- CTR 与展示、点击数据可人工复算。

### 14.3 广告统计

- 广告请求同时保留导航来源渠道和广告媒体渠道。
- 可以按媒体、站点、广告位、产品和渠道筛选。
- 产品点击明细可以追溯到媒体和导航渠道。

### 14.4 性能

- 数据总览首屏接口 P95 小于 800ms。
- 每日趋势查询 P95 小于 1s。
- 后台首屏不再加载全部历史明细。
- 所有长列表必须服务端分页，每页默认 20 条。
- 数据库不再因唯一访客数组无限增长。

### 14.5 数据一致性

- 新旧系统并行期间，PV 误差小于 2%。
- UV 误差小于 3%。
- 点击量误差小于 1%。
- 每日数据在次日 00:15 后稳定。

## 15. 监控与异常处理

后台异常提醒至少包含：

- 某站点连续 30 分钟无事件。
- 某渠道流量较近 7 日同期下降超过 70%。
- 广告请求有量但填充率低于 20%。
- 内容有展示但连续 24 小时无点击。
- 图片或广告资源加载错误率超过 5%。
- 批量事件接口错误率超过 1%。
- 聚合任务超过预定时间未完成。

## 16. 安全与隐私要求

- 不在统计库保存原始 IP。
- 访客 ID 服务端加盐哈希。
- 来源地址过滤账号、Token 等敏感查询参数。
- 搜索词限制长度并过滤控制字符。
- 管理接口必须鉴权。
- CSV 导出记录操作日志。
- API Key 只展示掩码，复制操作需要管理员权限。
- 前端传入的站点、渠道和内容 ID 必须由服务端校验。

## 17. 回滚方案

每个阶段发布前必须完成：

1. 备份数据库。
2. 保留上一版本 API 和后台静态文件。
3. 新事件接口异常时切回旧事件接口。
4. 新后台异常时将管理后台软链接切回上一版本。
5. 聚合结果异常时重新从 30 天事件明细生成，不直接手工修改总计。

回滚只切换读写入口，不删除新数据；确认问题后可以重新聚合并再次上线。

## 18. 最终结果

重构完成后，管理员应能通过一个统一筛选栏完成以下分析：

```text
选择日期和导航站
→ 选择导航推广渠道
→ 查看该渠道带来的 PV、UV 和会话
→ 查看用户浏览了哪些分类
→ 查看具体图标、Banner、交友卡片的展示与点击
→ 查看点击了哪个广告产品
→ 继续查看落地页、下载、安装和启动转化
```

系统最终只保留一套统计口径、一套内容行为模型和明确分离的两类渠道，避免重复页面、重复指标和渠道含义混乱。
