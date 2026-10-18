#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
test "$#" -ge 2
OLD_APK="$1"
NEW_APK="$2"
APP="com.pawchive.mobile"
OUT="$ROOT/qa-output/m10-4"
mkdir -p "$OUT"
adb wait-for-device
test "$(adb shell getprop sys.boot_completed | tr -d '\r')" = "1"

snapshot() {
  local name="$1"
  adb exec-out run-as "$APP" cat databases/pawchive_library.db > "$OUT/$name.db"
  for ext in wal shm; do
    adb exec-out run-as "$APP" sh -c "test -f databases/pawchive_library.db-$ext && cat databases/pawchive_library.db-$ext" > "$OUT/$name.db-$ext" || true
    test -s "$OUT/$name.db-$ext" || rm -f "$OUT/$name.db-$ext"
  done
}

echo "M10.4 direct v3 -> v4 test: old install (same signing key)"
adb install -r "$OLD_APK"
adb shell am start -W -n "$APP/.MainActivity" >/dev/null
sleep 8
node "$ROOT/scripts/m10-4-cdp.mjs" seed-v3
adb shell am force-stop "$APP"
snapshot db-v3
python3 "$ROOT/scripts/m10-4-verify.py" "$OUT" before

echo "M10.4 update in place: do not clear data, preserve key"
adb install -r "$NEW_APK"
adb logcat -c || true
adb shell am start -W -n "$APP/.MainActivity" >/dev/null
sleep 7
node "$ROOT/scripts/m10-4-cdp.mjs" check-upgrade
adb shell am force-stop "$APP"
snapshot db-v4
python3 "$ROOT/scripts/m10-4-verify.py" "$OUT" after

echo "M10.4 real HTTPS test: public pinned license fixture via system DownloadManager"
adb shell am start -W -n "$APP/.MainActivity" >/dev/null
sleep 3
node "$ROOT/scripts/m10-4-cdp.mjs" enqueue-https
node "$ROOT/scripts/m10-4-cdp.mjs" poll-https
FILE_ROOT="/sdcard/Android/data/$APP/files/Download/Pawchive"
MOBILE_FILE="$(adb shell find "$FILE_ROOT" -maxdepth 1 -type f -name '*_m10-4-license.txt' | tr -d '\r' | tail -n 1)"
test -n "$MOBILE_FILE"
adb exec-out cat "$MOBILE_FILE" > "$OUT/downloaded-public-license.txt"
cmp -s "$ROOT/UPSTREAM_LICENSE.txt" "$OUT/downloaded-public-license.txt" || {
  echo "FAIL: Android HTTPS bytes differ from pinned source"; exit 1;
}
sha256sum "$OUT/downloaded-public-license.txt" | awk '{print $1}' > "$OUT/https-file-sha256.txt"
rm -f "$OUT/downloaded-public-license.txt"
echo "PASS: completed actual HTTPS DownloadManager transfer, source bytes match"

node "$ROOT/scripts/m10-4-cdp.mjs" delete-https
adb shell test ! -f "$MOBILE_FILE"
adb shell am force-stop "$APP"
snapshot db-deleted
python3 "$ROOT/scripts/m10-4-verify.py" "$OUT" deleted

adb logcat -d -b crash > "$OUT/crash-buffer.log" || true
if grep -E 'FATAL EXCEPTION|Fatal signal' "$OUT/crash-buffer.log"; then
  echo "FAIL: Android crash detected";exit 1
fi
echo "PASS: M10.4 signed update, actual HTTPS bytes, Android DownloadManager deletion"
