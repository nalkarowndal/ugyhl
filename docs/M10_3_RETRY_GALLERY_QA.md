# M10.3 — Retry idempotency and real Android gallery operations

## Implemented
- SQLite history schema updated from v3 to **v4**. New `retry_of` field records the source download ID. A SQLite unique partial index enforces at most one linked retry per original ID.
- Native `PawchiveDownloads.retry()` serializes its check/create path. A repeated request returns the already-scheduled Android DownloadManager ID with `reused: true` instead of scheduling a second transfer.
- When a history database has been restored without the DownloadManager's job, the stale retry relationship is detached without deleting the historical row. The Keystore recovery errors from M10.2 still apply.
- React reports an existing retry and still disables its retry button while a request is in flight.

## Android 15 acceptance test
- Compile and install pinned M9.1 APK, inject synthetic SQLite v2 and legacy preference records, and perform a same-signature in-place upgrade to M10.3.
- Call the **real** Capacitor Java plugin to retry a failed synthetic download once, then terminate/relaunch the app and repeat the same request. Verify both responses identify the same OS-managed task, that the native second response has `reused: true`, and that exactly one history row has `retry_of=424242`.
- Check SQLite v4 migration, original favorites and encrypted URL records, and the existing key-loss/new-key mismatch error paths.
- Seed a known 8×8 PNG into the emulator app's own `Pawchive-M4` folder, registered through the synthetic legacy fixture. Exercise `thumbnail`, Android chooser `open`, and `delete` methods through the real Capacitor bridge, and verify file and SQLite record deletion.
- These checks do **not** download content over a live Internet HTTPS connection. They validate local file lifecycle and DownloadManager retry scheduling without contacting user accounts.

## Release boundaries
- Real physical-device download completion, network transitions, long-running Android 14+ UIDT under power-management constraints, and API 33/36 compatibility still require specific tests.
- The CI uses an Android 15 disposable emulator and **fake** test URLs; uninstall and Keystore-loss simulation must never be run on a user's installed app.
- The headless emulator Android framebuffer screenshot limitation remains distinct from Chromium's verified WebView screenshot.
- Keep Draft PR until the current emulator run is green and cross-version tests are complete.

Documentation:
- https://developer.android.com/reference/android/app/DownloadManager
- https://developer.android.com/reference/android/database/sqlite/SQLiteOpenHelper
- https://capacitorjs.com/docs/android/custom-code
