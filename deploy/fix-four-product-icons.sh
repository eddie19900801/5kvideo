#!/usr/bin/env bash
set -euo pipefail
admin_id="$(docker exec 5kvideo-api node --input-type=module -e 'const {initializeDatabase,readDb}=await import("./dist/db.js");await initializeDatabase();const u=readDb().users.find(x=>x.role==="admin"&&x.status==="active");process.stdout.write(u.id)')"
token="$(docker exec -e A="$admin_id" 5kvideo-api node -e 'const j=require("jsonwebtoken");process.stdout.write(j.sign({id:process.env.A,role:"admin"},process.env.JWT_SECRET,{expiresIn:"20m"}))')"
base=http://127.0.0.1:4010/api/v1
list="$(curl -fsS "$base/admin/product-lines" -H "Authorization: Bearer $token")"
patch_publish() {
  local slug="$1" icon="$2" id
  id="$(jq -r --arg slug "$slug" '.data[]|select(.slug==$slug)|.id' <<<"$list")"
  test -n "$id"
  curl -fsS -X PATCH "$base/admin/product-lines/$id" -H "Authorization: Bearer $token" -H 'Content-Type: application/json' --data "{\"iconUrl\":\"$icon\"}" >/dev/null
  curl -fsS -X POST "$base/admin/product-lines/$id/publish" -H "Authorization: Bearer $token" >/dev/null
  echo "published $slug"
}
patch_publish xingba https://spovhe.cn/v1/assets/landing/e3a3d03f-dbb1-4fb0-80f5-3353a177af5e.enc
patch_publish qiiyou https://spovhe.cn/v1/assets/landing/050f4546-a31a-4655-abaa-846d0381c468.enc
patch_publish chengrentiktok https://spovhe.cn/v1/assets/landing/133265a0-b549-4f3f-9ac6-6cdc5ce94834.enc
patch_publish chengrenkuaishou https://spovhe.cn/v1/assets/landing/8142f60d-23c6-425d-80e4-bd7f5c6317b2.enc
