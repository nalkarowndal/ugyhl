# M10 — Protect system DownloadManager URL records (development branch)

## Scope
- Upgrade SQLite history from v2 to v3, add `url_sealed` (Android Keystore AES-256-GCM through the existing UrlVault). New downloads never write URLs in plaintext to the SQLite `url` column.
- Encrypt the pre-existing v1/v2 `downloads.url` values within the SQLiteOpenHelper upgrade transaction. On encryption failure, roll back rather than dropping URLs.
- Migration from legacy SharedPreferences encrypts URLs directly, and removes original plaintext record keys after commit. Even if the prior M3 migration flag was set, residual preferences are cleared.
- Set SQLite secure_delete pragma for new deletion/overwrites. Do **not** claim this wipes older historical filesystem snapshots, backups, free pages, journal or OS-level DownloadManager records.
- `PawchiveDownloads.list` returns empty `url` and never selects sealed ciphertext; native `retry(id,wifiOnly)` decrypts only in Android and enqueues a new OS job. React calls retry by ID.
- All other M9.1 functionality preserved.

## Testing and release gates
- CI must pass `npm test`, `npm run build`, `npm run test:url-privacy`, native installer smoke checks, Java transfer tests, and Android assembleDebug.
- **Still required on disposable Android device or emulator**: install previous M9.1 version, enqueue URL with a test token, update without uninstall, verify SQLite schema v3, sealed URL, empty legacy URL field and removal of SharedPreferences original, retry failed job, preserved favorites and gallery; also try missing Keystore key and rollback behavior.
- The OS system DownloadManager retains the job URL outside of this application's database. This migration reduces app-local disclosure and web bridge exposure but is not end-to-end secret eradication.
- Public provider API auth, Android backup and existing disk snapshots require separate privacy review.

## Reference docs
- Android Keystore https://developer.android.com/privacy-and-security/keystore
- Android SQLiteOpenHelper https://developer.android.com/reference/android/database/sqlite/SQLiteOpenHelper
