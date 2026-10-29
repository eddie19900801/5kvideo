# 产品落地页复刻、渠道包与发布流程

更新时间：2026-10-28（Asia/Bangkok）

本文说明从参考落地页开始，完成新产品落地页、产品图标、CDN 加密资源、渠道链接、APK、iOS 书签、统计和线上部署的完整流程。目标是让后续新增产品可以按固定步骤交付，不再遗漏图标、缓存、渠道或统计。

## 1. 项目与线上位置

### 本地源码

- 视频前端与产品落地页：`E:\5kvideo\5knews`
- 后端、管理后台、Android 壳：`E:\5kvideo\5KVIDEO`
- 产品落地页实现：`E:\5kvideo\5knews\src\pages\product-landing`
- 产品运行配置：`E:\5kvideo\5knews\src\services\productRuntime.ts`
- Android 壳：`E:\5kvideo\5KVIDEO\channel-app\android`
- 产品线后台：`E:\5kvideo\5KVIDEO\admin-web\src\ProductLineManager.tsx`
- 产品与渠道接口：
  - `server/src/routes/productLines.ts`
  - `server/src/routes/channels.ts`
  - `server/src/services/productPackages.ts`

### 线上部署

- 前端服务器：`156.224.147.194:11870`
- 前端当前版本：`/www/wwwroot/5knews-web-current`
- 前端历史版本：`/www/wwwroot/5knews-releases/<release-name>`
- 中台/API 服务器：`154.91.16.130:43771`
- 后端源码：`/root/5kvideo-release/server`
- 后端数据：`/root/5kvideo-release/server/data`
- 视频后台当前版本：`/opt/5k-middle-platform/admin/5kvideo-admin-current`
- 视频后台版本目录：`/opt/5k-middle-platform/admin/5kvideo-admin-releases`
- Android 构建工程：`/opt/5k-product-builder/project/android`
- Android 产品图标：`/opt/5k-product-builder/icons/<product-slug>.png`
- APK 产物：`/root/5kvideo-release/server/data/product-packages/<product-slug>`
- 产品包清单：`/root/5kvideo-release/server/data/product-package-manifests/<product-slug>.json`

不要把 SSH 密码、资源中心管理员 Token、加密密钥写入本文或提交到 Git。

## 2. 复刻前先确认的产品资料

开始开发前至少确认：

1. 产品名称，例如“91学院”。
2. 产品标识 `slug`，只能包含小写字母、数字和中划线，例如 `91xueyuan`。
3. 参考落地页 URL。
4. 产品图标来源。
5. APP 主域名与落地页主域名。
6. 商务联系、客服链接。
7. Android 和 iOS 按钮的文案与交互。
8. 是否需要 PC 版、H5 版以及两端的差异。
9. 推荐内容关键词或分类。

系统自动生成：

- APP 域名：`<slug>.app.<主域名>`
- 落地页域名：`<slug>.download.<主域名>`
- Android 包名：`cn.k897kg.<slug>`；数字开头时自动加 `p`
- 主题颜色：从系统预置颜色中生成

## 3. 参考落地页采集与 1:1 复刻

### 3.1 采集内容

在桌面端和移动端分别保存：

- 完整页面截图。
- DOM 结构和主要 CSS。
- 页面宽度、容器宽度和断点。
- 字体、字号、字重、行高。
- 背景、渐变、圆角、阴影和间距。
- 首屏图片、人物图、标题图、装饰图和按钮图。
- 轮播速度、切换方式、按钮行为和安装引导。
- PC 二维码区域和 H5 下载按钮。

只复制已获授权的资源和样式。不要依赖参考站运行时地址，避免对方改域名后本项目失效。

### 3.2 实现要求

- PC 与 H5 分开校验，不用一套尺寸强行缩放。
- 使用参考页的实际比例，不根据截图猜固定高度。
- 移动端必须验证 320、375、390、430 像素宽度。
- PC 至少验证 1366×768 和 1920×1080。
- 所有图片区域先显示骨架，不显示裂图图标。
- 下载按钮在渠道配置尚未返回时必须禁用。
- 商务和客服链接从产品配置读取或使用统一配置，不能散落硬编码。

