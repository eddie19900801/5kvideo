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
8. 保留传入的 `channel`、`dc`、`aff`、`chan`、`code`、`cCode`、`_c`、`ch` 等来源参数并用于渠道归因；没有渠道参数时使用自然流量 `direct`。
9. 产品图标必须优先下载原站 APK，并通过 `aapt dump badging` 定位后解压真实应用图标；仅当原 APK 确认无法下载或不含可用图标时，才允许使用落地页 Logo，并在该条记录中注明原因。
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
| LP-006 | 重复（已处理） | https://a52.upcissxzgwmvsswhqyttwchdls.com/hz8kq/57334/9fb9Q8 | 识别为“黄果短剧”；同产品已在 LP-002 完成复刻、部署与验收，本条不重复覆盖 |
| LP-007 | 已完成 | https://edge-ws-94303.8l0bi.com/?channel=LmS5KR | 萝莉岛，已发布至 `lolidao.download.wflhc.cn`；真实图标从原 APK 提取并写入 APK/iOS 包 |
| LP-008 | 已完成 | https://9x.azcumgmyqwfmgbuptfbnnadvrj.com/kz6dh/72080/wvcDNi | SM社区；复用后台同名产品 `smshequ`，不重复创建；已发布至 `smshequ.download.wflhc.cn` |
| LP-009 | 已完成 | https://cvm.gkeqczlyrdddzapncquezrckwh.com/gkm3p/64698/gaKaBW | 暗黑抖阴；已发布至 `anheidouyin18.download.wflhc.cn`，APK 真实图标已提取 |
| LP-010 | 已完成 | https://atk.ysznhmxqhgdfrazokutafmrbpn.com/djkfe/8313/y1bVjL | “17岁”；复用后台产品 `17岁|17sui` 并保留原分类；已发布至 `https://17sui.download.wflhc.cn/`，RC4 源资源已解包并加密入库，APK、iOS 与移动页面验收通过 |
| LP-011 | 已完成 | https://d3s1kk3g0b9wiu.cloudfront.net/?dc=yjwxmgs | “逼哩逼哩”，已发布至 `https://bilio3.download.wflhc.cn/`；保留 `dc` 渠道参数；源 APK 已失效（404），图标采用其官方站点 favicon 并加密入库；APK/iOS 与页面均验收通过 |
| LP-012 | 已完成 | https://8fde.ln9llwwv.cc/chan-6159/aff-nd7Wx | “91短视频”；复用后台产品 `91短视频|91duanship`，保留原分类；已发布至 `https://91duanship.download.wflhc.cn/`，加密资源、APK、iOS 与移动页面验收通过 |
| LP-013 | 已完成 | https://fsadsf3g43g.pxz5y9.com/dy-tdy1506 | “抖阴”；复用后台产品 `抖阴|douyin`，保留原分类；已发布至 `https://douyin.download.wflhc.cn/`，加密资源、APK、iOS 与移动页面验收通过 |
| LP-014 | 已完成 | https://52c67.hj52u93m.com/chan/GS4747/aU92s | “P站”；复用后台产品 `P站|pzhan` 并保留原分类；已发布至 `https://pzhan.download.wflhc.cn/`，加密资源、APK、iOS 与移动页面验收通过 |
| LP-015 | 已完成 | https://mmxz.gcpfvrehlh.vip/?_c=xmflxb | “杏吧”；复用后台产品 `杏吧|xingba` 并保留原分类；已发布至 `https://xingba.download.wflhc.cn/`，保留 `_c` 参数，加密资源、APK、iOS 与移动页面验收通过 |
| LP-016 | 已完成 | https://846a.khnbeh5gc.cc/aff-fFRGU | “妻友”；复用后台产品 `妻友|qiiyou` 并保留原分类；已发布至 `https://qiiyou.download.wflhc.cn/aff-fFRGU`，加密资源、APK、iOS 与移动页面验收通过 |
| LP-017 | 已完成 | https://3b737.0lmbi8ar.cc/chan/GS6735/m2UZB | “成人tiktok”；复用后台产品 `成人tiktok|chengrentiktok` 并保留原分类；已发布至 `https://chengrentiktok.download.wflhc.cn/chan/GS6735/m2UZB`，加密资源、APK、iOS 与移动页面验收通过 |
| LP-018 | 已完成 | https://dshnlf0acb1n2.cloudfront.net/?dc=yjwxmgs07 | “成人快手”；复用后台产品 `成人快手|chengrenkuaishou` 并保留原分类；已发布至 `https://chengrenkuaishou.download.wflhc.cn/?dc=yjwxmgs07`，保留 `dc`，加密资源、APK、iOS 与移动页面验收通过 |
| LP-019 | 已完成 | https://28304.kqdlx2k14.cc/aff-eRqTD | “暗网禁区”；复用后台产品 `暗网禁区|anwangjinqu` 并保留原分类；已从原站 APK `res/9w.png` 提取真实图标并加密入库、替换后台和重打渠道包；落地页、APK、iOS 与移动页面验收通过 |
| LP-020 | 重复 | https://846a.khnbeh5gc.cc/aff-fFRGU | 与 LP-016 相同，保留原始记录但不重复开发 |
| LP-021 | 已完成 | https://hfwmeish.cc/?cCode=c1deddfc6e9e5329cd0e9913c3b4be7c | “橙涩”；复用后台产品 `橙涩|chengse` 并保留原分类；发布至 `https://chengse.download.wflhc.cn/`，保留调用方传入的渠道参数并用于归因，加密资源、APK、iOS 与移动页面验收通过 |
| LP-022 | 已完成 | https://d3r7pu6nh7q7vg.cloudfront.net/?dc=hrkzngss | “Xporn”；复用后台产品 `Xporn|xporn` 并保留原分类；从原站渠道 APK 提取 `res/mipmap-xxxhdpi/ic_launcher.png` 真实图标并加密入库；发布至 `https://xporn.download.wflhc.cn/?dc=hrkzngss`，页面、APK、iOS 与渠道参数验收通过 |
| LP-023 | 已完成 | https://d3ikot94o90fwu.cloudfront.net/?dc=KYOHLIAW | “禁果短剧”；复用后台产品 `禁果短剧|jinguoduanju` 并保留原分类；从原站 APK 提取 `res/mipmap-xxhdpi/ic_launcher.webp` 真实图标并加密入库；发布至 `https://jinguoduanju.download.wflhc.cn/?dc=KYOHLIAW`，页面、APK、iOS 与渠道参数验收通过 |
| LP-024 | 已完成 | https://d1pro9it16xrbj.cloudfront.net/?dc=GW6Al8GV | “MR好色”；复用后台产品 `MR好色|mrhaose` 并保留原分类；从原站 APK 提取 `res/mipmap-xxhdpi/ic_launcher.webp` 真实图标并加密入库；发布至 `https://mrhaose.download.wflhc.cn/?dc=GW6Al8GV`，页面、APK、iOS 与渠道参数验收通过 |
| LP-025 | 已完成 | https://coffee.5zzx6ko.com/?_c=xpfk115tx | “糖心VLOG”；复用后台产品 `溏心Vlog|tangxinvlog` 并保留原分类；从原站 APK 提取 `res/9w.png` 真实图标并加密入库；发布至 `https://tangxinvlog.download.wflhc.cn/?_c=xpfk115tx`，保留来源渠道参数用于归因 |
| LP-026 | 已完成 | https://daw3xqm04zuns.cloudfront.net/?dc=CZZ29825 | “91短剧”；复用后台产品 `91短剧|91duanju` 并保留原分类；从原站 APK 提取 `res/mipmap-xxhdpi/ic_launcher.webp` 真实图标并加密入库；发布至 `https://91duanju.download.wflhc.cn/?dc=CZZ29825` |
| LP-027 | 已完成 | https://cxkmwj.g45mzx0.com/xgys-npjnwydi | “糖心漫剧”；复用后台产品 `溏心漫剧|tangxinmanju` 并保留原分类；从原站 APK 提取 `res/RJ.png` 真实图标并加密入库；发布至 `https://tangxinmanju.download.wflhc.cn/` |
| LP-028 | 已完成 | https://d3n0ifaw77lbny.cloudfront.net/?dc=mvhsijbd | “黄火短剧”；复用后台产品 `黄火短剧|huanghuoduanju` 并保留原分类；从原站 APK 提取 `res/mipmap-mdpi/ic_launcher.png` 真实图标并加密入库；发布至 `https://huanghuoduanju.download.wflhc.cn/?dc=mvhsijbd` |
| LP-029 | 已完成 | https://d22tj1j5cuqqy8.cloudfront.net/?dc=CZZ29827 | “黄瓜短剧”；复用后台产品 `黄瓜短剧|huangguaduanju` 并保留原分类；从原站 APK 提取 `res/mipmap-mdpi/ic_launcher.png` 真实图标并加密入库；发布至 `https://huangguaduanju.download.wflhc.cn/?dc=CZZ29827` |
| LP-030 | 重复（已处理） | https://da86o9ekiq7bn.cloudfront.net/?dc=CZZ29826 | 识别为“禁果短剧”；该产品已在 LP-023 完成独立页面、真实 APK 图标、加密资源、安装包和线上验收，本来源不重复覆盖产品 |
| LP-031 | 重复（已处理） | https://92815.jzgcopdz.cc/chan/ak0017/acSMd | 识别为“黄果短剧”；该产品已在 LP-002 完成复刻、iOS 安装引导、真实 APK 图标、安装包和线上验收，本渠道来源不重复覆盖产品 |
| LP-032 | 重复（已处理） | https://04e2.ilmngymu.cc/chan/ak0013/aczZJ | 识别为“黄果短剧”；该产品已在 LP-002 完整处理，本条是同产品的另一渠道模板，不重复覆盖现有产品和分类 |
| LP-033 | 已完成 | https://dn246e9f12v5d.cloudfront.net/?dc=XMCPT | “蜜柚短剧”；复用后台产品 `蜜柚短剧|miyouduanju` 并保留原分类；原站下载 API 参数异常且硬编码备用 APK 实际属于其他产品，未误用错误图标，临时采用原站品牌 Logo 加密入库；发布至 `https://miyouduanju.download.wflhc.cn/?dc=XMCPT` |
| LP-034 | 已完成 | https://d1talkbjsk4wt1.cloudfront.net/?dc=yjwxmgs04a | “撸撸短剧”；复用后台产品 `撸撸短剧|luluduanju` 并保留原分类；从原站 APK 提取 `res/mipmap-xxhdpi/ic_launcher.webp` 真实图标并加密入库；发布至 `https://luluduanju.download.wflhc.cn/?dc=yjwxmgs04a` |
| LP-035 | 已完成 | https://e5tz.mjepihrp.shop/?dc=GIGI05 | “萝幼社”；复用后台产品 `萝幼社|luoyoushe` 并保留原分类；从混淆 APK 的无扩展名资源中识别并提取 510×510 PNG 真实图标，页面截图与素材加密入库；发布至 `https://luoyoushe.download.wflhc.cn/?dc=GIGI05` |
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

