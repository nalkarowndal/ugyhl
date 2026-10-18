#!/usr/bin/env python3
"""Create disposable real SQLite v2 and legacy preference fixtures with FAKE tokens."""
import json,sqlite3,sys
from pathlib import Path
from xml.sax.saxutils import escape
out=Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True)
database=out/"pawchive_library.db"
if database.exists(): database.unlink()
with sqlite3.connect(database) as db:
    db.execute("""CREATE TABLE downloads (
       id TEXT PRIMARY KEY NOT NULL,
       url TEXT NOT NULL,filename TEXT NOT NULL,created_at INTEGER NOT NULL,
       favorite INTEGER NOT NULL DEFAULT 0,
       source TEXT NOT NULL DEFAULT 'system',
       local_path TEXT NOT NULL DEFAULT '')""")
    db.execute("CREATE INDEX idx_downloads_created ON downloads(created_at DESC)")
    db.executemany("INSERT INTO downloads VALUES (?,?,?,?,?,?,?)",[
      ("424242","https://example.invalid/a.png?token=M10_FAKE_DATABASE","preserved.png",1700000000000,1,"system",""),
      ("m4:00000000-0000-4000-8000-000000000001","","gallery.png",1700000001000,1,"m4","/invalid/old/path"),
      ("m4:00000000-0000-4000-8000-000000000003","","qa-sample.png",1700000002000,0,"m4","/storage/emulated/0/Android/data/com.pawchive.mobile/files/Download/Pawchive-M4/00000000-0000-4000-8000-000000000003_qa-sample.png")
    ])
    db.execute("PRAGMA user_version=2")
records=json.dumps([{"id":"424244","url":"https://example.invalid/b.png?token=M10_FAKE_PREFS","filename":"from-prefs.png"}])
xml='<?xml version="1.0" encoding="utf-8" standalone="yes" ?>\n<map>\n'
xml+='  <boolean name="m3_sqlite_migrated" value="false" />\n'
xml+='  <string name="records">'+escape(records)+'</string>\n</map>\n'
(out/"pawchive_mobile_downloads_v1.xml").write_text(xml,encoding="utf-8")
print("Created real v2 SQLite + legacy XML fixtures (synthetic tokens).")

# A deterministic non-secret PNG in the app-owned M4 directory for gallery QA.
import struct,zlib
raw=b"".join(b"\x00"+bytes([45,116,188])*8 for _ in range(8))
def chunk(kind,data):
    return struct.pack(">I",len(data))+kind+data+struct.pack(">I",zlib.crc32(kind+data)&0xffffffff)
png=b"\x89PNG\r\n\x1a\n"+chunk(b"IHDR",struct.pack(">IIBBBBB",8,8,8,2,0,0,0))+chunk(b"IDAT",zlib.compress(raw))+chunk(b"IEND",b"")
(out/"qa-sample.png").write_bytes(png)
