import { createHash } from "node:crypto";
import { Router } from "express";
import { readDb } from "../db.js";
import { ok } from "../http.js";
import fs from "node:fs";
import path from "node:path";
import { directChannel, packageArtifact, packageLinks } from "../services/productPackages.js";

export const channelsRouter = Router();
const webOrigin = (process.env.VIDEO_WEB_ORIGIN || "https://5knews.wflhc.cn").replace(/\/$/, "");
const xml = (value: string) => value.replace(/[<>&'\"]/g, character => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[character]!);
const uuid = (value: string) => {
  const hash = createHash("sha256").update(value).digest("hex").slice(0, 32);
  return `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20)}`.toUpperCase();
};
const publishedProduct = (slug: string) => readDb().productLines.find(item => item.slug === slug && item.status === "active" && item.publishedConfig);
const configuredChannel = (code: string) => code === "direct" ? directChannel : readDb().channels.find(item => item.code === code);
const productIconData = (slug: string) => {
  const dataDirectory = path.dirname(path.resolve(process.env.DATA_FILE || "./data/db.json"));
  const iconFile = path.join(dataDirectory, "product-icons", `${slug}.png`);
  return fs.existsSync(iconFile) ? fs.readFileSync(iconFile).toString("base64") : "";
};

channelsRouter.get("/products/:slug/channels/:code/config", (req, res) => {
  const product = publishedProduct(req.params.slug), channel = configuredChannel(req.params.code);
  if (!product) return res.status(404).json({ error: { code: "PRODUCT_NOT_FOUND", message: "产品尚未发布" } });
  if (!channel) return res.status(404).json({ error: { code: "CHANNEL_NOT_FOUND", message: "渠道不存在" } });
  const config = product.publishedConfig!;
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  return ok(res, {
    productId: product.id, slug: product.slug, name: config.name, packageName: config.packageName,
    iconUrl: config.iconUrl, themeColor: config.themeColor, channel: channel.code, channelName: channel.name,
    navigationUrl: `https://${config.domain}/?channel=${encodeURIComponent(channel.code)}&app_platform=android`,
    ...packageLinks(product, channel), version: product.version,
  });
});

channelsRouter.get("/products/:slug/channels/:code/android.apk", (req, res) => {
  const product = publishedProduct(req.params.slug), channel = configuredChannel(req.params.code);
  if (!product) return res.status(404).json({ error: { code: "PRODUCT_NOT_FOUND", message: "产品尚未发布" } });
  if (!channel) return res.status(404).json({ error: { code: "CHANNEL_NOT_FOUND", message: "渠道不存在" } });
  const file = packageArtifact(product, channel.code);
  if (!fs.existsSync(file)) return res.status(503).json({ error: { code: "APK_BUILD_PENDING", message: "Android 渠道包正在生成，请稍后重试" } });
  res.type("application/vnd.android.package-archive");
  res.setHeader("Content-Disposition", `attachment; filename="${product.slug}-${channel.code}.apk"`);
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  return res.sendFile(file);
});

channelsRouter.get("/products/:slug/channels/:code/ios.mobileconfig", (req, res) => {
  const product = publishedProduct(req.params.slug), channel = configuredChannel(req.params.code);
  if (!product) return res.status(404).json({ error: { code: "PRODUCT_NOT_FOUND", message: "产品尚未发布" } });
  if (!channel) return res.status(404).json({ error: { code: "CHANNEL_NOT_FOUND", message: "渠道不存在" } });
  const config = product.publishedConfig!, target = `https://${config.domain}/?channel=${encodeURIComponent(channel.code)}&app_platform=ios`;
  const profileId = uuid(`profile:${product.slug}:${channel.code}`), clipId = uuid(`clip:${product.slug}:${channel.code}`), identifier = xml(config.packageName.toLowerCase());
  const icon = productIconData(product.slug), iconPayload = icon ? `<key>Icon</key><data>${icon}</data>` : "";
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>PayloadContent</key><array><dict>
<key>FullScreen</key><true/><key>IsRemovable</key><true/>
<key>Label</key><string>${xml(config.name)}</string><key>PayloadDescription</key><string>${xml(config.name)}</string>
<key>PayloadDisplayName</key><string>${xml(config.name)}</string><key>PayloadIdentifier</key><string>${identifier}.clip.${xml(channel.code.toLowerCase())}</string>
<key>PayloadType</key><string>com.apple.webClip.managed</string><key>PayloadUUID</key><string>${clipId}</string><key>PayloadVersion</key><integer>1</integer>
<key>Precomposed</key><true/>${iconPayload}<key>URL</key><string>${xml(target)}</string>
</dict></array>
<key>PayloadDescription</key><string>安装 ${xml(config.name)} 到主屏幕（${xml(channel.name)}）</string>
<key>PayloadDisplayName</key><string>${xml(config.name)}</string><key>PayloadIdentifier</key><string>${identifier}.profile.${xml(channel.code.toLowerCase())}</string>
<key>PayloadOrganization</key><string>${xml(config.name)}</string><key>PayloadRemovalDisallowed</key><false/>
<key>PayloadType</key><string>Configuration</string><key>PayloadUUID</key><string>${profileId}</string><key>PayloadVersion</key><integer>1</integer>
</dict></plist>`;
  res.setHeader("Content-Type", "application/x-apple-aspen-config");
  res.setHeader("Content-Disposition", `attachment; filename="${product.slug}-${channel.code}.mobileconfig"`);
  res.setHeader("Cache-Control", "no-store");
  return res.send(body);
});

channelsRouter.get("/channels/:code/config", (req, res) => {
  const channel = readDb().channels.find(item => item.code === req.params.code);
  if (!channel) return res.status(404).json({ error: { code: "CHANNEL_NOT_FOUND", message: "渠道不存在" } });
  return ok(res, { channel: channel.code, name: channel.name, navigationUrl: `${webOrigin}/?channel=${encodeURIComponent(channel.code)}&app_platform=android` });
});

channelsRouter.get("/channels/:code/ios.mobileconfig", (req, res) => {
  const channel = readDb().channels.find(item => item.code === req.params.code);
  if (!channel) return res.status(404).json({ error: { code: "CHANNEL_NOT_FOUND", message: "渠道不存在" } });
  const target = `${webOrigin}/?channel=${encodeURIComponent(channel.code)}&app_platform=ios`;
  const profileId = uuid(`profile:${channel.code}`), clipId = uuid(`clip:${channel.code}`);
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>PayloadContent</key><array><dict>
<key>FullScreen</key><true/><key>IsRemovable</key><true/>
<key>Label</key><string>PP免费</string><key>PayloadDescription</key><string>PP免费视频</string>
<key>PayloadDisplayName</key><string>PP免费</string><key>PayloadIdentifier</key><string>cn.ppfree.video.clip.${xml(channel.code.toLowerCase())}</string>
<key>PayloadType</key><string>com.apple.webClip.managed</string><key>PayloadUUID</key><string>${clipId}</string><key>PayloadVersion</key><integer>1</integer>
<key>Precomposed</key><true/><key>URL</key><string>${xml(target)}</string>
</dict></array>
<key>PayloadDescription</key><string>安装 PP免费 到主屏幕（${xml(channel.name)}）</string>
<key>PayloadDisplayName</key><string>PP免费</string><key>PayloadIdentifier</key><string>cn.ppfree.video.profile.${xml(channel.code.toLowerCase())}</string>
<key>PayloadOrganization</key><string>PP免费</string><key>PayloadRemovalDisallowed</key><false/>
<key>PayloadType</key><string>Configuration</string><key>PayloadUUID</key><string>${profileId}</string><key>PayloadVersion</key><integer>1</integer>
</dict></plist>`;
  res.setHeader("Content-Type", "application/x-apple-aspen-config");
  res.setHeader("Content-Disposition", `attachment; filename="ppfree-${channel.code}.mobileconfig"`);
  res.setHeader("Cache-Control", "no-store");
  return res.send(body);
});
