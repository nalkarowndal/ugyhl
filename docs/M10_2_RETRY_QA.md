# M10.2 — Native retry, lost-key handling and Android CI

## Scope
- Android `UrlVault(false)` decrypts saved URLs using **an existing Android Keystore key only**. A missing alias does not generate a new key.
- Native retry returns stable `RETRY_KEY_UNAVAILABLE` or `RETRY_CIPHERTEXT_UNREADABLE` error codes without exposing plaintext URL, raw ciphertext or key material.
- The React retry button is disabled while its request is in progress, and provides a Korean explanation prompting user re-entry of the original URL if the saved ciphertext cannot be recovered. Existing history and downloaded files are left intact.
- Legacy SharedPreferences migration does not create an unnecessary new encryption key when there are no legacy entries.

## Automated QA
The disposable Android 15 emulator workflow builds an older M9.1 APK and an M10.2 APK signed by the same debug key, verifies a real SQLite v2→v3 upgrade, then calls the real Capacitor plugin with a test-only `example.invalid` URL (no user content):
1. Retry a synthetic failed record and verify a new download entry is recorded with encrypted URL and no plaintext.
2. Simulate loss of app-managed keystore state by clearing a **disposable emulator app** and restoring only its earlier encrypted SQLite database.
3. Require a distinct `RETRY_KEY_UNAVAILABLE` outcome while preserving original metadata and favorites.
4. Enqueue a harmless test link to create a fresh key; retry the stale ciphertext and require `RETRY_CIPHERTEXT_UNREADABLE`, proving old ciphertext cannot be decrypted by a new key.
5. Check WebView renderer/navigation and existing source tests.

**Release gates:** CI green with Android 15; no real-device long-running transfer proof yet. Tests don't simulate an actual user backup/restore or prove physical flash sanitization. OS DownloadManager retains its own job metadata; malicious external links are not fetched.

**Never run the app-data clearing sequence on a real phone.**

References:
- Android Keystore: https://developer.android.com/privacy-and-security/keystore
- Android database: https://developer.android.com/reference/android/database/sqlite/SQLiteOpenHelper
