### yt-mp3-queue-service – YouTube to MP3 Converter API

A production-ready Node.js/TypeScript API for converting YouTube videos to MP3, backed by a Redis-powered job queue and horizontally scalable workers. Includes optional monitoring, rate limiting, security headers, and Docker support.

---

## Features

- **Single endpoint** to request conversion: `POST /api/convert`
- **Queue-based processing** with Bull and Redis for reliability and scaling
- **Dedicated workers** for conversion; run multiple replicas
- **FFmpeg + yt-dlp/youtube-dl** via `youtube-dl-exec` for robust extraction
- **Static hosting** of converted files under `/downloads`
- **Validation + rate limiting** to protect the service
- **Security headers** with Helmet (CSP preconfigured)
- **Docker Compose** for one-command local deployment
- Optional **Bull Board** admin dashboard (commented; enable when needed)

---

## Architecture

- `src/app.ts`: Express API server. Serves `/api` routes and static downloads at `/downloads`.
- `src/routes/converterRoutes.ts`: Routes for conversion.
- `src/controllers/converterController.ts`: Validates metadata, enqueues work, returns result.
- `src/services/queueService.ts`: Bull queue setup, job processing, capacity checks.
- `src/workers/conversionWorker.ts`: Worker process that performs the download and audio extraction.
- `src/services/downloadService.ts`: Uses `youtube-dl-exec` to fetch and extract audio to MP3.
- `src/config/config.ts`: Centralized configuration via env vars with sane defaults.
- `src/middleware/*`: Validation, rate limiting, async handling, and error handling.

Flow:
1) Client calls `POST /api/convert` with a YouTube URL and optional quality.
2) Controller validates duration and constraints, then enqueues a job.
3) Workers pick up jobs, call `youtube-dl-exec` + FFmpeg to extract MP3.
4) Resulting file is written to the output directory and served statically at `/downloads`.

---

## Tech stack

- Node.js 18+, TypeScript
- Express, Helmet, express-rate-limit, CORS
- Bull (Redis), `@bull-board/*` (optional monitoring)
- `youtube-dl-exec` (yt-dlp/youtube-dl wrapper) + FFmpeg
- Docker, Docker Compose (optional Nginx template included)

---

## Requirements

- Node.js 18+ (for local development)
- Redis 6+ (local or containerized)
- FFmpeg installed and available on PATH (both locally and inside Docker images)
  - On Debian/Ubuntu: `sudo apt-get update && sudo apt-get install -y ffmpeg`
  - On macOS (Homebrew): `brew install ffmpeg`
  - Docker: ensure the image installs FFmpeg (see notes below)

---

## Quick start

### 1) Clone and install

```bash
git clone git@github.com:kishan62435/yt-mp3-queue-service.git
cd yt-mp3-queue-service
npm install
```

### 2) Configure environment

Create a `.env` file in the repository root:

```bash
PORT=3000
REDIS_HOST=localhost
REDIS_PORT=6379

# Storage
OUTPUT_DIR=storage/output
TEMP_DIR=storage/temp

# Queue limits
MAX_CONCURRENT_JOBS=5
JOB_TIMEOUT=300000

# Worker
WORKER_CONCURRENCY=2
WORKER_RATE_LIMIT_MAX=10
WORKER_RATE_LIMIT_DURATION=60000

# Autoscaling hints (used by worker manager service if you wire it up)
QUEUE_THRESHOLD=5
MAX_WORKERS=0
SCALE_CHECK_INTERVAL=60000

# Monitoring
ENABLE_MONITORING=false
METRICS_INTERVAL=15000
```

Important: The API serves static files from `/downloads` mapped to the folder configured by `OUTPUT_DIR`. The default `app.ts` maps to `storage/output`. Set `OUTPUT_DIR=storage/output` to match.

### 3) Start services (local)

Start Redis (if not already running), then:

```bash
# Terminal 1 – API server
npm run build
npm start

# Terminal 2 – Worker(s)
npm run start:worker
```

Dev mode with live-reload:

```bash
# API
npm run start:dev

# Worker
npm run start:worker:dev
```

### 4) Docker Compose

The included `docker-compose.yml` brings up `app`, `worker` (2 replicas), and `redis`.

```bash
docker compose up --build
```

Note: The provided `Dockerfile` uses `node:18-alpine`. You must install FFmpeg in the image for audio extraction to work, for example by adding:

```Dockerfile
RUN apk add --no-cache ffmpeg
```

Add this before `npm run build` in the `Dockerfile`.

---

## API

### POST /api/convert

- Body JSON:
  - `videoUrl` (string, required): Full YouTube URL
  - `quality` (number, optional): One of `64, 128, 192, 256, 320` (kbps)

Validation guards:
- URL format is validated with `ytdl-core`
- Duration is fetched first; rejects live streams/premieres and videos longer than the configured max (`conversion.maxDuration`, default 300s)

Example request:

```bash
curl -X POST http://localhost:3000/api/convert \
  -H "Content-Type: application/json" \
  -d '{"videoUrl":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","quality":192}'
```

Example success response (note: by default `videoLink` path uses `/static` inside the code; see note below to switch to `/downloads`):

