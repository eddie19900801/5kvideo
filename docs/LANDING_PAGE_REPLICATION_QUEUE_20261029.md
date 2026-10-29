# 落地页逐站复刻任务清单

创建时间：2026-10-29（Asia/Bangkok）

## 执行原则

本清单中的落地页必须逐个、独立复刻。每个任务均执行以下完整流程：

1. 保存原始 URL、查询参数、渠道参数和最终跳转地址。
2. 分别采集 PC、Android、iPhone 页面截图、DOM、CSS、交互和网络资源。
3. 识别产品名称、产品图标、页面断点、下载方式及安装引导。
4. 不复制反调试跳转、第三方统计密钥、恶意脚本或第三方接口密钥。
5. 原始图片仅进入本地私有素材目录，不部署明文素材。
6. 素材转存到 `spovhe.cn`，以 AES-GCM 加密资源发布。
7. 独立创建产品线、产品标识、运行配置、APP 域名和落地页域名。
8. 保留 `channel`、`dc`、`aff`、`chan`、`code`、`cCode`、`_c`、`ch` 等来源参数，并映射为本系统渠道归因。
9. 生成自然渠道及后台已有渠道的落地页、APK、iOS 描述文件和下载地址。
10. 接入落地页访问、按钮点击、下载、安装激活和启动统计。
11. 分别验证 390×844、430×932、1366×768、1920×1080。
12. 验证图片无裂图、加载有骨架、HTTPS 正常、APK/iOS 可下载、二维码正确。
13. 发布后保存验收截图、版本号、资源清单和回滚版本。

## 状态定义

- `待采集`：尚未开始。
- `采集中`：正在保存页面、素材和交互。
- `开发中`：正在实现独立模板和配置。
- `待发布`：代码完成，等待域名、证书或构建。
- `待验收`：已上线，等待 PC/H5 和下载链路验证。
- `已完成`：全部验证通过。
- `不可访问`：源站失效、地区限制或必须额外授权。
- `重复`：与清单中另一条 URL 完全相同。

## 常规落地页

