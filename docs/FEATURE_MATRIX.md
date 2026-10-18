# Pawchive Downloader v1.2.9 → Mobile migration matrix

Fixed original reference: https://github.com/whyamihere773/Pawchive-Downloader/releases/tag/v1.2.9

Legend: DONE = source included in this project, PARTIAL = interface exists but not fully ported, TODO = not implemented. All items reflect code **shipped in this repository**, not features merely displayed in the UI.

| Source feature | Mobile target | Status | Phase |
| --- | --- | --- | --- |
| New mobile React responsive shell | React/TypeScript | DONE | M1 |
| Download direct HTTPS file | Android DownloadManager through Capacitor Java plugin | DONE (build/real-device validation pending) | M1 |
| Download list and progress | Android DownloadManager query, stored IDs | DONE (device validation pending) | M1 |
| Download cancel and retry failed item | DownloadManager remove + enqueue | DONE (device validation pending) | M1 |
| Wi-Fi only network restriction | DownloadManager Request | DONE (device validation pending) | M1 |
| Browser UI preview | Web non-downloading preview | DONE | M1 |
| Watchlist addresses | Local web storage only | PARTIAL | M1/M3 |
| Post, creator URL parser | Origin allow-list, creator/single post parser, tests | DONE (source; live verification pending) | M2 |
| Pawchive/Cum.st pagination | REST query + 50 item page navigation; no automatic multi-page crawl | PARTIAL (device/server verification pending) | M2 |
| Post/attachment picker | Posts, files, media filters, selection, native queue registration | PARTIAL (signed/deferred links unsupported) | M2 |
| Filename collision, dedupe | Archive database and fingerprint scheme | PARTIAL (unique prefix only) | M3 |
| Native media gallery | MediaStore/SAF + local thumbnails | TODO | M3 |
| Download archive database + verifier | Room or SQLite migrations | TODO | M3 |
| Multi-thread chunk/resumable | Java sequential Range + persistent partial file; multipart remains TODO | PARTIAL M4-alpha (device validation pending) | M4 |
| Global bandwidth limit v1.2.9 | Per-transfer KiB/s throttle implemented; aggregate global cap TODO | PARTIAL M4-alpha (device validation pending) | M4 |
| Watchlist new-post sync | Respect rate limits, WorkManager | TODO | M4 |
| Queue auto-recovery | Android OS DownloadManager + M4 registry marks unfinished jobs paused after restart | PARTIAL (M4 restart path device QA pending) | M4 |
| Download scheduler/night owl | WorkManager / JobScheduler | TODO | M4 |
| Google Drive, Dropbox, GoFile | Authenticated providers with scoped tokens | TODO | M5 |
| MEGA folder decryption | Reviewed Android-compatible AES implementation | TODO | M5 |
| Telegram login, media picker, download | Reviewed Android client and secure session storage | TODO | M5 |
| yt-dlp embedded video | Android-compatible extractor strategy and compliance review | TODO | M5 |
| Zip/RAR/7z extraction/password bank | Android archive library with zip slip defenses | TODO | M5 |
| Image conversion, audio metadata | Android codecs/Exif/metadata | TODO | M5 |
| AI recognizer | Android on-device runtime compatibility / memory budget | TODO | M6 |
| Browser cookie importer | DO NOT PORT desktop cookie extraction. User-mediated auth only | DESIGN CHANGE | M5 |
| Windows updater | Android store or signed APK updates | DESIGN CHANGE | M6 |

## Android version caveats

M1 uses the OS `DownloadManager` for system-managed HTTP transfer. It does NOT promise advanced pause/resume controls, full-download integrity hash checks, multithread acceleration, browser cookie migration or full background scheduling. Files are saved to `Android/data/com.pawchive.mobile/files/Download/Pawchive/` (may be difficult to access with third-party file apps on modern Android). Implement MediaStore export/SAF folder picker next.

Android 14+ longer user-initiated transfer should be reviewed against UIDT JobScheduler guidelines before replacing DownloadManager with a custom worker. WorkManager is better suited for deferrable periodic sync; no uninterrupted transfer guarantee under battery or OS restrictions.

## Security gates

- No plaintext secrets in localStorage; watchlist URL may embed sensitive tokens, so reject signed-auth data in future implementation.
- No cookie scraping from third-party browser profiles.
- Download URL validation on TypeScript and Java; HTTPS only, no user info.
- No transparent EXE/ZIP execution, no unzip in first milestone.
- Future remote file downloads require size ceilings, destination isolation, MIME checks, ZIP slip defenses and cancellation cleanup.
- Do not build trust in APK until dependency and release binary scans + Android run-time QA.


## M3 status (2026-10-19)
- [x] Android SQLite metadata storage (coded; APK not compiled)
- [x] M1/M2 SharedPreferences history migration (coded; device QA pending)
- [x] Completed native downloads in responsive gallery (coded)
- [x] Image thumbnail generation, open file with Android viewer (coded)
- [x] Text search, kind filter, favorite, newest/oldest/name/size sorting (coded)
- [x] Confirmation-gated file and record delete (coded)
- [ ] Full original v1.2.9 feature parity
- [ ] Real device / APK build verified
