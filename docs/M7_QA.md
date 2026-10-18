# M7 Android background download — implementation and QA

## Architecture
- `PawchiveBackgroundPlugin`: Capacitor UI entrypoint, start/list/pause/resume; only explicit user-tap jobs on Android API>=34.
- `BackgroundTransferJobService`: JobScheduler UIDT execution, user-visible notification, system-stop retry decision, transient retry handling, gallery index.
- `BackgroundTransferStore`: Android Keystore AES-GCM URL ciphertext in private no-backup JSON, persistent ETag, bytes, job ID, SHA-256 digest, state.
- `BackgroundJobPolicy`: pure Java retry and unsafe checkpoint replacement classification.
- Default `PawchiveDownloadsPlugin` DownloadManager path is unchanged; used for Android <=13.

## Implementation limits
- UIDT is system managed, **not** an unconditional never-stop background service. The OS can interrupt for user choice, thermal/system health, battery or network restrictions. Force-stop from the Task Manager can kill the app with no callbacks and block automatic rescheduling. Reopen and select Resume if necessary.
- Before Android 14, this new UI uses the existing system DownloadManager (not a WorkManager foreground worker), so it lacks the new engine's SHA verification/explicit pause.
- An encrypted URL record prevents easy plaintext exposure at rest, but other legacy DownloadManager URLs may still be stored in SQLite without encryption. This is a separate follow-up risk.
- No remote service account cookies or DRM bypass are used. Test only against URLs you have the right to download.
- Android notification runtime permission is declared; user preferences and device rules may affect delivery.
- Device execution and power-kill behavior require emulator/real-device tests. Java compilation alone does not establish reliability.

## Executed automated checks
- `bash scripts/test-transfer-core.sh`: pure Java transfer, digest, gallery path and M7 retry-policy assertions.
- `node scripts/test-install-native.mjs`: Java/Kotlin plugin installation on test scaffold twice, XML provider/service/permission idempotence.
- `npm test` and `npm run build` through GitHub Actions CI.
- APK Gradle build via GitHub Actions Android debug APK workflow.

## Manual device test matrix (pending until a device is available)
1. Android 14/15/16: start HTTPS file from visible download view; verify notification in shade/task manager; background app and lock screen.
2. Verify resumed Range bytes/ETag using a **controlled** HTTPS test endpoint; assert no duplicate bytes after interruption.
3. Pause then Resume; confirm the same job ID and partial-file continuity.
4. Force-stop using UIDT Task Manager (can kill process without onStopJob); reopen and manually Resume.
5. Enable/disable Wi-Fi with Unmetered setting, test storage-full, HTTP 403/429/500, truncation and invalid ETag.
6. Verify trusted SHA-256 mismatch cannot reach success or appear in gallery.
7. Confirm encrypted registry never contains unsealed query tokens; confirm generic error UI does not include credentials.
8. Verify Android 13 runs the default DownloadManager path with no UIDT invocation.
9. Confirm completion appears in SQLite gallery with correct opened content URI and safe delete.
10. Reinstall update **without clearing app data** to verify upgrade state and Keystore key continuity.

## Original project and license
[whyamihere773/Pawchive-Downloader v1.2.9](https://github.com/whyamihere773/Pawchive-Downloader/releases/tag/v1.2.9) has a custom source-available license requiring attribution, a noncommercial restriction, and commercial licensing permission.
