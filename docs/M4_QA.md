# M4-alpha implementation and verification — 2026-10-19

## Scope

Added independent Android Java experimental transfer engine (`TransferCore.java`) with:

- HTTPS public-host validation before download and each redirect (private/reserved DNS IP rejection best effort)
- Manual HTTP redirect validation, 5-hop limit; no cookies, Authorization or browser-token import
- Single-stream HTTP `Range: bytes=N-` resume with `If-Range` representation validator (strong ETag or Last-Modified)
- Refuse to append if representation validator is absent; if server returns 200, start from byte zero
- Verify `Content-Range` start on 206; length mismatch detection; atomic rename on completed file
- Transfer `.part` kept after pause and network failures, configurable per-download KiB/s speed limit
- Android state file in no-backup app-private storage; on reboot/restart unfinished jobs become manual resume
- Separate native Capacitor plugin with queued/running/pausing/paused/failed/success states
- React M4 experimental panel on Downloads page; browser remains clearly non-downloading

### Important limitations

1. **No guaranteed background execution**: in-process Java executor, not UIDT/WorkManager foreground service. Android OS may stop the process. Manual resume is required.
2. **Not multipart acceleration**: downloads one stream per task, at most two task threads; limit is per task, NOT global across the app.
3. **No integrated file gallery for M4 transfers**: M3 library still reflects DownloadManager downloads only; advanced completed files stay in app-specific Download/Pawchive-M4.
4. **Credentials**: signed direct URLs can be stored in local app-private no-backup JSON (unencrypted). Do not enter personal private signed URLs until secure storage is added.
5. No actual malware scanning, checksum validation against trusted out-of-band hashes, authenticated providers, cross-process atomic database transactions, or Android device run.
6. Server ETag/Last-Modified availability dictates safe resume; otherwise file restarts from zero.
7. No advanced delete/retry UI beyond pause/resume; pause may finish only after network I/O read timeout.

## Actual executed checks

- `bash scripts/test-transfer-core.sh`: PASS (javac compiled pure Java core, checked range parsing, private URLs/address rejection, pause short-circuit).
- `node scripts/verify-source.cjs`: PASS for TS/TSX parse and M1-M3 pure logic smoke tests (syntax only, not a full typecheck).
- `node scripts/install-native-plugin.mjs` invoked twice against a mocked Android MainActivity: PASS (both plugin classes registered once; 3 Java files copied).
- `npm install --offline`: FAILED (`ENOTCACHED` — packages not installed). Full React build and Vitest not executed.
- **Android Gradle build:** NOT EXECUTED (SDK / Android project unavailable).
- **Live Pawchive/HTTP range server:** NOT EXECUTED (network unavailable).

## Next execution priority

1. Install Node dependencies; run `npm test && npm run build` and fix type errors.
2. `npm run android:init` with Android Studio/SDK and `./gradlew :app:assembleDebug`.
3. In Android emulator/phone, run HTTPS local test fixture via reachable controlled server with Range/200/206/416/redirect/error scenarios; inspect `Content-Range`, ETag, Last-Modified and pause/retry.
4. Audit Android 14/16 transfer requirements; upgrade experimental in-process executor to UIDT JobScheduler (API 34+) or proper foreground worker fallback (legacy).
5. Add SHA-256 verification against trusted known checksum, Keystore encryption for sensitive URL registry, and import completed M4 downloads into gallery.

Original source license and attribution are preserved in `UPSTREAM_LICENSE.txt`.
