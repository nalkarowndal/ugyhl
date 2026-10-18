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
# Seed a harmless 8x8 PNG into app-specific storage for thumbnail/open/delete QA.
IMAGE_ID="00000000-0000-4000-8000-000000000003"
M4_DIR="/storage/emulated/0/Android/data/$APP/files/Download/Pawchive-M4"
adb push "$OUT/fixture/qa-sample.png" /data/local/tmp/m10-qa-sample.png >/dev/null
adb shell run-as "$APP" mkdir -p "$M4_DIR"
adb shell run-as "$APP" cp /data/local/tmp/m10-qa-sample.png "$M4_DIR/${IMAGE_ID}_qa-sample.png"
adb shell run-as "$APP" test -s "$M4_DIR/${IMAGE_ID}_qa-sample.png"

# Actual Android package update. NEVER uninstall or clear data.
adb install -r "$NEW_APK"
adb logcat -c || true
adb shell am start -W -n "$APP/.MainActivity" | tee "$OUT/launch.txt"
sleep 10
adb shell pidof "$APP" >/dev/null || { echo "FAIL: app did not survive migration"; exit 1; }
node "$ROOT/scripts/inspect-webview.mjs"
node "$ROOT/scripts/m10-2-native-retry.mjs" 424242 success
adb shell am force-stop "$APP"
adb shell am start -W -n "$APP/.MainActivity" >/dev/null
sleep 4
node "$ROOT/scripts/m10-2-native-retry.mjs" 424242 duplicate
# The gallery methods must work on a real app-owned PNG and never read arbitrary paths.
node "$ROOT/scripts/m10-3-gallery-action.mjs" thumbnail
node "$ROOT/scripts/m10-3-gallery-action.mjs" open
adb shell am start -W -n "$APP/.MainActivity" >/dev/null
sleep 4
node "$ROOT/scripts/m10-3-gallery-action.mjs" delete
adb shell run-as "$APP" test ! -f "$M4_DIR/${IMAGE_ID}_qa-sample.png"
cp "$ROOT/qa-output/webview-diagnostics.json" "$OUT/webview-diagnostics.json"
cp "$ROOT/qa-output/webview-cdp.png" "$OUT/webview-cdp.png"
python3 "$ROOT/scripts/check-screenshot.py" "$OUT/webview-cdp.png"

# Snapshot database after clean app process stop, preserving any existing WAL.
adb logcat -d -v time | tail -n 4000 > "$OUT/logcat-migration.txt" || true
echo "M10 migration native errors (synthetic fixture):"
grep -E 'PawchiveMobile|SQLiteException|AndroidKeyStore|UrlVault|URL_VAULT|Legacy migration|library_list' "$OUT/logcat-migration.txt" | tail -n 45 || true
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

python3 "$ROOT/scripts/m10-2-verify-retry.py" "$OUT" initial

# Disposable emulator only: simulate restored encrypted DB with its original
# Keystore key missing. Do not delete real user data or keys.
python3 - "$OUT/upgraded.db" "$OUT/stale-key.db" <<'PY'
import sqlite3,sys
source=sqlite3.connect(sys.argv[1]);dest=sqlite3.connect(sys.argv[2])
source.backup(dest)
dest.close();source.close()
PY
# pm clear is not a reliable simulation of Android Keystore alias deletion.
# Reinstall the disposable emulator package so its original UID-bound key is removed,
# then restore only the SQLite ciphertext WITHOUT any old key.
adb uninstall "$APP" | grep -q Success
adb install "$NEW_APK" | grep -q Success
adb push "$OUT/stale-key.db" /data/local/tmp/m10-stale-key.db >/dev/null
adb shell run-as "$APP" mkdir -p databases
adb shell run-as "$APP" cp /data/local/tmp/m10-stale-key.db databases/pawchive_library.db
adb shell am start -W -n "$APP/.MainActivity" | tee "$OUT/relaunch-without-key.txt"
sleep 8
adb shell pidof "$APP" >/dev/null
node "$ROOT/scripts/m10-2-native-retry.mjs" 424242 RETRY_KEY_UNAVAILABLE

# Create a fresh Android Keystore alias without deleting the stale record.
# A different key must never decrypt prior AES-GCM ciphertext.
node "$ROOT/scripts/m10-2-native-retry.mjs" 424242 new-key
node "$ROOT/scripts/m10-2-native-retry.mjs" 424242 RETRY_CIPHERTEXT_UNREADABLE
adb shell am force-stop "$APP"
adb exec-out run-as "$APP" cat databases/pawchive_library.db > "$OUT/after-key-loss.db"
for ext in wal shm; do
  adb exec-out run-as "$APP" sh -c "test -f databases/pawchive_library.db-$ext && cat databases/pawchive_library.db-$ext" > "$OUT/after-key-loss.db-$ext" || true
  test -s "$OUT/after-key-loss.db-$ext" || rm -f "$OUT/after-key-loss.db-$ext"
done
python3 "$ROOT/scripts/m10-2-verify-retry.py" "$OUT" after-loss
echo "PASS: valid retry, missing key and ciphertext mismatch all checked on Android."

