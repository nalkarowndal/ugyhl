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
