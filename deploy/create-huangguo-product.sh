#!/usr/bin/env bash
set -euo pipefail
admin_id="$(docker exec 5kvideo-api node --input-type=module -e 'const {initializeDatabase,readDb}=await import("./dist/db.js");await initializeDatabase();const u=readDb().users.find(x=>x.role==="admin"&&x.status==="active");process.stdout.write(u.id)')"
token="$(docker exec -e A="$admin_id" 5kvideo-api node -e 'const j=require("jsonwebtoken");process.stdout.write(j.sign({id:process.env.A,role:"admin"},process.env.JWT_SECRET,{expiresIn:"10m"}))')"
base=http://127.0.0.1:4010/api/v1
list="$(curl -fsS "$base/admin/product-lines" -H "Authorization: Bearer $token")"
id="$(jq -r '.data[]|select(.slug=="huangguo")|.id'<<<"$list"|head -1)"
if [[ -z "$id" ]];then
  created="$(curl -fsS -X POST "$base/admin/product-lines" -H "Authorization: Bearer $token" -H 'Content-Type: application/json' --data '{"name":"黄果短剧","slug":"huangguo","iconUrl":"https://spovhe.cn/v1/assets/landing/82dd82fc-0b0d-4aef-a7c0-ebbd35c8da1f.enc","recommendationCategoryIds":[],"recommendationKeywords":["短剧","AI短剧","魔改"],"recommendationVideoIds":[],"recommendationStrategy":"stable"}')"
  id="$(jq -r '.data.id'<<<"$created")"
fi
curl -fsS -X POST "$base/admin/product-lines/$id/publish" -H "Authorization: Bearer $token"|jq '{data:{id:.data.id,name:.data.name,slug:.data.slug,url:.data.url,landingUrl:.data.landingUrl,status:.data.status,version:.data.version}}'
