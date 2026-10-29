#!/usr/bin/env bash
set -euo pipefail
base=/opt/5k-product-builder
mkdir -p "$base" "$base/project" "$base/android-sdk/cmdline-tools"
if [[ ! -x "$base/jdk/bin/java" ]] || ! "$base/jdk/bin/java" -version 2>&1 | grep -q '17.0.10'; then
  wget -q -O /tmp/jdk17.tar.gz 'https://api.adoptium.net/v3/binary/version/jdk-17.0.10%2B7/linux/x64/jdk/hotspot/normal/eclipse'
  rm -rf "$base/jdk" "$base/jdk.tmp"
  mkdir -p "$base/jdk.tmp"
  tar -xzf /tmp/jdk17.tar.gz -C "$base/jdk.tmp" --strip-components=1
  mv "$base/jdk.tmp" "$base/jdk"
  rm -f /tmp/jdk17.tar.gz
fi
if [[ ! -x "$base/gradle/bin/gradle" ]]; then
  wget -q -O /tmp/gradle.zip 'https://services.gradle.org/distributions/gradle-8.9-bin.zip'
  unzip -q /tmp/gradle.zip -d "$base"
  mv "$base/gradle-8.9" "$base/gradle"
  rm -f /tmp/gradle.zip
fi
if [[ ! -x "$base/android-sdk/cmdline-tools/latest/bin/sdkmanager" ]]; then
  wget -q -O /tmp/android-cli.zip 'https://dl.google.com/android/repository/commandlinetools-linux-15859902_latest.zip'
  echo '4e4c464f145a7512b57d088ac6c278c03c9eea610886b35a5e0804e74eedf583  /tmp/android-cli.zip' | sha256sum -c -
  rm -rf "$base/android-sdk/cmdline-tools/latest" /tmp/android-cli
  mkdir -p /tmp/android-cli
  unzip -q /tmp/android-cli.zip -d /tmp/android-cli
  mv /tmp/android-cli/cmdline-tools "$base/android-sdk/cmdline-tools/latest"
  rm -rf /tmp/android-cli /tmp/android-cli.zip
fi
export JAVA_HOME="$base/jdk" ANDROID_HOME="$base/android-sdk"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$base/gradle/bin:$PATH"
(cd "$ANDROID_HOME/cmdline-tools/latest" && yes | bin/sdkmanager --licenses >/dev/null) || true
(cd "$ANDROID_HOME/cmdline-tools/latest" && bin/sdkmanager 'platform-tools' 'platforms;android-35' 'build-tools;35.0.0')
rm -rf "$base/project/android"
tar -xzf /tmp/android-template.tgz -C "$base/project"
cp "$base/project/android/app/src/main/res/drawable/app_icon.xml" "$base/project/android/app/src/main/res/drawable/app_icon_default.xml"
install -m 0755 /tmp/product-package-worker.sh /usr/local/sbin/5k-product-package-worker
cat >/etc/cron.d/5k-product-package-worker <<'EOF'
* * * * * root /usr/local/sbin/5k-product-package-worker >>/var/log/5k-product-package-worker.log 2>&1
EOF
chmod 0644 /etc/cron.d/5k-product-package-worker
rm -f /tmp/android-template.tgz /tmp/product-package-worker.sh
echo PRODUCT_PACKAGE_BUILDER_READY
