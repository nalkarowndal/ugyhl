# M10.1 — Android v2→v3 migration acceptance test

This milestone exercises the **actual Android SQLiteOpenHelper migration**, not merely source-pattern tests.

The CI compiles pinned M9.1 and current M10.1 APKs **on the same runner** (consistent debug signing key), installs the old APK on a disposable Android 15 emulator and seeds a real version-2 app-private SQLite database and legacy SharedPreferences. It then installs the new APK using `adb install -r`, without removing app data. React initialization triggers native download history migration.

Tests assert SQLite user_version 3, integrity check, preserved downloaded item IDs/filenames/favorites, empty plaintext URL fields, Keystore-style sealed values for prior URLs, migrated legacy preferences and removal of plaintext legacy preference keys. The Chromium renderer is inspected separately from the headless emulator OS screenshot.

**Limitations:** test tokens are synthetic and not real credentials. Success does not prove deletion of plaintext bytes in prior filesystem snapshots, OS DownloadManager records, Android backups, WAL history, or device flash storage. Retry by original history ID, interrupted migration and a lost Keystore key still require dedicated device tests.

References: https://developer.android.com/tools/sqlite3 and https://developer.android.com/privacy-and-security/keystore
