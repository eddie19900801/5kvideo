import { useEffect, useMemo, useState, type CSSProperties } from "react";
import QRCode from "qrcode";
import { analytics } from "@/services/analytics";
import { productRuntime, type ProductRuntime } from "@/services/productRuntime";
import EncryptedAssetImage, { productIconSource } from "@/components/EncryptedAssetImage";

type PackageConfig = ProductRuntime & {
  channel: string;
  channelName: string;
  landingUrl: string;
  androidUrl: string;
  iosUrl: string;
  navigationUrl: string;
};

const channel = () => {
  const value = new URLSearchParams(location.search).get("channel") || "direct";
  return /^[a-z0-9_-]{1,50}$/i.test(value) ? value : "direct";
};
const landingDevice = () => /iPad|iPhone|iPod/i.test(navigator.userAgent) ? "ios" : /Android/i.test(navigator.userAgent) ? "android" : "pc";

export default function DownloadPage() {
  const code = useMemo(channel, []), [config, setConfig] = useState<PackageConfig>(), [qr, setQr] = useState(""), [error, setError] = useState("");
  useEffect(() => {
    void productRuntime.load().then(async product => {
      document.title = `${product.name} - 免费下载`;
      const response = await fetch(`/vdo-api/v1/products/${encodeURIComponent(product.slug)}/channels/${encodeURIComponent(code)}/config`, { signal: AbortSignal.timeout(10000) });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error?.message || "下载配置加载失败");
      const value = body.data as PackageConfig;
      setConfig(value);
      setQr(await QRCode.toDataURL(location.href, { width: 220, margin: 1, color: { dark: "#111827", light: "#ffffff" } }));
      analytics.track("landing_view", { metadata: { product: product.slug, productSlug: product.slug, productId: product.id, channel: code, landingDevice: landingDevice() } });
    }).catch(reason => setError(reason instanceof Error ? reason.message : "下载配置加载失败"));
  }, [code]);
  const click = (platform: "android" | "ios") => {
    if (!config) return;
    analytics.track("app_download_click", { metadata: { product: config.slug, channel: code, platform } });
    location.href = platform === "android" ? config.androidUrl : config.iosUrl;
  };
  if (!config) return <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white"><div className="text-center"><span className="mx-auto mb-4 block h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-white"/><p>{error || "正在准备下载…"}</p>{error&&<a href="/" className="mt-4 inline-block text-sm text-blue-300">返回首页</a>}</div></main>;
  return <main className="min-h-screen bg-slate-950 px-5 py-10 text-white" style={{"--brand":config.themeColor} as CSSProperties}>
    <section className="mx-auto max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-white/5 p-6 text-center shadow-2xl backdrop-blur">
      <div className="mx-auto grid h-24 w-24 place-items-center overflow-hidden rounded-[24px] text-4xl font-black shadow-xl" style={{background:config.themeColor}}>{productIconSource(config.slug,config.iconUrl)?<EncryptedAssetImage src={productIconSource(config.slug,config.iconUrl)} alt={config.name} className="h-full w-full object-cover"/>:config.name.slice(0,1)}</div>
      <h1 className="mt-5 text-3xl font-black">{config.name}</h1>
      <p className="mt-2 text-sm text-white/55">永久免费 · 极速打开 · 自动更新线路</p>
      <div className="mt-7 hidden rounded-2xl bg-white p-4 sm:block"><img src={qr} alt="扫码下载" className="mx-auto h-48 w-48"/><p className="mt-2 text-xs text-slate-500">手机扫码打开当前渠道下载页</p></div>
      <div className="mt-7 grid gap-3">
        <button onClick={()=>click("android")} className="h-14 rounded-2xl text-base font-bold text-white shadow-lg" style={{background:config.themeColor}}><i className="ri-android-fill mr-2"/>Android 下载安装</button>
        <button onClick={()=>click("ios")} className="h-14 rounded-2xl border border-white/20 bg-white/10 text-base font-bold"><i className="ri-apple-fill mr-2"/>iPhone 添加到主屏幕</button>
        <a href={config.navigationUrl} className="py-3 text-sm text-white/60">暂不安装，直接进入网页版</a>
      </div>
      <p className="mt-5 text-[11px] text-white/35">渠道：{config.channelName}</p>
    </section>
  </main>;
}
