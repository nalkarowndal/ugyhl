# M3 QA & release notes — 2026-10-19

## Functional additions
- `native/android/PawchiveDownloadsPlugin.java`: SQLite-based durable download records with idempotent import of M1/M2 SharedPreferences download records; DownloadManager remains authoritative for real file status.
- Favorites (`favorite`), secure completed-file open (`open`), constrained decoded thumbnail (`thumbnail`), and explicit file+history deletion (`delete`).
- `src/features/library/LibraryView.tsx`: actual completed-download library, text search, media-kind filters, sort modes, favorites-only filter, mobile file tiles.
- `src/features/library/library-utils.ts`: pure deterministic type classification and filtering.
- `src/features/library/library-utils.test.ts`: regression cases for status filtering, query, type, favorites, sorting.

## Security boundaries
- Only files created through this app's tracked DownloadManager IDs are indexed.
- Files are not uploaded, inspected from arbitrary external locations, or granted broad storage permissions.
- Native thumbnails are JPEG at no more than ~256px in max dimension, returned as base64 for completed images only. Image decode limitations remain for unsupported formats and large corrupted files.
- `open()` checks owned download ID and success status, uses DownloadManager content URI and read grant intent.
- `delete()` removes both the OS download and SQLite row, and requires explicit UI confirmation; deletion is irreversible.
- No browser cookie extraction, private content bypass, or speculative cross-site cookies.
- SQLite URLs can contain signed download URLs; the app's private database must never be included in exported diagnostics. Future release: encrypted URL-at-rest policy, expired-link token clearing.
- Still no integrity verifier or antivirus engine. Do not assume downloaded content is safe.

## Known limitations
- Original archive feature set remains partially implemented. No full automatic art crawling, deferred Pawchive attachment resolver, cloud/Telegram/yt-dlp parity, bulk archive extraction, local file tree index, or media video thumbnail generation.
- User supplied HTTPS file links and upstream content URLs are not verified as benign by a security scanner.
- On browser, native downloads/library operations are disabled and explicit UI status is displayed.
- Android 13+ device storage behavior / content URI sharing, SQLite migration and Kotlin/Java compilation are unverified until Android Studio build and real device testing.
- No npm install / Vite production build in artifact environment when the public npm registry is unreachable.

## Recommended verification
1. Run `npm ci` (if lockfile exists) or `npm install`, then `npm test` and `npm run build`.
2. Run `npm run android:init` (first native creation), then open Android Studio and compile on Android API levels 29, 33, 34, 36 if available.
3. Direct download a small image and an MP4 from HTTPS URLs the tester owns. Confirm record persists across cold starts; image thumbnail and native viewer open.
4. Confirm favorites persist after restart, filters and sorting work, deleting the file removes both OS file and SQLite record, cancelled downloads remain visible until deleted.
5. Upgrade an M2 APK with 1-2 downloaded files (same package name, installed signed build) and validate migration. Do not uninstall between versions (uninstall deletes app data).
6. Tests for expired signed URLs, network drop, Wi-Fi-only constraint, 403/429, file storage exhaustion, malformed images, cancelled downloads and privacy diagnostics.
