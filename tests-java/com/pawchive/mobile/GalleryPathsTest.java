package com.pawchive.mobile;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;

public final class GalleryPathsTest {
    private static final String ID = "m4:11111111-2222-3333-4444-555555555555";
    private static void check(boolean okay, String description){ if(!okay) throw new AssertionError(description); }
    private static void rejected(File root,String id,File file) throws Exception {
        try { GalleryPaths.verified(root,id,file);throw new AssertionError("Accepted untrusted file: "+file); }
        catch (IOException expected) {}
    }
    public static void main(String[] args) throws Exception {
        File base = Files.createTempDirectory("m5-gallery").toFile();
        File owned = new File(base,"Pawchive-M4");check(owned.mkdirs(),"make directory");
        File file = new File(owned,"11111111-2222-3333-4444-555555555555_cat.png");
        check(file.createNewFile(),"create test image");
        check(GalleryPaths.verified(owned,ID,file).equals(file.getCanonicalFile()),"accept owned target");
        rejected(owned,"m4:wrong-id",file);
        rejected(owned,ID,new File(base,"11111111-2222-3333-4444-555555555555_cat.png"));
        rejected(owned,ID,new File(owned,"../Pawchive-M4/sneaky.txt"));
        rejected(owned,ID,new File(owned,"not-an-uuid_cat.png"));
        rejected(owned,ID,new File(owned,"11111111-2222-3333-4444-555555555555_cat.png.part"));
        // Symlink must never escape app-owned directory, even if the visible path is inside it.
        File elsewhere = new File(base,"outside.png");check(elsewhere.createNewFile(),"create outside");
        File link = new File(owned,"11111111-2222-3333-4444-555555555555_link.png");
        try {Files.createSymbolicLink(link.toPath(),elsewhere.toPath());rejected(owned,ID,link);} catch(UnsupportedOperationException | java.nio.file.FileSystemException unsupported){}
        System.out.println("PASS: GalleryPaths owned UUID file, invalid IDs, traversal and symlink escape");
    }
}
