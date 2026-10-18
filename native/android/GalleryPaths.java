package com.pawchive.mobile;

import java.io.File;
import java.io.IOException;
import java.util.regex.Pattern;

/** Restrict M4 library operations to immutable UUID-prefixed files in our own downloads directory. */
public final class GalleryPaths {
    private static final Pattern UUID = Pattern.compile("[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}");
    private GalleryPaths() {}
    public static File verified(File root, String id, File candidate) throws IOException {
        if (id == null || !id.startsWith("m4:") || !UUID.matcher(id.substring(3)).matches())
            throw new IOException("INVALID_M4_ID");
        if (root == null || candidate == null) throw new IOException("INVALID_M4_FILE");
        File safeRoot = root.getCanonicalFile();
        File safeFile = candidate.getCanonicalFile();
        if (!safeFile.getParentFile().equals(safeRoot) ||
            !safeFile.getName().startsWith(id.substring(3) + "_") ||
            safeFile.getName().endsWith(".part")) throw new IOException("OUTSIDE_OWNED_DOWNLOADS");
        return safeFile;
    }
}