当前 91学院模板位于：

```text
E:\5kvideo\5knews\src\pages\product-landing
```

新增不同模板时，应建立 `slug -> LandingComponent` 的模板注册表。不要继续在 `App.tsx` 中堆积大量 `if (slug === ...)`。

## 4. 图片资源与 CDN 加密

### 4.1 基本原则

- 线上页面不得引用参考站原始图片 URL。
- 静态图片上传到 `spovhe.cn` 资源中心。
- 数据库保存 `.enc` 加密资源链接。
- 页面获取项目客户端解密密钥，在浏览器内 AES-GCM 解密为临时 Blob URL。
- Blob URL 在组件卸载时必须 `URL.revokeObjectURL()`。
- 图片解密前显示骨架；失败时显示占位，不显示浏览器裂图。
- 原始素材仅放本地私有素材目录，不部署到 Web 根目录。

当前本地原始素材目录示例：

```text
E:\5kvideo\5knews\.private-source-assets\91xueyuan
```

当前通用解密组件：

```text
E:\5kvideo\5knews\src\components\EncryptedAssetImage.tsx
E:\5kvideo\5KVIDEO\admin-web\src\EncryptedAssetImage.tsx
```

### 4.2 加密资源链接格式

```text
https://spovhe.cn/v1/assets/<project>/<asset-id>.enc
```

客户端密钥接口：

```text
https://spovhe.cn/v1/assets/<project>/client-key
```

资源文件必须返回正确 CORS。当前产品落地页使用 `landing` 项目。

## 5. 产品图标处理

产品图标必须在以下位置保持一致：

1. 产品线管理列表。
2. 视频前端左上角。
3. 下载页面。
4. 落地页头部。
5. Android 桌面图标。
6. Android 系统启动页和原生启动页。
7. iOS Web Clip 主屏幕图标。

### 5.1 图标制作

- 优先从落地页官方 Logo 中精确裁切，不用 AI 重新绘制品牌 Logo。
- 建议源文件为方形 PNG，至少 512×512。
- 图形四周保留安全边距，避免 Android 圆角遮罩裁掉主体。
- 禁止直接把横向 Logo 拉伸成方形。
- 最终检查浅色、深色背景和小尺寸显示效果。

### 5.2 图标上传和配置

1. 将方形 PNG 上传至 `spovhe.cn` 的 `landing` 项目。
2. 得到 `.enc` 链接。
3. 将链接写入产品线的 `iconUrl`。
4. 发布产品，使 `publishedConfig.iconUrl` 同步更新。
5. 产品线后台和前端用加密图片组件显示，不能直接 `<img src="*.enc">`。
6. Android 构建时，将同一原图放到构建机：

```text
/opt/5k-product-builder/icons/<slug>.png
```

7. iOS 描述文件由后端读取产品图标并写入 `<key>Icon</key><data>...</data>`。

91学院当前加密图标示例：

```text
https://spovhe.cn/v1/assets/landing/ad5dca6d-26f6-4721-a341-c7cc9b91d919.enc
```

## 6. 产品线后台配置

后台地址：

```text
https://897kg.cc/vdo/admin/
```

操作顺序：

1. 进入“产品线管理”。
2. 新增产品并填写产品名称、产品标识和加密图标链接。
3. 配置推荐分类或多个模糊搜索关键词。
4. 保存草稿。
5. 检查自动生成的 APP 域名、落地页域名和包名。
6. 点击“发布”。
7. 发布后检查运行时配置接口。
8. 打开“渠道包”，复制对应渠道的落地页、APK 和 iOS 地址。

产品图标字段必须保存 `spovhe.cn` 加密链接。后台显示图标时由浏览器解密。

## 7. 渠道参数与链接生成

标准落地页地址：

```text
https://<slug>.download.<主域名>/?channel=<渠道号>
```

同时兼容：

- `channel=<渠道号>`（标准）
- `cid=<渠道号>`
- `utm_source=<渠道号>`

前端验证渠道号只允许字母、数字、下划线和中划线，非法值回退到 `direct`。

