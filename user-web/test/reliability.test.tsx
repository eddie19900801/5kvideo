import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { WatchClock } from "../src/services/watchClock";

const dom = new JSDOM("<!doctype html><div id='root'></div>", { url: "https://example.test" });
for (const key of ["window", "document", "navigator", "location", "localStorage", "sessionStorage", "Event", "HTMLElement", "innerWidth", "innerHeight"])
  Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.IntersectionObserver = class { observe() {} disconnect() {} unobserve() {} } as any;
const { createRoot } = await import("react-dom/client");
const { usePagedVideos } = await import("../src/hooks/usePagedVideos");
const { videoApi } = await import("../src/services/api");
const originalList = videoApi.list;
const { library } = await import("../src/services/library");
const { guestApi } = await import("../src/services/guest");
const { default: ContinueWatching } = await import("../src/components/ContinueWatching");
const { default: Profile } = await import("../src/pages/profile/page");
const { default: Home } = await import("../src/pages/home/page");
guestApi.progress = async () => {};
guestApi.favorite = async () => {};
const { default: SearchPanel } = await import("../src/pages/home/components/SearchPanel");
const { default: ContentFeedback } = await import("../src/components/ContentFeedback");
const { analytics } = await import("../src/services/analytics");
const { default: VideoPlayer } = await import("../src/pages/video/components/VideoPlayer");
const { default: VideoDetail } = await import("../src/pages/video/page");
const { MemoryRouter, Routes, Route } = await import("react-router-dom");
window.scrollTo = () => {};
globalThis.fetch = async () => new Response(JSON.stringify({ data: {} }), { headers: { "Content-Type": "application/json" } });
let root: ReturnType<typeof createRoot> | undefined;
let result: ReturnType<typeof usePagedVideos>;
const node = document.getElementById("root")!;
const video = (id: string) => ({ id, title: id, thumbnail: "", duration: 100, views: 0, tags: [], category: "", updatedAt: "", aspectRatio: "landscape" as const });
const page = (ids: string[], number = 1) => ({ page: number, pageSize: 20, total: 40, pageCount: 2, items: ids.map(video) });
function Harness({ query = "", personal = false }: { query?: string; personal?: boolean }) { result = usePagedVideos({ q: query, personalizeFeed: personal }); return <div ref={result.sentinel}>{result.videos.map(item => item.id).join(",")}</div>; }
async function render(element: React.ReactNode) { await act(async () => { root ??= createRoot(node); root.render(element); }); }
afterEach(async () => { await act(async () => root?.unmount()); root = undefined; localStorage.clear(); sessionStorage.clear(); window.history.replaceState({}, "", "/"); });

test("watch time excludes seeks, pauses, stalls and doubles neither speed nor time", () => {
  const clock = new WatchClock();
  assert.equal(clock.sample(1000, 0, 1, true), 0);
  assert.equal(clock.sample(1250, 0.25, 1, true), 0.25);
  assert.equal(clock.sample(1500, 50, 1, true), 0);
  clock.reset();
  assert.equal(clock.sample(1750, 50, 1, true), 0);
  assert.equal(clock.sample(2000, 50, 1, true), 0);
  assert.equal(clock.sample(2250, 50.5, 2, true), 0.25);
  assert.equal(clock.sample(2500, 51, 2, false), 0);
  assert.equal(clock.sample(2750, 51.5, 2, true), 0);
});

test("failed pagination keeps rows and retries the failed page without duplicates", async () => {
  const requests: number[] = [];
  let fail = true;
  videoApi.list = async input => { requests.push(input.page); if (input.page === 2 && fail) throw new Error("offline"); return input.page === 1 ? page(["a"]) : page(["a", "b"], 2); };
  await render(<Harness />);
  assert.deepEqual(result.videos.map(item => item.id), ["a"]);
  await act(async () => result.loadMore());
  assert.equal(result.error, "offline");
  assert.equal(node.textContent, "a");
  fail = false;
  await act(async () => result.retry());
  assert.deepEqual(result.videos.map(item => item.id), ["a", "b"]);
  assert.deepEqual(requests, [1, 2, 2]);
});

