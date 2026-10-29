import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const chrome = "E:\\playwright-browsers\\chromium-1187\\chrome-win\\chrome.exe";
const desktop = process.argv.includes("--desktop");
const targetUrl = process.argv.slice(2).find(value => !value.startsWith("--")) || "https://cdn-node-160401.mxdf4.com/?channel=IxCHwB";
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function connect(wsUrl) {
  const socket = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  const listeners = new Map();
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const item = pending.get(message.id);
      if (item) {
        pending.delete(message.id);
        message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result);
      }
      return;
    }
    for (const listener of listeners.get(message.method) || []) listener(message.params);
  });
  return {
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const current = ++id;
        pending.set(current, { resolve, reject });
        socket.send(JSON.stringify({ id: current, method, params }));
      });
    },
    on(method, listener) { listeners.set(method, [...(listeners.get(method) || []), listener]); },
    close() { socket.close(); },
  };
}

const profile = await mkdtemp(path.join(tmpdir(), "fivek-replica-inspect-"));
const proc = spawn(chrome, ["--headless=new", "--disable-gpu", "--no-first-run", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
try {
  let port;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { port = (await readFile(path.join(profile, "DevToolsActivePort"), "utf8")).split(/\r?\n/)[0]; break; } catch { await delay(50); }
  }
  const target = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" }).then(response => response.json());
  const cdp = await connect(target.webSocketDebuggerUrl);
  const responses = [];
  cdp.on("Network.responseReceived", async event => {
    if (!/landing-page|channel|config/i.test(event.response.url)) return;
    await delay(50);
    try {
      const body = await cdp.send("Network.getResponseBody", { requestId: event.requestId });
      responses.push({ url: event.response.url, status: event.response.status, body: body.body });
    } catch (error) {
      responses.push({ url: event.response.url, status: event.response.status, error: error.message });
    }
  });
  await Promise.all([cdp.send("Page.enable"), cdp.send("Network.enable"), cdp.send("Runtime.enable")]);
  if (desktop) {
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false, screenWidth: 1440, screenHeight: 900 });
  } else {
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true, screenWidth: 390, screenHeight: 844 });
    await cdp.send("Network.setUserAgentOverride", { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", platform: "iPhone" });
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  }
  await cdp.send("Page.navigate", { url: targetUrl });
  await delay(7000);
  const shot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(desktop ? "replica-reference-desktop.png" : "replica-reference-mobile.png", Buffer.from(shot.data, "base64"));
  const page = await cdp.send("Runtime.evaluate", { returnByValue: true, expression: `JSON.stringify({url:location.href,title:document.title,text:document.body.innerText,html:document.body.innerHTML.slice(0,20000),elements:[...document.querySelectorAll('a,button,[data-clipboard-text]')].map(el=>({tag:el.tagName,text:(el.innerText||el.getAttribute('aria-label')||'').trim().slice(0,200),href:el.href||'',clipboard:el.getAttribute('data-clipboard-text')||'',id:el.id||'',className:typeof el.className==='string'?el.className:''})),resources:performance.getEntriesByType('resource').map(entry=>({url:entry.name,type:entry.initiatorType,duration:Math.round(entry.duration),size:entry.transferSize})).filter(entry=>/^https?:/.test(entry.url))})` });
  await delay(800);
  await writeFile("replica-reference-data.json", JSON.stringify({ page: JSON.parse(page.result.value), responses }, null, 2));
  cdp.close();
  console.log(JSON.stringify({ page: JSON.parse(page.result.value), responses }, null, 2));
} finally {
  proc.kill();
  await delay(250);
  await rm(profile, { recursive: true, force: true });
}
