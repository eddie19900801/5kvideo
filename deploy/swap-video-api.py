import json
import subprocess
import time
import urllib.request


CURRENT = "5kvideo-api"
CANARY = "5kvideo-api-canary"
BACKUP = "5kvideo-api-backup-category-required"
IMAGE = "5kvideo-api:category-required"


def docker(*args: str, check: bool = True):
    return subprocess.run(["docker", *args], check=check, universal_newlines=True)


def run_args(config: dict, name: str, port: str):
    args = ["run", "-d", "--name", name, "--restart", "unless-stopped", "-p", f"127.0.0.1:{port}:4000"]
    for value in config["Config"].get("Env") or []:
        args.extend(["--env", value])
    for mount in config.get("Mounts") or []:
        if mount["Type"] == "bind":
            args.extend(["-v", f'{mount["Source"]}:{mount["Destination"]}'])
    args.append(IMAGE)
    return args


def healthy(port: str) -> bool:
    for _ in range(20):
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=2) as response:
                if response.status == 200:
                    return True
        except Exception:
            time.sleep(1)
    return False


config = json.loads(subprocess.check_output(["docker", "inspect", CURRENT], universal_newlines=True))[0]
docker("rm", "-f", CANARY, check=False)
docker(*run_args(config, CANARY, "4011"))
if not healthy("4011"):
    docker("logs", "--tail", "100", CANARY, check=False)
    docker("rm", "-f", CANARY, check=False)
    raise SystemExit("Canary health check failed")
docker("rm", "-f", CANARY)
docker("rm", "-f", BACKUP, check=False)
docker("stop", CURRENT)
docker("rename", CURRENT, BACKUP)
docker(*run_args(config, CURRENT, "4010"))
if not healthy("4010"):
    docker("logs", "--tail", "100", CURRENT, check=False)
    docker("rm", "-f", CURRENT, check=False)
    docker("rename", BACKUP, CURRENT)
    docker("start", CURRENT)
    raise SystemExit("Production health check failed; rolled back")
print("Video API deployed and healthy")
