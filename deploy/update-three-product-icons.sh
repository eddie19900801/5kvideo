#!/usr/bin/env bash
set -euo pipefail
admin_id="$(docker exec 5kvideo-api node --input-type=module -e 'const {initializeDatabase,readDb}=await import("./dist/db.js");await initializeDatabase();const u=readDb().users.find(x=>x.role==="admin"&&x.status==="active");process.stdout.write(u.id)')"
token="$(docker exec -e A="$admin_id" 5kvideo-api node -e 'const j=require("jsonwebtoken");process.stdout.write(j.sign({id:process.env.A,role:"admin"},process.env.JWT_SECRET,{expiresIn:"10m"}))')"
base=http://127.0.0.1:4010/api/v1
while IFS=$'\t' read -r slug asset; do
  id="$(curl -fsS "$base/admin/product-lines" -H "Authorization: Bearer $token" | jq -r --arg slug "$slug" '.data[]|select(.slug==$slug)|.id' | head -1)"
  test -n "$id"
  url="https://spovhe.cn/v1/assets/landing/${asset}.enc"
  curl -fsS -X PATCH "$base/admin/product-lines/$id" -H "Authorization: Bearer $token" -H 'Content-Type: application/json' --data "{\"iconUrl\":\"$url\"}" >/dev/null
  curl -fsS -X POST "$base/admin/product-lines/$id/publish" -H "Authorization: Bearer $token" | jq -c '{slug:.data.slug,version:.data.version,iconUrl:.data.iconUrl,categories:(.data.recommendationCategoryIds|length)}'
done <<'EOF'
yinmu91	6c209ceb-47f9-4bb4-8875-15ff8d8c5320
modelmedia	99aa6b06-1c65-47ed-af7a-00be88d2c542
huangguo	8c9eaf34-6aa3-4eb0-93ff-53a2ace57054
EOF
