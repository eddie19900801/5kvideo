#!/usr/bin/env bash
set -euo pipefail
admin_id="$(docker exec 5kvideo-api node --input-type=module -e 'const {initializeDatabase,readDb}=await import("./dist/db.js");await initializeDatabase();const u=readDb().users.find(x=>x.role==="admin"&&x.status==="active");process.stdout.write(u.id)')"
token="$(docker exec -e A="$admin_id" 5kvideo-api node -e 'const j=require("jsonwebtoken");process.stdout.write(j.sign({id:process.env.A,role:"admin"},process.env.JWT_SECRET,{expiresIn:"10m"}))')"
base=http://127.0.0.1:4010/api/v1
id="$(curl -fsS "$base/admin/product-lines" -H "Authorization: Bearer $token"|jq -r '.data[]|select(.slug=="chengse")|.id')"
curl -fsS -X PATCH "$base/admin/product-lines/$id" -H "Authorization: Bearer $token" -H 'Content-Type: application/json' --data '{"iconUrl":"https://spovhe.cn/v1/assets/landing/a0292d3e-2774-40e4-8cae-5577de540ea6.enc"}'
curl -fsS -X POST "$base/admin/product-lines/$id/publish" -H "Authorization: Bearer $token"
