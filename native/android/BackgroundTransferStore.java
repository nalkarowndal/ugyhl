package com.pawchive.mobile;

import android.content.Context;
import android.app.job.JobScheduler;
import android.os.Build;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.security.SecureRandom;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/** M7 UIDT registry; the only persistent copy of a transfer URL is Keystore-encrypted. */
final class BackgroundTransferStore {
    static final class Entry {
        String id, url, sealedUrl, filename, state = "queued", etag = "", error = "", sha256 = "";
        int jobId, speedKiB, failures;
        boolean wifiOnly;
        long bytes, total = -1, created = System.currentTimeMillis();
        JSONObject stored() throws Exception {
            JSONObject j = new JSONObject();
            j.put("id", id); j.put("urlSealed", sealedUrl); j.put("filename", filename);
            j.put("jobId", jobId); j.put("state", state); j.put("etag", etag);
            j.put("error", error); j.put("sha256", sha256); j.put("speedKiB", speedKiB);
            j.put("wifiOnly", wifiOnly); j.put("bytes", bytes); j.put("total", total);
            j.put("failures", failures); j.put("created", created);
            return j;
        }
        JSONObject publicView() throws Exception {
            JSONObject j = stored(); j.remove("urlSealed"); return j;
        }
    }
    private static BackgroundTransferStore instance;
    private final Map<String, Entry> entries = new LinkedHashMap<>();
    private final SecureRandom random = new SecureRandom();
    private final File registry;
    private final UrlVault vault;

    static synchronized BackgroundTransferStore get(Context context) throws Exception {
        if (instance == null) instance = new BackgroundTransferStore(context.getApplicationContext());
        return instance;
    }
    private BackgroundTransferStore(Context context) throws Exception {
        registry = new File(context.getNoBackupFilesDir(), "pawchive-m7-jobs.json");
        vault = new UrlVault();
        if (!registry.isFile()) return;
        JSONArray rows = new JSONArray(new String(Files.readAllBytes(registry.toPath()), StandardCharsets.UTF_8));
        for (int i = 0; i < rows.length(); i++) {
            JSONObject item = rows.optJSONObject(i); if (item == null) continue;
            Entry e = new Entry();
            e.id = item.optString("id", "");
            e.sealedUrl = item.optString("urlSealed", "");
            if (!e.id.matches("[0-9a-fA-F-]{36}") || !e.sealedUrl.startsWith("v1:"))
                throw new SecurityException("INVALID_SAVED_JOB");
            e.url = vault.open(e.sealedUrl);
            TransferCore.verifiedUrl(e.url);
            e.filename = item.optString("filename", "download.bin");
            e.jobId = item.optInt("jobId", -1);
            if (e.jobId < 11000 || e.jobId > 2100000000) throw new SecurityException("INVALID_JOB_ID");
            e.state = item.optString("state", "paused");
            e.etag = item.optString("etag", ""); e.error = item.optString("error", "");
            e.sha256 = item.optString("sha256", "");
            if (!e.sha256.isEmpty() && !DigestVerifier.validSha256(e.sha256)) throw new SecurityException("INVALID_SHA");
            e.speedKiB = item.optInt("speedKiB", 0); e.wifiOnly = item.optBoolean("wifiOnly", false);
            e.bytes = item.optLong("bytes", 0); e.total = item.optLong("total", -1);
            e.failures = item.optInt("failures", 0); e.created = item.optLong("created", System.currentTimeMillis());
            entries.put(e.id, e);
        }
    }
    private synchronized void save() throws Exception {
        JSONArray array = new JSONArray();
        for (Entry entry : entries.values()) array.put(entry.stored());
        File tmp = new File(registry.getPath() + ".tmp");
        try (FileOutputStream output = new FileOutputStream(tmp)) {
            output.write(array.toString().getBytes(StandardCharsets.UTF_8)); output.getFD().sync();
        }
        try { Files.move(tmp.toPath(), registry.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING); }
        catch (java.nio.file.AtomicMoveNotSupportedException ignored) {
            Files.move(tmp.toPath(), registry.toPath(), StandardCopyOption.REPLACE_EXISTING);
        }
    }
    synchronized Entry create(String url, String filename, String sha256, int speedKiB, boolean wifiOnly) throws Exception {
        Entry e = new Entry(); e.id = UUID.randomUUID().toString();
        e.url = url; e.sealedUrl = vault.seal(url);
        e.filename = filename; e.sha256 = sha256; e.speedKiB = speedKiB; e.wifiOnly = wifiOnly;
        do { e.jobId = 11000 + random.nextInt(1900000000); }
        while (jobIdTaken(e.jobId));
        entries.put(e.id, e);
        try { save(); } catch (Exception err) { entries.remove(e.id); throw err; }
        return e;
    }
    private boolean jobIdTaken(int candidate) {
        for (Entry row : entries.values()) if (row.jobId == candidate) return true;
        return false;
    }
    synchronized Entry find(String id) { return entries.get(id); }
    synchronized Entry byJobId(int jobId) {
        for (Entry e : entries.values()) if (e.jobId == jobId) return e;
        return null;
    }
    synchronized void update(Entry e) throws Exception { if (entries.containsKey(e.id)) save(); }
    synchronized JSONArray list(Context context) throws Exception {
        JSONArray array = new JSONArray();
        JobScheduler scheduler = (JobScheduler) context.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        for (Entry e : entries.values()) {
            // JobService may be absent after a task-manager force-stop; never present stale "running" as active.
            if (("running".equals(e.state) || "queued".equals(e.state)) && Build.VERSION.SDK_INT >= 34
                && scheduler != null && scheduler.getPendingJob(e.jobId) == null) {
                e.state = "paused"; e.error = "RESELECT_TO_RESUME"; save();
            }
            JSONObject item = e.publicView();
            if (("running".equals(e.state) || "queued".equals(e.state)) &&
                Build.VERSION.SDK_INT >= 34 && scheduler != null) {
                try {
                    int reason = scheduler.getPendingJobReason(e.jobId);
                    String status = "WAIT_SYSTEM";
                    if (reason == JobScheduler.PENDING_JOB_REASON_EXECUTING) status = "EXECUTING";
                    else if (reason == JobScheduler.PENDING_JOB_REASON_CONSTRAINT_CONNECTIVITY) status = "WAIT_NETWORK";
                    else if (reason == JobScheduler.PENDING_JOB_REASON_DEVICE_STATE) status = "WAIT_DEVICE";
                    else if (reason == JobScheduler.PENDING_JOB_REASON_QUOTA) status = "WAIT_QUOTA";
                    else if (reason == JobScheduler.PENDING_JOB_REASON_INVALID_JOB_ID) status = "MISSING_JOB";
                    item.put("schedulerState", status);
                } catch (RuntimeException ignored) { item.put("schedulerState", "UNKNOWN"); }
            }
            array.put(item);
        }
        return array;
    }
    synchronized void remove(Entry e) throws Exception { entries.remove(e.id); save(); }
}
