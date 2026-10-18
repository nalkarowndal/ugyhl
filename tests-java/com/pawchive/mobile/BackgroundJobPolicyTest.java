package com.pawchive.mobile;
public class BackgroundJobPolicyTest {
    static void check(boolean value) { if(!value) throw new AssertionError("M7 UIDT policy"); }
    public static void main(String[] args) {
        check(BackgroundJobPolicy.shouldRetry("HTTP_500", 1));
        check(BackgroundJobPolicy.shouldRetry("HTTP_429", 2));
        check(!BackgroundJobPolicy.shouldRetry("HTTP_403", 1));
        check(!BackgroundJobPolicy.shouldRetry("SHA256_MISMATCH", 1));
        check(!BackgroundJobPolicy.shouldRetry("HTTP_500", 3));
        check(BackgroundJobPolicy.shouldResetPartial("VALIDATOR_CHANGED"));
        check(!BackgroundJobPolicy.shouldResetPartial("TRUNCATED_DOWNLOAD"));
        System.out.println("PASS: M7 background retry policy (7 assertions)");
    }
}
