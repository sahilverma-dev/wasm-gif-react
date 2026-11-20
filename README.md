# GIF.WASM — Video to GIF

A privacy-first, client-side video to GIF converter with two encoders: a fast native browser path (Canvas + `gifenc`) and an optional FFmpeg WebAssembly path. Your files never leave the browser.

**Live:** https://wasm-gif-react.vercel.app/

![GIF.WASM](./public/open-graph-image.png)

## Why it exists

Most "video to GIF" sites upload your file to a server. This one doesn't. By default it decodes frames with the browser's own video decoder and encodes them with `gifenc`; the optional FFmpeg engine runs `ffmpeg.wasm` in a Web Worker. Either way there is no account, no watermark and no upload of your media.

## Features

- **Two encoders**:
  - **Browser** (default) — native `<video>` + Canvas + `gifenc`. Starts instantly, needs no download, and works on phones.
  - **FFmpeg** — `ffmpeg.wasm` with a multi-threaded core for photographic video and long clips.
- **Fully client-side** — no uploads, no server-side processing.
- **Lazy FFmpeg** — the 30 MB WebAssembly core is only downloaded when you pick the FFmpeg engine.
- **Batch workspace** — add multiple videos, trim each one, and queue them.
- **Batch clips** — generate several evenly spaced clips from one selection.
- **Output controls** — original or preset resolution, 1–60 FPS and three colour budgets.
- **Smart limits** — 60 s and 100 MB per file by default, with an opt-in "remove limits" mode.
- **Resilient queue** — automatic retries, a stale-job watchdog, cancellation and job dismissal.
- **Download individually or as a ZIP** — the archive code is loaded on demand.
- **Mobile-first controls** — touch-sized targets, visible playback controls, safe-area padding and 16 px inputs (no accidental page zoom).
- **Dark / light / system theme**, reduced-motion support, keyboard navigation and labelled icon buttons.
- **Log viewer** — opt-in FFmpeg output with filtering and copy-to-clipboard.

## Tech stack

| Layer | Choice |
| --- | --- |
| App | React 19, TypeScript, Vite 7 |
| Styling | Tailwind CSS v4, shadcn/ui (Radix primitives), Lucide |
| State | Zustand |
| Motion | Motion for React |
| Browser encoder | Native `<video>` + Canvas + `gifenc` |
| FFmpeg encoder | `@ffmpeg/ffmpeg` + `@ffmpeg/core-mt` (WebAssembly) |
| Files | `react-dropzone`, `jszip`, `file-saver` |

The FFmpeg core is fetched from jsDelivr at runtime (with an unpkg fallback). It is not bundled, which keeps the initial JavaScript small and unused unless selected.

## Getting started

### Requirements

- Node.js 20+
- [Bun](https://bun.sh) 1.2+ (the canonical package manager; `bun.lock` is the source of truth)
- A browser whose native decoder can read your videos (the browser engine), or WebAssembly + `SharedArrayBuffer` + Web Workers (the FFmpeg engine)

### Install and run

```bash
bun install
bun run dev
```

Open http://localhost:3000.

> **Testing on a phone:** the default browser encoder works over a plain LAN HTTP address. The FFmpeg engine needs `SharedArrayBuffer`, which requires a secure context: `localhost` counts, a plain `http://192.168.x.x:3000` address does not. Use an HTTPS tunnel (for example `ngrok http 3000`) or a trusted local certificate when testing FFmpeg on a physical device. The deployed site is HTTPS and unaffected.

```bash
bun run build    # type-check + production build
bun run preview  # serve the production build on port 3000
bun run lint
```

## Required headers (FFmpeg engine only)

The multi-threaded FFmpeg core needs cross-origin isolation. If you use the FFmpeg engine, the deployment must send:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

This repository configures them for:

- local dev and preview — `vite.config.ts`
- Vercel — `vercel.json`
- Netlify — `netlify.toml` and `public/_headers`

Without these headers the app shows a clear error instead of failing silently. If you host elsewhere, add them to your server or CDN configuration.

## How it works

1. A dropped file is inspected locally with a temporary `<video>` element to read duration, dimensions and a poster frame.
2. The job records the trim range, output width, frame rate, quality and chosen engine.
3. **Browser engine (default):** frames are read by seeking the `<video>` element, drawn to a canvas at the target size, quantized to one palette sampled from the clip, and encoded with `gifenc`. No WebAssembly, no download, and memory stays flat because frames are not retained.
4. **FFmpeg engine (optional):** the worker writes the file into FFmpeg's in-memory filesystem. Small selections use the faster single-pass palette (`palettegen` + `paletteuse`); large selections use a two-pass palette so decoded frames are not buffered in the wasm heap, which is what caused out-of-memory crashes on long 720p clips.
5. The FFmpeg worker is recycled between two-pass jobs because this ffmpeg.wasm build cannot safely run another job on the same instance afterwards.
6. GIF blobs are returned to the main thread. Blob URLs are revoked when a video, job or result is removed, so long sessions don't leak memory.

## Project structure

```
src/
  components/      UI (editor, uploader, processing, settings, shared UI)
  hooks/           Worker orchestration, media queries
  lib/             Blob URLs, browser GIF encoder, file validation, metadata
  store/           Zustand stores (videos, jobs, logs, settings)
  types/           Shared types, gifenc declarations, worker contracts
  workers/         FFmpeg Web Worker (created only when that engine is used)
```

## Contributing

Issues and pull requests are welcome. Please run `bun run lint` and `bun run build` before opening a PR.

## Credits

Built by [Sahil Verma](https://sahilverma.dev) with React, FFmpeg.wasm and a lot of browser testing.
