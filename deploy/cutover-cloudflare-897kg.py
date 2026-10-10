import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ENV_FILE = Path("/root/.zonecdn/cloudflare.env")
API = "https://api.cloudflare.com/client/v4"
TARGET = "154.91.19.108"


def read_env(path):
    values = {}
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


env = read_env(ENV_FILE)
headers = {
    "X-Auth-Email": env["ZONECDN_CF_EMAIL"],
    "X-Auth-Key": env["ZONECDN_CF_KEY"],
    "Content-Type": "application/json",
}


def request(method: str, path: str, payload=None):
    data = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(API + path, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=30) as response:
        result = json.load(response)
    if not result.get("success"):
        raise RuntimeError(result.get("errors") or "Cloudflare API request failed")
    return result["result"]


zones = request("GET", "/zones?" + urllib.parse.urlencode({"name": "897kg.cc", "status": "active"}))
if len(zones) != 1:
    raise RuntimeError(f"Expected one active 897kg.cc zone, found {len(zones)}")
zone_id = zones[0]["id"]
records = request("GET", f"/zones/{zone_id}/dns_records?per_page=100")
selected = [record for record in records if record["name"] in {"897kg.cc", "www.897kg.cc"}]

for record in selected:
    print(f"before {record['name']} {record['type']} {record['content']} proxied={record.get('proxied')}")

if "--apply" in sys.argv:
    roots = [record for record in selected if record["name"] == "897kg.cc" and record["type"] == "A"]
    if len(roots) != 1:
        raise RuntimeError(f"Expected one root A record, found {len(roots)}")
    for record in selected:
        if record["type"] != "A":
            continue
        payload = {
            "type": record["type"],
            "name": record["name"],
            "content": TARGET,
            "ttl": record.get("ttl", 1),
            "proxied": record.get("proxied", False),
        }
        updated = request("PUT", f"/zones/{zone_id}/dns_records/{record['id']}", payload)
        print(f"after {updated['name']} {updated['type']} {updated['content']} proxied={updated.get('proxied')}")
