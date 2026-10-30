import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import type { ProductRuntime } from "@/services/productRuntime";
import { analytics } from "@/services/analytics";
import { bi, BiImg } from "./assets";
import "./style.css";

type Config = { androidUrl: string; iosUrl: string };

export default function Bilio({ product }: { product: ProductRuntime }) {
  const channel = useMemo(() => { const query = new URLSearchParams(location.search); return query.get("channel") || query.get("dc") || "direct"; }, []);
  const [config, setConfig] = useState<Config | null>(null);
  const [slide, setSlide] = useState(0);
  const [qr, setQr] = useState("");

  useEffect(() => {
    document.title = "逼哩逼哩官方下载";
    analytics.report("landing_view", { metadata: { product: product.slug, productId: product.id, channel, landingDevice: /iPhone|iPad/.test(navigator.userAgent) ? "ios" : /Android/.test(navigator.userAgent) ? "android" : "pc" } });
    const load = async (value: string) => { const response = await fetch(`/vdo-api/v1/products/${product.slug}/channels/${value}/config?_=${Date.now()}`, { cache: "no-store" }); if (!response.ok) throw new Error("config failed"); return (await response.json()).data; };
    load(channel).catch(() => load("direct")).then(setConfig);
    QRCode.toDataURL(location.href, { width: 180 }).then(setQr);
    const timer = setInterval(() => setSlide(value => 1 - value), 3500);
    return () => clearInterval(timer);
  }, [channel, product]);

  const download = () => { if (!config) return; const ios = /iPhone|iPad/.test(navigator.userAgent); analytics.report("app_download_click", { metadata: { product: product.slug, productId: product.id, channel, platform: ios ? "ios" : "android" } }); location.href = ios ? config.iosUrl : config.androidUrl; };

  return <main className="bi-page"><section className="bi-mobile"><BiImg id={bi.backgrounds[slide]} className="bi-bg"/><BiImg id={bi.header} className="bi-header"/><a className="bi-business" href="https://t.me/dahe68868"/><a className="bi-service" href="https://t.me/dahe68868"/><a className="bi-group" href="https://t.me/dahe68868"/>{slide === 1 && bi.tags.map((id, index) => <BiImg id={id} className={`bi-tag t${index + 1}`} key={id}/>)}<BiImg id={bi.texts[slide]} className={`bi-text s${slide + 1}`}/><button className="bi-download" onClick={download}><BiImg id={bi.buttons}/></button><button className="bi-guide" onClick={() => { location.href = `/h5-install${location.search}`; }}><BiImg id={bi.guide}/></button></section><section className="bi-pc"><div className="bi-phone"><BiImg id={bi.backgrounds[slide]} className="bi-bg"/><BiImg id={bi.header} className="bi-header"/><BiImg id={bi.texts[slide]} className="bi-text"/></div><div className="bi-panel"><BiImg id={bi.icon}/><h1>逼哩逼哩</h1><p>原创基地 · 素人图鉴<br/>百万资源 · 同频共振</p>{qr && <img src={qr}/>}<button onClick={download}>立即下载</button></div></section></main>;
}
