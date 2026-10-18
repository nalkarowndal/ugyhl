package com.pawchive.mobile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.charset.StandardCharsets;
import java.io.IOException;

public final class DigestVerifierTest {
    private static void check(boolean okay, String what) { if (!okay) throw new AssertionError(what); }
    public static void main(String[] args) throws Exception {
        Path file = Files.createTempFile("pawchive-checksum-", ".part");
        try {
            Files.write(file, "abc".getBytes(StandardCharsets.UTF_8));
            final String sha = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
            DigestVerifier.verify(file.toFile(), sha);
            DigestVerifier.verify(file.toFile(), sha.toUpperCase(java.util.Locale.ROOT));
            DigestVerifier.verify(file.toFile(), "");
            check(!DigestVerifier.validSha256("invalid"), "hash format validation");
            try { DigestVerifier.verify(file.toFile(), "0".repeat(64)); throw new AssertionError("accepted wrong checksum"); }
            catch (IOException error) { check("SHA256_MISMATCH".equals(error.getMessage()), "wrong checksum reason"); }
            try { DigestVerifier.verify(file.toFile(), "00"); throw new AssertionError("accepted invalid checksum"); }
            catch (IOException error) { check("INVALID_SHA256".equals(error.getMessage()), "bad format reason"); }
            check(Files.exists(file), "verification must never erase the source file");
            System.out.println("PASS: SHA-256 trusted digest verification and wrong digest rejection");
        } finally { Files.deleteIfExists(file); }
    }
}
