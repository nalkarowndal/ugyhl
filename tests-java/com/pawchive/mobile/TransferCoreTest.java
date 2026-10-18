package com.pawchive.mobile;
import java.io.File;
import java.io.IOException;
import java.net.InetAddress;
import java.util.concurrent.atomic.AtomicBoolean;

public final class TransferCoreTest {
  static void check(boolean okay, String message) { if(!okay)throw new AssertionError(message); }
  static void invalid(String url) { try{TransferCore.verifiedUrl(url);throw new AssertionError("URL should have been rejected: "+url);} catch(IOException expected){} }
  public static void main(String[] args) throws Exception {
    check(TransferCore.contentRangeStart("bytes 1024-2047/4096")==1024,"parse start");
    check(TransferCore.contentRangeTotal("bytes 1024-2047/4096")==4096,"parse total");
    check(TransferCore.contentRangeStart("bytes bad-2047/4096")==-1,"bad range");
    check(TransferCore.contentRangeTotal("bytes 0-5/*")==-1,"unknown total");
    for(String address : new String[]{"http://example.com/f", "https://127.0.0.1/f", "https://localhost/f", "https://example.com:443/file", "https://u:p@example.com/f", "https://192.168.1.2/f", "https://[::1]/x", "https://service.local/file"}) invalid(address);
    check(!TransferCore.globallyRoutable(InetAddress.getByName("127.0.0.1")),"loopback should fail");
    check(!TransferCore.globallyRoutable(InetAddress.getByName("10.1.1.1")),"private IPv4 should fail");
    check(!TransferCore.globallyRoutable(InetAddress.getByName("169.254.42.42")),"link local should fail");
    try {TransferCore.download("https://example.com/file",new File("/tmp/x.part"),new File("/tmp/x"),"",0,new AtomicBoolean(true),new TransferCore.Observer(){public void onHeaders(String e,long t){}public void onProgress(long b,long t){}}); throw new AssertionError("Expected pause"); }
    catch(TransferCore.Paused expected) {}
    System.out.println("PASS: TransferCore content range, private URL rejection, address checks, pause short circuit");
  }
}
