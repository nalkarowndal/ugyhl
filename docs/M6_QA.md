# M6 — Android build readiness + optional integrity verification

## Completed
- GitHub source mirror now has all M5 project files in `dev/m6-android-hardening` (GitHub commit `dd85137eff8a5e786638949a93e97b81a50b17d1`). Original `main` was not overwritten.
- Corrected unused TypeScript `apiUrl` import; production React build succeeds on GitHub Actions.
- Android APK CI uses `android-actions/setup-android@v4`. Version 3 fails in 2026 while asking SDK manager for removed `tools` package.
- First Android debug APK build **succeeded** on GitHub Actions run 39158374482, prior to M6 optional SHA-256 source changes.
- M6 adds optional, trusted SHA-256 checksum input for the **experimental** single-stream native transfer engine. It verifies the whole received `.part` file before renaming to the completed file; mismatch is marked failed and is never registered as completed in the library.
- M6 unit test covers good digest, case-insensitive hex, invalid format and mismatch.
- M6 installer includes the pure `DigestVerifier.java` dependency and remains idempotent.

## Automated checks
- Local pure Java: `bash scripts/test-transfer-core.sh`: PASS (TransferCore, GalleryPaths, DigestVerifier).
- Local bridge mock: `node scripts/test-install-native.mjs`: PASS.
- Local TS/TSX parser and pure logic checks: `node scripts/verify-source.cjs`: PASS.
- GitHub source checks: `npm install`, 20 Vitest tests, TypeScript/Vite production build, native pure Java checks: PASSED for prior M5-source import-fix commit (`3d1e6d8`).
- Latest M6 checksum source build/check results must be checked from newest GitHub Actions run for the branch; do not assume that the first successful APK includes this feature.

## Not done / no release claim
- No emulator or Android physical device user acceptance test has been completed.
- No live end-to-end HTTPS Range/ETag test; controlled mock and digest only.
- `PawchiveTransfersPlugin` still runs in the app process: NOT a persistent JobScheduler UIDT background download service.
- OS-managed DownloadManager records may contain original URLs in SQLite and OS metadata; do not submit sensitive presigned links.
- No implementation of original Pawchive's Telegram, Mega, yt-dlp, AI classification, bulk decompressor, multisource concurrency, and auto watchlist sync.
- The APK is a debug build, signed with GitHub CI's temporary debug keystore. It is NOT an official security-audited release or a reliable update to previously installed debug APKs; key mismatch can require uninstall (which deletes app data).
- Downloaded content and remote endpoints are not automatically virus-scanned.

## Device QA checklist (required before calling app stable)
1. Install debug APK on clean test device and verify navigation, creator fetch, direct download.
2. Download a known SHA-256 test asset; verify success only with matching digest, failure and no library registration when mismatched.
3. Begin large file, pause and resume with a controlled HTTPS Range server, verify `.part` and server validator rules.
4. Repeat OS DownloadManager download with display off / on metered Wi-Fi.
5. Test M4/M5 database upgrade *without clearing data* using **a consistently signed build**; a fresh CI debug artifact often cannot update another signing key's APK.
6. Verify actual Gallery open, thumbnail, favorite and delete grants and storage permissions.
7. Check certificate validation, no plaintext secret tokens in logs, no unauthorized storage access, no crashes.

## Primary references
- https://developer.android.com/reference/android/app/DownloadManager
- https://github.com/android-actions/setup-android
- https://github.com/whyamihere773/Pawchive-Downloader/blob/v1.2.9/LICENSE