test("late responses from previous searches never overwrite the new query", async () => {
  let resolveOld: (value: ReturnType<typeof page>) => void;
  videoApi.list = input => input.q === "old" ? new Promise(resolve => { resolveOld = resolve; }) : Promise.resolve(page(["new"]));
  await render(<Harness query="old" />);
  await render(<Harness query="new" />);
  await act(async () => resolveOld!(page(["old"])));
  assert.equal(node.textContent, "new");
  assert.equal(result.loading, false);
});

test("a failed first page can be retried", async () => {
  videoApi.list = async () => { throw new Error("offline"); };
  await render(<Harness />);
  assert.equal(result.error, "offline");
  videoApi.list = async () => page(["recovered"]);
  await act(async () => result.retry());
  assert.equal(node.textContent, "recovered");
  assert.equal(result.error, "");
});

test("search draft submits once and does not alter the committed keyword", async () => {
  videoApi.hotSearches = async () => [];
  videoApi.recordSearch = async () => ({ recorded: true });
  const searches: string[] = [];
  const props = { open: true, keyword: "original", categories: [], onCategorySelect() {}, onClose() {}, onSearch: (value: string) => searches.push(value), onTagSelect() {} };
  await render(<SearchPanel {...props} />);
  const input = node.querySelector("input")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(input, "draft");
    input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  });
  assert.deepEqual(searches, []);
  await act(async () => node.querySelector("form")!.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })));
  assert.deepEqual(searches, ["draft"]);
  await render(<SearchPanel {...props} open={false} />);
  await render(<SearchPanel {...props} />);
  assert.equal(node.querySelector("input")!.value, "original");
});

test("feedback reports failure honestly, then succeeds on retry", async () => {
  analytics.report = async () => false;
  await render(<ContentFeedback videoId="test" title="Test" />);
  const submit = async () => { await act(async () => node.querySelector("form")!.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }))); };
  await submit();
  assert.match(node.textContent!, /提交失败/);
  analytics.report = async () => true;
  await submit();
  assert.match(node.textContent!, /反馈已收到/);
});

test("native playback failure offers a retry and restores the trimmed progress", async () => {
  dom.window.HTMLMediaElement.prototype.canPlayType = () => "probably";
  dom.window.HTMLMediaElement.prototype.play = async function () {};
  dom.window.HTMLMediaElement.prototype.pause = function () {};
  await render(<VideoPlayer src="https://example.test/video.m3u8" poster="" title="Test" trimStart={30} trimEnd={30} initialTime={20} />);
  const media = node.querySelector("video")!;
  Object.defineProperty(media, "duration", { value: 200, configurable: true });
  await act(async () => media.dispatchEvent(new Event("loadedmetadata")));
  assert.equal(media.currentTime, 50);
  media.currentTime = 85;
  await act(async () => media.dispatchEvent(new Event("error")));
  assert.match(node.textContent!, /重试播放/);
  await act(async () => (node.querySelector("button") as HTMLButtonElement).click());
  await act(async () => media.dispatchEvent(new Event("loadedmetadata")));
  assert.equal(media.currentTime, 85);
  assert.equal(node.querySelector('[role="alert"]'), null);
});

test("recommendation failure leaves the detail player mounted", async () => {
  videoApi.detail = async () => ({ ...video("sample"), description: "", playbackUrl: "https://example.test/sample.m3u8", trimStart: 0, trimEnd: 0, highlights: [] });
  videoApi.list = async () => { throw new Error("recommendation offline"); };
  await render(<MemoryRouter initialEntries={["/video/sample"]}><Routes><Route path="/video/:id" element={<VideoDetail />} /></Routes></MemoryRouter>);
  assert.ok(node.querySelector("video"));
  assert.match(node.textContent!, /推荐加载失败，视频可以继续播放/);
});

test("completed videos leave continue watching, while replay can start at zero", async () => {
  const item = { ...video("continue"), thumbnail: "https://example.test/cover.jpg" };
  library.record(item, 20);
  await render(<MemoryRouter><ContinueWatching /></MemoryRouter>);
  assert.match(node.textContent!, /上次看到 0:20/);
  await act(async () => library.complete(item));
  assert.equal(node.textContent, "");
  assert.equal(library.progress(item.id), 0);
  await act(async () => library.record(item, 0));
  assert.equal(library.history()[0].progress, 0);
  assert.equal(library.history()[0].completed, false);
});

