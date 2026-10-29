import { useEffect, useState } from "react";

const keys = new Map<string, Promise<CryptoKey>>();
const encryptedAsset = (source: string) => source.match(/^(https?:\/\/[^/]+)\/v1\/assets\/([^/]+)\/([A-Za-z0-9-]+)\.enc(?:\?.*)?$/);
const fallbackIcons: Record<string, string> = {
  "91xueyuan": "https://spovhe.cn/v1/assets/landing/ad5dca6d-26f6-4721-a341-c7cc9b91d919.enc",
};
export const productIconSource = (slug: string, configured?: string) => configured || fallbackIcons[slug] || "";

const keyFor = (origin: string, project: string) => {
  const cacheKey = `${origin}/${project}`;
  let pending = keys.get(cacheKey);
  if (!pending) {
    pending = fetch(`${origin}/v1/assets/${encodeURIComponent(project)}/client-key`, { cache: "force-cache" }).then(async response => {
      if (!response.ok) throw new Error("asset key unavailable");
      const body = await response.json();
      const raw = Uint8Array.from(atob(body.data.key), value => value.charCodeAt(0));
      return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
    });
    keys.set(cacheKey, pending);
  }
  return pending;
};

async function load(source: string) {
  const match = encryptedAsset(source);
  if (!match) return { url: source, objectUrl: false };
  const [, origin, project] = match;
  const [key, response] = await Promise.all([keyFor(origin, project), fetch(source, { cache: "force-cache" })]);
  if (!response.ok) throw new Error("asset unavailable");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (new TextDecoder().decode(bytes.slice(0, 4)) !== "5KRC" || bytes[4] !== 1) throw new Error("invalid asset");
  const mimeLength = (bytes[5] << 8) | bytes[6];
  const iv = bytes.slice(7, 19), mime = new TextDecoder().decode(bytes.slice(19, 19 + mimeLength));
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv, tagLength: 128 }, key, bytes.slice(19 + mimeLength));
  return { url: URL.createObjectURL(new Blob([plain], { type: mime })), objectUrl: true };
}

export default function EncryptedAssetImage({ src, alt = "", className = "" }: { src: string; alt?: string; className?: string }) {
  const [resolved, setResolved] = useState("");
  useEffect(() => {
    let active = true, revoke = "";
    setResolved("");
    void load(src).then(result => { if (result.objectUrl) revoke = result.url; if (active) setResolved(result.url); }).catch(() => { if (active) setResolved(""); });
    return () => { active = false; if (revoke) URL.revokeObjectURL(revoke); };
  }, [src]);
  return resolved ? <img src={resolved} alt={alt} className={className} /> : <span aria-hidden="true" className={`${className} animate-pulse bg-white/20`} />;
}