落地页请求：

```text
/vdo-api/v1/products/<slug>/channels/<channel>/config
```

该接口返回：

- 产品名称和图标。
- 渠道号和渠道名称。
- Android 下载地址。
- iOS 描述文件地址。
- APP 导航地址。
- 产品版本。

配置请求必须：

- 带时间戳参数。
- 使用 `cache: no-store`。
- 服务端响应 `Cache-Control: no-store, no-cache`。
- 失败时回退自然渠道 `direct`。

## 8. 落地页统计与安装归因

### 8.1 必须上报的事件

落地页打开：

```text
landing_view
```

下载按钮点击：

```text
app_download_click
```

APP 或 iOS 书签首次打开：

```text
app_open
metadata.firstOpen = true
```

每个事件必须携带：

- `productId`
- `productSlug`
- `productHost`
- `channel`
- `platform`：`web`、`android` 或 `ios`
- `installId`
- `sessionId`

### 8.2 安装量定义

浏览器无法知道系统是否真正完成 APK 安装，因此后台“安装量”统一定义为“首次启动激活”：

- Android：安装 APK 后第一次打开 APP。
- iOS：安装描述文件后第一次从主屏幕打开书签。
- 同一产品、同一平台、同一设备只记录一次首次激活。
- 安装归因到第一次启动时携带的渠道。
- 后续切换渠道不得重复计为新安装。

### 8.3 后台查看

```text
视频后台 → 产品线管理 → 产品 → 数据
```

支持按渠道查看：

- 落地页展示和独立用户。
- 下载点击和下载用户。
- 安装激活。
- 安装转化率。
- 日活、APP 用户、播放和有效播放。
- 次留、3 日留和 7 日留。

## 9. Android APK

### 9.1 启动顺序

必须保证：

```text
Android 系统启动页 → 原生启动页 → 网页 Loading → 正式页面
```

不能出现白屏。

系统启动页包含产品图标和深色背景；原生启动页包含：

- 产品图标。
- 产品名称。
- “启动中…”
- “正在连接安全线路”。

WebView 首个真实 HTTP/HTTPS 页面可见后才允许隐藏原生启动页。`about:blank` 不能触发隐藏。

### 9.2 动态域名

APK 不把最终域名永久写死。启动时请求渠道配置：

```text
/products/<slug>/channels/<channel>/config?_=<当前毫秒时间>
```

处理原则：

1. 立即打开上一次成功缓存的导航地址。
2. 后台请求最新配置。
3. 请求禁止缓存并携带时间戳。
4. 新地址保存到本地，下次启动使用。
5. 接口失败时使用缓存地址或构建时回退地址。

因此产品域名修改后不应要求用户重新下载 APK。

### 9.3 构建

构建脚本：

```text
deploy/product-package-worker.sh
deploy/setup-product-package-builder.sh
```

构建清单版本增加后，Worker 自动为自然渠道和所有渠道生成 APK。不要为了修改一个产品，错误地增加所有产品版本；应只更新目标产品清单。

## 10. iOS 书签

iOS 使用 `.mobileconfig` 安装 Web Clip：

- URL 必须携带渠道和 `app_platform=ios`。
- 描述文件内嵌产品图标。
- `FullScreen` 设置为 `true`。
- 页面 HTML 内置前置 Loading，不能等 React 加载后才出现。
- 首次从主屏幕打开时上报安装激活。

iOS Web Clip 不是真正原生 IPA，系统打开网页前可能存在极短系统过渡；HTML 返回后必须立即显示 Loading，不能显示空白页面。

## 11. 前端与后端部署

### 11.1 前端构建检查

在 `E:\5kvideo\5knews`：

```text
npm run type-check
npm run build
```

将 `out` 打包上传到前端服务器，解压到新版本目录，再原子切换：

```text
/www/wwwroot/5knews-releases/<release-name>
/www/wwwroot/5knews-web-current -> <release-name>
```

切换后执行：

```text
nginx -t
systemctl reload nginx
```

不要直接覆盖当前版本目录，否则无法快速回滚。

### 11.2 后端

