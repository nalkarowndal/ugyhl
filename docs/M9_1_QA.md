# M9.1 — Android WebView white screen diagnosis

M9 source and APK checks passed, but Android 15 emulator screenshot was entirely white. Android logcat shows PawchiveDownloads.list bridge calls plus dead-thread Handler warnings. Those warnings alone do not identify the cause.

This milestone adds a **debug-only** Chrome DevTools Protocol inspection:
- Queries whether React `.app-frame` exists in WebView DOM, with text length and computed layout dimensions
- Saves a screenshot from Chromium compositor and compares it against Android surface screenshot
- Stores sanitized structural diagnostics in `qa-output/webview-diagnostics.json`, without URLs, cookies or file paths
- Retains strict non-white screenshot gating; doesn't hide white screen or incorrectly mark it as a success

If DOM exists but OS screenshot is blank, investigate emulator GPU/Surface compositor. If DOM absent, inspect WebView asset loading, JS console and React startup. Run with Android Debug app with WebView debugging enabled. Device test for actual transfers still pending.

Official references:
- https://developer.chrome.com/docs/devtools/remote-debugging/webviews
- https://capacitorjs.com/docs/basics/workflow

## Confirmed M9.1 evidence
- Android 15 headless emulator: `adb screencap` returned white on both deprecated `swiftshader_indirect` and supported `swiftshader` GPU modes.
- CDP `Runtime.evaluate` showed `.app-frame` mounted, with 655 nonempty characters, a visible 412px layout and a nonwhite dark theme.
- CDP `Page.captureScreenshot` captured the actual Pawchive home UI. Therefore a blank Android **headless framebuffer capture does not establish a blank WebView UI**.
- Removed render-blocking remote Google Fonts import to make first paint independent of network; this did not cure headless framebuffer capture behavior.
- Emulator CI now requires an actual Chromium screenshot, React DOM metrics and working navigation, while recording Android surface capture as a separate **unverified warning**. This is not a replacement for physical-device screen testing.

Source on GPU modes: https://developer.android.com/studio/run/emulator-acceleration
