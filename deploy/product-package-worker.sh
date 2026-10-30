#!/usr/bin/env bash
set -euo pipefail
exec 9>/var/lock/5k-product-package-worker.lock
flock -n 9 || exit 0
export JAVA_HOME=/opt/5k-product-builder/jdk
export ANDROID_HOME=/opt/5k-product-builder/android-sdk
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:/opt/5k-product-builder/gradle/bin:$PATH"
manifest_dir=/root/5kvideo-release/server/data/product-package-manifests
project=/opt/5k-product-builder/project/android
icon_dir=/opt/5k-product-builder/icons
drawable_dir="$project/app/src/main/res/drawable"
mkdir -p "$manifest_dir" /root/5kvideo-release/server/data/product-packages "$icon_dir"
shopt -s nullglob
target_slug="${1:-}"
template_version="fullscreen-video-v2"
for manifest in "$manifest_dir"/*.json; do
  while IFS=$'\t' read -r version slug name_b64 package domain channel artifact; do
    if [[ -n "$target_slug" && "$slug" != "$target_slug" ]]; then continue; fi
    name="$(printf '%s' "$name_b64" | base64 -d)"
    if [[ "$artifact" == /app/data/* ]]; then
      artifact="/root/5kvideo-release/server/data/${artifact#/app/data/}"
    fi
    marker="${artifact}.version"
    build_version="$version:$template_version"
    if [[ -s "$artifact" && -f "$marker" && "$(cat "$marker")" == "$build_version" ]]; then continue; fi
    mkdir -p "$(dirname "$artifact")"
    if [[ -s "$icon_dir/$slug.png" ]]; then
      rm -f "$drawable_dir/app_icon.xml" "$drawable_dir/app_icon.webp"
      install -m 0644 "$icon_dir/$slug.png" "$drawable_dir/app_icon.png"
    elif [[ -s "$icon_dir/$slug.webp" ]]; then
      rm -f "$drawable_dir/app_icon.xml" "$drawable_dir/app_icon.png"
      install -m 0644 "$icon_dir/$slug.webp" "$drawable_dir/app_icon.webp"
    else
      rm -f "$drawable_dir/app_icon.png" "$drawable_dir/app_icon.webp"
      install -m 0644 "$drawable_dir/app_icon_default.xml" "$drawable_dir/app_icon.xml"
    fi
    /opt/5k-product-builder/gradle/bin/gradle -p "$project" :app:assembleRelease --no-daemon \
      "-PchannelCode=$channel" "-PproductSlug=$slug" "-PproductName=$name" \
      "-PproductPackage=$package" "-PproductDomain=$domain" \
      "-PapiBase=https://897kg.cc/vdo/api/v1"
    install -m 0644 "$project/app/build/outputs/apk/release/app-release.apk" "$artifact"
    printf '%s' "$build_version" > "$marker"
  done < <(python3 - "$manifest" <<'PY'
import base64,json,sys
d=json.load(open(sys.argv[1],encoding='utf-8')); c=d['config']
name=base64.b64encode(c['name'].encode()).decode()
for ch in d['channels']:
 print('\t'.join(map(str,[d['version'],d['slug'],name,c['packageName'],c['domain'],ch['code'],ch['artifact']])))
PY
  )
done
