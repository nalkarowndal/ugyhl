# M2 QA Report — Pawchive Mobile

## Reviewed
- Original v1.2.9 API routes: `core/api_client.py` pages 187-192, 586-615, 640-685; `core/parser.py` and `core/providers.py`.
- Capacitor native HTTP API official documentation: https://capacitorjs.com/docs/apis/http
- Native Android DownloadManager official documentation: https://developer.android.com/reference/android/app/DownloadManager
- LICENSE is custom source-available, **personal/non-commercial**; commercial use requires author's written permission. Attribution required on redistribution.

## Checks completed in artifact environment
- TypeScript/TSX syntactic transpile check: PASS, all 10 source files checked using installed TypeScript compiler.
- JS execution of transpiled API adapter: PASS (URL routing, host restrictions, normalized attachment response, unsafe URL rejection) in isolated Node smoke test. Not a Vitest execution.

## Not completed
- `npm install` from registry unavailable in this environment; `npm test`, `npm run build` and Android APK build unverified.
- Live Pawchive/Cum.st network, HTTP response schema and CORS behavior unverified from device.
- Android native plugin real-device checks pending.

## Functional scope
- Android: existing M1 OS DownloadManager handles direct HTTPS downloads. M2 page/media resolver feeds it selected file URLs when present.
- Web: can query publicly accessible API only if remote server permits CORS; no invented results or browser file downloading.
- Deferred attachments with no path, authenticated APIs, browser cookie extraction, Cloudflare restrictions and embedded video extraction deliberately not implemented.
- Only one page at a time, default 50 creator posts; no unlimited recursive crawl.

## Security work remaining
- Strict redirect validation and external CDN hostname verification for downloaded files; audit native/OS downloads for private address redirects.
- Rate limiting / exponential backoff (respect 429 Retry-After and cancellation), streaming parse size caps on Android, auth design before non-public content.
- Unique filename sanitization, duplicate prevention, storage quota and accessible export to SAF/MediaStore.
