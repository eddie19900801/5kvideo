#!/usr/bin/env bash
set -euo pipefail

source /root/.zonecdn/cloudflare.env
export CF_Email="$ZONECDN_CF_EMAIL"
export CF_Key="$ZONECDN_CF_KEY"
mkdir -p /root/wflhc-download-wildcard
/root/.acme.sh/acme.sh --issue --dns dns_cf -d '*.download.wflhc.cn' --server letsencrypt --keylength ec-256
/root/.acme.sh/acme.sh --install-cert -d '*.download.wflhc.cn' --ecc \
  --fullchain-file /root/wflhc-download-wildcard/fullchain.pem \
  --key-file /root/wflhc-download-wildcard/privkey.pem