| ID | 状态 | 原始地址 | 备注 |
|---:|---|---|---|
| LP-001 | 已完成 | https://static-wh-231101.uiov1.com/?channel=U6II14 | 已发布至 `madou.download.wflhc.cn`，保留 `channel` |
| LP-002 | 已完成 | https://static-wh-580709.s8r1g.com/?channel=O7yLNH | 已发布至 `huangguo.download.wflhc.cn`，保留 `channel` |
| LP-003 | 已完成 | https://img-cache-072137.3zm8j.com/?channel=EU5bkG | 已发布至 `haijiao.download.wflhc.cn`，保留 `channel` |
| LP-004 | 已完成 | https://ew.eqznkgthhehfoahrgkupnelojn.com/fhs2/28456/lS53gK | 已发布至 `modelmedia.download.wflhc.cn`，路径末段映射渠道 |
| LP-005 | 已完成 | https://m-res-418478.35n7s.com/?channel=tWFqC2 | 已发布至 `yinmu91.download.wflhc.cn`，保留 `channel` |
| LP-006 | 待采集 | https://a52.upcissxzgwmvsswhqyttwchdls.com/hz8kq/57334/9fb9Q8 | 路径型渠道 |
| LP-007 | 已完成 | https://edge-ws-94303.8l0bi.com/?channel=LmS5KR | 萝莉岛，已发布至 `lolidao.download.wflhc.cn`；真实图标从原 APK 提取并写入 APK/iOS 包 |
| LP-008 | 已完成 | https://9x.azcumgmyqwfmgbuptfbnnadvrj.com/kz6dh/72080/wvcDNi | SM社区；复用后台同名产品 `smshequ`，不重复创建；已发布至 `smshequ.download.wflhc.cn` |
| LP-009 | 已完成 | https://cvm.gkeqczlyrdddzapncquezrckwh.com/gkm3p/64698/gaKaBW | 暗黑抖阴；已发布至 `anheidouyin18.download.wflhc.cn`，APK 真实图标已提取 |
| LP-010 | 重复 | https://atk.ysznhmxqhgdfrazokutafmrbpn.com/djkfe/8313/y1bVjL | 识别为“17岁”，后台已有完全同名产品 `17sui`，按规则跳过 |
| LP-011 | 采集中 | https://d3s1kk3g0b9wiu.cloudfront.net/?dc=yjwxmgs | 识别为“逼哩逼哩”，后台无完全同名产品，继续制作并保留 `dc` |
| LP-012 | 待采集 | https://8fde.ln9llwwv.cc/chan-6159/aff-nd7Wx | 路径型渠道 |
| LP-013 | 待采集 | https://fsadsf3g43g.pxz5y9.com/dy-tdy1506 | 路径型渠道 |
| LP-014 | 待采集 | https://52c67.hj52u93m.com/chan/GS4747/aU92s | 路径型渠道 |
| LP-015 | 待采集 | https://mmxz.gcpfvrehlh.vip/?_c=xmflxb | 保留 `_c` |
| LP-016 | 待采集 | https://846a.khnbeh5gc.cc/aff-fFRGU | 路径型渠道 |
| LP-017 | 待采集 | https://3b737.0lmbi8ar.cc/chan/GS6735/m2UZB | 路径型渠道 |
| LP-018 | 待采集 | https://dshnlf0acb1n2.cloudfront.net/?dc=yjwxmgs07 | 保留 `dc` |
| LP-019 | 待采集 | https://28304.kqdlx2k14.cc/aff-eRqTD | 路径型渠道 |
| LP-020 | 重复 | https://846a.khnbeh5gc.cc/aff-fFRGU | 与 LP-016 相同，保留原始记录但不重复开发 |
| LP-021 | 待采集 | https://hfwmeish.cc/?cCode=c1deddfc6e9e5329cd0e9913c3b4be7c | 保留 `cCode` |
| LP-022 | 待采集 | https://d3r7pu6nh7q7vg.cloudfront.net/?dc=hrkzngss | 保留 `dc` |
| LP-023 | 待采集 | https://d3ikot94o90fwu.cloudfront.net/?dc=KYOHLIAW | 保留 `dc` |
| LP-024 | 待采集 | https://d1pro9it16xrbj.cloudfront.net/?dc=GW6Al8GV | 保留 `dc` |
| LP-025 | 待采集 | https://coffee.5zzx6ko.com/?_c=xpfk115tx | 保留 `_c` |
| LP-026 | 待采集 | https://daw3xqm04zuns.cloudfront.net/?dc=CZZ29825 | 保留 `dc` |
| LP-027 | 待采集 | https://cxkmwj.g45mzx0.com/xgys-npjnwydi | 路径型渠道 |
| LP-028 | 待采集 | https://d3n0ifaw77lbny.cloudfront.net/?dc=mvhsijbd | 保留 `dc` |
| LP-029 | 待采集 | https://d22tj1j5cuqqy8.cloudfront.net/?dc=CZZ29827 | 保留 `dc` |
| LP-030 | 待采集 | https://da86o9ekiq7bn.cloudfront.net/?dc=CZZ29826 | 保留 `dc` |
| LP-031 | 待采集 | https://92815.jzgcopdz.cc/chan/ak0017/acSMd | 路径型渠道 |
| LP-032 | 待采集 | https://04e2.ilmngymu.cc/chan/ak0013/aczZJ | 路径型渠道 |
| LP-033 | 待采集 | https://dn246e9f12v5d.cloudfront.net/?dc=XMCPT | 保留 `dc` |
| LP-034 | 待采集 | https://d1talkbjsk4wt1.cloudfront.net/?dc=yjwxmgs04a | 保留 `dc` |
| LP-035 | 待采集 | https://e5tz.mjepihrp.shop/?dc=GIGI05 | 保留 `dc` |
| LP-036 | 待采集 | https://ba5.ccuk78c7c.cc/chan/ak0030/ZDvc | 路径型渠道 |
| LP-037 | 待采集 | https://39b31.ywafrtcpf.cc/chan/lldapp1951/PTWs | 路径型渠道 |
| LP-038 | 待采集 | https://b0eeb.tauyhggx.com/chan/st1399/qTQA | 路径型渠道 |
| LP-039 | 待采集 | https://6b6c.wrysinpj.com/ | 无显式渠道参数 |
| LP-040 | 待采集 | https://cf11.rquejmzs.com/ | 无显式渠道参数 |
| LP-041 | 待采集 | https://059c.lrgzpwofz.com/ | 无显式渠道参数 |
| LP-042 | 待采集 | https://395a11.aftrhitnn.cc/#/ | Hash 路由 |
| LP-043 | 待采集 | https://zevy.sryjohqj.vip/ | 无显式渠道参数 |
| LP-044 | 待采集 | https://0ff32.mhmpspzx.com/ | 无显式渠道参数 |
| LP-045 | 待采集 | https://102a5.mcyorcrp.cc/ | 无显式渠道参数 |
| LP-046 | 待采集 | https://d12wiheauzp6nk.cloudfront.net/ | 无显式渠道参数 |
| LP-047 | 待采集 | https://0dcd.gukxtol.cc/ | 无显式渠道参数 |
| LP-048 | 待采集 | https://be6.csxisbuq.com/ | 无显式渠道参数 |
| LP-049 | 待采集 | https://down.51sp.app/aff-fldh | 路径型渠道 |
| LP-050 | 待采集 | https://down.91md.app/aff-fldh | 路径型渠道 |
| LP-051 | 待采集 | https://down.taoziapp.com/aff-fldh | 路径型渠道 |
| LP-052 | 待采集 | https://down.51pf.app/aff-fldh | 路径型渠道 |
| LP-053 | 待采集 | https://down.zmq.app/aff-fldh | 路径型渠道 |
| LP-054 | 待采集 | https://mgdjai.com/landing/Df6h5bb5 | 路径型渠道 |
| LP-055 | 待采集 | https://mtdjgw.com/ | 无显式渠道参数 |
| LP-056 | 待采集 | https://gpvu.wcfzjhbf.vip/?code=3Q17Y3M4YD | 保留 `code` |
| LP-057 | 待采集 | https://d2dw7qg9qboajg.cloudfront.net/?dc=swmvhmif | 保留 `dc` |
| LP-058 | 待采集 | https://lnophq.phxelbnofh.vip/?ch=u0AJtemD | 保留 `ch` |
| LP-059 | 待采集 | https://cdn-node-306509.n50hx.com/?channel=KRkdbA | 保留 `channel` |
| LP-060 | 待采集 | https://af0.fothj4vt.cc/aff-kaJHa | 路径型渠道 |
| LP-061 | 待采集 | https://cdn-sh-374041.fkblf.com/?channel=dElgKy | 保留 `channel` |
| LP-062 | 待采集 | https://46df.3h3otesx.cc/chan/GS5182/bf3cY | 路径型渠道 |
| LP-063 | 待采集 | https://00bb.h7w8igape.cc/chan/tk2080/VGWPe | 路径型渠道 |

