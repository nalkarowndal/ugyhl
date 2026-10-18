package com.pawchive.mobile;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.job.JobParameters;
import android.app.job.JobService;
import android.os.Build;
import android.os.Environment;
import android.util.Log;

import java.io.File;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

/** Android 14+ UIDT JobService. Not a guarantee against force-stop or device policy restrictions. */
public final class BackgroundTransferJobService extends JobService {
    private static final String CHANNEL = "pawchive_m7_background";
    private static final String TAG = "PawchiveUIDT";
    private final ConcurrentHashMap<Integer, AtomicBoolean> stopFlags = new ConcurrentHashMap<>();

    private Notification notice(String filename, long bytes, long total) {
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        manager.createNotificationChannel(new NotificationChannel(CHANNEL, "Pawchive downloads", NotificationManager.IMPORTANCE_LOW));
        Notification.Builder builder = new Notification.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setContentTitle("Pawchive 다운로드")
            .setContentText(filename)
            .setOngoing(true)
            .setOnlyAlertOnce(true);
        if (total > 0 && total <= Integer.MAX_VALUE) {
            builder.setProgress(100, (int)Math.min(100, bytes * 100 / total), false);
        } else builder.setProgress(100, 0, true);
        return builder.build();
    }
    @Override public boolean onStartJob(JobParameters params) {
        if (Build.VERSION.SDK_INT < 34) return false;
        String transferId = params.getExtras().getString("transferId", "");
        final BackgroundTransferStore.Entry entry;
        final BackgroundTransferStore store;
        try {
            store = BackgroundTransferStore.get(this);
            entry = store.find(transferId);
            if (entry == null || entry.jobId != params.getJobId() ||
                "paused".equals(entry.state) || "success".equals(entry.state) || "failed".equals(entry.state)) return false;
            entry.state = "running"; entry.error=""; store.update(entry);
            setNotification(params, entry.jobId, notice(entry.filename, entry.bytes, entry.total),
                JobService.JOB_END_NOTIFICATION_POLICY_REMOVE);
        } catch(Exception error) { Log.e(TAG, "Cannot load protected transfer record", error); return false; }
        AtomicBoolean stopped = new AtomicBoolean(false);
        stopFlags.put(entry.jobId, stopped);
        Thread worker = new Thread(() -> runTransfer(params, store, entry, stopped), "Pawchive-UIDT-" + entry.jobId);
        worker.start();
        return true;
    }
    private void runTransfer(JobParameters params, BackgroundTransferStore store,
                             BackgroundTransferStore.Entry entry, AtomicBoolean stopped) {
        File root = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (root == null) root = getFilesDir();
        File base = new File(root, "Pawchive-M4");
        if (!base.exists()) base.mkdirs();
        File part = new File(base, entry.id + ".part");
        File target = new File(base, entry.id + "_" + entry.filename);
        boolean retry = false;
        try {
            if (stopped.get()) throw new TransferCore.Paused();
            if (target.isFile() && !part.isFile()) {
                DigestVerifier.verify(target, entry.sha256);
                finishFile(store, entry, target);
            } else {
                TransferCore.download(entry.url, part, target, entry.etag, entry.speedKiB, stopped,
                    new TransferCore.Observer() {
                        long lastSaved;
                        @Override public void onHeaders(String etag, long total) {
                            if (stopped.get()) return;
                            try { entry.etag = etag == null ? "" : etag; entry.total = total; store.update(entry); }
                            catch(Exception error) { throw new IllegalStateException("CHECKPOINT_WRITE_FAILED", error); }
                        }
                        @Override public void onProgress(long bytes, long total) {
                            if (stopped.get()) return;
                            entry.bytes = bytes; entry.total = total;
                            if (System.currentTimeMillis() - lastSaved > 1500) {
                                try { store.update(entry); lastSaved = System.currentTimeMillis(); }
                                catch(Exception error) { throw new IllegalStateException("CHECKPOINT_WRITE_FAILED", error); }
                            }
                        }
                    }, entry.sha256);
                if (stopped.get()) throw new TransferCore.Paused();
                finishFile(store, entry, target);
            }
        } catch (TransferCore.Paused stoppedBySystem) {
            if (!stopped.get()) {
                try { entry.state = "paused"; entry.error = "USER_PAUSED"; store.update(entry); }
                catch (Exception ignored) { Log.w(TAG, "Pause checkpoint failed"); }
            }
        } catch (Exception error) {
            String code = error.getMessage() == null ? "TRANSFER_ERROR" : error.getMessage();
            if (BackgroundJobPolicy.shouldResetPartial(code)) { part.delete(); entry.etag = ""; }
            if (!stopped.get()) {
                entry.failures++;
                retry = BackgroundJobPolicy.shouldRetry(code, entry.failures);
                entry.state = retry ? "queued" : "failed";
                entry.error = code.matches("(HTTP_[0-9]{3}|SHA256_MISMATCH|TRUNCATED_DOWNLOAD|VALIDATOR_CHANGED|INVALID_CONTENT_RANGE|SIZE_MISMATCH)") ? code : "TRANSFER_ERROR";
                try { store.update(entry); } catch (Exception ignored) { retry = false; }
            }
        } finally {
            stopFlags.remove(entry.jobId, stopped);
            if (!stopped.get()) jobFinished(params, retry);
        }
    }
    private void finishFile(BackgroundTransferStore store, BackgroundTransferStore.Entry entry, File target) throws Exception {
        if (!target.isFile()) throw new java.io.IOException("MISSING_COMPLETED_FILE");
        PawchiveDownloadsPlugin.registerCompletedM4(this, entry.id, entry.filename, target);
        entry.bytes = target.length(); entry.total = entry.bytes;
        entry.state = "success"; entry.error = ""; store.update(entry);
    }
    @Override public boolean onStopJob(JobParameters params) {
        AtomicBoolean flag = stopFlags.get(params.getJobId()); if (flag != null) flag.set(true);
        try {
            BackgroundTransferStore store = BackgroundTransferStore.get(this);
            BackgroundTransferStore.Entry entry = store.byJobId(params.getJobId());
            if (entry == null || "paused".equals(entry.state) || "success".equals(entry.state) || "failed".equals(entry.state)) return false;
            entry.state = "queued";
            entry.error = "SYSTEM_STOPPED";
            store.update(entry);
            return true; // Android can retry from checkpoint if it interrupted the job.
        } catch(Exception error) { Log.e(TAG, "Stop checkpoint unavailable", error); return false; }
    }
}
