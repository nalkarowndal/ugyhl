package com.pawchive.mobile;

import android.app.job.JobInfo;
import android.app.job.JobScheduler;
import android.content.ComponentName;
import android.os.Build;
import android.content.Context;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** User-confirmed Android 14+ downloads. Other Android versions retain DownloadManager fallback in the UI. */
@CapacitorPlugin(name="PawchiveBackground")
public final class PawchiveBackgroundPlugin extends Plugin {
    private JobScheduler scheduler() {
        return (JobScheduler) getContext().getSystemService(Context.JOB_SCHEDULER_SERVICE);
    }
    private static String safeName(String input) {
        String name = input == null ? "" : input.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_").replaceAll("^\\.+", "").trim();
        if (name.isEmpty()) name = "download.bin";
        return name.substring(0, Math.min(name.length(), 100));
    }
    @PluginMethod public void capabilities(PluginCall call) {
        JSObject response = new JSObject();
        response.put("uidt", Build.VERSION.SDK_INT >= 34);
        response.put("platformSdk", Build.VERSION.SDK_INT);
        call.resolve(response);
    }
    /** This method MUST be invoked directly from a visible, user-initiated UI action. */
    private boolean schedule(BackgroundTransferStore.Entry e) {
        if (Build.VERSION.SDK_INT < 34) return false;
        JobInfo.Builder builder = new JobInfo.Builder(e.jobId, new ComponentName(getContext(), BackgroundTransferJobService.class))
            .setUserInitiated(true)
            .setRequiredNetworkType(e.wifiOnly ? JobInfo.NETWORK_TYPE_UNMETERED : JobInfo.NETWORK_TYPE_ANY)
            .setBackoffCriteria(10000L, JobInfo.BACKOFF_POLICY_EXPONENTIAL);
        android.os.PersistableBundle params = new android.os.PersistableBundle();
        params.putString("transferId", e.id); // no credentials or signed URL in OS JobScheduler extras
        builder.setExtras(params);
        try { return scheduler().schedule(builder.build()) == JobScheduler.RESULT_SUCCESS; }
        catch (Exception error) { return false; }
    }
    @PluginMethod public void start(PluginCall call) {
        if (Build.VERSION.SDK_INT < 34) { call.reject("REQUIRES_ANDROID_14_USE_STANDARD_DOWNLOAD"); return; }
        String url = call.getString("url", "");
        String sha = call.getString("sha256", "").trim();
        int speed = call.getInt("speedKiB", 0);
        if (speed < 0 || speed > 102400 || (!sha.isEmpty() && !DigestVerifier.validSha256(sha))) {
            call.reject("INVALID_TRANSFER_PARAMETERS"); return;
        }
        try {
            TransferCore.verifiedUrl(url);
            BackgroundTransferStore store = BackgroundTransferStore.get(getContext());
            BackgroundTransferStore.Entry e = store.create(url, safeName(call.getString("filename", "download.bin")), sha,
                speed, Boolean.TRUE.equals(call.getBoolean("wifiOnly", false)));
            if (!schedule(e)) { e.state="paused"; e.error="OS_JOB_REJECTED"; store.update(e); call.reject("OS_JOB_REJECTED"); return; }
            JSObject response = new JSObject(); response.put("id", e.id); response.put("jobId", e.jobId); call.resolve(response);
        } catch (Exception error) { call.reject("BACKGROUND_START_FAILED"); }
    }
    @PluginMethod public void list(PluginCall call) {
        try { JSObject out = new JSObject(); out.put("transfers", BackgroundTransferStore.get(getContext()).list(getContext())); call.resolve(out); }
        catch (Exception error) { call.reject("ENCRYPTED_REGISTRY_UNAVAILABLE"); }
    }
    @PluginMethod public void pause(PluginCall call) { change(call, false); }
    @PluginMethod public void resume(PluginCall call) { change(call, true); }
    private void change(PluginCall call, boolean resume) {
        try {
            BackgroundTransferStore store = BackgroundTransferStore.get(getContext());
            BackgroundTransferStore.Entry e = store.find(call.getString("id", ""));
            if (e == null) { call.reject("UNKNOWN_TRANSFER"); return; }
            if ("success".equals(e.state)) { call.reject("ALREADY_COMPLETED"); return; }
            if (resume) {
                if (!("paused".equals(e.state) || "failed".equals(e.state))) { call.reject("NOT_PAUSED"); return; }
                e.state="queued"; e.error=""; e.failures=0; store.update(e);
                if (!schedule(e)) { e.state="paused"; e.error="OS_JOB_REJECTED"; store.update(e); call.reject("OS_JOB_REJECTED"); return; }
            } else {
                e.state="paused"; e.error="USER_PAUSED"; store.update(e);
                scheduler().cancel(e.jobId);
            }
            call.resolve();
        } catch(Exception error) { call.reject("TRANSFER_CONTROL_FAILED"); }
    }
}
