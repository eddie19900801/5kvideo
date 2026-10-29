#!/usr/bin/env bash
set -euo pipefail
base=http://127.0.0.1:4010
token=$(docker exec 5kvideo-api node -e 'const jwt=require("jsonwebtoken");process.stdout.write(jwt.sign({id:"admin-1",role:"admin"},process.env.JWT_SECRET,{expiresIn:"5m"}))')
auth="Authorization: Bearer $token"
day=$(TZ=Asia/Bangkok date +%F)
for path in "/api/v1/admin/landing-analytics?days=30" "/api/v1/admin/analytics?days=30&compact=1" "/api/v1/admin/analytics/ip-visits?date=$day&page=1&pageSize=20"; do
  echo "$path"
  for _ in 1 2 3 4 5; do curl -fsS -H "$auth" -o /dev/null -w '%{time_total}\n' "$base$path"; done
done
