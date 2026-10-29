export type ProductRuntime = {
  id: string;
  name: string;
  slug: string;
  domain: string;
  packageName: string;
  iconUrl: string;
  themeColor: string;
  recommendationCategoryIds: string[];
  recommendationKeywords: string[];
  recommendationVideoIds: string[];
  recommendationStrategy: "stable" | "shuffle";
  status: "active";
  version: number;
  url: string;
  hostMode?: "app" | "landing";
  landingDomain?: string;
  landingDomains?: string[];
  landingPage?: null;
};

const fallback: ProductRuntime = { id:"product-ppfree",name:"PP免费",slug:"ppfree",domain:location.hostname,packageName:"cn.ppfree.video",iconUrl:"",themeColor:"#ef4444",recommendationCategoryIds:[],recommendationKeywords:[],recommendationVideoIds:[],recommendationStrategy:"shuffle",status:"active",version:1,url:location.origin+"/",hostMode:"app" };
const hexToOklch = (hex: string) => {
  const value = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(value)) return null;
  const linear = (channel: number) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  const red = linear(Number.parseInt(value.slice(0, 2), 16));
  const green = linear(Number.parseInt(value.slice(2, 4), 16));
  const blue = linear(Number.parseInt(value.slice(4, 6), 16));
  const l = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue);
  const m = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue);
  const s = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue);
  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const b = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const chroma = Math.sqrt(a * a + b * b);
  const hue = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  return { lightness, chroma, hue };
};
const applyProductTheme = (product: ProductRuntime) => {
  const color = hexToOklch(product.themeColor);
  if (!color) return;
  const root = document.documentElement;
  const lightness = [0.97, 0.94, 0.88, 0.8, 0.71, color.lightness, Math.max(0.2, color.lightness - 0.07), Math.max(0.16, color.lightness - 0.14), Math.max(0.12, color.lightness - 0.22), Math.max(0.09, color.lightness - 0.29), Math.max(0.06, color.lightness - 0.36)];
  const chromaScale = [0.1, 0.22, 0.42, 0.64, 0.82, 1, 0.94, 0.82, 0.68, 0.5, 0.34];
  const shades = [50,100,200,300,400,500,600,700,800,900,950];
  shades.forEach((shade, index) => {
    const value = `${lightness[index].toFixed(4)} ${(color.chroma * chromaScale[index]).toFixed(4)} ${color.hue.toFixed(2)}`;
    root.style.setProperty(`--primary-${shade}`, value);
    root.style.setProperty(`--accent-${shade}`, value);
  });
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", product.themeColor);
};
let pending: Promise<ProductRuntime> | undefined;
export const productRuntime = {
  fallback,
  load: () => pending ??= fetch(`/vdo-api/v1/product/runtime-config?host=${encodeURIComponent(location.hostname)}&_=${Date.now()}`, { cache: "no-store", headers: { Accept: "application/json", "Cache-Control": "no-cache" }, signal: AbortSignal.timeout(10000) })
    .then(async response => { if (!response.ok) throw new Error("product config unavailable"); const body = await response.json(); return body.data as ProductRuntime; })
    .catch(() => fallback)
    .then(product => {
      applyProductTheme(product);
      localStorage.setItem("5knews_product_slug_v1", product.slug);
      localStorage.setItem("5knews_product_id_v1", product.id);
      return product;
    }),
};
