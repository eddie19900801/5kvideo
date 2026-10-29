import { useEffect, useState } from "react";

const keys = new Map<string, Promise<CryptoKey>>();
const pattern = /^(https?:\/\/[^/]+)\/v1\/assets\/([^/]+)\/([A-Za-z0-9-]+)\.enc(?:\?.*)?$/;

const projectKey = (origin: string, project: string) => {
  const cacheKey = `${origin}/${project}`;
  let pending = keys.get(cacheKey);
  if (!pending) {
    pending = fetch(`${origin}/v1/assets/${encodeURIComponent(project)}/client-key`, { cache: "force-cache" }).then(async response => {
      if (!response.ok) throw new Error("key unavailable");
      const body = await response.json(), raw = Uint8Array.from(atob(body.data.key), value => value.charCodeAt(0));
      return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
    });
    keys.set(cacheKey, pending);
  }
  return pending;
};

async function decrypt(source: string) {
  const match = source.match(pattern);
  if (!match) return { source, revoke: false };
  const [, origin, project] = match;
  const [key, response] = await Promise.all([projectKey(origin, project), fetch(source, { cache: "force-cache" })]);
  if (!response.ok) throw new Error("asset unavailable");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (new TextDecoder().decode(bytes.slice(0, 4)) !== "5KRC") throw new Error("invalid asset");
  const mimeLength = (bytes[5] << 8) | bytes[6], iv = bytes.slice(7, 19);
  const mime = new TextDecoder().decode(bytes.slice(19, 19 + mimeLength));
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv, tagLength: 128 }, key, bytes.slice(19 + mimeLength));
  return { source: URL.createObjectURL(new Blob([plain], { type: mime })), revoke: true };
}

export default function EncryptedAssetImage({ source, alt }: { source: string; alt: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let active = true, objectUrl = "";
    setUrl("");
    void decrypt(source).then(result => { if (result.revoke) objectUrl = result.source; if (active) setUrl(result.source); }).catch(() => {});
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [source]);
  return url ? <img src={url} alt={alt} /> : <span className="product-icon-loading" />;
}
