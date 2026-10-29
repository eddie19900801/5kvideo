import { useEffect, useState } from "react";

export const landingAssets = {
  productIcon: "ad5dca6d-26f6-4721-a341-c7cc9b91d919",
  features: "4e48beb6-db51-4f01-97ca-a982c88f020e",
  footerTable: "ecc91361-1ac6-4a13-a71a-90ab9d6f8fa4",
  girl1: "a4082ba0-dd52-4ecb-b22c-93af4143a318",
  girl2: "387dc05f-feed-4b10-8d68-433e3429f004",
  girl3: "7af0a814-902c-410e-a3bd-ed8eb64615ed",
  pcBackground: "714d5965-d464-4ef6-bb9f-60a46ea65a70",
  pcLogo: "1a0c0eed-3c5a-4d36-9928-1d930e435b60",
  pcSticker: "57960cae-9fd3-495d-9eb2-6425cdf1f3cf",
  pcTable: "e6b68f9b-10d9-44b0-88f4-440a5ed8d91d",
  pcTitle: "7a1e605c-a699-407e-a35f-c181c720919b",
  sticker: "2766a4ce-dfa5-41f8-9a2b-19ef649cfaf3",
  title1: "7ede5bdb-09a5-4a49-9764-e5e9cf60547a",
  title2: "b1d0d0dc-b100-4b1c-a072-a53b46a84531",
} as const;

let keyPromise: Promise<CryptoKey> | undefined;
const getKey = () => keyPromise ??= fetch("https://spovhe.cn/v1/assets/landing/client-key", { cache: "force-cache" }).then(async response => {
  if (!response.ok) throw new Error("资源解密授权失败");
  const payload = await response.json(), raw = Uint8Array.from(atob(payload.data.key), value => value.charCodeAt(0));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
});

async function loadAsset(id: string) {
  const [key, response] = await Promise.all([getKey(), fetch(`https://spovhe.cn/v1/assets/landing/${id}.enc`, { cache: "force-cache" })]);
  if (!response.ok) throw new Error("资源加载失败");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (new TextDecoder().decode(bytes.slice(0, 4)) !== "5KRC" || bytes[4] !== 1) throw new Error("资源格式无效");
  const mimeLength = (bytes[5] << 8) | bytes[6], iv = bytes.slice(7, 19), mime = new TextDecoder().decode(bytes.slice(19, 19 + mimeLength));
  const body = bytes.slice(19 + mimeLength), plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv, tagLength: 128 }, key, body);
  return URL.createObjectURL(new Blob([plain], { type: mime }));
}

export function EncryptedLandingImage({ asset, className, alt = "" }: { asset: keyof typeof landingAssets; className: string; alt?: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let active = true, objectUrl = "";
    void loadAsset(landingAssets[asset]).then(url => { objectUrl = url; if (active) setSrc(url); }).catch(() => { if (active) setSrc(""); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [asset]);
  return <span className={`${className}-shell encrypted-image-shell`}>{src ? <img className={className} src={src} alt={alt} /> : <i className={`${className} encrypted-image-skeleton`} />}</span>;
}
