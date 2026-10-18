package com.pawchive.mobile;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.URI;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Small, independently testable foreground-session HTTP transfer engine.
 * Never handles login cookies, bypasses access controls, or automatically executes downloads.
 * Android lifecycle/background reliability is explicitly NOT provided by this class.
 */
public final class TransferCore {
    private TransferCore() {}
    public static final class Paused extends IOException { public Paused() { super("USER_PAUSED"); } }
    public static final class Result {
        public final long bytes;
        public final long total;
        public final String etag;
        public Result(long bytes, long total, String etag) { this.bytes=bytes; this.total=total; this.etag=etag; }
    }
    public interface Observer {
        void onHeaders(String etag, long total);
        void onProgress(long bytes, long total);
    }
    static boolean globallyRoutable(InetAddress ip) {
        if(ip.isAnyLocalAddress() || ip.isLoopbackAddress() || ip.isSiteLocalAddress() ||
           ip.isLinkLocalAddress() || ip.isMulticastAddress()) return false;
        byte[] raw=ip.getAddress();
        if(raw.length==4){
            int a=raw[0]&255, b=raw[1]&255;
            // Additional reserved/test/carrier-grade address blocks excluded from common Java helpers.
            if(a==0||a>=224||(a==100&&b>=64&&b<=127)||(a==192&&b==0)||(a==192&&b==88)||(a==192&&b==2)||(a==198&&b>=18&&b<=19)||
                (a==198&&b==51)||(a==203&&b==0)) return false;
        }
        return true;
    }
    public static URL verifiedUrl(String raw) throws IOException {
        try {
            URI uri = new URI(raw);
            String host = uri.getHost();
            if (!"https".equalsIgnoreCase(uri.getScheme()) || host == null || uri.getUserInfo()!=null ||
                uri.getPort()!=-1 || host.contains(":") || host.indexOf('.')<1 ||
                host.toLowerCase(Locale.ROOT).endsWith(".local") || host.toLowerCase(Locale.ROOT).endsWith(".localhost"))
                throw new IOException("INVALID_PUBLIC_HTTPS_URL");
            // Reject IP literals (including IPv6); the target must be a DNS hostname.
            if (host.matches("[0-9.]+")) throw new IOException("IP_LITERAL_NOT_ALLOWED");
            for (InetAddress address : InetAddress.getAllByName(host)) {
                if (!globallyRoutable(address)) throw new IOException("PRIVATE_HOST_BLOCKED");
            }
            return uri.toURL();
        } catch (IllegalArgumentException | java.net.URISyntaxException error) {
            throw new IOException("INVALID_PUBLIC_HTTPS_URL", error);
        }
    }
    interface ConnectionPolicy {
        void verify(URL url) throws IOException;
        HttpURLConnection open(URL url) throws IOException;
    }
    private static final ConnectionPolicy PUBLIC_HTTPS = new ConnectionPolicy() {
        @Override public void verify(URL url) throws IOException { verifiedUrl(url.toString()); }
        @Override public HttpURLConnection open(URL url) throws IOException {
            return (HttpURLConnection) url.openConnection();
        }
    };
    private static HttpURLConnection connect(URL initial, long offset, String etag, ConnectionPolicy policy) throws IOException {
        URL next=initial;
        for(int redirects=0; redirects<5; redirects++) {
            policy.verify(next);
            HttpURLConnection c=policy.open(next);
            c.setInstanceFollowRedirects(false);
            c.setConnectTimeout(12000); c.setReadTimeout(25000);
            c.setRequestProperty("User-Agent","PawchiveMobile/0.4");
            c.setRequestProperty("Accept-Encoding","identity");
            if(offset>0) { c.setRequestProperty("Range","bytes="+offset+"-"); if(etag!=null&&!etag.isEmpty()) c.setRequestProperty("If-Range",etag); }
            int code=c.getResponseCode();
            if(code==301||code==302||code==303||code==307||code==308) {
                String location=c.getHeaderField("Location");
                if(location==null) {c.disconnect(); throw new IOException("REDIRECT_MISSING_LOCATION");}
                URL redirected=new URL(next,location); c.disconnect();
                policy.verify(redirected); next=redirected; continue;
            }
            return c;
        }
        throw new IOException("TOO_MANY_REDIRECTS");
    }
    static long contentRangeStart(String header) {
        if(header==null) return -1;
        java.util.regex.Matcher m=java.util.regex.Pattern.compile("^bytes (\\d+)-(\\d+)/(\\d+|\\*)$").matcher(header.trim());
        return m.matches()?Long.parseLong(m.group(1)):-1;
    }
    static long contentRangeTotal(String header) {
        if(header==null)return -1;
        java.util.regex.Matcher m=java.util.regex.Pattern.compile("^bytes (\\d+)-(\\d+)/(\\d+|\\*)$").matcher(header.trim());
        if(!m.matches()||"*".equals(m.group(3)))return -1;
        return Long.parseLong(m.group(3));
    }
    /** Caller owns the persistent .part file and etag checkpoint. */
    public static Result download(String rawUrl, File part, File finished, String priorEtag,
                                  int limitKiBPerSec, AtomicBoolean pause, Observer observer) throws IOException {
        return download(rawUrl, part, finished, priorEtag, limitKiBPerSec, pause, observer, "");
    }
    public static Result download(String rawUrl, File part, File finished, String priorEtag,
                                  int limitKiBPerSec, AtomicBoolean pause, Observer observer, String expectedSha256) throws IOException {
        return downloadImpl(rawUrl, part, finished, priorEtag, limitKiBPerSec, pause, observer,
            expectedSha256, PUBLIC_HTTPS);
    }
    /** Package-private test seam, not exposed by the Capacitor bridge. */
    static Result downloadForQa(String rawUrl, File part, File finished, String etag,
                                int speed, AtomicBoolean pause, Observer observer,
                                String digest, ConnectionPolicy qaPolicy) throws IOException {
        if (qaPolicy == null) throw new IOException("MISSING_TEST_TRANSPORT");
        return downloadImpl(rawUrl, part, finished, etag, speed, pause, observer, digest, qaPolicy);
    }
    private static Result downloadImpl(String rawUrl, File part, File finished, String priorEtag,
                                       int limitKiBPerSec, AtomicBoolean pause, Observer observer,
                                       String expectedSha256, ConnectionPolicy policy) throws IOException {
        if (expectedSha256 != null && !expectedSha256.isEmpty() && !DigestVerifier.validSha256(expectedSha256))
            throw new IOException("INVALID_SHA256");
        if(limitKiBPerSec<0 || limitKiBPerSec>102400) throw new IOException("INVALID_BANDWIDTH_LIMIT");
        if(pause.get())throw new Paused();
        URL url = PUBLIC_HTTPS == policy ? verifiedUrl(rawUrl) : new URL(rawUrl);
        policy.verify(url);
        File parent=part.getParentFile();
        if(parent==null || (!parent.exists()&&!parent.mkdirs()))throw new IOException("STORAGE_UNAVAILABLE");
        long offset=part.isFile()?part.length():0;
        // Never append to a partial file without a server-issued representation validator.
        if(offset>0 && (priorEtag==null || priorEtag.isEmpty())) offset=0;
        HttpURLConnection conn=connect(url,offset,priorEtag,policy);
        int status=conn.getResponseCode();
        try {
            if(status!=200 && status!=206)throw new IOException("HTTP_"+status);
            if(status==206 && contentRangeStart(conn.getHeaderField("Content-Range"))!=offset)
                throw new IOException("INVALID_CONTENT_RANGE");
            // 200 for a range request means the resource changed or the server does not support Range.
            // Restart safely instead of appending invalid bytes.
            boolean append=offset>0 && status==206;
            if(!append)offset=0;
            String strongETag=conn.getHeaderField("ETag");
            if(strongETag!=null && strongETag.startsWith("W/")) strongETag=null;
            String currentEtag=strongETag!=null?strongETag:conn.getHeaderField("Last-Modified");
            // Do not append if the server omits the validator or returns a different one.
            if(append && (currentEtag==null || !currentEtag.equals(priorEtag)))
                throw new IOException("VALIDATOR_CHANGED");
            long total=status==206?contentRangeTotal(conn.getHeaderField("Content-Range")):
                conn.getContentLengthLong();
            if(total>=0 && total<offset)throw new IOException("SIZE_MISMATCH");
            observer.onHeaders(currentEtag,total);
            long transferred=offset;
            long startNanos=System.nanoTime();
            long currentRunBytes=0;
            try(InputStream input=conn.getInputStream(); FileOutputStream out=new FileOutputStream(part,append)) {
                byte[] buffer=new byte[32768]; int count;
                while((count=input.read(buffer))!=-1) {
                    if(pause.get())throw new Paused();
                    out.write(buffer,0,count); transferred+=count; currentRunBytes+=count;
                    observer.onProgress(transferred,total);
                    if(limitKiBPerSec>0) {
                        long perSecond=limitKiBPerSec*1024L;
                        long targetNanos=(currentRunBytes/perSecond)*1_000_000_000L+
                            ((currentRunBytes%perSecond)*1_000_000_000L)/perSecond;
                        long wait=targetNanos-(System.nanoTime()-startNanos);
                        while(wait>0) {
                            if(pause.get())throw new Paused();
                            try { Thread.sleep(Math.min(100,wait/1_000_000L+1)); }
                            catch(InterruptedException e) { Thread.currentThread().interrupt(); throw new Paused(); }
                            wait=targetNanos-(System.nanoTime()-startNanos);
                        }
                    }
                }
                out.getFD().sync();
            }
            if(total>=0&&transferred!=total)throw new IOException("TRUNCATED_DOWNLOAD");
            if(pause.get())throw new Paused();
            // Fail closed: no gallery publication or final rename on a mismatched trusted digest.
            DigestVerifier.verify(part, expectedSha256);
            if(pause.get())throw new Paused();
            try { Files.move(part.toPath(),finished.toPath(),StandardCopyOption.ATOMIC_MOVE); }
            catch(java.nio.file.AtomicMoveNotSupportedException error) { Files.move(part.toPath(),finished.toPath()); }
            return new Result(transferred,total,currentEtag);
        } finally {conn.disconnect();}
    }
}