本地先执行：

```text
cd E:\5kvideo\5KVIDEO\server
npm run type-check
```

上传变更源码到：

```text
/root/5kvideo-release/server
```

构建带日期和功能名的新 Docker 镜像，保留原数据卷：

```text
/root/5kvideo-release/server/data:/app/data
```

新容器启动后必须检查 `/health`，确认成功后再结束部署。

### 11.3 视频管理后台

后台构建：

```text
cd E:\5kvideo\5KVIDEO\admin-web
npm run build
```

线上正确发布位置：

```text
/opt/5k-middle-platform/admin/5kvideo-admin-releases/<release-name>
/opt/5k-middle-platform/admin/5kvideo-admin-current -> <release-name>
```

`https://897kg.cc/vdo/admin/` 使用上述中台目录，不是旧的 `/root/5kvideo-release/admin`。发布错目录会导致线上仍加载旧代码。

## 12. 缓存策略

- `index.html`：`no-cache, no-store, must-revalidate`
- 带内容哈希的 JS/CSS：长缓存并设置 `immutable`
- 产品运行配置：`no-store`
- 渠道配置：`no-store`
- APK 下载：`no-store`，避免重新打包后下载旧文件
- `.enc` 静态资源：可长缓存，因为资源 ID 变化即生成新 URL
- 修改图标时生成新资源 ID，不覆盖旧加密资源

## 13. 上线验收清单

### 产品和域名

- [ ] APP 域名 HTTPS 正常。
- [ ] 落地页域名 HTTPS 正常。
- [ ] 运行时配置返回正确产品和 `hostMode`。
- [ ] 域名修改后配置请求不会命中旧缓存。

### 页面

- [ ] PC 页面与参考页主要尺寸一致。
- [ ] H5 页面无横向滚动和错位。
- [ ] 图片加载前有骨架。
- [ ] 图片失败不显示裂图。
- [ ] 商务和客服链接正确。
- [ ] Android、iOS 下载按钮可用。

### 图标

- [ ] 产品线后台显示正确 APP 图标。
- [ ] 前端左上角显示正确 APP 图标。
- [ ] 落地页显示正确 APP 图标。
- [ ] Android 桌面图标和启动页正确。
- [ ] iOS 主屏幕图标正确。
- [ ] 数据库保存的是 CDN 加密链接。

### 渠道和统计

- [ ] 标准渠道落地页能打开。
- [ ] `channel`、`cid`、`utm_source` 能识别。
- [ ] `landing_view` 正确入库。
- [ ] `app_download_click` 正确入库。
- [ ] Android 首次启动归因正确。
- [ ] iOS 首次启动归因正确。
- [ ] 后台按渠道筛选数据正确。
- [ ] 同一设备重复启动不会重复计算安装。

### 部署

- [ ] 前端类型检查和构建通过。
- [ ] 后端类型检查通过。
- [ ] 管理后台构建通过。
- [ ] Nginx 配置检查通过。
- [ ] API `/health` 正常。
- [ ] 线上脚本哈希是本次发布版本。
- [ ] 保留上一版本目录和数据库备份以便回滚。

## 14. 常见问题

### 后台图标裂开

原因通常是把 `.enc` 直接交给 `<img>`，或后台发布到了旧目录。确认使用 `EncryptedAssetImage`，并确认线上软链接指向新版本。

### 前端仍显示默认播放图标

检查运行时配置的 `iconUrl`、浏览器是否仍运行旧 SPA、配置是否缓存，以及前端是否提供该产品的加密图标兜底。

### APK 启动白屏

检查 Android 系统启动主题、`windowBackground`、Android 12 SplashScreen 属性、原生启动 View，以及是否错误地用 `about:blank` 触发启动页隐藏。

### 修改域名后 APP 仍打开旧地址

检查配置 URL 是否带时间戳、请求和响应是否 `no-store`，以及 APP 是否先读取本地缓存再后台更新配置。

### 落地页有访问但安装为 0

安装量统计的是首次启动激活。仅下载 APK 不计安装；必须安装并第一次打开 APP，且页面需要成功发送 `app_open`。
