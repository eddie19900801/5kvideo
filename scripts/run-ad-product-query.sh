#!/bin/sh
set -eu
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /tmp/find-ad-product.sql
