#!/usr/bin/env bash
set -euo pipefail
trap 'printf "create product failed at line %s\n" "$LINENO" >&2' ERR

admin_id="$(docker exec 5kvideo-api node --input-type=module -e 'const {initializeDatabase,readDb}=await import("./dist/db.js");await initializeDatabase();const user=readDb().users.find(item=>item.role==="admin"&&item.status==="active");if(!user)process.exit(2);process.stdout.write(user.id)')"
token="$(docker exec -e FIVEK_ADMIN_ID="$admin_id" 5kvideo-api node -e 'const jwt=require("jsonwebtoken");process.stdout.write(jwt.sign({id:process.env.FIVEK_ADMIN_ID,role:"admin"},process.env.JWT_SECRET,{expiresIn:"10m"}))')"
base='http://127.0.0.1:4010/api/v1'
existing="$(curl -fsS "$base/admin/product-lines" -H "Authorization: Bearer $token")"
product_id="$(jq -r '.data[] | select(.slug=="huangdou") | .id' <<<"$existing" | head -1)"

if [[ -z "$product_id" ]]; then
  created="$(curl -fsS -X POST "$base/admin/product-lines" \
    -H "Authorization: Bearer $token" \
    -H 'Content-Type: application/json' \
    --data '{"name":"黄豆魔改短剧","slug":"huangdou","iconUrl":"https://spovhe.cn/v1/assets/landing/4c76d0c6-498a-437c-86cd-da41f0576d2a.enc","recommendationCategoryIds":[],"recommendationKeywords":["短剧","AI短剧","魔改"],"recommendationVideoIds":[],"recommendationStrategy":"stable"}')"
  product_id="$(jq -r '.data.id' <<<"$created")"
fi

curl -fsS -X POST "$base/admin/product-lines/$product_id/publish" \
  -H "Authorization: Bearer $token" | jq '{data:{id:.data.id,name:.data.name,slug:.data.slug,url:.data.url,landingUrl:.data.landingUrl,status:.data.status,version:.data.version}}'
