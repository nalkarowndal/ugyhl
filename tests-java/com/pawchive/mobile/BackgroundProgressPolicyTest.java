package com.pawchive.mobile;

public final class BackgroundProgressPolicyTest {
    private static void check(boolean ok) { if (!ok) throw new AssertionError(); }
    public static void main(String[] args) {
        check(BackgroundProgressPolicy.percent(0, 0) == -1);
        check(BackgroundProgressPolicy.percent(5, -1) == -1);
        check(BackgroundProgressPolicy.percent(0, 100) == 0);
        check(BackgroundProgressPolicy.percent(25, 100) == 25);
        check(BackgroundProgressPolicy.percent(100, 100) == 100);
        check(BackgroundProgressPolicy.percent(Long.MAX_VALUE-1, Long.MAX_VALUE) == 99);
        check(BackgroundProgressPolicy.shouldUpdate(10_000, 0, 0, -1));
        check(!BackgroundProgressPolicy.shouldUpdate(11_000, 10_000, 10, 100));
        check(BackgroundProgressPolicy.shouldUpdate(12_000, 10_000, 20, 100));
        check(BackgroundProgressPolicy.shouldUpdate(10_000, 11_000, 0, 100));
        check(BackgroundProgressPolicy.shouldUpdate(11_000, 10_000, 100, 100));
        System.out.println("BackgroundProgressPolicyTest OK");
    }
}
