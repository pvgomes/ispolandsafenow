import type { LiveStream } from "../domain/live-stream";

/**
 * Public 24/7 YouTube streams embedded on /live. Cameras come from
 * WebCamera.pl, which aggregates tourist webcams across Poland; the news
 * channels are live rolling broadcasts. These are third-party feeds and may
 * go offline or be rotated by their owners at any time.
 */
export const LIVE_STREAMS: readonly LiveStream[] = [
  {
    slug: "cities",
    videoId: "Rn_ga4yXkME",
    title: "Polish cities",
    description: "Rotating live views from city-centre cameras across Poland.",
    channelName: "WebCamera.pl",
    channelUrl: "https://www.youtube.com/@WebCameraPl",
    badge: "PL",
    category: "camera",
  },
  {
    slug: "mountains",
    videoId: "W3Y2T66t--Y",
    title: "Mountain resorts",
    description: "Cameras from tourist towns in the Tatras and other Polish mountain ranges.",
    channelName: "WebCamera.pl",
    channelUrl: "https://www.youtube.com/@WebCameraPl",
    badge: "PL",
    category: "camera",
  },
  {
    slug: "beaches",
    videoId: "uxC7Gf0_MwM",
    title: "Baltic beaches",
    description: "A year-round rotation of 50 beach cameras along the Polish coast.",
    channelName: "WebCamera.pl",
    channelUrl: "https://www.youtube.com/@WebCameraPl",
    badge: "PL",
    category: "camera",
  },
  {
    slug: "biznes24",
    videoId: "1ocbJcGikfM",
    title: "BIZNES24",
    description: "Polish-language rolling news and business television, streamed live.",
    channelName: "Telewizja BIZNES24",
    channelUrl: "https://www.youtube.com/@TelewizjaBIZNES24",
    badge: "PL",
    category: "news",
  },
];
