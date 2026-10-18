package com.pawchive.mobile;

/** Pure-Java throttling and overflow-safe progress percentage for Android 14+ UIDT notifications. */
public final class BackgroundProgressPolicy {
    private BackgroundProgressPolicy() {}
    public static final long MIN_INTERVAL_MS = 2000L;
    public static int percent(long bytes, long total) {
        if (total <= 0) return -1;
        if (bytes <= 0) return 0;
        if (bytes >= total) return 100;
        return (int)Math.min(99d, (bytes / (double)total) * 100d);
    }
    public static boolean shouldUpdate(long now, long previous, long bytes, long total) {
        if (previous == 0L || now < previous) return true;
        if (bytes >= total && total > 0L) return true;
        return now - previous >= MIN_INTERVAL_MS;
    }
}
