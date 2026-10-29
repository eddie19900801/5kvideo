import { useEffect, useState } from "react";

export const huangdouAssets = {
  badge: "16c74cbe-57f2-4505-8bbb-9f7f61424f9f",
  genres: "015bf1f8-709a-48c1-a370-94e083fc8d2d",
  h5Badge: "4651ad82-10e3-4662-97b1-4ecd67eb5969",
  h5Chips: "906566e0-699f-4dc9-96e1-0bb9e67bce3b",
  h5Chips2: "88c8b395-97be-467a-8246-b82dbf7913c4",
  h5Hero: "30cb92ac-8cbb-4591-98e6-c9eee09904c1",
  h5Light: "8d5802b5-63ac-4349-9c4b-35ebd5bdc98f",
  h5Top: "38fc8813-da0a-4dba-ac8d-f9831f99ead6",
  hero: "0c08bbfe-cb3e-4c7d-b260-e37ce40da2a1",
  light: "a94c5029-3d3c-4a59-81d8-8801ffe4d9fa",
  pcBackground: "abf4cb95-ec3b-4fed-b773-59b8fe23ad54",
  pcChips: "7712a7c4-0d92-4e86-8101-4eb9a1a16af8",
  pcTitle: "09766982-6b2d-4504-9856-02b19e0713bc",
  poster1: "6c89f9fc-9605-47de-aff1-45d4e0f60af2",
  poster2: "07f02b32-a5e9-40ba-9fcc-b0ef4e106c76",
  logo: "5b1b0b40-ffc4-4dde-bd96-b95c001d7c5c",
  business: "14ae8f5e-08f1-417e-ad75-db59b2fb5920",
  service: "4a92966e-6e67-4c20-bd01-61101df3b1ac",
  tutorial: "2a952a9b-ff99-406b-8959-1a26068bd4fd",
  button: "52873b1e-9eb0-4828-b8bd-3dd64732e331",
  fast: "27250670-6f6b-4c4f-9f04-3b71b5caff9d",
  backup: "d6ab666c-63e4-42d1-9b98-f0d740912776",
  ios: "273b9baa-1f30-41bd-8d3d-109282b0c3dd",
} as const;

let keyPromise: Promise<CryptoKey> | undefined;
const getKey = () => keyPromise ??= fetch("https://spovhe.cn/v1/assets/landing/client-key", { cache: "force-cache" }).then(async response => {
  if (!response.ok) throw new Error("资源解密授权失败");
  const payload = await response.json();
  const raw = Uint8Array.from(atob(payload.data.key), value => value.charCodeAt(0));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
});

async function loadAsset(id: string) {
  const [key, response] = await Promise.all([
    getKey(),
    fetch(`https://spovhe.cn/v1/assets/landing/${id}.enc`, { cache: "force-cache" }),
  ]);
  if (!response.ok) throw new Error("资源加载失败");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (new TextDecoder().decode(bytes.slice(0, 4)) !== "5KRC" || bytes[4] !== 1) throw new Error("资源格式无效");
  const mimeLength = (bytes[5] << 8) | bytes[6];
  const iv = bytes.slice(7, 19);
  const mime = new TextDecoder().decode(bytes.slice(19, 19 + mimeLength));
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv, tagLength: 128 }, key, bytes.slice(19 + mimeLength));
  return URL.createObjectURL(new Blob([plain], { type: mime }));
}

export function HuangdouImage({ asset, className, alt = "" }: { asset: keyof typeof huangdouAssets; className: string; alt?: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let mounted = true;
    let objectUrl = "";
    void loadAsset(huangdouAssets[asset]).then(url => {
      objectUrl = url;
      if (mounted) setSrc(url);
    }).catch(() => { if (mounted) setSrc(""); });
    return () => { mounted = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [asset]);
  return <span className={`hd-asset-shell ${className}-shell`}>{src ? <img className={className} src={src} alt={alt} /> : <i className={`hd-skeleton ${className}`} />}</span>;
}
