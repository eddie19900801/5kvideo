import { useEffect, useRef } from "react";

type AdClient = { mount: (element: HTMLElement, zone: string) => Promise<void> };
type AdClientConstructor = new (options: { apiBase: string }) => AdClient;
type AdSdkGlobal = AdClientConstructor | { FiveKAdClient?: AdClientConstructor };

declare global {
  interface Window {
    FiveKAds?: AdSdkGlobal;
  }
}

let sdkPromise: Promise<AdClientConstructor> | undefined;

function sdkClient() {
  const sdk = window.FiveKAds;
  return typeof sdk === "function" ? sdk : sdk?.FiveKAdClient;
}

function loadAdSdk() {
  const existing = sdkClient();
  if (existing) return Promise.resolve(existing);
  sdkPromise ??= new Promise<AdClientConstructor>((resolve, reject) => {
    const script = document.querySelector<HTMLScriptElement>('script[src*="/ads/sdk/fivek-ads.js"]');
    if (!script) return reject(new Error("广告 SDK 未配置"));
    const ready = () => {
      const Client = sdkClient();
      return Client ? resolve(Client) : reject(new Error("广告 SDK 加载失败"));
    };
    script.addEventListener("load", ready, { once: true });
    script.addEventListener("error", () => reject(new Error("广告 SDK 加载失败")), { once: true });
  });
  return sdkPromise;
}

export default function FiveKAdSlot({ zone, limit, className = "" }: { zone: string; limit: number; className?: string }) {
  const ref = useRef<HTMLModElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let active = true;
    const mount = () => void loadAdSdk().then(Client => {
      if (active && element.isConnected) void new Client({ apiBase: "https://897kg.cc/ads/api" }).mount(element, zone);
    }).catch(() => {});
    if (!("IntersectionObserver" in window)) mount();
    else {
      const observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          observer.disconnect();
          mount();
        }
      }, { rootMargin: "600px 0px" });
      observer.observe(element);
      return () => { active = false; observer.disconnect(); };
    }
    return () => { active = false; };
  }, [zone]);

  return <ins ref={ref} className={`fivek-ad block w-full ${className}`} data-zone={zone} data-limit={String(limit)} />;
}
