# M10.4 — Direct SQLite v3→v4 Upgrade and Actual HTTPS Download QA

## Objective
Verify two previously unproven release gates with a real Android 15 emulator. These are actual Capacitor → Java calls, not mocked TypeScript unit tests.

### 1. Direct M10.2 → M10.4 APK upgrade
- Build the **pinned M10.2 commit** (`493b197fb9c95eb61127a7aae810650d4092836b`) and current M10.4 with the same runner's Android debug signing key.
- Install M10.2; launch React; call native `enqueue` with a **fake example.invalid** URL and mark the record as favorite.
- Verify that the **real SQLite database version is 3**, with URL encrypted using the Android Keystore.
- Install the new APK using `adb install -r` **without removing app data**; launch native list.
- Verify schema v4, partial unique retry index, `retry_of` default, original favorite, identical sealed ciphertext digest and SQLite integrity.
- This test does **not** reset the original Android Keystore before migration.

### 2. Public HTTPS fixture completion and file lifecycle
- Use the pinned public resource `UPSTREAM_LICENSE.txt` hosted at the repository's GitHub Raw domain over **real HTTPS**. Its content is a project license file, not private user media.
- Request via native `PawchiveDownloads.enqueue()`; poll actual Android DownloadManager status until `success` (timeout bounded). Require nonzero bytes.
- Copy the downloaded app-owned file through the emulator shell and compare **every byte** with the checked-out repository's `UPSTREAM_LICENSE.txt`.
- Delete via native `PawchiveDownloads.delete()`; verify physical file absence and SQLite history removal.

## Limits
- External connectivity to `raw.githubusercontent.com` is needed for the HTTPS part. Network/DNS failure is an environmental blocker, **not** proof the app itself is incorrect. Report rather than artificially overriding a failure.
- This is a disposable Android 15 emulator using debug builds. It does **not** establish app behavior across Android 13/16 devices, power-saving, lost connectivity, long-running UIDT, or actual user account media.
- Debug APKs compiled in separate CI runs can have different signing keys; never uninstall a real user app to bypass signature incompatibility.
- Treat `main` and earlier draft PRs as unchanged until all release gates are independently evaluated.

## Sources
- [Android DownloadManager](https://developer.android.com/reference/android/app/DownloadManager)
- [SQLiteOpenHelper](https://developer.android.com/reference/android/database/sqlite/SQLiteOpenHelper)
