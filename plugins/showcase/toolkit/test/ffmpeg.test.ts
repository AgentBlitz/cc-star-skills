import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { missing, parseCapabilities } from "../lib/ffmpeg.ts";

const VERSION = `ffmpeg version 8.0.1 Copyright (c) 2000-2025 the FFmpeg developers
configuration: --prefix=/opt/homebrew --enable-libass --enable-libmp3lame --enable-libsoxr --enable-libx264
`;
const FILTERS = `Filters:
  T.. = Timeline support
  ------
 ... alimiter          A->A       Audio lookahead limiter.
 ... aresample         A->A       Resample audio data.
 ... ebur128           A->N       EBU R128 scanner.
 ... loudnorm          A->A       EBU R128 loudness normalization
 T.. silenceremove     A->A       Remove silent frames.
 ... ass               V->V       Render ASS subtitles onto input video using the libass library.
 T.. perspective       V->V       Correct the perspective of video.
 ... subtitles         V->V       Render text subtitles onto input video using the libass library.
`;
const ENCODERS = `Encoders:
 V..... = Video
 ------
 V....D libx264              libx264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10 (codec h264)
 A....D aac                  AAC (Advanced Audio Coding)
 A....D libmp3lame           libmp3lame MP3 (MPEG audio layer 3) (codec mp3)
`;

describe("ffmpeg capability parsing", () => {
  it("finds every capability in a full build", () => {
    const p = parseCapabilities(VERSION, FILTERS, ENCODERS);
    assert.equal(p.version, "8.0.1");
    assert.deepEqual(missing(p), []);
  });

  it("reports what a thin build lacks", () => {
    const p = parseCapabilities(
      VERSION.replace("--enable-libsoxr ", ""),
      FILTERS.replace(/^.*\bass\b.*$/m, "").replace(/^.*perspective.*$/m, ""),
      ENCODERS.replace(/^.*libmp3lame.*$/m, ""),
    );
    assert.deepEqual(missing(p).sort(), ["ass", "libmp3lame", "perspective", "soxr"]);
  });

  it("doesn't mistake a description word for a filter name", () => {
    const p = parseCapabilities("ffmpeg version x", " ... subtitles V->V Render ass subtitles\n", "");
    assert.equal(p.capabilities.ass, false);
    assert.equal(p.capabilities.subtitles, true);
  });
});
