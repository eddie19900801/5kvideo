import { useEffect, useMemo, useState } from "react";
import { Headphones, MessageCircle, ShieldCheck } from "lucide-react";
import QRCode from "qrcode";
import type { ProductRuntime } from "@/services/productRuntime";
import "./style.css";
import "./pc.css";
import "./encrypted.css";
import { EncryptedLandingImage } from "./encryptedAssets";
import { analytics } from "@/services/analytics";

type Props = { product: ProductRuntime };
type PackageConfig = { androidUrl: string; iosUrl: string; channel: string };

const cleanChannel = (value: string | null) => {
  const normalized = (value || "direct").trim();
  return /^[A-Za-z0-9_-]{1,64}$/.test(normalized) ? normalized : "direct";
};
const landingDevice = () => /iPad|iPhone|iPod/i.test(navigator.userAgent) ? "ios" : /Android/i.test(navigator.userAgent) ? "android" : "pc";

export default function ProductLandingPage({ product }: Props) {
  const requestedChannel = useMemo(() => {
    const query = new URLSearchParams(location.search);
    return cleanChannel(query.get("channel") || query.get("cid") || query.get("utm_source"));
  }, []);
  const [active, setActive] = useState(0);
  const [ready, setReady] = useState(false);
  const [links, setLinks] = useState<PackageConfig | null>(null);
  const [qrCode, setQrCode] = useState("");
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  useEffect(() => {
    document.title = `${product.name} - 官方下载`;
    void analytics.report("landing_view", { metadata: { product: product.slug, productSlug: product.slug, productId: product.id, channel: requestedChannel, landingDevice: landingDevice() } });
    let alive = true;
    const load = async (channel: string) => {
      const response = await fetch(`/vdo-api/v1/products/${encodeURIComponent(product.slug)}/channels/${encodeURIComponent(channel)}/config`, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error("package config unavailable");
      return (await response.json()).data as PackageConfig;
    };
    load(requestedChannel).catch(() => load("direct")).then(value => { if (alive) setLinks(value); }).finally(() => { if (alive) setReady(true); });
    const timer = window.setInterval(() => setActive(value => (value + 1) % 3), 3500);
    return () => { alive = false; window.clearInterval(timer); };
  }, [product.name, product.slug, requestedChannel]);
  useEffect(() => { void QRCode.toDataURL(location.href, { width: 180, margin: 1 }).then(setQrCode); }, []);

  const download = (kind: "android" | "ios") => {
    if (!links) return;
    void analytics.report("app_download_click", { metadata: { product: product.slug, productSlug: product.slug, productId: product.id, channel: requestedChannel, platform: kind } });
    location.href = kind === "ios" ? links.iosUrl : links.androidUrl;
  };

  return (
    <main className="product-landing" style={{ "--brand": product.themeColor } as React.CSSProperties}>
      <div className="landing-glow landing-glow-one" /><div className="landing-glow landing-glow-two" />
      <header className="landing-header">
        <div className="landing-brand"><EncryptedLandingImage asset="productIcon" className="landing-logo" alt={product.name} /><div><strong>{product.name}</strong><span>海量内容 · 随时畅享</span></div></div>
        <nav><a href="https://t.me/dahe68868" target="_blank" rel="noreferrer"><MessageCircle />商务</a><a href="https://t.me/dahe68868" target="_blank" rel="noreferrer"><Headphones />客服</a></nav>
      </header>

      <section className="landing-pc">
        <EncryptedLandingImage asset="pcBackground" className="pc-background" />
        <EncryptedLandingImage asset="pcLogo" className="pc-logo" alt={product.name} />
        <EncryptedLandingImage asset="girl1" className="pc-girl" />
        <EncryptedLandingImage asset="pcSticker" className="pc-sticker" />
        <EncryptedLandingImage asset="pcTable" className="pc-table" />
        <EncryptedLandingImage asset="pcTitle" className="pc-title" />
        <div className="pc-actions"><button disabled={!links} onClick={() => download("android")}><b>安卓下载</b><span>建议UC/夸克浏览器打开</span></button><button disabled={!links} onClick={() => download("ios")}><b>苹果下载</b><span>请使用Safari浏览器打开</span></button><p>本APP属于特殊行业，偶尔会误报毒提醒，如有报毒提示<br/>请点击忽略，并开启飞行模式安装即可！</p></div>
        <div className="pc-qr">{qrCode && <img src={qrCode} alt="手机扫码下载" />}<span>手机扫码下载</span></div>
      </section>

      <section className="landing-stage" onClick={() => download(isIOS ? "ios" : "android")}>
        {[0, 1, 2].map(index => <div key={index} className={`landing-scene ${active === index ? "active" : ""}`}>
          {index < 2 && <EncryptedLandingImage className="scene-title" asset={index === 0 ? "title1" : "title2"} />}
          {index === 2 && <EncryptedLandingImage className="scene-features" asset="features" />}
          {index < 2 && <EncryptedLandingImage className="scene-sticker" asset="sticker" />}
          <EncryptedLandingImage className={`scene-girl girl-${index + 1}`} asset={index === 0 ? "girl1" : index === 1 ? "girl2" : "girl3"} />
        </div>)}
        <EncryptedLandingImage className="landing-table" asset="footerTable" />
      </section>

      <div className="landing-dots">{[0,1,2].map(index => <button key={index} className={active === index ? "active" : ""} onClick={() => setActive(index)} aria-label={`第 ${index + 1} 页`} />)}</div>

      <footer className="landing-downloads">
        <div className="landing-security"><ShieldCheck /> 官方正版 · 安全无毒 · 极速安装</div>
        <div className="landing-actions">
          {!isIOS && <button className="secondary" disabled={!ready || !links} onClick={() => download("android")}><span>备用下载</span><small>Android APK</small></button>}
          <button className="primary" disabled={!ready || !links} onClick={() => download(isIOS ? "ios" : "android")}><span>{!ready ? "下载连接中..." : isIOS ? "苹果下载" : "立即下载"}</span><small>{isIOS ? "安装到 iPhone 主屏幕" : "Android APK"}</small></button>
        </div>
        <p>{isIOS ? "请使用 Safari 浏览器打开并安装描述文件" : "若无法弹出下载，请使用系统浏览器重新打开"}</p>
      </footer>
    </main>
  );
}