## 交付记录

### LP-001 · 麻豆短剧

- 完成时间：2026-10-29（Asia/Bangkok）
- 产品标识：`madou`
- 产品主页：`https://madou.app.wflhc.cn/`
- 落地页：`https://madou.download.wflhc.cn/`
- Android 包名：`cn.k897kg.madou`
- 产品 ID：`80df18c6-953a-43e2-aaa0-a5897e3daf57`
- 发布版本：`1`
- 前端版本：`20261029-madou-v1`
- 加密资源：40 个页面图片资源，统一存储在 `spovhe.cn` 的 `landing` 项目中。
- 渠道归因：支持 `channel`、`cid`、`dc`、`utm_source`，无匹配渠道时回退自然流量，不丢失落地页展示统计。
- 验收：HTTPS、H5、PC、轮播、标签切换、骨架加载、二维码、渠道配置、Android/iOS 下载配置均已验证。
- 验收截图：`madou-live-mobile.png`、`madou-live-desktop.png`。

### LP-002 · 黄果短剧

- 完成时间：2026-10-29（Asia/Bangkok）
- 产品标识：`huangguo`
- 产品主页：`https://huangguo.app.wflhc.cn/`
- 落地页：`https://huangguo.download.wflhc.cn/`
- Android 包名：`cn.k897kg.huangguo`
- 产品 ID：`787396fe-f25e-4926-a96c-a5fd3fc77697`
- 发布版本：`1`
- 前端版本：`20261029-huangguo-v1`
- 加密资源：23 个产品页面与交互素材，统一存储在 `spovhe.cn` 的 `landing` 项目中。
- 渠道归因：识别 `channel`、`cid`、`dc`、`utm_source`；原始渠道值进入落地页行为统计，未建档渠道下载回退自然流量。
- 验收：独立 HTTPS 证书、H5 长图、PC 横版、骨架加载、Android APK、iOS 描述文件、独立 `ios-installation.html` 安装教程和下载配置均已验证。
- 验收截图：`huangguo-live-mobile.png`、`huangguo-live-desktop.png`。

### LP-003 · 海角

