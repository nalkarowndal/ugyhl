# Pawchive Mobile M4-alpha progress — 2026-10-19

**Project state:** ZIP source snapshot available in the ChatGPT development conversation as `Pawchive-Mobile-M4-source.zip`. This GitHub repository is **not yet a complete, buildable mirror** of that ZIP; do not claim APK availability from the docs in this repository.

## M4 source snapshot changes
- Independent single-stream Android Java download engine (`native/android/TransferCore.java`)
- Validated HTTPS redirect chain and best-effort public-host checks
- Persistent `.part` checkpoint file, Range / If-Range with strong ETag or Last-Modified; safe restart on 200 or absent validator
- Bounded individual task KiB/s rate limit, cancellation-aware sleep
- Experimental Capacitor Java bridge (`PawchiveTransfersPlugin.java`): start, list, pause, resume, speed; JSON no-backup registry
- React UI `src/features/transfers/AdvancedTransfers.tsx` on Download screen
- Native install script registers both old DownloadManager and new M4 plugin
- M3 SQLite gallery and default DownloadManager path left intact

## Executed verification
- Pure Java core `javac` compilation: PASS
- Java unit smoke tests: PASS (Content-Range, invalid URL/local addresses, pause)
- TS/TSX 15-file transpile syntax check and pure JS logic smoke tests: PASS
- Mocked Android plugin installation, twice: PASS (no duplicate registration)
- ZIP file CRC integrity: PASS

## Not yet verified
- Full npm install / TypeScript typecheck / React production build (package registry DNS unavailable)
- Android SDK Gradle compile and actual APK on physical device
- Live HTTPS transfer against Range/ETag/retry response variants
- OS process death, reboot, Doze and battery restrictions

## Security and feature boundaries
M4 is an **experimental app-foreground in-process downloader**, NOT a reliable Android 14+ UIDT job. It does NOT implement a global cap, multipart accelerator, integrated M4 gallery export, end-to-end verified checksum, or resumable encrypted provider authorization. URLs may contain sensitive signed query values and are stored in app-private no-backup JSON **without encryption**; avoid private signed URLs. Always use only content you are entitled to access.

## Next verification
1. Install npm packages and build React; resolve compiler errors.
2. Android Studio/SDK: assembleDebug and emulator/device tests, including pauses and resume with a controlled HTTPS Range server.
3. Move custom transfer to UIDT JobScheduler / proper foreground worker with Android-version gating.
4. Encrypt sensitive URL state with Android Keystore; add SHA-256 validation and gallery integration.

Original author/license: [whyamihere773/Pawchive-Downloader v1.2.9](https://github.com/whyamihere773/Pawchive-Downloader/blob/v1.2.9/LICENSE). The upstream license limits use to personal, non-commercial unless separately authorized.
