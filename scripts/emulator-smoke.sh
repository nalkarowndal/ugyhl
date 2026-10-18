#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APK="$ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
OUT="$ROOT/qa-output"
APP="com.pawchive.mobile"
mkdir -p "$OUT"
test -s "$APK" || { echo "Missing debug APK"; exit 2; }
adb wait-for-device
test "$(adb shell getprop sys.boot_completed | tr -d '\r')" = "1"
adb install -r "$APK"
adb shell pm path "$APP" | grep -q '^package:'
launch() {
  adb shell am force-stop "$APP"
  local out
  out="$(adb shell am start -W -n "$APP/.MainActivity")"
  echo "$out"
  echo "$out" | grep -q 'Status: ok' || exit 3
  sleep 6
  adb shell pidof "$APP" >/dev/null || { echo "App crashed"; exit 4; }
  adb shell dumpsys activity activities > "$OUT/activities.txt"
  grep -q "$APP" "$OUT/activities.txt" || exit 5
}
adb logcat -c || true
launch
adb shell screencap -p /sdcard/pawchive-m9.png
adb pull /sdcard/pawchive-m9.png "$OUT/emulator-launch.png" >/dev/null
launch
adb logcat -d -b crash > "$OUT/crash-buffer.log" || true
if grep -E '(FATAL EXCEPTION|Fatal signal)' "$OUT/crash-buffer.log"; then exit 6; fi
echo "PASS: emulator install, launch, process survive, re-launch and crash-buffer QA"
