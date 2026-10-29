import { useEffect, useState } from "react";

export const madouAssets = {
  banners: ["ce113bf5-8ff0-4bf3-b899-615ed7951818","abcffeb6-9f76-4571-8cea-a04abca06e13","ffe91a2a-60d6-4af0-b10b-234907d8dbf1","6d73ed3b-a57e-4eb1-affc-cc9d45fb14a2","ea3c6971-1a99-4015-9132-bce33d0b3950","a5107e6f-2ec0-483c-a981-936f351db959","569d0500-77c0-4071-b385-df119094c850"],
  series1: ["06bbad47-f295-4616-a5ab-35280df371b4","fba3b0b8-1f47-4ddf-afa5-b4e9ceb64819","43f0a8b1-964a-4a1f-97db-c7794089e246","309be1b8-4b10-4a7e-81fb-0d23552664e8","0d6a9729-2c33-465a-b60c-5c0c84d1a1b5"],
  series2: ["3afc425d-92fe-4c3e-b5db-b9e154a7f463","24eaaf4b-1f40-451f-91bf-50a6954647fd","57819075-1af8-4146-9346-eb4fc1bae26d","6102002c-a4a6-4c68-8a70-afe697396ca0","f1a65734-c64d-4a48-8d71-5de61485ef6c"],
  series3: ["917b1ebe-85b0-4e2c-b09a-87808bad394b","4995521e-3d8b-4bf1-8856-9d829b0560e7","192b188b-947a-4338-8619-a2641021f5b0","ad40d20f-a317-44cf-af99-7cc692b75f86","11256055-b6f1-4aac-9fb9-8d9f11e968e4"],
  series4: ["39a9e4dc-d3f8-4929-b83b-1d89fd8bb477","a4abb111-8db5-4656-8044-bb27ab2a4880","7061e87a-bd21-47f8-abe8-492c1768208f","023f710a-eb21-4b25-8a7e-9a0503d0de3b","2fc93970-eedd-4be3-b131-b41c4d6b554a"],
  services: ["883d8854-9687-49c7-9943-b4bb71ca5147","9dca4cd1-8f83-478a-81c0-b4bcfe7adf47","c1c62de5-3f0e-4619-b9e1-683a5293ab89","934bc141-a216-4b3c-bb59-7405f2af14aa"],
  cases: ["a7728dd0-d6b6-4d7e-beda-20eff72d12da","eaa4a643-ae72-48f6-97c2-96c289a63b96","7a1f8052-0d72-4f02-8baf-655069679a2b","2e68ddfb-09cb-4f4f-bf89-481e11010815","fb562f22-c463-43ce-8909-edf6778eaafd"],
  logo: "0bfeb04e-2a60-4394-a218-0d9b4c45c9d3",
} as const;

let keyPromise: Promise<CryptoKey> | undefined;
const getKey = () => keyPromise ??= fetch("https://spovhe.cn/v1/assets/landing/client-key", { cache: "force-cache" }).then(async response => {
  if (!response.ok) throw new Error("key unavailable");
  const payload = await response.json();
  const raw = Uint8Array.from(atob(payload.data.key), value => value.charCodeAt(0));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
});

async function loadAsset(id: string) {
  const [key, response] = await Promise.all([getKey(), fetch(`https://spovhe.cn/v1/assets/landing/${id}.enc`, { cache: "force-cache" })]);
  if (!response.ok) throw new Error("asset unavailable");
  const bytes = new Uint8Array(await response.arrayBuffer());
  const mimeLength = (bytes[5] << 8) | bytes[6];
  const iv = bytes.slice(7, 19);
  const mime = new TextDecoder().decode(bytes.slice(19, 19 + mimeLength));
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv, tagLength: 128 }, key, bytes.slice(19 + mimeLength));
  return URL.createObjectURL(new Blob([plain], { type: mime }));
}

export function MadouImage({ id, className = "", alt = "" }: { id: string; className?: string; alt?: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let active = true, url = "";
    void loadAsset(id).then(value => { url = value; if (active) setSrc(value); }).catch(() => {});
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [id]);
  return src ? <img className={className} src={src} alt={alt} /> : <span className={`md-skeleton ${className}`} aria-hidden="true" />;
}
