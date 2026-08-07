# Video Editor

A self-hosted video processing backend built with **Node.js**, **Express**, and **FFmpeg**. Handles video uploads, thumbnail generation, audio extraction, and resizing — with a job queue to keep CPU usage under control, and an optional cluster mode for scaling across CPU cores.

> Portfolio/learning project focused on backend architecture: streamed upload validation, background job processing, and multi-process coordination.

## Features

- **JWT-based authentication** — cookie sessions, protected routes
- **Streamed upload validation** — a custom `Transform` stream checks file signature and size on the fly, without buffering the whole file or pulling in a validation library
- **Automatic thumbnails** — generated on upload via FFmpeg
- **Audio extraction** — pulls the audio track out in its original codec
- **Video resizing/transcoding** — runs as a background job, not inline with the request
- **Job queue** — resize jobs are queued and processed one at a time with limited FFmpeg threads, so heavy transcoding doesn't saturate the CPU
- **Cluster mode** — one worker process per CPU core, all forwarding jobs into a single shared queue instead of each worker running its own

## How the queue + cluster mode work

Resize requests don't run immediately — they're pushed onto an in-memory queue and processed one job at a time, with each FFmpeg process capped at a couple of threads. That keeps a burst of resize requests from spinning up competing, CPU-hungry FFmpeg processes all at once.

In cluster mode (`npm run cluster`), the app forks one worker per CPU core to handle incoming requests. Instead of giving each worker its own queue — which would just recreate the same CPU contention problem across processes — only the primary process owns the queue. Workers forward new resize jobs to the primary via `process.send()`, so there's still exactly one coordinated queue no matter how many workers are running.

## Tech Stack

- Node.js / Express 5
- FFmpeg & FFprobe (spawned as child processes)
- JSON Web Tokens (`jsonwebtoken`)
- Node's built-in `cluster` module

## Prerequisites

- Node.js v20.6+ (for `--env-file` support)
- `ffmpeg` and `ffprobe` available on your system `PATH`

## Getting Started

```bash
git clone https://github.com/omr-muhammad/video-editor.git
cd video-editor
npm install
```

Create `src/.env`:

```
jwt_secret=your_secret_here
```

Run it:

```bash
npm start          # single process
npm run cluster    # cluster mode — one worker per CPU core
```

The server listens on `http://localhost:8000`.

## API Reference

| Method | Endpoint                   | Auth | Description                                                          |
| ------ | -------------------------- | :--: | -------------------------------------------------------------------- |
| POST   | `/api/login`               |  ❌  | Log in, sets an httpOnly auth cookie                                 |
| DELETE | `/api/logout`              |  ✅  | Clears the auth cookie                                               |
| GET    | `/api/user`                |  ✅  | Get the current user's info                                          |
| PUT    | `/api/user`                |  ✅  | Update username / name / password                                    |
| GET    | `/api/videos`              |  ✅  | List the current user's videos                                       |
| GET    | `/get-video-asset`         |  ✅  | Stream/download an asset — `type=thumbnail\|original\|audio\|resize` |
| POST   | `/api/upload-video`        |  ✅  | Upload a video (send filename via `filename` header)                 |
| PATCH  | `/api/video/extract-audio` |  ✅  | Extract the audio track for a video                                  |
| PUT    | `/api/video/resize`        |  ✅  | Queue a resize job — body: `videoId`, `width`, `height`              |

## Project Structure

```
src/
├── controllers/     # route handlers (user, video)
├── lib/             # ffmpeg wrapper, job queue, shared helpers
├── middleware/       # serves index.html for client-side routes
├── streams/         # custom upload validator (Transform stream)
├── utils/           # auth/token helpers
├── DB.js            # lightweight data layer
├── index.js         # app entry point
└── cluster.js       # cluster mode entry point
public/               # frontend (static bundle)
```

## Upcoming Features

- [ ] Hash passwords
- [ ] Better error handling
- [ ] Delete video endpoint
- [ ] Track audio-extraction status
- [ ] HTTP range support for streaming
- [ ] Trim/cut clips
- [ ] Auto-generate subtitles
- [ ] Switch to SQLite
- [ ] Live progress via SSE

## License

ISC
