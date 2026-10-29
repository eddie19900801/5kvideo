#!/usr/bin/env bash
set -euo pipefail

shared_dir="/www/wwwroot/5knews-static-data"
current_dir="/www/wwwroot/5knews-web-current"
target_dir="$current_dir/static-data"
mkdir -p "$shared_dir"
# New frontend releases do not contain generated API data. Attach the shared
# directory automatically so switching the release symlink cannot cause a 404.
if [[ ! -e "$target_dir" ]]; then
  ln -s "$shared_dir" "$target_dir"
fi
temporary=$(mktemp "$target_dir/bootstrap.XXXXXX.json")
trap 'rm -f "$temporary"' EXIT
curl --fail --silent --show-error --max-time 90 \
  "https://897kg.cc/vdo/api/v1/collected-videos/bootstrap?static_sync=1" \
  --output "$temporary"
jq -e '(.data.categories | length > 0) and (.data.pools | length > 0)' "$temporary" >/dev/null
chmod 0644 "$temporary"
mv -f "$temporary" "$target_dir/bootstrap.json"
trap - EXIT
