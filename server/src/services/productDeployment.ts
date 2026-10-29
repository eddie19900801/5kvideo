import { resolve4 } from "node:dns/promises";
import fs from "node:fs";
import { readDb, updateDb } from "../db.js";
import { allPackageChannels, packageArtifact, syncProductPackageManifest } from "./productPackages.js";

const running = new Set<string>();
const initial = () => ({ status: "queued" as const, dnsReady: false, tlsReady: false, frontendReady: false, runtimeReady: false, packagesReady: false });

function updateDeployment(id: string, value: Partial<NonNullable<import("../types.js").ProductLine["deployment"]>>) {
  updateDb(database => {
    const product = database.productLines.find(item => item.id === id);
    if (!product) return;
    product.deployment = { ...initial(), ...product.deployment, ...value };
    product.updatedAt = new Date().toISOString();
  });
}

async function request(url: string) {
  const response = await fetch(url, { headers: { Accept: "application/json,text/html" }, signal: AbortSignal.timeout(12_000), redirect: "follow" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response;
}

export async function runProductDeployment(productId: string) {
  if (running.has(productId)) return;
  running.add(productId);
  updateDeployment(productId, { ...initial(), status: "checking", error: undefined });
  try {
    let product = readDb().productLines.find(item => item.id === productId);
    if (!product) return;
    const config = product.publishedConfig || product;
    for(const productDomain of config.domains){const addresses=await resolve4(productDomain);if(!addresses.length)throw new Error(`${productDomain} 尚未解析`)}
    updateDeployment(productId, { dnsReady: true });
    for(const productDomain of config.domains)await request(`https://${productDomain}/`);
    updateDeployment(productId, { tlsReady: true, frontendReady: true });
    const runtime = await request(`https://${config.domain}/vdo-api/v1/product/runtime-config?host=${encodeURIComponent(config.domain)}`).then(response => response.json()) as { data?: { slug?: string; version?: number } };
    if (runtime.data?.slug !== product.slug || runtime.data.version !== product.version) throw new Error("线上运行配置尚未同步到当前产品版本");
    product = readDb().productLines.find(item => item.id === productId)!;
    const packagesReady = allPackageChannels(readDb()).every(channel => fs.existsSync(packageArtifact(product, channel.code)));
    updateDeployment(productId, { status: "ready", runtimeReady: true, packagesReady, checkedAt: new Date().toISOString(), error: undefined });
  } catch (error) {
    updateDeployment(productId, { status: "failed", checkedAt: new Date().toISOString(), error: error instanceof Error ? error.message.slice(0, 300) : "发布检查失败" });
  } finally {
    running.delete(productId);
  }
}

export function queueProductDeployment(productId: string) {
  updateDeployment(productId, { status: "queued", error: undefined });
  setTimeout(() => void runProductDeployment(productId), 200).unref();
}

export function resumeProductDeployments() {
  const database = readDb();
  for (const product of database.productLines) {
    if (product.status === "active" && (!product.deployment || product.deployment.status === "queued" || product.deployment.status === "checking")) {
      syncProductPackageManifest(database, product);
      queueProductDeployment(product.id);
    }
  }
}
