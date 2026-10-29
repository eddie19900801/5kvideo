import { useEffect, useMemo, useState } from "react";
import type { ProductRuntime } from "@/services/productRuntime";
import { analytics } from "@/services/analytics";
import { HaijiaoImage } from "./assets";
import "./ios-store.css";

type Config={iosUrl:string};
export default function HaijiaoIosStore({product}:{product:ProductRuntime}){
  const channel=useMemo(()=>new URLSearchParams(location.search).get("channel")||"direct",[]);
  const[config,setConfig]=useState<Config|null>(null);
  useEffect(()=>{document.title="海角社区";const load=async(code:string)=>{const r=await fetch(`/vdo-api/v1/products/${product.slug}/channels/${code}/config?_=${Date.now()}`,{cache:"no-store"});if(!r.ok)throw 0;return(await r.json()).data};void load(channel).catch(()=>load("direct")).then(setConfig)},[channel,product.slug]);
  const install=()=>{if(!config)return;void analytics.report("app_download_click",{metadata:{product:product.slug,productSlug:product.slug,productId:product.id,channel,platform:"ios"}});location.href=config.iosUrl};
  return <main className="hj-ios" onClick={install}>
    <section className="hj-ios-app"><HaijiaoImage asset="logo"/><div><h1>海角社区</h1><p>应用大小：14.4M</p><button disabled={!config}>立即安装</button></div></section>
    <section className="hj-ios-notice"><p>1，<b>安装之前请确认使用苹果自带的 Safari 浏览器打开，否则无法正常下载</b></p><p>2，如果没有自动跳转，请打开“设置 - 通用 - VPN 与设备管理”完成安装。</p><p>3，若 60 秒后没有弹出安装提示，请点击右上角刷新页面。</p></section>
    <section className="hj-ios-rating"><div><strong>4+</strong><span>年龄</span></div><div><strong>4.9 ★★★★★</strong><span>100000 个评分</span></div></section>
    <Info title="简介">海角社区，高清内容与高速线路，随时随地便捷观看。</Info>
    <Info title="评分及评论"><div className="hj-ios-score"><strong>4.9</strong><span>★★★★★<br/>9999 个评分</span></div></Info>
    <Info title="新功能">新版本：1.0</Info>
    <Info title="信息"><dl><dt>销售商</dt><dd>海角社区</dd><dt>大小</dt><dd>14.4M</dd><dt>兼容性</dt><dd>需要 iOS 11.0 或更高版本</dd><dt>语言</dt><dd>简体中文</dd><dt>价格</dt><dd>免费</dd></dl></Info>
  </main>;
}
function Info({title,children}:{title:string,children:React.ReactNode}){return <section className="hj-ios-info"><h2>{title}</h2><div>{children}</div></section>}
