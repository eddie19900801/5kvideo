import jwt from "jsonwebtoken";

const productName = process.env.NAV_PRODUCT_NAME;
const categoryId = process.env.NAV_CATEGORY_ID;
const adminId = process.env.VERIFY_ADMIN_ID;
if (!productName || !categoryId || !adminId) throw new Error("missing deployment parameters");

const adToken = jwt.sign({ id: adminId }, process.env.JWT_SECRET, { expiresIn: "5m" });
const adSsoResponse = await fetch("http://127.0.0.1:4100/v1/admin/navigation-sso", {
  method: "POST",
  headers: { authorization: `Bearer ${adToken}`, "content-type": "application/json" },
  body: "{}",
});
const adSso = await adSsoResponse.json();
if (!adSsoResponse.ok) throw new Error(`ad sso failed: ${adSsoResponse.status}`);

const navSsoResponse = await fetch("http://5k-navigation-api:4020/api/v1/admin/auth/sso", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ assertion: adSso.data.assertion }),
});
const navSso = await navSsoResponse.json();
if (!navSsoResponse.ok) throw new Error(`navigation sso failed: ${navSsoResponse.status}`);
const headers = { authorization: `Bearer ${navSso.data.token}`, "content-type": "application/json" };

const catalogResponse = await fetch("http://5k-navigation-api:4020/api/v1/admin/ad-catalog", { headers });
const catalog = await catalogResponse.json();
if (!catalogResponse.ok) throw new Error(`catalog failed: ${catalogResponse.status}`);
const creative = catalog.data.creatives.find((item) => item.productName === productName && item.type === "icon" && item.primary && item.enabled);
if (!creative) throw new Error(`active primary icon not found for ${productName}`);

const applyResponse = await fetch("http://5k-navigation-api:4020/api/v1/admin/ad-catalog/apply", {
  method: "POST",
  headers,
  body: JSON.stringify({ type: "icon", categoryId, creative }),
});
const applied = await applyResponse.json();
if (!applyResponse.ok) throw new Error(`apply failed: ${applyResponse.status} ${applied?.error?.message || ""}`);

const publishResponse = await fetch("http://5k-navigation-api:4020/api/v1/admin/publish", {
  method: "POST",
  headers,
  body: "{}",
});
const published = await publishResponse.json();
if (!publishResponse.ok) throw new Error(`publish failed: ${publishResponse.status}`);
console.log(JSON.stringify({ applied: applied.data.applied, linkId: applied.data.id, version: published.data.version }));
