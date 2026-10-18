package com.pawchive.mobile;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Locale;

/** Streaming SHA-256 verification of completed .part files before publishing them. */
public final class DigestVerifier {
    private DigestVerifier() { }

    public static boolean validSha256(String expected) {
        return expected != null && expected.matches("[a-fA-F0-9]{64}");
    }

    public static void verify(File partial, String expected) throws IOException {
        if (expected == null || expected.isEmpty()) return;
        if (!validSha256(expected)) throw new IOException("INVALID_SHA256");
        final MessageDigest digest;
        try { digest = MessageDigest.getInstance("SHA-256"); }
        catch (NoSuchAlgorithmException error) { throw new IOException("SHA256_UNAVAILABLE", error); }
        try (FileInputStream input = new FileInputStream(partial)) {
            byte[] buffer = new byte[64 * 1024];
            int size;
            while ((size = input.read(buffer)) != -1) digest.update(buffer, 0, size);
        }
        byte[] actual = digest.digest();
        byte[] wanted = new byte[32];
        for (int i = 0; i < wanted.length; i++) {
            wanted[i] = (byte) Integer.parseInt(expected.substring(i * 2, i * 2 + 2), 16);
        }
        if (!MessageDigest.isEqual(actual, wanted)) throw new IOException("SHA256_MISMATCH");
    }
}
