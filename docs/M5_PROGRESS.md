# M5 progress — 2026-10-19

**Development artifact:** `Pawchive-Mobile-M5-source.zip`, 51 files, independently downloadable from the corresponding ChatGPT development conversation. **This GitHub branch is not a complete standalone buildable source checkout yet.** The full 51-file snapshot, including React UI and Android plugin source, is in that ZIP.

## M5 changes in the source snapshot
- SQLite library schema version 2, adds source and local_path columns, supports advanced (M4) completed files in M3 library.
- Strict canonical file path validation and scoped FileProvider for opening the app's own M4 files, thumbnails, deletion and favorites.
- Keystore-backed AES-256-GCM URL-at-rest encryption for M4 resume state. Migrates previous M4 JSON plaintext records; no URL/ciphertext in public JS list.
- Safer HTTP Range validator handling: refuse to append on missing/mismatched validator.
- Android DownloadManager retained as the more OS-managed background mode; M4 advanced transfer remains **in-process experimental**.
- Local CI workflow source checks included in ZIP, but no Android APK generated.

## Verification performed
- Pure Java TransferCore+GalleryPaths compiled, unit smoke tests passed.
- TypeScript/TSX 15-file syntax transpilation and domain/API logic smoke tests passed.
- Android plugin installer idempotence against mock Java MainActivity and AndroidManifest: passed twice.
- M5 ZIP integrity check (CRC): passed.
- npm dependencies unavailable offline (`ENOTCACHED`), so npm React build/typechecking, Vitest and Android Gradle compile/device QA were **not run**.
- No real HTTPS resume test; no claims of persistent background transfers.

## Security gaps
- Earlier M3 DownloadManager SQLite stores original URL; M5 encrypts only the experimental transfer resume registry, not those legacy records.
- Previously stored M4 plaintext URL bytes may remain on flash even after migration.
- No trusted SHA-256 verification of downloaded content, malware scan, external cloud/Telegram support, or permanent UIDT background job.
- Use on lawfully accessible content only; original author's license remains custom source-available and non-commercial without written permission.

## Next
Upload the ZIP's full source files into GitHub, run npm build/tests, Android assembleDebug and device migration QA, then implement Android 14+ UIDT and pre-14 fallback.

[Original upstream/license](https://github.com/whyamihere773/Pawchive-Downloader/blob/v1.2.9/LICENSE)
