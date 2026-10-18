#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="com.pawchive.mobile"
OLD_APK="$1"
NEW_APK="$2"
OUT="$ROOT/qa-output/m10-migration"
mkdir -p "$OUT"
test -s "$OLD_APK" && test -s "$NEW_APK"
adb wait-for-device
test "$(adb shell getprop sys.boot_completed | tr -d '\r')" = "1"

# Both APKs are built on the same CI runner with the same debug signing key.
adb install -r "$OLD_APK"
adb shell pm path "$APP" | grep -q '^package:'
adb shell am force-stop "$APP" || true
python3 "$ROOT/scripts/m10-create-fixture.py" "$OUT/fixture"
adb push "$OUT/fixture/pawchive_library.db" /data/local/tmp/m10-old.db >/dev/null
adb push "$OUT/fixture/pawchive_mobile_downloads_v1.xml" /data/local/tmp/m10-old-prefs.xml >/dev/null
adb shell run-as "$APP" mkdir -p databases shared_prefs
adb shell run-as "$APP" cp /data/local/tmp/m10-old.db databases/pawchive_library.db
adb shell run-as "$APP" cp /data/local/tmp/m10-old-prefs.xml shared_prefs/pawchive_mobile_downloads_v1.xml

# Actual Android package update. NEVER uninstall or clear data.
adb install -r "$NEW_APK"
adb logcat -c || true
adb shell am start -W -n "$APP/.MainActivity" | tee "$OUT/launch.txt"
sleep 10
adb shell pidof "$APP" >/dev/null || { echo "FAIL: app did not survive migration"; exit 1; }
node "$ROOT/scripts/inspect-webview.mjs"
cp "$ROOT/qa-output/webview-diagnostics.json" "$OUT/webview-diagnostics.json"
cp "$ROOT/qa-output/webview-cdp.png" "$OUT/webview-cdp.png"
python3 "$ROOT/scripts/check-screenshot.py" "$OUT/webview-cdp.png"

# Snapshot database after clean app process stop, preserving any existing WAL.
adb shell am force-stop "$APP"
adb exec-out run-as "$APP" cat databases/pawchive_library.db > "$OUT/upgraded.db"
for ext in wal shm; do
  adb exec-out run-as "$APP" sh -c "test -f databases/pawchive_library.db-$ext && cat databases/pawchive_library.db-$ext" > "$OUT/upgraded.db-$ext" || true
  test -s "$OUT/upgraded.db-$ext" || rm -f "$OUT/upgraded.db-$ext"
done
adb exec-out run-as "$APP" cat shared_prefs/pawchive_mobile_downloads_v1.xml > "$OUT/upgraded-prefs.xml"
python3 "$ROOT/scripts/m10-verify-fixture.py" "$OUT"
adb logcat -d -b crash > "$OUT/crash-buffer.log" || true
if grep -E 'FATAL EXCEPTION|Fatal signal' "$OUT/crash-buffer.log"; then exit 1; fi
echo "PASS: signed APK update, real Android database upgrade, encrypted history and WebView"
