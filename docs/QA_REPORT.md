# M1 QA report — 2026-10-19

## Automated checks completed in producer environment
- PASS: TypeScript syntax/transpile checks across all seven TS/TSX source files using TypeScript global compiler (zero parse diagnostics).
- PASS: `scripts/install-native-plugin.mjs` Node syntax check.
- PASS: Node-executed runtime assertions for HTTPS/invalid URL parsing, filename sanitization and size formatting (7/7 checks).
- PASS: Installer script applies to a simulated minimal Capacitor MainActivity and Android manifest; rerunning produces one plugin registration (idempotence).
- PASS: Source ZIP generated and inspected for included files.

## Not verified / blocked
- `npm install`, `npm run build`, `npm test`: npm registry DNS EAI_AGAIN in this environment; package downloads unavailable.
- Android APK compilation and USB/emulator runtime: Android SDK/Gradle toolchain not installed.
- Actual live Pawchive browsing and supported platforms: NOT in the M1 implementation.
- HTML screenshots: sandbox Chromium navigation to local file and loopback server blocked by administrator. Design mock HTML available in docs/static-preview.html for a normal local browser.

## Next checks required in developer machine
1. `npm install && npm run build && npm test`
2. `npm run android:init` and Android Studio Gradle sync/build.
3. Test known safe, user-authorized HTTPS file downloads over Wi-Fi/mobile data; check progress, cancel, retry and force-stop/rotate/restart.
4. Validate actual file location and storage behavior on Android 13-16 and file sharing/export needs.
5. Scan built APK and dependencies before use; review release provenance/signing.
