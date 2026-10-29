#!/usr/bin/env bash
set -euo pipefail
admin_id="$(docker exec 5k-ad-postgres sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "select id from admins where status='"'"'active'"'"' limit 1"')"
docker cp /tmp/apply-navigation-product.mjs 5k-ad-platform:/app/apply-navigation-product.mjs
docker exec \
  -e VERIFY_ADMIN_ID="$admin_id" \
  -e NAV_PRODUCT_NAME="91免费" \
  -e NAV_CATEGORY_ID="reference-3" \
  5k-ad-platform node /app/apply-navigation-product.mjs
