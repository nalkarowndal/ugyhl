package com.pawchive.mobile;

import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Environment;
import android.os.ParcelFileDescriptor;
import android.util.Base64;
import android.util.Log;
import android.webkit.MimeTypeMap;
import androidx.core.content.FileProvider;
import java.io.FileInputStream;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.util.Locale;

/**
 * M3 native file library. DownloadManager remains the authoritative status source.
 * SQLite stores ONLY downloads created by this app, their immutable ids and local
 * metadata; it does not scan arbitrary folders or read browser credentials.
 */
@CapacitorPlugin(name = "PawchiveDownloads")
public class PawchiveDownloadsPlugin extends Plugin {
    private static final String TAG = "PawchiveMobile";
    private static final String OLD_PREF = "pawchive_mobile_downloads_v1";
    private static final String OLD_KEY = "records";
    private static final String MIGRATED = "m3_sqlite_migrated";
    private LibraryDb db;

    static class LibraryDb extends SQLiteOpenHelper {
        LibraryDb(Context ctx) { super(ctx, "pawchive_library.db", null, 3); }
        @Override public void onCreate(SQLiteDatabase database) {
            database.execSQL("CREATE TABLE downloads (id TEXT PRIMARY KEY NOT NULL, url TEXT NOT NULL, filename TEXT NOT NULL, created_at INTEGER NOT NULL, favorite INTEGER NOT NULL DEFAULT 0, source TEXT NOT NULL DEFAULT 'system', local_path TEXT NOT NULL DEFAULT '', url_sealed TEXT NOT NULL DEFAULT '')");
            database.execSQL("CREATE INDEX idx_downloads_created ON downloads(created_at DESC)");
        }
        @Override public void onConfigure(SQLiteDatabase database) {
            super.onConfigure(database);
            database.execSQL("PRAGMA secure_delete=ON");
        }
        @Override public void onUpgrade(SQLiteDatabase database, int oldVersion, int newVersion) {
            if (oldVersion < 2) {
                database.execSQL("ALTER TABLE downloads ADD COLUMN source TEXT NOT NULL DEFAULT 'system'");
                database.execSQL("ALTER TABLE downloads ADD COLUMN local_path TEXT NOT NULL DEFAULT ''");
            }
            if (oldVersion < 3) {
                database.execSQL("ALTER TABLE downloads ADD COLUMN url_sealed TEXT NOT NULL DEFAULT ''");
                try {
                    java.util.ArrayList<String[]> legacy = new java.util.ArrayList<>();
                    try (Cursor cursor = database.rawQuery("SELECT id,url FROM downloads WHERE url<>''", null)) {
                        while (cursor.moveToNext()) legacy.add(new String[]{cursor.getString(0), cursor.getString(1)});
                    }
                    if (!legacy.isEmpty()) {
                        UrlVault vault = new UrlVault();
                        for (String[] row : legacy) {
                            android.content.ContentValues values = new android.content.ContentValues();
                            values.put("url_sealed", vault.seal(row[1]));
                            values.put("url", "");
                            database.update("downloads", values, "id=?", new String[]{row[0]});
                        }
                    }
                } catch (Exception error) {
                    // SQLiteOpenHelper upgrades in a transaction: fail closed and roll back.
                    throw new IllegalStateException("URL_VAULT_MIGRATION_FAILED", error);
                }
            }
        }
    }

    @Override public void load() {
        db = new LibraryDb(getContext());
    }

    /** M4 completed transfer is registered only after the .part file is atomically moved. */
    static void registerCompletedM4(Context context, String id, String filename, File target) throws Exception {
        File downloads = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (downloads == null) throw new IllegalStateException("STORAGE_UNAVAILABLE");
        File verified = GalleryPaths.verified(new File(downloads, "Pawchive-M4"), "m4:" + id, target);
        if (!verified.isFile()) throw new IllegalStateException("M4_FILE_MISSING");
        android.content.ContentValues row = new android.content.ContentValues();
        row.put("id", "m4:" + id);
        row.put("url", ""); // Never store signed / tokenized download URLs in the gallery DB.
        row.put("filename", filename);
        row.put("created_at", System.currentTimeMillis());
        row.put("source", "m4");
        row.put("local_path", verified.getAbsolutePath());
        try (LibraryDb database = new LibraryDb(context)) {
            database.getWritableDatabase().insertWithOnConflict("downloads", null, row, SQLiteDatabase.CONFLICT_IGNORE);
        }
    }
    private File completedM4File(String id) throws Exception {
        File downloads = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (downloads == null) throw new IllegalStateException("STORAGE_UNAVAILABLE");
        try (Cursor c = db.getReadableDatabase().rawQuery("SELECT local_path FROM downloads WHERE id=? AND source='m4'", new String[]{id})) {
            if (!c.moveToFirst()) throw new IllegalArgumentException("UNKNOWN_M4_DOWNLOAD");
            return GalleryPaths.verified(new File(downloads, "Pawchive-M4"), id, new File(c.getString(0)));
        }
    }

