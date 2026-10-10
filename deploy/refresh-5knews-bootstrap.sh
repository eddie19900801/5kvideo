#!/usr/bin/env bash
set -euo pipefail

target_dir="/www/wwwroot/5knews-web-current/static-data"
mkdir -p "$target_dir"
temporary=$(mktemp "$target_dir/bootstrap.XXXXXX.json")
trap 'rm -f "$temporary"' EXIT
curl --fail --silent --show-error --max-time 30 \
  "https://897kg.cc/vdo/api/v1/collected-videos/bootstrap?static_sync=1" \
  --output "$temporary"
jq -e '(.data.categories | length > 0) and (.data.pools | length > 0)' "$temporary" >/dev/null
chmod 0644 "$temporary"
mv -f "$temporary" "$target_dir/bootstrap.json"
trap - EXIT
