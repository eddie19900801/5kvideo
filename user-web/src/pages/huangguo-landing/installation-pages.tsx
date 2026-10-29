import { useEffect, useMemo, useState } from "react";
import type { ProductRuntime } from "@/services/productRuntime";
import { analytics } from "@/services/analytics";
import { HuangguoImage } from "./assets";
import "./installation-pages.css";

function useDownload(product: ProductRuntime, platform: "ios" | "android") {
  const channel=useMemo(()=>new URLSearchParams(location.search).get("channel")||"direct",[]),[url,setUrl]=useState("");
  useEffect(()=>{const load=async(code:string)=>{const r=await fetch(`/vdo-api/v1/products/${product.slug}/channels/${code}/config?_=${Date.now()}`,{cache:"no-store"});if(!r.ok)throw 0;const d=(await r.json()).data;return platform==="ios"?d.iosUrl:d.androidUrl};void load(channel).catch(()=>load("direct")).then(setUrl).catch(()=>{})},[channel,platform,product.slug]);
  return()=>{if(!url)return;void analytics.report("app_download_click",{metadata:{product:product.slug,productSlug:product.slug,productId:product.id,channel,platform}});location.href=url};
}

export function HuangguoIosStore({product}:{product:ProductRuntime}){const install=useDownload(product,"ios");return <main className="hg-ios-store" onClick={install}>
  <section className="hg-store-app"><HuangguoImage asset="installIcon"/><div><h1>{product.name}</h1><p>应用大小：14.4M</p><button onClick={install}>立即安装</button></div></section>
  <p className="hg-store-alert">1，步骤：如果没有自动跳转，请按照以下步骤安装：【设置 → 通用 → VPN与设备管理 → {product.name} → 安装】<br/>2，若60秒后没弹出安装APP，请点击右上角刷新页面。</p>
  <section className="hg-store-score"><div><b>4+</b><span>年龄</span></div><div><b>4.9</b><span>★★★★★　100000个评分</span></div></section>
  <section><h2>简介</h2><p>{product.name}，用 AI 重塑短剧的无限可能！</p></section><section><h2>评分及评论</h2><div className="hg-rating"><b>4.9</b><span>★★★★★<br/>9999个评分</span></div></section><section><h2>新功能</h2><p>新版本：1.0</p></section>
  <section><h2>信息</h2><dl><dt>销售商</dt><dd>{product.name}</dd><dt>大小</dt><dd>14.4M</dd><dt>兼容性</dt><dd>需要 iOS 11.0 或更高版本</dd><dt>语言</dt><dd>简体中文</dd><dt>价格</dt><dd>免费</dd></dl></section>
  </main>}

export function HuangguoAndroidInstallation({product}:{product:ProductRuntime}){const groups=[{text:"4. 关于未知来源应用：点击允许即可。",assets:["apk41","apk42"] as const},{text:"5. 关于手机管家纯净模式：出现确认选项时点击允许。",assets:["apk51","apk52"] as const},{text:"6. 关于安装扫描：请耐心等待扫描完成。",assets:["apk61","apk62"] as const}];return <main className="hg-android-guide"><header><button onClick={()=>history.back()}>‹</button><h1>各型手机安装教程</h1></header><div className="hg-android-body"><p>1. 浏览器网页报红属于浏览器安全提醒，请确认来源后继续。</p><p>2. 点击下载无响应时，请切换网络后重试。</p><p>3. 下载速度缓慢时，建议切换网络。</p>{groups.map(g=><section key={g.text}><p>{g.text}</p>{g.assets.map(a=><HuangguoImage key={a} asset={a}/>)}</section>)}<p>7. 安装完成后若第一次打开失败，请退出程序、切换网络后重新打开 {product.name}。</p></div></main>}
