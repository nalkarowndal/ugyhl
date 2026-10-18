#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
javac -d "$work" native/android/TransferCore.java native/android/DigestVerifier.java native/android/BackgroundJobPolicy.java native/android/GalleryPaths.java tests-java/com/pawchive/mobile/TransferCoreTest.java tests-java/com/pawchive/mobile/GalleryPathsTest.java tests-java/com/pawchive/mobile/DigestVerifierTest.java tests-java/com/pawchive/mobile/BackgroundJobPolicyTest.java
java -cp "$work" com.pawchive.mobile.TransferCoreTest
java -cp "$work" com.pawchive.mobile.GalleryPathsTest
java -cp "$work" com.pawchive.mobile.DigestVerifierTest

java -cp "$work" com.pawchive.mobile.BackgroundJobPolicyTest
