#!/usr/bin/env bash
set -euo pipefail
docker exec 5k-ad-postgres sh -lc 'psql -U "$POSTGRES_USER" -d fivekvideo -Atc "SELECT count(*) FROM runtime_videos; SELECT count(*) FROM runtime_users; SELECT count(*) FROM runtime_analytics_events; SELECT count(*) FROM runtime_product_lines; SELECT count(*) FROM runtime_progress;"'
docker images --format '{{.Repository}}:{{.Tag}}' | grep 20261029-postgres-v11
