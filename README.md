# Pawchive Mobile — M7 (React + Capacitor + Android)

An **unofficial, personal and non-commercial** mobile adaptation inspired by [Pawchive Downloader v1.2.9](https://github.com/whyamihere773/Pawchive-Downloader/releases/tag/v1.2.9). The original project has a custom source-available license, **not** an MIT/open redistribution license. See `UPSTREAM_LICENSE.txt`. Maintain attribution; obtain written permission before commercial distribution.

## Current milestone status

| Milestone | Source code implementation | Tested? |
|---|---|---|
| M1 | Mobile React UI, Android DownloadManager queue/list/cancel | Source-only, no device QA |
| M2 | Pawchive/Cum.st creator & single-post parsing, API lookup, attachment selection | Smoke tests, not live API tested |
| M3 | Android SQLite library/history, image thumbnails, favorites, safe delete/open | Syntax-only, no device QA |
| M4-alpha | In-process single-stream Range+ETag resume, pause, limited KiB/s throttle | Pure Java unit smoke tests |
| M5 | Gallery indexing for M4, URL encryption/migration via Android Keystore, FileProvider, SQLite v2, safer resume | Pure tests passed; APK compiled in M7 |
| M7 | Complete GitHub source mirror, CI React/Android builds, optional trusted SHA-256 verification in advanced downloader | Source unit tests passed; M7 checksum APK needs CI build + physical device QA |

**GitHub Actions has produced a debug APK from the M5-source M7 branch. This project is still untested on an actual phone.**

**The app is not at upstream feature parity.** Telegram, cloud downloaders, yt-dlp, AI matching, archive extraction, automatic watchlist sync, multipart downloads, global bandwidth throttle and 24/7 Android background transfers remain unimplemented.

## Project tree

- `src/App.tsx` and `src/features/*` — React TypeScript responsive UI and views
- `src/lib/*` — URL validation, Pawchive public API adapters, Capacitor native bridge
- `native/android/PawchiveDownloadsPlugin.java` — OS-managed downloads, SQLite v2 gallery
- `native/android/PawchiveTransfersPlugin.java` — **experimental** M4 resumable transfer orchestration
- `native/android/TransferCore.java` — pure Java HTTPS Range download engine
- `native/android/UrlVault.java` — AndroidKeyStore-backed AES/GCM sealing of resume URLs
- `native/android/GalleryPaths.java` — pure Java canonical-path guard for M4 gallery
- `native/android/PawchiveFileProvider.java` and `native/android/res/xml/pawchive_file_paths.xml` — scoped file-view sharing
- `scripts/install-native-plugin.mjs` — repeatable Android source + manifest installer
- `native/android/DigestVerifier.java` — optional trusted SHA-256 verification of the completed `.part` file
- `docs/M5_QA.md` — QA and gaps

## Installation / build (requires outside this environment)

```bash
npm install
npm test
npm run build
npm run dev
```

Build on Android SDK installation, with JDK17:

```bash
npm run android:init
npm run android:open
# In Android Studio, assembleDebug or use ./gradlew :app:assembleDebug
```

For existing Android project: `npm run android:sync`. Do not clear app data when testing M3->M5 migration.

## Two download modes

1. **Android 기본 다운로드:** use built-in Android DownloadManager for OS-managed transfers; generally more robust in background. History and completed files appear in gallery.
2. **고급 다운로드 엔진 (실험적):** supports manual pause/resume, a `.part` file, conditional HTTP Range requests and individual job speed cap. **It runs in an app-process executor, not a foreground service/UIDT job.** It can stop as soon as Android kills the app process. Completed downloads appear in gallery with `m4:` IDs.

## Privacy and security notes

- M5 encrypts only the experimental M4 registry URL at rest with Android Keystore AES-GCM. The existing M3/OS DownloadManager database still contains URLs in plain text: **avoid private signed URLs** until that path is hardened.
- M4 pre-upgrade plaintext resume URLs may remain recoverable in old physical flash blocks or outside app-managed backups; migration cannot guarantee forensic erasure.
- Public `PawchiveTransfers.list()` returns neither URL nor ciphertext.
- No desktop cookie extraction, DRM circumvention, or browser credential scraping. Only access content for which you have legal permission.
- Gallery access is limited to this application's own downloaded files; FileProvider exposes only a single app-specific download subdirectory.
- No verified malware scanning; treat downloaded attachments as untrusted.

## Development checks

```bash
bash scripts/test-transfer-core.sh
node scripts/verify-source.cjs
node scripts/test-install-native.mjs
```

These checks are not proof of Android compilation, runtime correctness or security. See [M7 QA](docs/M7_QA.md), including the first successful Android debug CI build and remaining physical-device tests.

## Attribution

Original: [whyamihere773/Pawchive-Downloader](https://github.com/whyamihere773/Pawchive-Downloader) · [Custom source available license](https://github.com/whyamihere773/Pawchive-Downloader/blob/v1.2.9/LICENSE)


## M7 (Android 14+ UIDT, developer preview)
- New **BackgroundTransferJobService** uses Android JobScheduler's user-initiated jobs on API 34+. It is scheduled only after the user's explicit download action while the app is visible.
- Includes Android OS notification, stop/retry callback, encrypted private file registry, capped transient retries, Range/ETag checkpoint and optional SHA-256 verification.
- Completion is indexed into the M3 SQLite gallery under the existing M4 app-private output path.
- Android 13 and earlier **fall back to the existing DownloadManager** in the new UI. The M4 foreground-session transfer remains separate.
- System process kill, Doze, device restart, job quota, user force-stop and non-public downloads **are not yet verified**. User task-manager force-stop may prevent automatic retry; the user may need to reopen the app and press resume.
- To build locally: `npm install && npm test && npm run android:init && cd android && ./gradlew assembleDebug`. Never install a debug APK over another differently signed app without backing up its data first.
- Device QA checklist: `docs/M7_QA.md`; source license: `UPSTREAM_LICENSE.txt`. Project is for personal noncommercial use only.
