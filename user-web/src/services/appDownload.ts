export const appDownloadUrl = "/app/5kvideo-latest.apk";
export const appLandingUrl = "/app/download/";
export const slowPlaybackEvent = "5knews:slow-playback";

export const isAndroidDevice = /Android/i.test(navigator.userAgent);
export const appDownloadEntry = isAndroidDevice ? appDownloadUrl : appLandingUrl;

export function promptAppForSlowPlayback() {
  window.dispatchEvent(new CustomEvent(slowPlaybackEvent));
}
