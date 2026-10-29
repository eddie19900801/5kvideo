#!/usr/bin/env bash
set -euo pipefail

source /opt/5k-resource-center/landing-project.env
base='http://127.0.0.1:4330'

if (($#)); then
  files=("$@")
else
  files=( \
  /tmp/*.source.webp \
  /tmp/logo-CrIsLMsa.webp \
  /tmp/icon_business-BHUzkcle.webp \
  /tmp/icon_service-DufelMQm.webp \
  /tmp/tutorial-D5j3oy1T.webp \
  /tmp/hm_entry-ChS2Hzkw.webp \
  /tmp/btn_bg-BuGWjhXz.webp \
  /tmp/t_fast-B6_1beRe.webp \
  /tmp/t_backup-C47IVzkZ.webp \
  /tmp/t_ioslite-h7CsHXvu.webp \
  /tmp/t_h5-OM1KNorK.webp \
  /tmp/t_ios-BIlp4Yge.webp )
fi

for file in "${files[@]}"
do
  response="$(curl -fsS -X POST "$base/v1/assets/upload" \
    -H "X-API-Key: $RESOURCE_CENTER_API_KEY" \
    -F "file=@${file};type=image/webp")"
  printf '%s\t%s\n' "$(basename "$file")" "$(jq -r '.data.id' <<<"$response")"
done
