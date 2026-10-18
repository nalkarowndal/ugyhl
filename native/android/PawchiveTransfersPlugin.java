package com.pawchive.mobile;

import android.content.Context;
import android.os.Environment;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/** Experimental app-foreground transfer runner. Does NOT guarantee transfer while app is closed. */
@CapacitorPlugin(name="PawchiveTransfers")
public final class PawchiveTransfersPlugin extends Plugin {
    private static final String TAG="PawchiveTransfers";
    private final Map<String, Entry> entries=new LinkedHashMap<>();
    private ExecutorService workers;
    private File base;
    private File registry;
    private UrlVault vault;
    private boolean vaultReady = false;

    static class Entry {
        String id,url,name,state="paused",etag="",error="",sha256="";
        long bytes=0,total=-1,created=System.currentTimeMillis();
        int speedKiB=0;
        transient AtomicBoolean pause=new AtomicBoolean(false);
        String sealedUrl="";
        JSONObject serialize() throws Exception {
            JSONObject v=new JSONObject();
            v.put("id",id);v.put("urlSealed",sealedUrl);v.put("name",name);v.put("state",state);
            v.put("etag",etag);v.put("sha256",sha256);v.put("error",error);v.put("bytes",bytes);
            v.put("total",total);v.put("created",created);v.put("speedKiB",speedKiB);
            return v;
        }
        static Entry parse(JSONObject v, UrlVault vault) throws Exception { Entry e=new Entry();
            e.id=v.optString("id");
            e.sealedUrl=v.optString("urlSealed", "");
            if (!e.sealedUrl.isEmpty()) e.url=vault.open(e.sealedUrl);
            else { // M4 plaintext registry migration (one-way, encrypted at next persist)
                e.url=v.optString("url", "");
                e.sealedUrl=vault.seal(e.url);
            }
            e.name=v.optString("name");
            e.state=v.optString("state","paused");e.etag=v.optString("etag","");
            e.sha256=v.optString("sha256", "");
            if(!e.sha256.isEmpty() && !DigestVerifier.validSha256(e.sha256)) throw new SecurityException("INVALID_SAVED_SHA256");
            e.error=v.optString("error","");e.bytes=v.optLong("bytes");
            e.total=v.optLong("total",-1);e.created=v.optLong("created");
            e.speedKiB=v.optInt("speedKiB");return e;
        }
        JSONObject publicView() throws Exception {
            JSONObject v=serialize();v.remove("urlSealed");return v;
        }
    }
    @Override public synchronized void load(){
        workers=Executors.newFixedThreadPool(2);
        base=getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if(base==null)base=getContext().getFilesDir();
        base=new File(base,"Pawchive-M4");base.mkdirs();
        registry=new File(getContext().getNoBackupFilesDir(),"pawchive-transfers-m4.json");
        try{
            vault=new UrlVault();
            if(registry.isFile()){
                JSONArray arr=new JSONArray(new String(Files.readAllBytes(registry.toPath()),StandardCharsets.UTF_8));
                for(int i=0;i<arr.length();i++){
                    JSONObject item=arr.optJSONObject(i);if(item==null)continue;
                    Entry entry=Entry.parse(item, vault);
                    if(!entry.id.matches("[a-zA-Z0-9-]{30,40}"))continue;
                    if("running".equals(entry.state)||"queued".equals(entry.state)||"pausing".equals(entry.state))entry.state="paused";
                    entries.put(entry.id,entry);
                }
            }
            vaultReady = true;
        }catch(Exception error){
            vaultReady=false;
            Log.e(TAG,"Encrypted registry unavailable; existing data preserved (without exposing URL)");
        }
        if(vaultReady) {
            persist();
            // Recover a file moved to final destination just before a prior process stopped.
            for(Entry entry: entries.values()) {
                if (!"success".equals(entry.state)) continue;
                File target = new File(base, entry.id + "_" + entry.name);
                if (!target.isFile()) continue;
                try { PawchiveDownloadsPlugin.registerCompletedM4(getContext(), entry.id, entry.name, target); }
                catch(Exception ignored) { Log.w(TAG, "Deferred gallery index recovery failed"); }
            }
        }
    }
    private synchronized boolean persist(){
        if (!vaultReady) return false;
        try{
            JSONArray arr=new JSONArray();for(Entry e:entries.values())arr.put(e.serialize());
            File temp=new File(registry.getPath()+".tmp");
            try(FileOutputStream out=new FileOutputStream(temp)){
                out.write(arr.toString().getBytes(StandardCharsets.UTF_8));out.getFD().sync();
            }
            try{Files.move(temp.toPath(),registry.toPath(),StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);}
            catch(java.nio.file.AtomicMoveNotSupportedException error){Files.move(temp.toPath(),registry.toPath(),StandardCopyOption.REPLACE_EXISTING);}
            return true;
        }catch(Exception error){Log.e(TAG,"Registry persist failed (state may not survive process death)");return false;}
    }
    private static String safeName(String input){
        String name=(input==null?"":input).replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]","_").replaceAll("^\\.+","").trim();
        return name.isEmpty()?"download.bin":name.substring(0,Math.min(110,name.length()));
    }
    @PluginMethod public void start(PluginCall call){
        if (!vaultReady) {call.reject("SECURE_STORAGE_UNAVAILABLE");return;}
        String url=call.getString("url","");
        int limit=call.getInt("speedKiB",0);
        String trustedSha=call.getString("sha256", "").trim();
        if(!trustedSha.isEmpty() && !DigestVerifier.validSha256(trustedSha)){call.reject("INVALID_SHA256");return;}
        if(limit<0||limit>102400){call.reject("INVALID_SPEED_LIMIT");return;}
        try{TransferCore.verifiedUrl(url);}catch(Exception error){call.reject("INVALID_HTTPS_URL");return;}
        Entry e=new Entry();e.id=UUID.randomUUID().toString();e.url=url;
        e.name=safeName(call.getString("filename","download.bin"));e.speedKiB=limit;e.sha256=trustedSha;
        try { e.sealedUrl = vault.seal(url); }
        catch (Exception failed) {call.reject("SECURE_STORAGE_UNAVAILABLE");return;}
        synchronized(this){
            entries.put(e.id,e);
            if (!queue(e)) {entries.remove(e.id);call.reject("REGISTRY_WRITE_FAILED");return;}
        }
        JSObject out=new JSObject();out.put("id",e.id);call.resolve(out);
    }
    private boolean queue(Entry e){
        e.pause.set(false);e.state="queued";e.error="";
        if (!persist()) return false;
        workers.submit(()->run(e));
        return true;
    }
    private void run(Entry e){
        synchronized(this){ if(e.pause.get()){e.state="paused";persist();return;}e.state="running";persist(); }
        File part=new File(base,e.id+".part");File target=new File(base,e.id+"_"+e.name);
        int retries=0;
        while(true){
            try{
                TransferCore.download(e.url,part,target,e.etag,e.speedKiB,e.pause,new TransferCore.Observer(){
                    long lastSaved=0;
                    public void onHeaders(String etag,long total){synchronized(PawchiveTransfersPlugin.this){
                        e.etag=etag==null?"":etag;e.total=total;persist();}}
                    public void onProgress(long bytes,long total){e.bytes=bytes;e.total=total;
                        if(System.currentTimeMillis()-lastSaved>1000){synchronized(PawchiveTransfersPlugin.this){persist();}
                            lastSaved=System.currentTimeMillis();}}
                },e.sha256);
                synchronized(this){e.bytes=target.length();e.total=e.bytes;e.state="success";persist();}
                try {PawchiveDownloadsPlugin.registerCompletedM4(getContext(), e.id, e.name, target);}
                catch (Exception galleryError) {
                    synchronized(this){ e.error="GALLERY_INDEX_FAILED"; persist(); }
                    Log.e(TAG, "Completed transfer gallery registration failed");
                }
                return;
            }catch(TransferCore.Paused stop){synchronized(this){e.bytes=part.length();e.state="paused";persist();}return;}
            catch(Exception error){
                if(e.pause.get()){synchronized(this){e.bytes=part.length();e.state="paused";persist();}return;}
                retries++;
                // Changed ETags / malformed partial ranges should never be auto-appended.
                if("VALIDATOR_CHANGED".equals(error.getMessage())||"INVALID_CONTENT_RANGE".equals(error.getMessage())||"SHA256_MISMATCH".equals(error.getMessage())){
                    part.delete();e.etag="";
                }
                if(retries>2 || "SHA256_MISMATCH".equals(error.getMessage()) || error.getMessage()!=null && error.getMessage().startsWith("HTTP_4")){
                    synchronized(this){e.bytes=part.length();e.state="failed";
                        String message = error.getMessage()==null ? "TRANSFER_ERROR":error.getMessage();
                        e.error=message.matches("(?:HTTP_[0-9]{3}|TRUNCATED_DOWNLOAD|SIZE_MISMATCH|INVALID_CONTENT_RANGE|VALIDATOR_CHANGED|PRIVATE_HOST_BLOCKED|TOO_MANY_REDIRECTS)")?message:"TRANSFER_ERROR";
                        persist();}
                    return;
                }
                try{Thread.sleep(retries*1000L);}catch(InterruptedException interrupted){Thread.currentThread().interrupt();synchronized(this){e.state="paused";persist();}return;}
            }
        }
    }
    @PluginMethod public synchronized void list(PluginCall call){
        if (!vaultReady) {call.reject("SECURE_STORAGE_UNAVAILABLE");return;}
        JSArray array=new JSArray();
        for(Entry e:entries.values()){
            try{JSObject item=new JSObject(e.publicView().toString());array.put(item);}catch(Exception ignored){}
        }
        JSObject out=new JSObject();out.put("transfers",array);call.resolve(out);
    }
    @PluginMethod public synchronized void pause(PluginCall call){
        Entry e=entries.get(call.getString("id",""));if(e==null){call.reject("UNKNOWN_TRANSFER");return;}
        if("running".equals(e.state)||"queued".equals(e.state)){e.pause.set(true);e.state="pausing";persist();}
        call.resolve();
    }
    @PluginMethod public synchronized void resume(PluginCall call){
        if (!vaultReady) {call.reject("SECURE_STORAGE_UNAVAILABLE");return;}
        Entry e=entries.get(call.getString("id",""));if(e==null){call.reject("UNKNOWN_TRANSFER");return;}
        if("paused".equals(e.state)||"failed".equals(e.state)){
            if (!queue(e)) {call.reject("REGISTRY_WRITE_FAILED");return;}
        }
        call.resolve();
    }
    @PluginMethod public synchronized void setSpeed(PluginCall call){
        if (!vaultReady) {call.reject("SECURE_STORAGE_UNAVAILABLE");return;}
        Entry e=entries.get(call.getString("id",""));if(e==null){call.reject("UNKNOWN_TRANSFER");return;}
        int limit=call.getInt("speedKiB",0);
        String trustedSha=call.getString("sha256", "").trim();
        if(!trustedSha.isEmpty() && !DigestVerifier.validSha256(trustedSha)){call.reject("INVALID_SHA256");return;}if(limit<0||limit>102400){call.reject("INVALID_SPEED_LIMIT");return;}
        if("running".equals(e.state)){call.reject("PAUSE_BEFORE_CHANGING_LIMIT");return;}
        e.speedKiB=limit;persist();call.resolve();
    }
}
