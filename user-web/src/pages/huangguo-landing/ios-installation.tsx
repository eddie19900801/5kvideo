import { useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import type { ProductRuntime } from "@/services/productRuntime";
import { analytics } from "@/services/analytics";
import { HuangguoImage } from "./assets";
import "./ios-installation.css";

export default function HuangguoIosInstallation({ product }: { product: ProductRuntime }) {
  const channel = useMemo(() => new URLSearchParams(location.search).get("channel") || "direct", []);
  const [ready, setReady] = useState(false);
  useEffect(() => { const load=async(code:string)=>{const r=await fetch(`/vdo-api/v1/products/${product.slug}/channels/${code}/config?_=${Date.now()}`,{cache:"no-store"});if(!r.ok)throw 0;return true};void load(channel).catch(()=>load("direct")).then(setReady).catch(()=>{}) }, [channel, product.slug]);
  const download = () => { if(!ready)return;void analytics.report("app_download_click",{metadata:{product:product.slug,productSlug:product.slug,productId:product.id,channel,platform:"ios"}});location.href=`/ios.html${location.search}` };
  const goBack = (event: MouseEvent) => { event.stopPropagation();if(history.length>1)history.back();else location.href=`/${location.search}` };
  return <main className="hg-install-page" onClick={download}>
    <header><button type="button" onClick={goBack} aria-label="返回">‹</button><h1>下载与安装教程</h1></header>
    <section className="hg-install-content"><div className="hg-install-product"><div><HuangguoImage asset="installIcon" className="hg-install-icon"/><strong>{product.name}</strong></div><button type="button" disabled={!ready}>下载</button></div>
      <h2>下载后请先安装描述文件</h2><div className="hg-install-steps"><HuangguoImage asset="installStep1" alt="设置里点击通用"/><HuangguoImage asset="installStep2" alt="点击 VPN 与设备管理"/><HuangguoImage asset="installStep3" alt={`点击${product.name}描述文件`}/><HuangguoImage asset="installStep4" alt="点击右上角安装"/></div>
    </section>
  </main>;
}
