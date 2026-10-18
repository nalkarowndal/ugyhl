#!/usr/bin/env python3
"""Reject incomplete or plaintext M10 on-device migrations."""
import sqlite3,sys
from pathlib import Path
out=Path(sys.argv[1])
with sqlite3.connect(out/"upgraded.db") as db:
    assert db.execute("PRAGMA integrity_check").fetchone()[0]=="ok"
    assert db.execute("PRAGMA user_version").fetchone()[0]==4
    assert {"url_sealed","retry_of"} <= {row[1] for row in db.execute("PRAGMA table_info(downloads)")}
    rows={r[0]:r for r in db.execute("SELECT id,url,url_sealed,filename,favorite,source FROM downloads")}
    for item,name,fave in [
      ("424242","preserved.png",1),
      ("424244","from-prefs.png",0),
      ("m4:00000000-0000-4000-8000-000000000001","gallery.png",1)
    ]:
        assert item in rows,"Missing record "+item
        r=rows[item];assert r[1]=="" and r[3]==name and r[4]==fave,r
        if item.startswith("m4:"):assert r[2]==""
        else:assert r[2].startswith("v1:") and len(r[2])>50
    assert all("M10_FAKE_" not in str(v) for r in rows.values() for v in r)
prefs=(out/"upgraded-prefs.xml").read_text("utf-8")
assert 'name="records"' not in prefs
assert "M10_FAKE_" not in prefs
assert 'name="m3_sqlite_migrated" value="true"' in prefs
print("PASS: v2-to-v4 migration, encrypted URLs, favorites, legacy prefs cleanup")
