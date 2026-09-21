/**
 * Live YouTube streams shown on /live: public webcams pointed at Polish
 * cities and live news channels. Nothing here is an official feed — the
 * page only embeds third-party streams that anyone can watch on YouTube.
 */
export type LiveStreamCategory = "camera" | "news";

export interface LiveStream {
  /** Stable slug used in the DOM and in the `?stream=` query parameter. */
  readonly slug: string;
  /** 11-character YouTube video id. */
  readonly videoId: string;
  readonly title: string;
  readonly description: string;
  readonly channelName: string;
  readonly channelUrl: string;
  /** Short chip suffix, e.g. "PL" — mirrors the country tags on the channel buttons. */
  readonly badge: string;
  readonly category: LiveStreamCategory;
}

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export function isValidVideoId(videoId: string): boolean {
  return VIDEO_ID_PATTERN.test(videoId);
}

export interface EmbedOptions {
  readonly autoplay?: boolean;
  /** Browsers only allow autoplay while muted, so it defaults to on with autoplay. */
  readonly mute?: boolean;
}

/**
 * Builds a privacy-friendly (`youtube-nocookie.com`) embed URL. Throws on a
 * malformed id so a typo in the stream list fails at build time rather than
 * rendering an iframe that points somewhere unexpected.
 */
export function youtubeEmbedUrl(videoId: string, options: EmbedOptions = {}): string {
  if (!isValidVideoId(videoId)) throw new Error(`Invalid YouTube video id: ${videoId}`);
  const autoplay = options.autoplay ?? false;
  const mute = options.mute ?? autoplay;
  const params = new URLSearchParams({ rel: "0", playsinline: "1" });
  if (autoplay) params.set("autoplay", "1");
  if (mute) params.set("mute", "1");
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}

export function youtubeWatchUrl(videoId: string): string {
  if (!isValidVideoId(videoId)) throw new Error(`Invalid YouTube video id: ${videoId}`);
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function youtubeThumbnailUrl(videoId: string): string {
  if (!isValidVideoId(videoId)) throw new Error(`Invalid YouTube video id: ${videoId}`);
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function streamsInCategory(
  streams: readonly LiveStream[],
  category: LiveStreamCategory,
): LiveStream[] {
  return streams.filter((stream) => stream.category === category);
}

/** Resolves the `?stream=` slug, falling back to the first stream in the list. */
export function selectStream(streams: readonly LiveStream[], slug: string | null): LiveStream {
  if (streams.length === 0) throw new Error("No live streams configured");
  return streams.find((stream) => stream.slug === slug) ?? streams[0]!;
}
