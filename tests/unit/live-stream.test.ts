import { describe, expect, it } from "vitest";
import { LIVE_STREAMS } from "../../src/data/live-streams";
import {
  isValidVideoId,
  selectStream,
  streamsInCategory,
  youtubeEmbedUrl,
  youtubeThumbnailUrl,
  youtubeWatchUrl,
} from "../../src/domain/live-stream";

describe("youtubeEmbedUrl", () => {
  it("uses the no-cookie host and suppresses unrelated recommendations", () => {
    const url = new URL(youtubeEmbedUrl("Rn_ga4yXkME"));
    expect(url.origin).toBe("https://www.youtube-nocookie.com");
    expect(url.pathname).toBe("/embed/Rn_ga4yXkME");
    expect(url.searchParams.get("rel")).toBe("0");
    expect(url.searchParams.get("autoplay")).toBeNull();
  });

  it("mutes by default when autoplaying, since browsers block unmuted autoplay", () => {
    const url = new URL(youtubeEmbedUrl("Rn_ga4yXkME", { autoplay: true }));
    expect(url.searchParams.get("autoplay")).toBe("1");
    expect(url.searchParams.get("mute")).toBe("1");
  });

  it("rejects ids that are not plain YouTube video ids", () => {
    expect(() => youtubeEmbedUrl("../evil")).toThrow(/Invalid YouTube video id/);
    expect(() => youtubeWatchUrl("short")).toThrow(/Invalid YouTube video id/);
    expect(() => youtubeThumbnailUrl("")).toThrow(/Invalid YouTube video id/);
    expect(isValidVideoId("W3Y2T66t--Y")).toBe(true);
  });
});

describe("selectStream", () => {
  it("resolves a slug and falls back to the first stream", () => {
    expect(selectStream(LIVE_STREAMS, "biznes24").videoId).toBe("1ocbJcGikfM");
    expect(selectStream(LIVE_STREAMS, null).slug).toBe(LIVE_STREAMS[0]!.slug);
    expect(selectStream(LIVE_STREAMS, "does-not-exist").slug).toBe(LIVE_STREAMS[0]!.slug);
  });
});

describe("LIVE_STREAMS", () => {
  it("has unique slugs and valid video ids", () => {
    expect(new Set(LIVE_STREAMS.map((s) => s.slug)).size).toBe(LIVE_STREAMS.length);
    expect(new Set(LIVE_STREAMS.map((s) => s.videoId)).size).toBe(LIVE_STREAMS.length);
    expect(LIVE_STREAMS.every((s) => isValidVideoId(s.videoId))).toBe(true);
  });

  it("groups into cameras and news channels", () => {
    expect(streamsInCategory(LIVE_STREAMS, "camera").map((s) => s.videoId)).toEqual([
      "Rn_ga4yXkME",
      "W3Y2T66t--Y",
      "uxC7Gf0_MwM",
    ]);
    expect(streamsInCategory(LIVE_STREAMS, "news").map((s) => s.videoId)).toEqual(["1ocbJcGikfM"]);
  });
});