```json
{
  "message": "Conversion completed successfully",
  "videoLink": "/static/dQw4w9WgXcQ.mp3",
  "metadata": {
    "duration": 213,
    "quality": 192,
    "convertedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

Static downloads:
- Files are served at `GET /downloads/<file>.mp3` by the API.

Important path note:
- The response `videoLink` is currently built in `src/services/queueService.ts` by replacing the configured output directory with `/static`. If you prefer clients to receive `/downloads/...`, change that replacement to `/downloads` in `queueService.ts` (or adjust the static mapping in `src/app.ts`).

Error responses:
- `400` for invalid URL, disallowed quality, or duration violations
- `429` if rate limited
- `500` for unexpected errors

---

## Configuration

All configuration lives in `src/config/config.ts` and can be overridden via environment variables.

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | Server port |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `OUTPUT_DIR` | `output` | Directory where MP3 files are written; set to `storage/output` to match static mapping |
| `TEMP_DIR` | `temp` | Temp directory |
| `MAX_CONCURRENT_JOBS` | `5` | Back-pressure limit; reject if active+waiting exceeds this |
| `JOB_TIMEOUT` | `300000` | Per-job timeout in ms |
| `WORKER_CONCURRENCY` | `2` | Parallel jobs per worker process |
| `WORKER_RATE_LIMIT_MAX` | `10` | Max jobs in rate limit window |
| `WORKER_RATE_LIMIT_DURATION` | `600000` | Rate limit window in ms |
| `QUEUE_THRESHOLD` | `5` | Used by scaling heuristics |
| `MAX_WORKERS` | `0` | 0 = auto-detect (CPUs - 1) |
| `SCALE_CHECK_INTERVAL` | `60000` | Scaling check interval ms |
| `ENABLE_MONITORING` | unset/`false` | Toggle monitoring endpoints |
| `METRICS_INTERVAL` | `15000` | Metrics collection interval |

Conversion config (in-code defaults):
- `conversion.defaultQuality`: `192`
- `conversion.allowedQualities`: `[64, 128, 192, 256, 320]`
- `conversion.maxDuration`: `300` seconds

Queue timeouts:
- `config.queue.jobTimeout` is defined but the per-job timeout is currently hardcoded to `300000` ms in `src/services/queueService.ts` (`timeout` option when adding a job). Update there to fully adopt the env-driven value if desired.

Rate limiting (global):
- Window: 15 minutes, Max: 100 requests/IP (`src/middleware/rateLimiter.ts`)

Security headers:
- Helmet with strict CSP allowing self and inline scripts/styles as configured in `src/app.ts`.

---

## Monitoring (optional)

Bull Board is wired but commented out. To enable the dashboard at `/admin/queues`:
1) In `src/app.ts`, uncomment the `QueueService` and `MonitoringService` initialization and the `app.use('/admin/queues', ...)` line.
2) Rebuild and restart.

Note: Restrict access before exposing this in production.

---

## Project structure

```
yt-mp3-queue-service/
  src/
    app.ts                 # Express app
    worker.ts              # Worker entrypoint
    workers/conversionWorker.ts
    controllers/converterController.ts
    routes/converterRoutes.ts
    services/{queueService,downloadService,converterService,cleanupService,monitoringService,workerManagerService}.ts
    middleware/{asyncHandler,errorHandler,rateLimiter,validator}.ts
    config/config.ts
    types/
  Dockerfile
  docker-compose.yml
  nginx/default.conf       # Optional reverse proxy config (not used by compose by default)
```

---

## Development scripts

- `npm run build`: TypeScript build
- `npm start`: Start compiled API (`dist/app.js`)
- `npm run start:dev`: Start API with `nodemon` on `src/app.ts`
- `npm run start:worker`: Start compiled worker (`dist/worker.js`)
- `npm run start:worker:dev`: Start worker with `ts-node` on `src/worker.ts`
- `npm run lint` / `npm run lint:fix`: ESLint

---

## Troubleshooting

- **FFmpeg not found**: Ensure FFmpeg is installed locally and inside Docker images. In Alpine-based images add `RUN apk add --no-cache ffmpeg`.
- **Redis connection issues**: Verify `REDIS_HOST`/`REDIS_PORT`. With Docker Compose, the host is `redis`.
- **Downloads not served**: The server serves `/downloads` from `storage/output` by default. Set `OUTPUT_DIR=storage/output` (or adjust the static mapping in `src/app.ts`).
- **Capacity errors**: If you see "Server is currently at capacity", increase `MAX_CONCURRENT_JOBS` and/or `WORKER_CONCURRENCY`, or scale the `worker` service.
- **Live streams/premieres or long videos**: These are rejected by design; adjust `conversion.maxDuration` if needed.

---

## Legal

This project is for educational and research purposes only. Usage of this software may violate YouTube’s Terms of Service and/or applicable laws depending on how it is used. You are solely responsible for ensuring that your use complies with all terms and laws in your jurisdiction. Do not use this project to download or distribute content you do not have the rights to. The authors and maintainers do not endorse or encourage any infringement and assume no liability for misuse. Provided “as is” without warranty.

---

## License

ISC