    private DownloadManager manager() {
        return (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
    }

    /** Idempotent conversion of M1/M2 SharedPreferences records into SQLite. */
    private synchronized void migrateIfNeeded() {
        SharedPreferences prefs = getContext().getSharedPreferences(OLD_PREF, Context.MODE_PRIVATE);
        if (prefs.getBoolean(MIGRATED, false)) {
            // Older releases left the original plaintext copy in preferences.
            if (prefs.contains(OLD_KEY)) prefs.edit().remove(OLD_KEY).commit();
            return;
        }
        SQLiteDatabase database = db.getWritableDatabase();
        database.beginTransaction();
        try {
            JSONArray old = new JSONArray(prefs.getString(OLD_KEY, "[]"));
            UrlVault vault = new UrlVault();
            for (int i = 0; i < old.length(); i++) {
                JSONObject record = old.optJSONObject(i);
                if (record == null) continue;
                String id = record.optString("id", "");
                if (id.isEmpty()) continue;
                android.content.ContentValues row = new android.content.ContentValues();
                row.put("id", id);
                String legacyUrl = record.optString("url", "");
                row.put("url", "");
                row.put("url_sealed", legacyUrl.isEmpty() ? "" : vault.seal(legacyUrl));
                row.put("filename", record.optString("filename", "download.bin"));
                row.put("created_at", System.currentTimeMillis() - (old.length() - i) * 1000L);
                database.insertWithOnConflict("downloads", null, row, SQLiteDatabase.CONFLICT_IGNORE);
                if (record.optBoolean("cancelled", false)) {
                    // Removed M2 downloads show as unavailable; they are not resurrected.
                }
            }
            database.setTransactionSuccessful();
        } catch (Exception error) {
            Log.e(TAG, "Legacy migration failed", error);
            throw new IllegalStateException("Legacy migration failed", error);
        } finally { database.endTransaction(); }
        if (!prefs.edit().remove(OLD_KEY).putBoolean(MIGRATED, true).commit())
            throw new IllegalStateException("LEGACY_PREF_CLEANUP_FAILED");
    }

    private static String safeName(String input) {
        String name = input == null ? "download.bin" : input;
        name = name.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_");
        name = name.replaceAll("^\\.+", "").trim();
        if (name.length() > 110) name = name.substring(0, 110);
        return name.isEmpty() ? "download.bin" : name;
    }

    private boolean validHttps(String value) {
        try {
            Uri uri = Uri.parse(value);
            String host = uri.getHost();
            if (!"https".equalsIgnoreCase(uri.getScheme()) || host == null || host.isEmpty() ||
                uri.getUserInfo() != null || uri.getPort() != -1) return false;
            String h = host.toLowerCase(Locale.ROOT);
            if (h.equals("localhost") || h.endsWith(".localhost") || h.endsWith(".local") ||
                h.equals("0.0.0.0") || h.equals("255.255.255.255") || h.indexOf(':') >= 0 || h.indexOf('.') < 0) return false;
            // Reject IPv4 literals entirely, including private and loopback ranges.
            if (h.matches("[0-9.]+")) return false;
            return true;
        } catch (Exception error) { return false; }
    }

    /** Only the OS DownloadManager sees a plaintext URL. SQLite stores encrypted URL only. */
    private long enqueueTracked(String url, String name, boolean wifiOnly) throws Exception {
        if (!validHttps(url)) throw new IllegalArgumentException("HTTPS_URL_REQUIRED");
        migrateIfNeeded();
        String sealed = new UrlVault().seal(url);
        File root = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (root == null) throw new IllegalStateException("STORAGE_UNAVAILABLE");
        File folder = new File(root, "Pawchive");
        if (!folder.exists() && !folder.mkdirs()) throw new IllegalStateException("STORAGE_UNAVAILABLE");
        String unique = System.currentTimeMillis() + "_" + name;
        DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url))
            .setTitle(name)
            .setDescription("Pawchive Mobile download")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setAllowedOverMetered(!wifiOnly)
            .setAllowedOverRoaming(false)
            .setDestinationInExternalFilesDir(getContext(), Environment.DIRECTORY_DOWNLOADS, "Pawchive/" + unique);
        if (wifiOnly) request.setAllowedNetworkTypes(DownloadManager.Request.NETWORK_WIFI);
        long id = manager().enqueue(request);
        try {
            android.content.ContentValues values = new android.content.ContentValues();
            values.put("id", Long.toString(id));
            values.put("url", "");
            values.put("url_sealed", sealed);
            values.put("filename", name);
            values.put("created_at", System.currentTimeMillis());
            db.getWritableDatabase().insertOrThrow("downloads", null, values);
        } catch (Exception persistError) {
            manager().remove(id); // No orphan downloads if metadata persistence fails.
            throw persistError;
        }
        return id;
    }

    @PluginMethod public void enqueue(PluginCall call) {
        try {
            String url = call.getString("url", "");
            String name = safeName(call.getString("filename", "download.bin"));
            boolean wifiOnly = Boolean.TRUE.equals(call.getBoolean("wifiOnly", false));
            long id = enqueueTracked(url, name, wifiOnly);
            JSObject out = new JSObject(); out.put("id", Long.toString(id)); call.resolve(out);
        } catch (Exception error) {
            Log.e(TAG, "enqueue failed", error); call.reject("ENQUEUE_FAILED");
        }
    }

    /** Retry by app-owned ID; never return stored URL across the JS bridge. */
    @PluginMethod public void retry(PluginCall call) {
        try {
            migrateIfNeeded();
            String id = call.getString("id", "");
            if (!id.matches("[0-9]+")) { call.reject("INVALID_DOWNLOAD_ID"); return; }
            String sealed, filename;
            try (Cursor row = db.getReadableDatabase().rawQuery(
                "SELECT url_sealed,filename FROM downloads WHERE id=? AND source='system'",
                new String[]{id})) {
                if (!row.moveToFirst()) { call.reject("DOWNLOAD_NOT_FOUND"); return; }
                sealed = row.getString(0); filename = row.getString(1);
            }
            if (sealed == null || sealed.isEmpty()) { call.reject("RETRY_URL_UNAVAILABLE"); return; }
            long previousId = Long.parseLong(id);
            try (Cursor status = manager().query(new DownloadManager.Query().setFilterById(previousId))) {
                if (status != null && status.moveToFirst() &&
                    status.getInt(status.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
                        != DownloadManager.STATUS_FAILED) {
                    call.reject("DOWNLOAD_NOT_RETRYABLE"); return;
                }
            }
            String url = new UrlVault().open(sealed);
            if (!validHttps(url)) { call.reject("RETRY_URL_INVALID"); return; }
            boolean wifiOnly = Boolean.TRUE.equals(call.getBoolean("wifiOnly", false));
            long nextId = enqueueTracked(url, safeName(filename), wifiOnly);
            JSObject out = new JSObject(); out.put("id", Long.toString(nextId)); call.resolve(out);
        } catch (Exception error) {
            // Never log decrypted URLs or exception payloads from keystore/network.
            Log.e(TAG, "native retry failed");
            call.reject("RETRY_FAILED");
        }
    }

    private static String statusName(int status) {
        if (status == DownloadManager.STATUS_PENDING) return "pending";
        if (status == DownloadManager.STATUS_RUNNING) return "running";
        if (status == DownloadManager.STATUS_PAUSED) return "paused";
        if (status == DownloadManager.STATUS_SUCCESSFUL) return "success";
        if (status == DownloadManager.STATUS_FAILED) return "failed";
        return "failed";
    }

    private boolean completed(long id) {
        DownloadManager.Query query = new DownloadManager.Query().setFilterById(id);
        try (Cursor cursor = manager().query(query)) {
            return cursor != null && cursor.moveToFirst() &&
                cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS)) == DownloadManager.STATUS_SUCCESSFUL;
        }
    }

    @PluginMethod public void list(PluginCall call) {
        try {
            migrateIfNeeded();
            JSArray all = new JSArray();
            try (Cursor records = db.getReadableDatabase().rawQuery(
                "SELECT id, filename, created_at, favorite, source FROM downloads ORDER BY created_at DESC", null)) {
                while (records.moveToNext()) {
                    String id = records.getString(0);
                    JSObject row = new JSObject();
                    row.put("id", id); row.put("url", ""); // Never send persisted URLs to React.
                    row.put("filename", records.getString(1));
                    row.put("createdAt", records.getLong(2));
                    row.put("favorite", records.getInt(3) == 1);
                    row.put("bytesDownloaded", 0L); row.put("totalBytes", -1L);
                    row.put("status", "failed"); row.put("reason", "NOT_FOUND");
                    if ("m4".equals(records.getString(4))) {
                        try {
                            File file = completedM4File(id);
                            if (file.isFile()) {
                                row.put("status", "success"); row.put("reason", "");
                                row.put("bytesDownloaded", file.length()); row.put("totalBytes", file.length());
                            } else row.put("reason", "M4_FILE_MISSING");
                        } catch (Exception failure) {row.put("reason", "M4_FILE_UNAVAILABLE");}
                        all.put(row);
                        continue;
                    }
                    try (Cursor status = manager().query(new DownloadManager.Query().setFilterById(Long.parseLong(id)))) {
                        if (status != null && status.moveToFirst()) {
                            row.put("status", statusName(status.getInt(status.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))));
                            row.put("bytesDownloaded", status.getLong(status.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)));
                            row.put("totalBytes", status.getLong(status.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)));
                            row.put("reason", Integer.toString(status.getInt(status.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON))));
                        }
                    } catch (Exception ignored) { row.put("reason", "QUERY_FAILED"); }
                    all.put(row);
                }
            }
            JSObject response = new JSObject(); response.put("downloads", all); call.resolve(response);
        } catch (Exception error) { Log.e(TAG, "list failed", error); call.reject("LIBRARY_LIST_FAILED"); }
    }

    private long verifiedId(String id) {
        long value = id.startsWith("m4:") ? -1L : Long.parseLong(id);
        try (Cursor cursor = db.getReadableDatabase().rawQuery("SELECT id FROM downloads WHERE id=?", new String[]{id})) {
            if (!cursor.moveToFirst()) throw new IllegalArgumentException("UNKNOWN_DOWNLOAD");
        }
        return value;
    }

    @PluginMethod public void favorite(PluginCall call) {
        try {
            migrateIfNeeded(); String id = call.getString("id", ""); verifiedId(id);
            android.content.ContentValues values = new android.content.ContentValues();
            values.put("favorite", Boolean.TRUE.equals(call.getBoolean("favorite", false)) ? 1 : 0);
            db.getWritableDatabase().update("downloads", values, "id=?", new String[]{id});
            JSObject result = new JSObject(); result.put("success", true); call.resolve(result);
        } catch (Exception error) { call.reject("FAVORITE_FAILED"); }
    }

    @PluginMethod public void open(PluginCall call) {
        try {
            migrateIfNeeded(); String id = call.getString("id", ""); long numericId = verifiedId(id);
            Uri uri;
            if (id.startsWith("m4:")) {
                File file = completedM4File(id);
                if (!file.isFile()) {call.reject("DOWNLOAD_NOT_COMPLETE");return;}
                uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName()+".pawchive.files", file);
            } else {
                if (!completed(numericId)) { call.reject("DOWNLOAD_NOT_COMPLETE"); return; }
                uri = manager().getUriForDownloadedFile(numericId);
            }
            if (uri == null) { call.reject("DOWNLOAD_URI_UNAVAILABLE"); return; }
            String name;
            try (Cursor c = db.getReadableDatabase().rawQuery("SELECT filename FROM downloads WHERE id=?", new String[]{id})) {
                if (!c.moveToFirst()) { call.reject("NOT_FOUND"); return; }
                name = c.getString(0);
            }
            String extension = MimeTypeMap.getFileExtensionFromUrl(name);
            String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension.toLowerCase(Locale.ROOT));
            if (mime == null) mime = "application/octet-stream";
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, mime);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(Intent.createChooser(intent, "파일 열기"));
            JSObject result = new JSObject(); result.put("success", true); call.resolve(result);
        } catch (ActivityNotFoundException error) { call.reject("NO_COMPATIBLE_APP"); }
        catch (Exception error) { Log.e(TAG, "open failed", error); call.reject("OPEN_FAILED"); }
    }

    @PluginMethod public void thumbnail(PluginCall call) {
        try {
            migrateIfNeeded(); String id = call.getString("id", ""); long numericId = verifiedId(id);
            File m4File = id.startsWith("m4:") ? completedM4File(id) : null;
            if (m4File == null && !completed(numericId)) { call.reject("DOWNLOAD_NOT_COMPLETE"); return; }
            if (m4File != null && !m4File.isFile()) { call.reject("DOWNLOAD_NOT_COMPLETE"); return; }
            BitmapFactory.Options probe = new BitmapFactory.Options(); probe.inJustDecodeBounds = true;
            if (m4File != null) {
                try (FileInputStream file = new FileInputStream(m4File)) {
                    BitmapFactory.decodeFileDescriptor(file.getFD(), null, probe);
                }
            } else try (ParcelFileDescriptor fd = manager().openDownloadedFile(numericId)) {
                BitmapFactory.decodeFileDescriptor(fd.getFileDescriptor(), null, probe);
            }
            if (probe.outWidth <= 0 || probe.outHeight <= 0) { call.reject("NOT_AN_IMAGE"); return; }
            BitmapFactory.Options opts = new BitmapFactory.Options();
            int factor = 1;
            while (probe.outWidth / factor > 360 || probe.outHeight / factor > 360) factor *= 2;
            opts.inSampleSize = factor;
            Bitmap decoded;
            if (m4File != null) {
                try (FileInputStream file = new FileInputStream(m4File)) {
                    decoded = BitmapFactory.decodeFileDescriptor(file.getFD(), null, opts);
                }
            } else try (ParcelFileDescriptor fd = manager().openDownloadedFile(numericId)) {
                decoded = BitmapFactory.decodeFileDescriptor(fd.getFileDescriptor(), null, opts);
            }
            if (decoded == null) { call.reject("IMAGE_DECODE_FAILED"); return; }
            Bitmap scaled = Bitmap.createScaledBitmap(decoded,
                Math.max(1, Math.round(decoded.getWidth() * Math.min(1f, 256f / Math.max(decoded.getWidth(), decoded.getHeight())))),
                Math.max(1, Math.round(decoded.getHeight() * Math.min(1f, 256f / Math.max(decoded.getWidth(), decoded.getHeight())))), true);
            if (scaled != decoded) decoded.recycle();
            ByteArrayOutputStream stream = new ByteArrayOutputStream();
            scaled.compress(Bitmap.CompressFormat.JPEG, 65, stream); scaled.recycle();
            JSObject result = new JSObject();
            result.put("dataUrl", "data:image/jpeg;base64," + Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP));
            call.resolve(result);
        } catch (OutOfMemoryError error) { call.reject("IMAGE_TOO_LARGE"); }
        catch (Exception error) { call.reject("THUMBNAIL_UNAVAILABLE"); }
    }

    @PluginMethod public void cancel(PluginCall call) {
        try {
            migrateIfNeeded(); String id = call.getString("id", ""); long numericId = verifiedId(id);
            // Preserve record as failed/unavailable for history. Deleting is a separate action.
            if (id.startsWith("m4:")) {call.reject("ALREADY_COMPLETED_IN_LIBRARY");return;}
            manager().remove(numericId);
            JSObject out = new JSObject(); out.put("success", true); call.resolve(out);
        } catch (Exception error) { call.reject("CANCEL_FAILED"); }
    }

    @PluginMethod public void delete(PluginCall call) {
        try {
            migrateIfNeeded(); String id = call.getString("id", ""); long numericId = verifiedId(id);
            if (id.startsWith("m4:")) {
                File file = completedM4File(id);
                if (file.isFile() && !file.delete()) {call.reject("FILE_DELETE_FAILED");return;}
            } else manager().remove(numericId); // OS-managed file deletion
            db.getWritableDatabase().delete("downloads", "id=?", new String[]{id});
            JSObject out = new JSObject(); out.put("success", true); call.resolve(out);
        } catch (Exception error) { call.reject("DELETE_FAILED"); }
    }
}
