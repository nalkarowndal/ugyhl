# Chat-mode incremental development plan

## M1: Web mobile UI + Android native single-file download (current)
Deliver React navigation, URL form, persistent watchlist bookmarks, system-managed download queue, status polling, cancel/retry and honest browser-demo separation. Tests: URL schemes, path sanitizing, TypeScript syntax and build. Android APK integration not confirmed until SDK build + physical device check.

## M2: Original v1.2.9 source-based API port
- Audit `core/api_client.py`, `core/parser.py`, `core/providers.py`, `core/filter_engine.py`, `services/link_extractor.py` in original v1.2.9 tag.
- Extract provider specs and fixture responses into `docs/PROVIDER_CONTRACTS.md`.
- Implement `PawchiveProvider` and `CumStProvider` interfaces, URL matcher, creator/posts pagination and attachment selection.
- Start with public data only, no scraped browser cookie, verify rate-limits/terms before live requests.
- Automated fixture tests and real user-authorized integration tests.

## M3: Mobile gallery/storage
Room local database for Task, Post, Creator and Attachment. MediaStore export, Storage Access Framework folder selection, dedupe and filename collision avoidance. Thumbnail pipeline and accessible image/video grid.

## M4: Advanced native download service
Replace or augment basic OS DownloadManager with Android-appropriate durable download engine, range requests, resume checkpoints, independent global cap, per-host retry policy, cancellation, app crash recovery, work constraints and user-initiated data transfer jobs on API 34+ when suitable.

## M5: Extended service adapters
Telegram, cloud providers, archived/password-protected attachments, embedded media. Do not use browser cookie decryption; use allowed authentication and secure Keystore. Review third-party licenses, APIs, copyright rights and TOS.

## M6: Stability, security & APK release
Robolectric/instrumentation test, emulator/device lifecycle tests, scan included dependencies and signed APK, SAST/DAST, SBOM and provenance, accessibility audit and performance testing. Verify licensing/attribution before redistribution.

## Definition of Done for each phase
1. Implemented code rather than fake button or static mock.
2. Unit test + manual runtime checks and explicit pass/fail.
3. Security review (network, local storage, cookies, deletion).
4. Document limitations and attach concise changelog.
5. Commit phase separately, do not amend upstream without user-directed destination.


## M2 implementation in progress (2026-10-19)
Creator/post parser, public API client, attachment selection and DownloadManager queue hookup. Live server and device integration tests pending. Review docs/M2_QA.md.
