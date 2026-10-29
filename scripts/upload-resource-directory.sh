#!/usr/bin/env bash
set -euo pipefail
directory="${1:?asset directory required}"
source /opt/5k-resource-center/landing-project.env
for file in "$directory"/*; do
  [[ -f "$file" ]] || continue
  name="$(basename "$file")"
  case "$name" in *.png) mime=image/png;; *.jpg|*.jpeg) mime=image/jpeg;; *) mime=image/webp;; esac
  id="$(curl -fsS -X POST http://127.0.0.1:4330/v1/assets/upload -H "X-API-Key: $RESOURCE_CENTER_API_KEY" -F "file=@$file;type=$mime" | jq -r '.data.id')"
  printf '%s\t%s\n' "$name" "$id"
done