- 完成时间：2026-10-29（Asia/Bangkok）
- 产品标识：`haijiao`
- 产品主页：`https://haijiao.app.wflhc.cn/`
- 落地页：`https://haijiao.download.wflhc.cn/`
- iOS 安装页：`https://haijiao.download.wflhc.cn/ios.html`
- Android 包名：`cn.k897kg.haijiao`
- 产品 ID：`3610800c-b72c-4dab-843c-d8af56dea138`
- 发布版本：`1`
- 前端版本：`20261029-haijiao-final`
- 加密资源：22 个页面图片资源，统一存储在 `spovhe.cn` 的 `landing` 项目中，线上不保存明文素材。
- 渠道归因：保留 `channel`，不存在的渠道回退自然流量；落地页展示和下载点击仍记录原始渠道值。
- 验收：独立 HTTPS 证书、H5 长页、PC 横版、图片骨架、二维码、Android APK、iOS 描述文件及独立 `ios.html` 安装页均已验证。
- 验收截图：`haijiao-live-mobile-final.png`、`haijiao-live-desktop-final2.png`、`haijiao-live-ios-final.png`。

### LP-004 · 麻豆传媒映画

- 完成时间：2026-10-29（Asia/Bangkok）
- 产品标识：`modelmedia`
- 产品主页：`https://modelmedia.app.wflhc.cn/`
- 落地页：`https://modelmedia.download.wflhc.cn/fhs2/28456/lS53gK`
- Android 包名：`cn.k897kg.modelmedia`
- 产品 ID：`6d1e5d80-30a8-4c5b-ae0d-ed8062c10657`
- 前端版本：`20261029-modelmedia-v1`
- 加密资源：24 个页面素材存储于 `spovhe.cn` 的 `landing` 项目，服务器不保存明文线上资源。
- 渠道归因：路径末段 `lS53gK` 自动作为渠道值；未知渠道下载回退自然流量。
- 验收：独立 HTTPS、H5、PC、加密图片、二维码、运行配置与下载配置均已验证。
- 验收截图：`modelmedia-live-mobile.png`、`modelmedia-live-desktop.png`。

## 动漫落地页

| ID | 状态 | 原始地址 | 备注 |
|---:|---|---|---|
| AN-001 | 待采集 | https://d2id8gz94of19h.cloudfront.net/?dc=jhyhmh212 | 保留 `dc` |
| AN-002 | 待采集 | https://2cf8.jmy3mtl8u.cc/chan/jm0126/aaTfX | 路径型渠道 |
| AN-003 | 待采集 | https://d1bmq6h6lqghij.cloudfront.net/?dc=yjwxmgs01 | 保留 `dc` |
| AN-004 | 待采集 | https://dpf8i6v7w6h85.cloudfront.net/?dc=yjwxmgs10 | 保留 `dc` |
| AN-005 | 待采集 | https://d381f6jxkxh8vq.cloudfront.net/slf-tslf939 | 路径型渠道 |
| AN-006 | 待采集 | https://d34gzyjtmo63su.cloudfront.net/?dc=zesqlxte | 保留 `dc` |
| AN-007 | 待采集 | https://d298veicgq9t8a.cloudfront.net/?dc=dymhbjkio1p | 保留 `dc` |
| AN-008 | 待采集 | https://txmh04ko.sdq3l1.com/uusp-refgmsry | 路径型渠道 |
| AN-009 | 待采集 | https://down.51wm.app/aff-fldh | 路径型渠道 |
| AN-010 | 待采集 | https://17306.a167tswd0.cc/chan/ak0047/ZD4K | 路径型渠道 |
| AN-011 | 待采集 | https://d32z73zpx6tgkz.cloudfront.net/?appId=30&dc=tprbwzsp | 同时保留 `appId`、`dc` |

## 汇总

- 原始记录：74 条。
- 完全重复：1 条（LP-020 与 LP-016）。
- 已完成：5 个。
- 独立待复刻页面：68 个。
- 常规独立页面：62 个。
- 动漫页面：11 个。

## 单站交付记录模板

每完成一个任务，在该任务下补充：

```text
产品名称：
产品标识：
参考地址：
模板代码：
APP 域名：
落地页域名：
产品图标加密地址：
素材项目及资源数量：
Android APK：
iOS 描述文件：
自然渠道链接：
原始渠道参数映射：
前端发布版本：
后端配置版本：
移动端验收截图：
PC 端验收截图：
性能结果：
发布状态：
备注：
```

