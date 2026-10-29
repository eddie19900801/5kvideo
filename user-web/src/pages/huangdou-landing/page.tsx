import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import type { ProductRuntime } from "@/services/productRuntime";
import { analytics } from "@/services/analytics";
import { HuangdouImage } from "./assets";
import "./style.css";

type Props = { product: ProductRuntime };
type PackageConfig = { androidUrl: string; iosUrl: string; channel: string };

const normalizeChannel = (value: string | null) => /^[A-Za-z0-9_-]{1,64}$/.test(value || "") ? value! : "direct";
const device = () => /iPad|iPhone|iPod/i.test(navigator.userAgent) ? "ios" : /Android/i.test(navigator.userAgent) ? "android" : "pc";

export default function HuangdouLandingPage({ product }: Props) {
  const channel = useMemo(() => {
    const query = new URLSearchParams(location.search);
    return normalizeChannel(query.get("channel") || query.get("cid") || query.get("utm_source"));
  }, []);
  const [config, setConfig] = useState<PackageConfig | null>(null);
  const [qr, setQr] = useState("");
  const [variant] = useState(() => Math.random() > .5 ? 1 : 0);
  const [isDesktop, setIsDesktop] = useState(() => matchMedia("(min-width: 760px)").matches);
  const isIOS = /iPad|iPhone|iPod/i.test(navigator.userAgent);

  useEffect(() => {
    document.title = `${product.name} - 官方下载`;
    void analytics.report("landing_view", { metadata: { product: product.slug, productSlug: product.slug, productId: product.id, channel, landingDevice: device() } });
    const load = async (value: string) => {
      const response = await fetch(`/vdo-api/v1/products/${encodeURIComponent(product.slug)}/channels/${encodeURIComponent(value)}/config?_=${Date.now()}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error("config unavailable");
      return (await response.json()).data as PackageConfig;
    };
    let mounted = true;
    load(channel).catch(() => load("direct")).then(value => { if (mounted) setConfig(value); }).catch(() => {});
    void QRCode.toDataURL(location.href, { width: 180, margin: 1 }).then(setQr);
    return () => { mounted = false; };
  }, [channel, product.id, product.name, product.slug]);
  useEffect(() => {
    const media = matchMedia("(min-width: 760px)");
    const update = () => setIsDesktop(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const download = (platform: "android" | "ios", backup = false) => {
    if (!config) return;
    void analytics.report("app_download_click", { metadata: { product: product.slug, productSlug: product.slug, productId: product.id, channel, platform, backup } });
    location.href = platform === "ios" ? config.iosUrl : config.androidUrl;
  };
  const primaryDownload = () => download(isIOS ? "ios" : "android");

  return <main className="hd-landing" onClick={primaryDownload}>
    {!isDesktop && <section className="hd-mobile">
      <header className="hd-header" onClick={event => event.stopPropagation()}>
        <HuangdouImage asset="logo" className="hd-logo" alt={product.name} />
        <nav>
          <a href="https://t.me/dahe68868" target="_blank" rel="noreferrer"><HuangdouImage asset="business" className="hd-contact-icon" />官方商务</a>
          <a href="https://t.me/dahe68868" target="_blank" rel="noreferrer"><HuangdouImage asset="service" className="hd-contact-icon" />在线客服</a>
        </nav>
      </header>
      <div className="hd-mobile-canvas">
        <HuangdouImage asset="h5Top" className="hd-h5-top" />
        <HuangdouImage asset="h5Light" className="hd-h5-light" />
        <HuangdouImage asset={variant ? "hero" : "h5Hero"} className="hd-h5-hero" />
        <HuangdouImage asset={variant ? "h5Chips2" : "h5Chips"} className="hd-h5-chips" />
        <HuangdouImage asset={variant ? "h5Badge" : "badge"} className="hd-h5-badge" />
        <HuangdouImage asset="genres" className="hd-genres" />
        <div className="hd-tags"><b>AI原创好剧</b><span>AI影视魔改</span><span>AI成人漫剧</span><span>AI黑科技</span></div>
        <HuangdouImage asset="poster1" className="hd-poster hd-poster-one" />
        <HuangdouImage asset="poster2" className="hd-poster hd-poster-two" />
      </div>
      <a className="hd-tutorial" href="./android-installation.html" onClick={event => event.stopPropagation()}><HuangdouImage asset="tutorial" className="hd-tutorial-image" /></a>
      <div className="hd-dock" onClick={event => event.stopPropagation()}>
        {!isIOS && <button disabled={!config} onClick={() => download("android", true)}><HuangdouImage asset="button" className="hd-button-bg" /><HuangdouImage asset="backup" className="hd-button-text" /></button>}
        <button disabled={!config} onClick={primaryDownload}><HuangdouImage asset="button" className="hd-button-bg" /><HuangdouImage asset={isIOS ? "ios" : "fast"} className="hd-button-text" /></button>
        <p>{isIOS ? "请使用自带 Safari 浏览器打开" : "若无法弹出下载，请重试或使用 UC/夸克浏览器打开"}<br />APP 无法安装时，请开启飞行模式安装</p>
      </div>
    </section>}

    {isDesktop && <section className="hd-desktop">
      <HuangdouImage asset="pcBackground" className="hd-pc-bg" />
      <HuangdouImage asset="light" className="hd-pc-light" />
      <HuangdouImage asset="hero" className="hd-pc-hero" />
      <HuangdouImage asset="logo" className="hd-pc-logo" alt={product.name} />
      <div className="hd-pc-contact" onClick={event => event.stopPropagation()}><a href="https://t.me/dahe68868" target="_blank" rel="noreferrer">官方商务</a><a href="https://t.me/dahe68868" target="_blank" rel="noreferrer">在线客服</a></div>
      <HuangdouImage asset="pcTitle" className="hd-pc-title" />
      <HuangdouImage asset="pcChips" className="hd-pc-chips" />
      <div className="hd-qr" onClick={event => event.stopPropagation()}>{qr && <img src={qr} alt="扫码下载" />}<b>扫码下载APP</b><span>下载链接：{location.host.toUpperCase()}</span></div>
      <p className="hd-warning">本APP属于特殊行业，偶尔会误报毒提醒。如有报毒提示，请点击忽略，并开启飞行模式安装即可！</p>
    </section>}
  </main>;
}
