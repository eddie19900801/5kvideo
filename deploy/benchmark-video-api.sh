#!/usr/bin/env bash
set -euo pipefail
base=http://127.0.0.1:4010
token=$(docker exec 5kvideo-api node -e 'const jwt=require("jsonwebtoken");process.stdout.write(jwt.sign({id:"admin-1",role:"admin"},process.env.JWT_SECRET,{expiresIn:"10m"}))')
auth="Authorization: Bearer $token"
product_id=$(curl -fsS -H "$auth" "$base/api/v1/admin/product-lines" | jq -r '.data[0].id')
product_slug=$(curl -fsS -H "$auth" "$base/api/v1/admin/product-lines" | jq -r '.data[0].slug')
video_id=$(curl -fsS -H "$auth" "$base/api/v1/admin/videos" | jq -r '.data[0].id')
collected_id=$(curl -fsS "$base/api/v1/collected-videos?pageSize=1" | jq -r '.data.items[0].id')
day=$(TZ=Asia/Bangkok date +%F)

bench() {
  local name=$1 path=$2 header=${3:-} count=${4:-12} tmp
  tmp=$(mktemp)
  for ((i=0;i<count;i++)); do
    if [[ -n "$header" ]]; then curl -sS -o /dev/null -H "$header" -w '%{http_code} %{time_total}\n' "$base$path"; else curl -sS -o /dev/null -w '%{http_code} %{time_total}\n' "$base$path"; fi
  done > "$tmp"
  local failures p50 p95 maximum average
  failures=$(awk '$1 < 200 || $1 >= 400 {n++} END {print n+0}' "$tmp")
  average=$(awk '{s+=$2} END {printf "%.1f",s/NR*1000}' "$tmp")
  p50=$(awk '{print $2*1000}' "$tmp" | sort -n | awk '{a[NR]=$1} END {printf "%.1f",a[int((NR+1)*.50)]}')
  p95=$(awk '{print $2*1000}' "$tmp" | sort -n | awk '{a[NR]=$1} END {i=int((NR+1)*.95);if(i>NR)i=NR;printf "%.1f",a[i]}')
  maximum=$(awk '{if($2>m)m=$2} END {printf "%.1f",m*1000}' "$tmp")
  printf '%s\t%s\t%s\t%s\t%s\n' "$name" "$average" "$p50" "$p95" "$maximum/$failures"
  rm -f "$tmp"
}

printf 'endpoint\tavg_ms\tp50_ms\tp95_ms\tmax_ms/failures\n'
bench health /health
bench public_tags /api/v1/tags
bench public_categories /api/v1/categories
bench chapter_tags /api/v1/chapter-tags
bench runtime_config '/api/v1/product/runtime-config?host=91xueyuan.app.wflhc.cn'
bench video_list '/api/v1/videos?adult=false'
bench video_detail "/api/v1/videos/$video_id"
bench collected_topics /api/v1/collected-videos/topics
bench collected_bootstrap /api/v1/collected-videos/bootstrap '' 6
bench collected_hot_searches /api/v1/collected-videos/hot-searches
bench collected_categories /api/v1/collected-videos/categories
bench collected_list '/api/v1/collected-videos?page=1&pageSize=20'
bench collected_search '/api/v1/collected-videos?page=1&pageSize=20&q=动漫'
bench collected_detail "/api/v1/collected-videos/$collected_id"
bench product_channel_config "/api/v1/products/$product_slug/channels/direct/config"
bench product_ios "/api/v1/products/$product_slug/channels/direct/ios.mobileconfig"
bench admin_users /api/v1/admin/users "$auth"
bench admin_channels /api/v1/admin/channels "$auth"
bench admin_tags /api/v1/admin/tags "$auth"
bench admin_categories /api/v1/admin/categories "$auth"
bench admin_videos /api/v1/admin/videos "$auth"
bench admin_products /api/v1/admin/product-lines "$auth"
bench admin_product_domains /api/v1/admin/product-domains "$auth"
bench admin_product_packages "/api/v1/admin/product-lines/$product_id/packages" "$auth"
bench admin_product_analytics "/api/v1/admin/product-lines/$product_id/analytics?days=30" "$auth" 5
bench admin_landing_analytics '/api/v1/admin/landing-analytics?days=30' "$auth" 5
bench admin_analytics_compact '/api/v1/admin/analytics?days=30&compact=1' "$auth" 4
bench admin_ip_visits "/api/v1/admin/analytics/ip-visits?date=$day&page=1&pageSize=20" "$auth" 5
bench collector_sources /api/v1/admin/collectors/sources "$auth"
bench collector_sync /api/v1/admin/collectors/sync "$auth"
bench collector_categories /api/v1/admin/collectors/categories "$auth"
bench collector_remote '/api/v1/admin/collectors/remote?page=1' "$auth" 5
bench preview_jobs /api/v1/admin/collectors/preview-jobs "$auth"
bench media_jobs /api/v1/admin/media-jobs "$auth"
