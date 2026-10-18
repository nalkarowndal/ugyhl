
**M9 initial emulator screenshot finding:** the earlier process-only test passed but captured a *completely white content area*. We now treat this as a UI QA failure and require nonblank screenshot, with WebView logcat saved for diagnosis. The original run's green status must not be interpreted as a functioning UI.
# M9 test plan and evidence

The standalone `scripts/test-transfer-core.sh` (JDK 17+) runs **real HTTP** against a deterministic local fixture. Java integration cases cover full transfer, pause/HTTP Range resume, safe restart on ignored Range, validator mismatch, SHA-256 mismatch, HTTP 503 retries and restricted redirects. The separate full ZIP development snapshot includes extra connection-cut coverage. The test transport is **package-private, loopback-restricted and not exposed to React**. Public production calls still validate HTTPS and each redirect.

`.github/workflows/m9-emulator-qa.yml` builds the debug APK and boots Android 15 (API 35) with an emulator; it checks installation, process survival after launch, relaunch after app force-stop, and the crash buffer. A screenshot is saved. **The screenshot is pixel-inspected with a stdlib PNG decoder; a blank screen fails QA and logcat/UI hierarchy are saved. This remains smoke QA, not proof UIDT survives job interruption.**

Manual Android 14+ UIDT QA remains necessary:
1. Start authorized large HTTPS transfer while app visible, verify notification/bytes.
2. Inspect the job ID, simulate system stop: `adb shell cmd jobscheduler timeout com.pawchive.mobile JOB_ID`; restart: `adb shell cmd jobscheduler run -f com.pawchive.mobile JOB_ID`.
3. Confirm Range resume, ETag, no duplicate gallery file, correct SHA-256 and encrypted resume state.
4. Distinguish system termination vs user Task Manager Stop; user Stop can prevent rescheduling, requiring explicit resume.
5. Test Android 13 DownloadManager fallback, screen-off and network changes, storage exhaustion, wrong SHA, device reboot separately.

Do not include cookies or signed URLs in logs. Plaintext URLs in legacy DownloadManager records still require remediation. Original third-party features are not yet all ported.

References: [Android UIDT](https://developer.android.com/develop/background-work/background-tasks/uidt), [Android emulator runner](https://github.com/ReactiveCircus/android-emulator-runner).
