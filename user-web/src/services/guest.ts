import { apiBase } from "./api";

const tokenKey = "5knews_guest_token_v1",
  userKey = "5knews_guest_user_v1";
let pendingToken: Promise<string> | undefined;

const storedToken = () => {
  try {
    return localStorage.getItem(tokenKey) || "";
  } catch {
    return "";
  }
};

async function ensureToken() {
  const existing = storedToken();
  if (existing) return existing;
  if (pendingToken) return pendingToken;
  pendingToken = fetch(`${apiBase}/auth/guest`, {
    method: "POST",
    headers: { Accept: "application/json" },
  })
    .then(async (response) => {
      const body = await response.json();
      if (!response.ok || !body?.data?.token)
        throw new Error("游客身份创建失败");
      localStorage.setItem(tokenKey, body.data.token);
      localStorage.setItem(userKey, JSON.stringify(body.data.user));
      return body.data.token as string;
    })
    .finally(() => {
      pendingToken = undefined;
    });
  return pendingToken;
}

async function authorized(path: string, method: string, body?: unknown) {
  const send = async (token: string) =>
    fetch(`${apiBase}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  let response = await send(await ensureToken());
  if (response.status === 401) {
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(userKey);
    response = await send(await ensureToken());
  }
  if (!response.ok) throw new Error("游客数据同步失败");
}

export const guestApi = {
  favorite: (videoId: string, favorited: boolean) =>
    authorized(
      `/videos/${encodeURIComponent(videoId)}/favorite${favorited ? "" : "?mode=normal"}`,
      favorited ? "PUT" : "DELETE",
      favorited ? { mode: "normal" } : undefined,
    ),
  progress: (videoId: string, progress: number, duration: number) =>
    authorized(`/videos/${encodeURIComponent(videoId)}/progress`, "PUT", {
      progress,
      duration: Math.max(1, duration),
      mode: "normal",
    }),
  removeProgress: (videoId: string) =>
    authorized(
      `/videos/${encodeURIComponent(videoId)}/progress?mode=normal`,
      "DELETE",
    ),
  clearHistory: () => authorized("/me/history?mode=normal", "DELETE"),
};
