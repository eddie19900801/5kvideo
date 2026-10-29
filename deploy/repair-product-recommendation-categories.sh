#!/usr/bin/env bash
set -euo pipefail
admin_id="$(docker exec 5kvideo-api node --input-type=module -e 'const {initializeDatabase,readDb}=await import("./dist/db.js");await initializeDatabase();const u=readDb().users.find(x=>x.role==="admin"&&x.status==="active");process.stdout.write(u.id)')"
token="$(docker exec -e A="$admin_id" 5kvideo-api node -e 'const j=require("jsonwebtoken");process.stdout.write(j.sign({id:process.env.A,role:"admin"},process.env.JWT_SECRET,{expiresIn:"10m"}))')"
base=http://127.0.0.1:4010/api/v1
products="$(curl -fsS "$base/admin/product-lines" -H "Authorization: Bearer $token")"
taxonomy="$(curl -fsS "$base/admin/collectors/categories" -H "Authorization: Bearer $token")"
for slug in madou huangdou huangguo haijiao modelmedia yinmu91; do
  id="$(jq -r --arg slug "$slug" '.data[]|select(.slug==$slug)|.id' <<<"$products" | head -1)"
  [[ -z "$id" ]] && continue
  current="$(jq -c --arg slug "$slug" '.data[]|select(.slug==$slug)|.recommendationCategoryIds' <<<"$products")"
  [[ "$(jq 'length' <<<"$current")" -gt 0 ]] && { printf '%s\tpreserved:%s\n' "$slug" "$(jq 'length' <<<"$current")"; continue; }
  keywords="$(jq -c --arg slug "$slug" '.data[]|select(.slug==$slug)|.recommendationKeywords' <<<"$products")"
  categories="$(jq -c --argjson keys "$keywords" '[.data[]|select(.count>0)|.name as $name|($name|ascii_downcase) as $n|select(any($keys[]; . as $k|($k|ascii_downcase) as $kl|($n|contains($kl)) or ($kl|contains($n))))|.id][:100]' <<<"$taxonomy")"
  [[ "$categories" == "[]" && "$slug" == "modelmedia" ]] && categories="$(jq -c '.data[]|select(.slug=="madou")|.recommendationCategoryIds' <<<"$products")"
  [[ "$categories" == "[]" ]] && { printf '%s\tno-match\n' "$slug"; continue; }
  curl -fsS -X PATCH "$base/admin/product-lines/$id" -H "Authorization: Bearer $token" -H 'Content-Type: application/json' --data "$(jq -cn --argjson ids "$categories" '{recommendationCategoryIds:$ids}')" >/dev/null
  curl -fsS -X POST "$base/admin/product-lines/$id/publish" -H "Authorization: Bearer $token" >/dev/null
  printf '%s\t%s\n' "$slug" "$(jq 'length' <<<"$categories")"
done
