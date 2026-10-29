import jwt from "jsonwebtoken";
const expiringToken = jwt.sign({ id: process.env.VERIFY_ADMIN_ID }, process.env.JWT_SECRET, { expiresIn: "1h" });
try {
  const startedAt = Date.now();
  const adResponse = await fetch("http://127.0.0.1:4100/v1/admin/navigation-sso", {
    method: "POST",
    headers: { authorization: `Bearer ${expiringToken}`, "content-type": "application/json" },
    body: "{}",
  });
  const adPayload = await adResponse.json();
  const adMs = Date.now() - startedAt;
  const navResponse = await fetch("http://5k-navigation-api:4020/api/v1/admin/auth/sso", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ assertion: adPayload.data?.assertion }),
  });
  const navPayload = await navResponse.json();
  const navSsoMs = Date.now() - startedAt - adMs;
  const decoded = navPayload.data?.token ? jwt.decode(navPayload.data.token) : null;
  const dashboardResponse = navPayload.data?.token
    ? await fetch("http://5k-navigation-api:4020/api/v1/admin/dashboard", { headers: { authorization: `Bearer ${navPayload.data.token}` } })
    : null;
  const dashboardMs = Date.now() - startedAt - adMs - navSsoMs;
  console.log(JSON.stringify({
    adSso: adResponse.status,
    adRolling: Boolean(adResponse.headers.get("x-ad-admin-token")),
    navSso: navResponse.status,
    navRole: navPayload.data?.role,
    navSessionDays: decoded ? Math.round((decoded.exp - decoded.iat) / 86400) : 0,
    dashboard: dashboardResponse?.status || 0,
    timingsMs: { adSso: adMs, navSso: navSsoMs, dashboard: dashboardMs },
  }));
} finally {}