test("legacy history is retained and completed records can be filtered and searched", async () => {
  localStorage.setItem("5knews_history_v1", JSON.stringify([{ ...video("legacy"), thumbnail: "https://example.test/cover.jpg", progress: 20, watchedAt: Date.now() }]));
  assert.equal(library.continuing()[0].id, "legacy");
  library.complete({ ...video("finished"), thumbnail: "https://example.test/cover.jpg" });
  await render(<MemoryRouter><Profile /></MemoryRouter>);
  const select = node.querySelector("select")!;
  await act(async () => { select.value = "completed"; select.dispatchEvent(new Event("change", { bubbles: true })); });
  assert.match(node.textContent!, /finished/);
  assert.doesNotMatch(node.textContent!, /legacy/);
  const input = node.querySelector("input")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(input, "missing");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  assert.match(node.textContent!, /没有符合条件的记录/);
  assert.equal(library.history().length, 2);
});

test("home removes obsolete sort and duration filters while retaining search and topics", async () => {
  window.history.replaceState({}, "", "/?q=alpha&category=cat-a&sort=latest&duration=medium");
  sessionStorage.setItem("5knews_feed_sort","latest");
  sessionStorage.setItem("5knews_feed_duration","long");
  videoApi.categories = async () => [{ id: "cat-a", name: "CategoryA", count: 40 }];
  const requests: any[] = [];
  videoApi.list = async input => { requests.push(input); return page([]); };
  await render(<MemoryRouter><Home /></MemoryRouter>);
  assert.equal(node.querySelector('[aria-label="内容排序"]'),null);
  assert.equal(node.querySelector('[aria-label="播放时长"]'),null);
  assert.equal(requests.at(-1).q,"alpha");
  assert.equal(requests.at(-1).category,"cat-a");
  assert.equal(requests.at(-1).sort,"recommended");
  assert.equal(requests.at(-1).duration,"all");
  assert.ok(!new URLSearchParams(location.search).has("sort"));
  assert.ok(!new URLSearchParams(location.search).has("duration"));
  assert.equal(sessionStorage.getItem("5knews_feed_sort"),null);
  assert.ok(node.querySelector('section[aria-label="专题推荐"]'));
});

test("filtered requests bypass static bootstrap and share a stable paging seed", async () => {
  const requests: string[] = [];
  globalThis.fetch = async url => { requests.push(String(url)); return new Response(JSON.stringify({ data: page([]) })); };
  await originalList({ page: 1, sort: "latest", duration: "medium", seed: "test-session" });
  await originalList({ page: 2, sort: "latest", duration: "medium", seed: "test-session" });
  assert.ok(requests.every(url => url.includes("sort=latest") && url.includes("duration=medium") && !new URL(url, location.origin).pathname.includes("bootstrap")));
  assert.equal(new URL(requests[0],location.origin).searchParams.get("seed"), new URL(requests[1],location.origin).searchParams.get("seed"));
});

test("history uses actual media duration when the catalog duration is missing", async () => {
  videoApi.detail = async () => ({ ...video("unknown-duration"), duration: 1, description: "", playbackUrl: "https://example.test/sample.m3u8", trimStart: 0, trimEnd: 0, highlights: [] });
  videoApi.list = async () => page([]);
  await render(<MemoryRouter initialEntries={["/video/unknown-duration"]}><Routes><Route path="/video/:id" element={<VideoDetail />} /></Routes></MemoryRouter>);
  const media = node.querySelector("video")!;
  Object.defineProperty(media, "duration", { value: 200, configurable: true });
  await act(async () => media.dispatchEvent(new Event("loadedmetadata")));
  await act(async () => media.dispatchEvent(new Event("play")));
  media.currentTime = 20;
  await act(async () => media.dispatchEvent(new Event("timeupdate")));
  assert.equal(library.history()[0].duration, 200);
  assert.equal(library.continuing()[0].progress, 20);
  await act(async () => media.dispatchEvent(new Event("ended")));
  assert.equal(library.history()[0].completed, true);
  assert.equal(library.history()[0].progress, 200);
  assert.equal(library.continuing().length, 0);
});

