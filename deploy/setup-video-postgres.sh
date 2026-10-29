#!/usr/bin/env bash
set -euo pipefail
pg_container=5k-ad-postgres
secret_file=/root/5kvideo-release/server/.video-db-password
env_file=/root/5kvideo-release/server/.postgres.env
if [[ ! -s "$secret_file" ]]; then openssl rand -hex 32 > "$secret_file"; chmod 600 "$secret_file"; fi
password=$(<"$secret_file")
exists=$(docker exec "$pg_container" sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT 1 FROM pg_roles WHERE rolname='"'"'video_runtime'"'"'"')
if [[ "$exists" != "1" ]]; then
  docker exec "$pg_container" sh -lc "psql -v ON_ERROR_STOP=1 -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -c \"CREATE ROLE video_runtime LOGIN PASSWORD '$password'\"" >/dev/null
else
  docker exec "$pg_container" sh -lc "psql -v ON_ERROR_STOP=1 -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -c \"ALTER ROLE video_runtime PASSWORD '$password'\"" >/dev/null
fi
database=$(docker exec "$pg_container" sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT 1 FROM pg_database WHERE datname='"'"'fivekvideo'"'"'"')
if [[ "$database" != "1" ]]; then docker exec "$pg_container" sh -lc 'createdb -U "$POSTGRES_USER" -O video_runtime fivekvideo'; fi
printf 'DATABASE_URL=postgresql://video_runtime:%s@5k-ad-postgres:5432/fivekvideo\n' "$password" > "$env_file"
printf 'DATABASE_POOL_SIZE=10\n' >> "$env_file"
chmod 600 "$env_file"
echo ready
