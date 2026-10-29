import fs from "node:fs";
import path from "node:path";
import type { Database, ProductLine, TrafficChannel } from "../types.js";

const dataDirectory = () => path.dirname(path.resolve(process.env.DATA_FILE || "./data/db.json"));
export const productPackageDirectory = () => path.join(dataDirectory(), "product-packages");
const manifestDirectory = () => path.join(dataDirectory(), "product-package-manifests");
export const directChannel: TrafficChannel = { id: "direct", code: "direct", name: "自然流量", createdAt: "" };
export const allPackageChannels = (database: Database) => [directChannel, ...database.channels];

export function packageLinks(product: ProductLine, channel: TrafficChannel) {
  const config = product.publishedConfig || product;
  const origin = `https://${config.domain}`;
  const landingOrigin = `https://${config.landingDomain}`;
  const code = encodeURIComponent(channel.code);
  const slug = encodeURIComponent(product.slug);
  return {
    landingUrl: `${landingOrigin}/?channel=${code}`,
    androidUrl: `${origin}/vdo-api/v1/products/${slug}/channels/${code}/android.apk`,
    iosUrl: `${origin}/vdo-api/v1/products/${slug}/channels/${code}/ios.mobileconfig`,
    configUrl: `${origin}/vdo-api/v1/products/${slug}/channels/${code}/config`,
  };
}

export function packageArtifact(product: ProductLine, channelCode: string) {
  return path.join(productPackageDirectory(), product.slug, `${channelCode}.apk`);
}

export function syncProductPackageManifest(database: Database, product: ProductLine) {
  if (!product.publishedConfig || product.status !== "active") return;
  fs.mkdirSync(manifestDirectory(), { recursive: true });
  const target = path.join(manifestDirectory(), `${product.slug}.json`), temporary = `${target}.tmp-${process.pid}`;
  const channels = allPackageChannels(database).map(channel => ({
    code: channel.code, name: channel.name, ...packageLinks(product, channel),
    artifact: packageArtifact(product, channel.code),
  }));
  fs.writeFileSync(temporary, JSON.stringify({
    schemaVersion: 1, productId: product.id, slug: product.slug, version: product.version,
    generatedAt: new Date().toISOString(), config: product.publishedConfig, channels,
  }, null, 2));
  fs.renameSync(temporary, target);
}

export function syncAllProductPackageManifests(database: Database) {
  for (const product of database.productLines) syncProductPackageManifest(database, product);
}
