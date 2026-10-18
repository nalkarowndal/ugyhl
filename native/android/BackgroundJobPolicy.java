package com.pawchive.mobile;

/** Pure-Java decision logic for M7 download retry behavior; covered without Android SDK. */
public final class BackgroundJobPolicy {
    private BackgroundJobPolicy() {}
    public static boolean shouldRetry(String code, int failures) {
        if (failures >= 3 || code == null) return false;
        if (code.matches("HTTP_4[0-9]{2}") && !"HTTP_408".equals(code) && !"HTTP_429".equals(code)) return false;
        return !code.equals("SHA256_MISMATCH") && !code.equals("INVALID_SHA256") &&
               !code.equals("INVALID_PUBLIC_HTTPS_URL") && !code.equals("PRIVATE_HOST_BLOCKED") &&
               !code.equals("INVALID_CONTENT_RANGE") && !code.equals("INVALID_SAVED_JOB");
    }
    public static boolean shouldResetPartial(String code) {
        return "VALIDATOR_CHANGED".equals(code) || "INVALID_CONTENT_RANGE".equals(code) ||
               "SHA256_MISMATCH".equals(code);
    }
}
