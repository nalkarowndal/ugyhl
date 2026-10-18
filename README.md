# Pawchive Mobile — M4 (React · Capacitor · Android)

An **unofficial, personal/non-commercial** mobile reimplementation that references the architecture and feature set of [Pawchive Downloader v1.2.9](https://github.com/whyamihere773/Pawchive-Downloader/releases/tag/v1.2.9). Not an official Pawchive client or affiliate. The original source is released under a **custom source-available license**, not a standard permissive open-source license; see `UPSTREAM_LICENSE.txt`.

## Implemented source (not an independently validated APK)

| Phase | Implementation | Status |
|---|---|---|
| M1 | React responsive Korean UI, Android DownloadManager enqueue/list/cancel/retry, Wi-Fi only | Source written |
| M2 | Pawchive/Cum.st URL parser, public posts lookup, attachments filters, native queue | Source written; API live reachability unverified |
| M3 | SQLite history migration, real completed-download library, filters/sort/search/favorites, thumbnail generation, file open, confirmed delete | Source written; Android compilation/device QA unverified |
| M4-alpha | Experimental foreground-session Range downloader, `.part` checkpoint, ETag/Last-Modified validator, manual pause/resume, per-download KiB/s speed limit, transfer JSON registry | Pure Java tests passed; APK and live transfer unverified |

**Not yet feature-parity:** original watchlist updates, external media/cloud/Telegram/yt-dlp, deferred signed attachments, credentials, large file multi-part accelerator, bandwidth limiter, gallery video playback/preview, archive extraction and tag recognition.

## Requirements
- Node 20.19+ or 22.12+; npm network access.
- For APK: Android Studio and SDK, Java 17-compatible Gradle/Android plugin setup.

## Run
```bash
npm install
npm test
npm run build
npm run dev
```

Android setup for fresh project:
```bash
npm run android:init
npm run android:open
```
For previously-created Android folder use `npm run android:sync`. The setup script copies native `PawchiveDownloadsPlugin.java` into the Capacitor Android project's app package and registers it in MainActivity, after generating Android source with `npx cap add android`. **You still need to build and run the APK with Android Studio**. A successful web build is not proof of Android functionality.

## Architecture
- React+TypeScript UI (`src/App.tsx`, `src/features/explorer`, `src/features/library`).
- Public Pawchive/Cum.st API adapter (`src/lib/pawchive.ts`) with domain checks. Android API uses CapacitorHttp; browser API may fail due to CORS.
- Android Java plugin (`native/android/PawchiveDownloadsPlugin.java`) for OS-managed download tasks and local library access.
- **Experimental M4** (`native/android/TransferCore.java`, `PawchiveTransfersPlugin.java`, `src/features/transfers`): independent long-file sequential Range transfer. This is **not** a multi-part accelerator or globally shared throttle, and not integrated with M3 gallery yet.
- SQLite `pawchive_library.db` for durable metadata and favorites; migrates legacy SharedPreferences `pawchive_mobile_downloads_v1` entries only once.
- Gallery shows **actual successful tracked Android downloads only**; on the web, displays explicit platform limit rather than fake sample content.

## M4-alpha use

Open the **다운로드 관리** tab and use the separate **고급 다운로드 엔진** card. Zero KiB/s means no cap. A transfer must be paused before changing its speed limit (native API method exists; per-job editing UI is planned). Java transfer tests without Android SDK: `bash scripts/test-transfer-core.sh`. The experimental worker runs in an in-process executor, not an OS foreground service; do not rely on it continuing after the app closes or under Android battery pressure. Opening finished advanced downloads is not integrated with gallery yet; completed bytes are in app-specific `Download/Pawchive-M4`. The M1–M3 DownloadManager path remains intact.

## Privacy and security
- Only personally accessible, lawfully downloadable content. Do not bypass platform access restrictions or DRM.
- No external browser cookie extraction or saved passwords. Avoid persisting signed file URLs as user-visible logs.
- **M4 experimental state file contains full download URLs**, possibly signed query tokens, inside Android app-private **no-backup** storage, but not encrypted. Do not use private authenticated download URLs until Android Keystore encryption and URL redaction are available.
- Direct HTTPS downloads cannot guarantee files are safe or free of malware. Use device-level scanning as appropriate.
- User confirmation precedes file and history deletion. No bulk file deletion.
- App-specific external files path. Files are opened with content URIs and temporary read access.

## Verify / Known limitations
Read [`docs/M4_QA.md`](docs/M4_QA.md) and [`docs/M3_QA.md`](docs/M3_QA.md). In the ChatGPT execution container, npm install failed with DNS `EAI_AGAIN` for registry.npmjs.org, and Android SDK is unavailable. Therefore no npm build or APK claim is made.

## Attribution
Original copyright and license are preserved in `UPSTREAM_LICENSE.txt`. Modified/mobile port copyright for wholly new contributions belongs to its respective authors, subject to the original project's license and third-party library license obligations. For commercial redistribution obtain prior written permission from upstream author.

References: [Capacitor Android custom plugin](https://capacitorjs.com/docs/android/custom-code) · [Android DownloadManager](https://developer.android.com/reference/android/app/DownloadManager) · [GitHub upstream](https://github.com/whyamihere773/Pawchive-Downloader/tree/v1.2.9).