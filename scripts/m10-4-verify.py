#!/usr/bin/env python3
"""Inspect actual SQLite DB copied from Android. No user URLs are logged."""
from pathlib import Path
import sqlite3,sys,json,hashlib

out=Path(sys.argv[1])
phase=sys.argv[2]
assert phase in ("before","after","deleted")
dbfile=out/("db-v3.db" if phase=="before" else "db-v4.db" if phase=="after" else "db-deleted.db")
seed=json.loads((out/"seed-v3.json").read_text())
with sqlite3.connect(dbfile) as db:
    assert db.execute("PRAGMA integrity_check").fetchone()[0]=="ok", "database damaged"
    version=db.execute("PRAGMA user_version").fetchone()[0]
    assert version==(3 if phase=="before" else 4), (phase,version)
    cols={r[1] for r in db.execute("PRAGMA table_info(downloads)")}
    assert {"id","url","url_sealed","favorite"}<=cols
    if phase=="before": assert "retry_of" not in cols
    else:
        assert "retry_of" in cols
        index=db.execute("SELECT sql FROM sqlite_master WHERE type='index' AND name='idx_downloads_retry_of'").fetchone()
        assert index and "UNIQUE" in index[0] and "retry_of" in index[0]
    row=db.execute("SELECT id,url,url_sealed,filename,favorite FROM downloads WHERE id=?",(seed["id"],)).fetchone()
    assert row is not None,"existing downloaded record lost"
    assert row[1]=="" and row[2].startswith("v1:") and len(row[2])>50
    assert row[3]=="m10-4-old.dat" and row[4]==1,"favorite/filename changed"
    fingerprint=hashlib.sha256(row[2].encode("utf-8")).hexdigest()
    if phase=="before": (out/"ciphertext-sha256.txt").write_text(fingerprint+"\n")
    else:
        assert (out/"ciphertext-sha256.txt").read_text().strip()==fingerprint,"sealed URL changed unexpectedly"
        retry=db.execute("SELECT retry_of FROM downloads WHERE id=?",(seed["id"],)).fetchone()
        assert retry[0]=="","unexpected retry relationship on old row"
    if phase=="deleted":
        live=json.loads((out/"enqueue-https.json").read_text())["id"]
        assert db.execute("SELECT 1 FROM downloads WHERE id=?",(live,)).fetchone() is None
print(f"PASS: actual SQLite {phase} version={version}; metadata/favorite/encrypted URL persisted")