test("favorite groups preserve legacy items and deleting a group keeps its videos", () => {
  localStorage.setItem("5knews_favorites_v1", JSON.stringify([video("a"),video("b")]));
  const group = library.saveGroup("Later");
  assert.throws(() => library.saveGroup(" later "));
  library.assignGroup(["a","b"], group.id);
  assert.ok(library.favorites().every(item => item.groupId === group.id));
  library.saveGroup("Weekend",group.id);
  assert.equal(library.groups()[0].name,"Weekend");
  library.deleteGroup(group.id);
  assert.deepEqual(library.favorites().map(item => item.id),["a","b"]);
  assert.ok(library.favorites().every(item => !item.groupId));
  assert.throws(() => library.assignGroup(["a"],group.id));
});

test("personalized feed demotes watched items and hide/restore updates without refetch", async () => {
  let calls=0;
  videoApi.list=async () => {calls++;return page(["a","b","c"]);};
  library.record(video("a"),20);
  await render(<Harness personal />);
  assert.equal(node.textContent,"b,c,a");
  await act(async () => library.hide(video("b")));
  assert.equal(node.textContent,"c,a");
  await act(async () => library.restoreHidden("b"));
  assert.equal(node.textContent,"b,c,a");
  assert.equal(calls,1);
  await render(<Harness />);
  assert.equal(node.textContent,"a,b,c");
});

test("related requests bypass static bootstrap and preserve the source id", async () => {
  const requests:string[]=[];
  globalThis.fetch=async input => { requests.push(String(input));return new Response(JSON.stringify({data:page(["b"])})); };
  videoApi.list=originalList;
  await videoApi.list({page:1,relatedTo:"source-id"});
  assert.equal(requests.length,1);
  assert.ok(requests[0].includes("relatedTo=source-id"));
  assert.ok(!new URL(requests[0], "https://example.test").pathname.includes("bootstrap"));
});

test("recommendation notice can undo hiding immediately", async () => {
  const {default: Notice}=await import("../src/components/RecommendationNotice");
  await render(<Notice />);
  await act(async () => library.hide(video("a")));
  assert.equal(library.hidden().length,1);
  const undo=node.querySelector("button")!;
  assert.equal(undo.textContent,"撤销");
  await act(async () => undo.click());
  assert.equal(library.hidden().length,0);
  assert.equal(node.textContent,"");
});

test("profile bulk moves favorites and follows group removal from another view", async () => {
  library.toggleFavorite(video("a"));library.toggleFavorite(video("b"));
  const group=library.saveGroup("Weekend");
  await render(<MemoryRouter><Profile /></MemoryRouter>);
  await act(async () => [...node.querySelectorAll("button")].find(button=>button.textContent?.includes("我的收藏"))!.click());
  await act(async () => [...node.querySelectorAll("button")].find(button=>button.textContent?.includes("选择当前结果"))!.click());
  const select=node.querySelector<HTMLSelectElement>('select[aria-label="批量移动收藏"]')!;
  await act(async () => {select.value=group.id;select.dispatchEvent(new Event("change",{bubbles:true}));});
  assert.ok(library.favorites().every(item=>item.groupId===group.id));
  await act(async () => library.deleteGroup(group.id));
  assert.equal(library.favorites().length,2);
  assert.ok(library.favorites().every(item=>!item.groupId));
});

test("topic cards open their category, link covers and respect hidden videos", async () => {
  const {default: Topics}=await import("../src/pages/home/components/TopicRecommendations");
  const originalBootstrap=videoApi.bootstrap;
  const originalTopics=videoApi.topics;
  videoApi.topics=async () => { throw new Error("offline"); };
  let selected="";
  videoApi.bootstrap=async () => ({version:"test",generatedAt:"",pools:[],categories:[{id:"a",name:"分类A",count:4},{id:"b",name:"分类B",count:3}],categoryPages:{a:{...page(["a1","a2","a3","a4"]),items:page(["a1","a2","a3","a4"]).items.map(item=>({...item,category:"CategoryA"}))},b:page(["b1","b2","b3"])}});
  try {
    library.hide(video("a1"));
    library.toggleFavorite({...video("a2"),category:"CategoryA"});
    await render(<MemoryRouter><Topics onOpen={id=>{selected=id;}} /></MemoryRouter>);
    assert.deepEqual([...node.querySelectorAll("a")].map(link=>link.getAttribute("href")),["/video/a2","/video/a3","/video/a4"]);
    await act(async () => [...node.querySelectorAll("button")].find(button=>button.textContent?.includes("查看专题"))!.click());
    assert.equal(selected,"a");
    await act(async () => [...node.querySelectorAll("button")].find(button=>button.textContent==="换个专题")!.click());
    assert.match(node.textContent!,/分类B/);
    await act(async () => library.hide(video("b1")));
    assert.match(node.textContent!,/分类A/);
  } finally { videoApi.bootstrap=originalBootstrap; videoApi.topics=originalTopics; }
});

