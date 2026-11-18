# GIF.WASM — Video to GIF

A privacy-first, client-side video to GIF converter built with React, WebAssembly and FFmpeg. Your files never leave the browser.

**Live:** https://wasm-gif-react.vercel.app/

![GIF.WASM](./public/open-graph-image.png)

## Why it exists

Most "video to GIF" sites upload your file to a server. This one doesn't. `ffmpeg.wasm` runs the encoder inside a Web Worker on your device, so conversion works with no account, no watermark and no network traffic for the media itself.

## Features

- **Fully client-side** — no uploads, no server-side processing.
- **Multi-threaded FFmpeg** — the `core-mt` build runs across CPU cores.
- **Batch workspace** — add multiple videos, trim each one, and queue them.
- **Batch clips** — generate several evenly spaced clips from one selection.
- **Output controls** — original or preset resolution, 1–60 FPS and three dither qualities.
- **Smart limits** — 60 s and 100 MB per file by default, with an opt-in "remove limits" mode.
- **Resilient queue** — automatic retry with safer settings, a stale-job watchdog, cancellation and job dismissal.
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
| Media | `@ffmpeg/ffmpeg` + `@ffmpeg/core-mt` (WebAssembly) |
| Files | `react-dropzone`, `jszip`, `file-saver` |

The FFmpeg core is fetched from jsDelivr at runtime (with an unpkg fallback). It is not bundled, which keeps the initial JavaScript small.

## Getting started

### Requirements

- Node.js 20+
- [Bun](https://bun.sh) 1.2+ (the canonical package manager; `bun.lock` is the source of truth)
- A browser with WebAssembly, `SharedArrayBuffer` and Web Workers

### Install and run

```bash
bun install
bun run dev
```

Open http://localhost:3000.

> **Testing on a phone:** `SharedArrayBuffer` requires a secure context. `localhost` counts as one, but a plain `http://192.168.x.x:3000` LAN address does not, so the encoder will refuse to start there. Use an HTTPS tunnel (for example `ngrok http 3000`) or a trusted local certificate when testing on a physical device. The deployed site is HTTPS and unaffected.

```bash
bun run build    # type-check + production build
bun run preview  # serve the production build on port 3000
bun run lint
```

## Required headers (important)

The multi-threaded FFmpeg core needs cross-origin isolation. Every deployment must send:

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
2. The file, trim range and settings are turned into an FFmpeg argument list.
3. The main thread posts one job at a time to `src/workers/ffmpeg.worker.ts`.
4. The worker writes the file into FFmpeg's in-memory filesystem. Small selections use the faster single-pass palette (`palettegen` + `paletteuse`); large selections use a two-pass palette so decoded frames are not buffered in the wasm heap, which is what caused out-of-memory crashes on long 720p clips.
5. The worker is recycled between two-pass jobs because this ffmpeg.wasm build cannot safely run another job on the same instance afterwards.
6. GIF blobs are returned to the main thread. Blob URLs are revoked when a video, job or result is removed, so long sessions don't leak memory.

## Project structure

```
src/
  components/      UI (editor, uploader, processing, settings, shared UI)
  hooks/           Worker orchestration, media queries
  lib/             Blob URLs, file validation, metadata, formatting
  store/           Zustand stores (videos, jobs, logs, settings)
  types/           Shared types and worker message contracts
  workers/         FFmpeg Web Worker
```

## Contributing

Issues and pull requests are welcome. Please run `bun run lint` and `bun run build` before opening a PR.

## Credits

Built by [Sahil Verma](https://sahilverma.dev) with React, FFmpeg.wasm and a lot of browser testing.
