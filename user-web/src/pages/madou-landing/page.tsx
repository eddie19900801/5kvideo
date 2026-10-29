import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import type { ProductRuntime } from "@/services/productRuntime";
import { analytics } from "@/services/analytics";
import { madouAssets, MadouImage } from "./assets";
import "./style.css";

type Props = { product: ProductRuntime };
type PackageConfig = { androidUrl: string; iosUrl: string; channel: string };
const tabs = ["麻豆短剧系列", "海角乱伦", "3D动漫", "猎奇暗网"];
const series = [madouAssets.series1, madouAssets.series2, madouAssets.series3, madouAssets.series4];
const serviceNames = ["内容制作", "专案内容", "影棚资源", "经纪资源"];
const channelValue = () => {
  const query = new URLSearchParams(location.search);
  const raw = query.get("channel") || query.get("cid") || query.get("dc") || query.get("utm_source") || "direct";
  return /^[\w-]{1,64}$/.test(raw) ? raw : "direct";
};
const device = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) ? "ios" : /Android/i.test(navigator.userAgent) ? "android" : "pc";

export default function MadouLandingPage({ product }: Props) {
  const channel = useMemo(channelValue, []);
  const [config, setConfig] = useState<PackageConfig | null>(null);
  const [hero, setHero] = useState(0);
  const [tab, setTab] = useState(0);
  const [qr, setQr] = useState("");
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  useEffect(() => {
    document.title = `${product.name} - 官方下载`;
    void analytics.report("landing_view", { metadata: { product: product.slug, productSlug: product.slug, productId: product.id, channel, landingDevice: device() } });
    const load = async (value: string) => {
      const response = await fetch(`/vdo-api/v1/products/${encodeURIComponent(product.slug)}/channels/${encodeURIComponent(value)}/config?_=${Date.now()}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error("config unavailable");
      return (await response.json()).data as PackageConfig;
    };
    load(channel).catch(() => load("direct")).then(setConfig).catch(() => {});
    void QRCode.toDataURL(location.href, { width: 188, margin: 1, color: { dark: "#17100a", light: "#fffaf2" } }).then(setQr);
  }, [channel, product.id, product.name, product.slug]);
  useEffect(() => { const timer = setInterval(() => setHero(value => (value + 1) % madouAssets.banners.length), 4200); return () => clearInterval(timer); }, []);

  const download = (platform = isIOS ? "ios" : "android") => {
    if (!config) return;
    void analytics.report("app_download_click", { metadata: { product: product.slug, productSlug: product.slug, productId: product.id, channel, platform } });
    location.href = platform === "ios" ? config.iosUrl : config.androidUrl;
  };

  return <main className="md-page">
    <header className="md-header">
      <div className="md-brand"><MadouImage id={madouAssets.logo} className="md-logo" /><div><b>{product.name}</b><span>AI原创成人短剧</span></div></div>
      <nav><a href="#about">关于麻豆</a><a href="https://t.me/dahe68868" target="_blank" rel="noreferrer">在线客服</a><button onClick={() => download()}>下载APP</button></nav>
    </header>

    <section className="md-hero">
      <div className="md-hero-stage"><MadouImage id={madouAssets.banners[hero]} className="md-hero-image" /></div>
      <div className="md-hero-dots">{madouAssets.banners.map((_, index) => <button key={index} className={index === hero ? "active" : ""} onClick={() => setHero(index)} aria-label={`轮播 ${index + 1}`} />)}</div>
    </section>

    <section className="md-download">
      <div><strong>麻豆短剧</strong><span>原创精选 · 每日更新 · 极速播放</span></div>
      <button disabled={!config} onClick={() => download()}>{config ? "立即下载体验" : "下载连接中…"}</button>
      <div className="md-qr">{qr && <img src={qr} alt="扫码下载" />}<small>手机扫码下载</small></div>
    </section>

    <section className="md-showcase">
      <div className="md-tabs">{tabs.map((item, index) => <button key={item} className={tab === index ? "active" : ""} onClick={() => setTab(index)}>{item}</button>)}</div>
      <div className="md-card-strip">{series[tab].map(id => <MadouImage key={id} id={id} className="md-series-card" />)}</div>
    </section>

    <section className="md-section"><h2>服务内容</h2><div className="md-services">{madouAssets.services.map((id, index) => <article key={id}><MadouImage id={id} className="md-service-image" /><h3>{serviceNames[index]}</h3><p>{index === 0 ? "专属节目订制 · 影视内容制作" : index === 1 ? "AI技术开发 · 创新内容合作" : index === 2 ? "原创场景 · 专业拍摄制作" : "质感打造 · 专属经纪服务"}</p></article>)}</div></section>
    <section className="md-section md-cases"><h2>作品集合</h2><div>{madouAssets.cases.map(id => <MadouImage key={id} id={id} className="md-case-image" />)}</div></section>
    <section id="about" className="md-about"><h2>关于麻豆短剧</h2><p>汇集原创短剧、动漫与精选内容，为用户提供清晰流畅的移动端观看体验。安装官方应用，获取完整内容与持续更新。</p></section>
    <footer>麻豆短剧 · 官方客户端下载</footer>
    <div className="md-mobile-dock"><button disabled={!config} onClick={() => download()}>{isIOS ? "iOS 安装" : "极速下载 APP"}</button><span>{isIOS ? "请使用 Safari 浏览器安装" : "若无法安装，请使用系统浏览器打开"}</span></div>
  </main>;
}
