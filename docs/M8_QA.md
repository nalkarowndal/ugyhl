# M8 QA progress — 2026-10-19

## Changed
- Android 14+ UIDT JobService: bounded progress notification updates and JobScheduler network byte updates.
- Android JobScheduler reason diagnostics surfaced to React without exposing saved URL.
- Pure-Java percentage overflow/throttling tests and React display-string unit tests.
- Native installer and Android build CI updated for M8.

## Local verification
- `bash scripts/test-transfer-core.sh`: Java policy and transfer tests passed.
- `node scripts/verify-source.cjs`: TS/TSX syntax and source checks passed.
- Local `npm run build` could not run without dependencies; CI must run npm install, Vitest, tsc, Vite, and Gradle.

## Device QA required
1. Android 14+: start a user-initiated HTTPS Range-capable download while app visible.
2. Verify notification progress/size updates and OS pending-reason messaging, with Wi-Fi disabled/re-enabled.
3. Pause/resume, app recreation, system interruption, task-manager Stop, reboot, and parallel transfers.
4. Validate final SHA-256 against independently trusted value, and gallery file accessibility.
5. Android 13: verify DownloadManager fallback.

Build success does not prove runtime behavior, long-term survival, or desktop feature parity.
Original [Pawchive Downloader v1.2.9](https://github.com/whyamihere773/Pawchive-Downloader/blob/v1.2.9/LICENSE) is custom source-available; personal noncommercial use only without separately granted commercial permission.
