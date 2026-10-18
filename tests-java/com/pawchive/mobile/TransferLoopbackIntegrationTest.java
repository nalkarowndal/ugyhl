package com.pawchive.mobile;
import com.sun.net.httpserver.*;
import java.io.*;
import java.net.*;
import java.nio.file.*;
import java.security.*;
import java.util.*;
import java.util.concurrent.atomic.*;
/** Deterministic, credential-free actual HTTP fixture; no public site contacts. */
public final class TransferLoopbackIntegrationTest {
  static final byte[] BODY = new byte[65536];
  static final String ETAG = "\"fixture-v1\"";
  static int rangeHits=0, failures=0;
  static void check(boolean ok, String label) {if(!ok) throw new AssertionError(label);}
  static final TransferCore.ConnectionPolicy QA = new TransferCore.ConnectionPolicy(){
    public void verify(URL u) throws IOException {
      if(!u.getProtocol().equals("http") || !u.getHost().equals("127.0.0.1"))throw new IOException("QA_LOOPBACK_ONLY");
    }
    public HttpURLConnection open(URL u)throws IOException { verify(u); return (HttpURLConnection)u.openConnection(); }
  };
  static TransferCore.Observer silent(){return new TransferCore.Observer(){public void onHeaders(String e,long t){} public void onProgress(long b,long t){}};}
  static String hash()throws Exception{byte[] d=MessageDigest.getInstance("SHA-256").digest(BODY);StringBuilder s=new StringBuilder();for(byte b:d)s.append(String.format("%02x",b&255));return s.toString();}
  static void reply(HttpExchange x,int code,int from,String etag)throws IOException {
    x.getResponseHeaders().set("ETag",etag);
    if(code==206)x.getResponseHeaders().set("Content-Range","bytes "+from+"-"+(BODY.length-1)+"/"+BODY.length);
    x.sendResponseHeaders(code,BODY.length-from);
    try(OutputStream o=x.getResponseBody()){o.write(BODY,from,BODY.length-from);}
  }
  static void handle(HttpExchange x)throws IOException{
    String path=x.getRequestURI().getPath();
    if(path.equals("/redirect")){x.getResponseHeaders().set("Location","/ok");x.sendResponseHeaders(302,-1);x.close();return;}
    if(path.equals("/offhost")){x.getResponseHeaders().set("Location","http://example.com/file");x.sendResponseHeaders(302,-1);x.close();return;}
    if(path.equals("/flaky") && failures++==0){x.sendResponseHeaders(503,-1);x.close();return;}
    String r=x.getRequestHeaders().getFirst("Range");
    if(r!=null&&!path.equals("/ignore")) {
      int start=Integer.parseInt(r.replace("bytes=","").replace("-",""));
      rangeHits++;
      reply(x,206,start,path.equals("/changed")?"\"fixture-v2\"":ETAG);return;
    }
    reply(x,200,0,ETAG);
  }
  static TransferCore.Result take(String root,Path dir,String name,String etag,AtomicBoolean stop,TransferCore.Observer obs,String sha)throws Exception{
    return TransferCore.downloadForQa(root,dir.resolve(name+".part").toFile(),dir.resolve(name+".bin").toFile(),
      etag,0,stop,obs,sha,QA);
  }
  public static void main(String[] argv)throws Exception {
    for(int i=0;i<BODY.length;i++)BODY[i]=(byte)(17+i*37);
    HttpServer server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
    server.createContext("/",TransferLoopbackIntegrationTest::handle);server.start();
    Path dir=Files.createTempDirectory("pawchive-m9-");
    String base="http://127.0.0.1:"+server.getAddress().getPort(),sha=hash();
    try{
      take(base+"/ok",dir,"full","",new AtomicBoolean(),silent(),sha);
      check(Arrays.equals(BODY,Files.readAllBytes(dir.resolve("full.bin"))),"full transfer");
      AtomicBoolean stop=new AtomicBoolean();String[] validator={""};
      try{take(base+"/ok",dir,"pause","",stop,new TransferCore.Observer(){
        public void onHeaders(String e,long t){validator[0]=e;}
        public void onProgress(long b,long t){if(b>20000)stop.set(true);}
      },sha);throw new AssertionError("should pause");}catch(TransferCore.Paused expected){}
      check(Files.isRegularFile(dir.resolve("pause.part"))&&!Files.exists(dir.resolve("pause.bin")),"checkpoint");
      take(base+"/ok",dir,"pause",validator[0],new AtomicBoolean(),silent(),sha);
      check(rangeHits>0 && Arrays.equals(BODY,Files.readAllBytes(dir.resolve("pause.bin"))),"range resume");
      Files.write(dir.resolve("ignore.part"),Arrays.copyOf(BODY,15000));
      take(base+"/ignore",dir,"ignore",ETAG,new AtomicBoolean(),silent(),sha);
      check(Arrays.equals(BODY,Files.readAllBytes(dir.resolve("ignore.bin"))),"ignore range restarts");
      Files.write(dir.resolve("changed.part"),Arrays.copyOf(BODY,10000));
      try{take(base+"/changed",dir,"changed",ETAG,new AtomicBoolean(),silent(),sha);throw new AssertionError("changed validator");}
      catch(IOException e){check("VALIDATOR_CHANGED".equals(e.getMessage()),"validator");}
      check(!Files.exists(dir.resolve("changed.bin")),"changed not published");
      try{take(base+"/ok",dir,"badsha","",new AtomicBoolean(),silent(),"0".repeat(64));throw new AssertionError("hash");}
      catch(IOException e){check("SHA256_MISMATCH".equals(e.getMessage()),"digest fail closed");}
      check(!Files.exists(dir.resolve("badsha.bin")),"checksum not published");
      try{take(base+"/flaky",dir,"flaky","",new AtomicBoolean(),silent(),sha);throw new AssertionError("should get 503");}
      catch(IOException e){check("HTTP_503".equals(e.getMessage())&&BackgroundJobPolicy.shouldRetry(e.getMessage(),1),"retry decision");}
      take(base+"/flaky",dir,"flaky","",new AtomicBoolean(),silent(),sha);
      check(Arrays.equals(BODY,Files.readAllBytes(dir.resolve("flaky.bin"))),"retry good");
      take(base+"/redirect",dir,"redirect","",new AtomicBoolean(),silent(),sha);
      try{take(base+"/offhost",dir,"offhost","",new AtomicBoolean(),silent(),sha);throw new AssertionError("offhost");}
      catch(IOException e){check("QA_LOOPBACK_ONLY".equals(e.getMessage()),"offhost blocked");}
      System.out.println("PASS: controlled loopback HTTP integration (full/resume/restart/ETag/SHA-256/503/redirect)");
    } finally {server.stop(0);try(var walk=Files.walk(dir)){walk.sorted(Comparator.reverseOrder()).forEach(p->{try{Files.deleteIfExists(p);}catch(IOException ignored){}});}}
  }
}
