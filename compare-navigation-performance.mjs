import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const chrome = "E:\\playwright-browsers\\chromium-1187\\chrome-win\\chrome.exe";
const args = process.argv.slice(2);
const mobile = args.includes("--mobile");
const requestedUrls = args.filter((value) => !value.startsWith("--"));
const urls = requestedUrls.length ? requestedUrls : ["https://daohang.wflhc.cn/", "https://daohang1.wflhc.cn/"];
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    once(method) {
      return new Promise((resolve) => {
        const listener = (params) => {
          listeners.set(method, (listeners.get(method) || []).filter((item) => item !== listener));
          resolve(params);
        };
        listeners.set(method, [...(listeners.get(method) || []), listener]);
      });
    },
    on(method, listener) { listeners.set(method, [...(listeners.get(method) || []), listener]); },
    close() { socket.close(); },
  };
}

async function run(url) {
  const profile = await mkdtemp(path.join(tmpdir(), "fivek-nav-perf-"));
  const proc = spawn(chrome, ["--headless=new", "--disable-gpu", "--no-first-run", "--disable-background-networking", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
  try {
    let port;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { port = (await readFile(path.join(profile, "DevToolsActivePort"), "utf8")).split(/\r?\n/)[0]; break; } catch { await delay(50); }
    }
    if (!port) throw new Error("Chromium DevTools port unavailable");
    const target = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" }).then((response) => response.json());
    const cdp = await connect(target.webSocketDebuggerUrl);
    const requests = new Map(), failures = [];
    cdp.on("Network.responseReceived", (event) => requests.set(event.requestId, { url: event.response.url, type: event.type, status: event.response.status, mime: event.response.mimeType, encoded: 0 }));
    cdp.on("Network.loadingFinished", (event) => { const item = requests.get(event.requestId); if (item) item.encoded = event.encodedDataLength; });
    cdp.on("Network.loadingFailed", (event) => failures.push({ requestId: event.requestId, error: event.errorText }));
    await Promise.all([cdp.send("Page.enable"), cdp.send("Network.enable"), cdp.send("Runtime.enable")]);
    if (mobile) {
      await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true, screenWidth: 390, screenHeight: 844 });
      await cdp.send("Network.setUserAgentOverride", { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", platform: "iPhone" });
      await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    }
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    const loaded = cdp.once("Page.loadEventFired");
    const started = performance.now();
    await cdp.send("Page.navigate", { url });
    await Promise.race([loaded, delay(30000)]);
    await delay(5000);
    const elapsed = performance.now() - started;
    const evaluated = await cdp.send("Runtime.evaluate", { returnByValue: true, expression: `JSON.stringify({navigation:performance.getEntriesByType('navigation')[0]?.toJSON(),paints:performance.getEntriesByType('paint').map(x=>({name:x.name,startTime:x.startTime})),resources:performance.getEntriesByType('resource').map(x=>({name:x.name,initiatorType:x.initiatorType,duration:x.duration,transferSize:x.transferSize,encodedBodySize:x.encodedBodySize})),images:[...document.images].map(x=>({src:x.currentSrc||x.src,complete:x.complete,naturalWidth:x.naturalWidth})),ads:[...document.querySelectorAll('.fivek-ad')].map(x=>({zone:x.dataset.zone,mounted:x.dataset.fivekMounted,error:x.dataset.fivekError,text:x.textContent?.trim(),hidden:x.hidden,children:x.children.length,links:x.querySelectorAll('a').length,images:[...x.querySelectorAll('img')].map(i=>({src:i.currentSrc||i.src,width:i.naturalWidth,height:i.naturalHeight})),rect:(()=>{const r=x.getBoundingClientRect();return {top:r.top,width:r.width,height:r.height}})()}))})` });
    const page = JSON.parse(evaluated.result.value);
    const network = [...requests.values()];
    cdp.close();
    return { url, elapsed, page, network, failures };
  } finally {
    proc.kill();
    await delay(300);
    await rm(profile, { recursive: true, force: true });
  }
}

for (const url of urls) {
  const result = await run(url);
  const nav = result.page.navigation || {};
  const resources = result.page.resources || [];
  const images = result.page.images || [];
  const slow = [...resources].sort((a, b) => b.duration - a.duration).slice(0, 10);
  console.log(JSON.stringify({
    url,
    observedMs: Math.round(result.elapsed),
    domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd || 0),
    loadMs: Math.round(nav.loadEventEnd || 0),
    firstContentfulPaintMs: Math.round(result.page.paints?.find((item) => item.name === "first-contentful-paint")?.startTime || 0),
    requestCount: result.network.length,
    resourceCount: resources.length,
    transferredKB: Math.round(result.network.reduce((sum, item) => sum + (item.encoded || 0), 0) / 1024),
    imageCount: images.length,
    brokenImages: images.filter((item) => item.complete && !item.naturalWidth).length,
    brokenImageUrls: images.filter((item) => item.complete && !item.naturalWidth).map((item) => item.src),
    ads: result.page.ads || [],
    failures: result.failures.length,
    failureUrls: result.failures,
    resourceTypes: Object.fromEntries(Object.entries(result.network.reduce((counts, item) => ({ ...counts, [item.type]: (counts[item.type] || 0) + 1 }), {})).sort()),
    imageResponses: result.network.filter((item) => item.type === "Image" || item.mime?.startsWith("image/")).slice(0, 30).map((item) => ({ url: item.url, mime: item.mime, status: item.status, kb: Math.round((item.encoded || 0) / 1024) })),
    slow: slow.map((item) => ({ url: item.name, type: item.initiatorType, ms: Math.round(item.duration), kb: Math.round((item.transferSize || 0) / 1024) })),
  }, null, 2));
}
