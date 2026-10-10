from pathlib import Path
import shutil

path = Path("/www/server/panel/vhost/nginx/897kg.cc.conf")
backup = path.with_name("897kg.cc.conf.bak-migration-download-20261001")
if not backup.exists():
    shutil.copy2(path, backup)

text = path.read_text()
marker = "    location / { try_files $uri $uri/ /index.html; }"
block = """    location ^~ /__5k_migrate_20261001_a81f/ {
        alias /opt/5k-migration-final-20261001/;
        allow 154.91.16.130;
        deny all;
        default_type application/octet-stream;
    }

"""
if block not in text:
    if marker not in text:
        raise RuntimeError("897kg root location marker not found")
    path.write_text(text.replace(marker, block + marker, 1))