test("topic interest uses effective watching and favorites, excludes hidden and reduced topics", async () => {
  const {rankTopics,topicInterests}=await import("../src/services/topicInterests");
  const candidate=(id:string)=>({id,name:id,crowdReady:false,crowdScore:0,videos:[1,2,3,4].map(n=>({...video(id+n),category:id,crowdScore:0,importedAt:"2026-09-15T00:00:00Z"}))});
  const topics=[candidate("a"),candidate("b"),candidate("c"),candidate("d"),candidate("e"),candidate("f")];
  library.record({...video("b1"),category:"b"},99);
  const before=rankTopics(topics,42);
  topicInterests.watch({...video("b1"),category:"b"},2,"short");
  assert.deepEqual(rankTopics(topics,42),before);
  topicInterests.watch({...video("b1"),category:"b"},60,"visit");
  assert.equal(rankTopics(topics,42)[0].id,"b");
  assert.match(rankTopics(topics,42)[0].reason,/有效观看/);
  assert.equal(rankTopics(topics,42)[4].reason,"发现一个不同的主题");
  library.hide({...video("b2"),category:"b"});
  assert.ok(rankTopics(topics,42).every(topic=>topic.videos.every(item=>item.id!=="b2")));
  topicInterests.reduce("b");
  assert.ok(!rankTopics(topics,42).some(topic=>topic.id==="b"));
  topicInterests.restore();
  assert.ok(rankTopics(topics,42).some(topic=>topic.id==="b"));
});

test("new visitors prefer supported crowd signals and searches influence topic selection", async () => {
  const {rankTopics,topicInterests}=await import("../src/services/topicInterests");
  const topics=["a","b"].map(id=>({id,name:id,crowdReady:id==="a",crowdScore:id==="a"?.1:0,videos:[1,2,3].map(n=>({...video(id+n),category:id,crowdScore:id==="a"?.1:0,importedAt:""}))}));
  assert.equal(rankTopics(topics,42)[0].id,"a");
  assert.match(rankTopics(topics,42)[0].reason,/全站/);
  topicInterests.search("b");
  library.toggleFavorite({...video("b1"),category:"b"});
  assert.equal(rankTopics(topics,42)[0].id,"b");
});

test("topic section remains visible on failure and can retry", async () => {
  const {default: Topics}=await import("../src/pages/home/components/TopicRecommendations");
  const originalTopics=videoApi.topics, originalBootstrap=videoApi.bootstrap;
  videoApi.topics=async () => { throw new Error("offline"); };
  videoApi.bootstrap=async () => { throw new Error("offline"); };
  try {
    await render(<MemoryRouter><Topics onOpen={()=>{}} /></MemoryRouter>);
    assert.ok(node.querySelector('section[aria-label="专题推荐"]'));
    assert.match(node.textContent!,/专题暂时加载失败/);
    videoApi.topics=async () => ({version:"interest-v1",topics:[{id:"topic",name:"测试专题",crowdReady:false,crowdScore:0,videos:["a","b","c"].map(id=>({...video(id),crowdScore:0,importedAt:""}))}]});
    await act(async () => [...node.querySelectorAll("button")].find(button=>button.textContent==="重新加载专题")!.click());
    assert.equal(node.querySelectorAll("a").length,3);
    assert.doesNotMatch(node.textContent!,/推荐说明与设置|继续观看/);
  } finally {videoApi.topics=originalTopics;videoApi.bootstrap=originalBootstrap;}
});
