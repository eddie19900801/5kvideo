#!/usr/bin/env bash
set -euo pipefail
admin_id="$(docker exec 5k-ad-postgres sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "select id from admins where status='"'"'active'"'"' limit 1"')"
docker cp /tmp/auth-unification/verify.mjs 5k-ad-platform:/app/verify.mjs
docker exec -e VERIFY_ADMIN_ID="$admin_id" 5k-ad-platform node /app/verify.mjs
curl -fsS http://127.0.0.1:4100/health >/dev/null
curl -fsS http://127.0.0.1:4020/health >/dev/null
if grep -q 'navigation_admin_token.*adToken' /opt/5k-middle-platform/admin/5k-ad-platform-current/integration.js; then
  echo legacyCopy=present
  exit 1
fi
echo legacyCopy=removed
