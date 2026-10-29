#!/usr/bin/env bash
set -euo pipefail
admin_id="$(docker exec 5kvideo-api node --input-type=module -e 'const {initializeDatabase,readDb}=await import("./dist/db.js");await initializeDatabase();const u=readDb().users.find(x=>x.role==="admin"&&x.status==="active");process.stdout.write(u.id)')"
token="$(docker exec -e A="$admin_id" 5kvideo-api node -e 'const j=require("jsonwebtoken");process.stdout.write(j.sign({id:process.env.A,role:"admin"},process.env.JWT_SECRET,{expiresIn:"10m"}))')"
base=http://127.0.0.1:4010/api/v1
id="$(curl -fsS "$base/admin/product-lines" -H "Authorization: Bearer $token"|jq -r '.data[]|select(.name=="暗黑抖阴")|.id'|head -1)"
payload='{"name":"暗黑抖阴","slug":"anheidouyin18","iconUrl":"https://spovhe.cn/v1/assets/landing/6d3ebad2-7d6b-4fec-9cca-aef82cba110b.enc","recommendationCategoryIds":[],"recommendationKeywords":["抖阴","成人视频","自拍视频"],"recommendationVideoIds":[],"recommendationStrategy":"stable"}'
if [[ -z "$id" ]];then id="$(curl -fsS -X POST "$base/admin/product-lines" -H "Authorization: Bearer $token" -H 'Content-Type: application/json' --data "$payload"|jq -r '.data.id')";else echo "SKIP_EXISTING:$id";exit 10;fi
curl -fsS -X POST "$base/admin/product-lines/$id/publish" -H "Authorization: Bearer $token"
