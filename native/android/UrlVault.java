package com.pawchive.mobile;

import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.SecureRandom;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Encrypts resume URLs with an app-bound, non-exportable Android Keystore AES key.
 * The ciphertext alone is stored in app-private no-backup JSON. Keystore loss
 * intentionally renders a resume URL unusable rather than silently downgrading. */
public final class UrlVault {
    private static final String ALIAS = "pawchive_m5_transfer_urls";
    private static final String TRANSFORM = "AES/GCM/NoPadding";
    private static final String PREFIX = "v1:";
    private final SecretKey key;

    /** Do not silently generate a replacement key while decrypting old resume URLs. */
    public static final class MissingKeyException extends java.security.GeneralSecurityException {
        public MissingKeyException() { super("URL_KEY_NOT_AVAILABLE"); }
    }

    public UrlVault() throws Exception { this(true); }

    public UrlVault(boolean createIfMissing) throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        SecretKey existing = (SecretKey) store.getKey(ALIAS, null);
        if (existing != null) { key = existing; return; }
        if (!createIfMissing) throw new MissingKeyException();
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256).build());
        key = generator.generateKey();
    }
    public String seal(String value) throws Exception {
        Cipher cipher = Cipher.getInstance(TRANSFORM);
        cipher.init(Cipher.ENCRYPT_MODE, key);
        byte[] iv = cipher.getIV();
        byte[] encrypted = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
        byte[] combined = new byte[1 + iv.length + encrypted.length];
        combined[0] = (byte) iv.length;
        System.arraycopy(iv, 0, combined, 1, iv.length);
        System.arraycopy(encrypted, 0, combined, 1 + iv.length, encrypted.length);
        return PREFIX + Base64.encodeToString(combined, Base64.NO_WRAP);
    }
    public String open(String ciphertext) throws Exception {
        if (ciphertext == null || !ciphertext.startsWith(PREFIX)) throw new SecurityException("INVALID_URL_CIPHERTEXT");
        byte[] combined;
        try { combined = Base64.decode(ciphertext.substring(PREFIX.length()), Base64.NO_WRAP); }
        catch (IllegalArgumentException bad) { throw new SecurityException("INVALID_URL_CIPHERTEXT"); }
        if (combined.length < 30 || combined[0] != 12) throw new SecurityException("INVALID_URL_CIPHERTEXT");
        byte[] iv = new byte[12]; System.arraycopy(combined, 1, iv, 0, 12);
        Cipher cipher = Cipher.getInstance(TRANSFORM);
        cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, iv));
        return new String(cipher.doFinal(combined, 13, combined.length - 13), StandardCharsets.UTF_8);
    }
}
