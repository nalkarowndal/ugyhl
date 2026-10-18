#!/usr/bin/env python3
"""Verify retry results without printing signed URLs or ciphertext."""
import json,sqlite3,sys
from pathlib import Path
out=Path(sys.argv[1]);mode=sys.argv[2]
assert mode in ("initial","after-loss")
dbfile=out/("upgraded.db" if mode=="initial" else "after-key-loss.db")
with sqlite3.connect(dbfile) as db:
    assert db.execute("PRAGMA integrity_check").fetchone()[0]=="ok"
    assert db.execute("PRAGMA user_version").fetchone()[0]==3
    rows={r[0]:r for r in db.execute(
        "SELECT id,url,url_sealed,filename,favorite FROM downloads"
    )}
    original=rows["424242"]
    assert original[1]=="" and original[2].startswith("v1:")
    assert original[3]=="preserved.png" and original[4]==1
    assert all("M10_FAKE_" not in str(c) for r in rows.values() for c in r)
    if mode=="initial":
        new_id=json.loads((out/"native-retry-success.json").read_text())["id"]
        assert new_id!="424242" and new_id in rows,"Native retry did not persist a new history record"
        new=rows[new_id]
        assert new[1]=="" and new[2].startswith("v1:") and new[3]=="preserved.png"
        assert len(rows)>=4
        print("PASS: Android native retry created a new DownloadManager record with sealed URL.")
    else:
        for tag in ("RETRY_KEY_UNAVAILABLE","RETRY_CIPHERTEXT_UNREADABLE"):
            result=json.loads((out/("native-retry-"+tag+".json")).read_text())
            assert result["ok"] is False and result["code"]==tag
        for ident in ("424242","424244"):
            assert ident in rows,"Old records lost after Keystore reset"
        assert original[4]==1
        print("PASS: missing/mismatched Keystore key rejected without deleting historical records.")
