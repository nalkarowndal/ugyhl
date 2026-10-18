# M5 QA and implementation boundaries — 2026-10-19

## Implemented in source

- Android `SQLiteOpenHelper` schema upgraded from v1 to v2 with `source` and `local_path` columns; upgrades are additive and preserve original M3 records.
- M4 completed download file is registered into the M3 SQLite library *after final file rename*, with id `m4:<UUID>` and intentionally blank URL in library DB.
- Library querying, opening, image thumbnail and deletion support owned M4 files. For M4 files, FileProvider uses `content://` URI with one scoped external-files path; no global external storage permissions are requested.
- `GalleryPaths.verified` requires exact UUID prefix and canonical path directly inside `Download/Pawchive-M4` to reduce path traversal and symlink escape risks.
- M4 resume URLs are AES-256-GCM sealed using Android Keystore; registry JSON stores `urlSealed`, not `url`. Existing M4 plaintext JSON records are read and rewritten encrypted. Public JS list returns no URL or sealed ciphertext.
- The original in-app Range transfer engine remains **EXPERIMENTAL** and is not allowed to claim persistent background execution. OS DownloadManager remains the supported more-reliable mode.
- On loading, completed M4 files can be registered into the gallery if an earlier app process stopped between file rename and indexing.
- Resume now refuses to append to a 206 response with an absent or mismatched ETag/Last-Modified.

## Checks executed in this environment

- `bash scripts/test-transfer-core.sh`: javac pure Java engine and GalleryPaths; success.
- `node scripts/verify-source.cjs`: TSX/TypeScript transpile syntax + pure browser-source logic smoke checks; success.
- `node scripts/test-install-native.mjs`: generated Android manifest, provider metadata and plugin registration checked after two install runs; success.
- ZIP CRC integrity verification: see generated release report; success.

## Not tested / restrictions

- `npm install && npm test && npm run build`: dependencies missing locally and public package registry unavailable. Transpilation check is **not** a typecheck/build.
- Android `assembleDebug`, platform Java type-check, actual FileProvider open grants, Android SQLite upgrade and transfer on phone: SDK/emulator unavailable. **APK not produced.**
- Network Range / Last-Modified / ETag real server tests: network unavailable.
- Signed URL credentials in M3 DownloadManager SQLite from earlier releases **are not encrypted**; M5 Keystore protects only M4 registry. Signed URL data might have existed on flash in plaintext from M4 before migration. Do not use private signed URLs for now.
- No guaranteed background continuation of M4 in-process executor. On Android 14+, use UIDT JobScheduler when a future milestone adds reliable long-running background transfer. See Android docs on UIDT and OS quotas.
- No virus scanning of downloaded files, no cryptographic checksum provided externally for downloaded content, no outside-storage scan.

## Android device test checklist (must be executed before declaring stability)

1. Install M4 on disposable emulator, create a `paused` task and completed file, install M5 as upgrade **without clearing app data**; inspect SQLite migration, URL seal and gallery.
2. Copy/test 1MB PNG and known test MP4, verify native `open`, FileProvider permission, thumbnail and cancel/delete semantics. Try renaming or deleting file and restarting.
3. HTTPS controlled range test: `206` matching range+ETag -> resume; changed validator -> safe failure/restart; `200` instead of `206` -> restart; bad `Content-Range` -> reject; `416` -> safe failure; redirect to HTTP/localhost/private IP -> reject.
4. Kill app and process during a long M4 transfer, verify `paused` state/part preservation and explicit manual resume, *not* auto-background continuation.
5. Confirm Android DownloadManager path continues after backgrounding and reports status after reopen, subject to OS constraints.
6. Verify auth/signed URL never appears in JS transfer-list payload, app logs, unencrypted JSON or exported backup.
7. Install dependencies and run `npm test`, `npm run build`, then `npm run android:init` and `./gradlew :app:assembleDebug`.

## Next milestone

M6: build/real device blockers and Android 14+ UIDT background JobScheduler (Android version gating, notification channel and POST_NOTIFICATIONS / required permission handling) with pre-14 WorkManager or foreground-service fallback; add per-file trusted SHA-256 checks and hardened M3 credential storage.
