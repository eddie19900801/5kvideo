from pathlib import Path
from datetime import datetime
import shutil

TARGET = "154.91.19.108"


def replace_exact(text: str, old: str, new: str, expected: int, label: str) -> str:
    count = text.count(old)
    if count != expected:
        raise RuntimeError(f"{label}: expected {expected} matches, found {count}")
    return text.replace(old, new)


def update(path: str, transforms) -> None:
    file = Path(path)
    original = file.read_text()
    updated = original
    for old, new, expected, label in transforms:
        updated = replace_exact(updated, old, new, expected, label)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    shutil.copy2(file, file.with_name(f"{file.name}.bak-migrate-130-{stamp}"))
    file.write_text(updated)


ssl = "proxy_ssl_server_name on;\n        proxy_ssl_name 897kg.cc;\n        "

update(
    "/www/server/panel/vhost/nginx/daohang.wflhc.cn.conf",
    [
        (
            """    location ^~ /site-data/ {
        alias /opt/5k-navigation/published-site/;
        default_type application/json;
        expires 1m;
        add_header Cache-Control "public, max-age=60, stale-while-revalidate=86400" always;
    }""",
            f"""    location ^~ /site-data/ {{
        proxy_set_header Host 897kg.cc;
        {ssl}proxy_pass https://{TARGET}/dhang/site-data/;
        expires 1m;
        add_header Cache-Control "public, max-age=60, stale-while-revalidate=86400" always;
    }}""",
            1,
            "navigation site-data",
        ),
        (
            "proxy_set_header Host $host;",
            "proxy_set_header Host 897kg.cc;",
            2,
            "navigation public Host headers",
        ),
        (
            """proxy_ssl_server_name on;
        proxy_ssl_name navigation-origin.internal;
        proxy_set_header Host navigation-origin.internal;""",
            """proxy_ssl_server_name on;
        proxy_ssl_name 897kg.cc;
        proxy_set_header Host 897kg.cc;""",
            3,
            "navigation origin TLS settings",
        ),
        (
            "proxy_pass http://127.0.0.1:4020;",
            f"{ssl}proxy_pass https://{TARGET};",
            1,
            "navigation encrypted assets",
        ),
        (
            "proxy_pass http://127.0.0.1:4020/api/;",
            f"proxy_pass https://{TARGET}/api/;",
            3,
            "navigation API locations",
        ),
        (
            "proxy_pass http://127.0.0.1:4100/;",
            f"{ssl}proxy_pass https://{TARGET}/ads/api/;",
            1,
            "navigation ads API",
        ),
    ],
)

update(
    "/www/server/panel/vhost/nginx/wflhc.cn.conf",
    [
        (
            "proxy_set_header Host $host;",
            "proxy_set_header Host 897kg.cc;",
            3,
            "video public Host headers",
        ),
        (
            "proxy_pass https://127.0.0.1;",
            f"proxy_pass https://{TARGET};",
            2,
            "video cross-service routes",
        ),
        (
            "proxy_set_header Host daohang.ikumep.cn;",
            "proxy_set_header Host 897kg.cc;",
            1,
            "video navigation host",
        ),
        (
            "proxy_ssl_name daohang.ikumep.cn;",
            "proxy_ssl_name 897kg.cc;",
            1,
            "video navigation SNI",
        ),
        (
            "proxy_pass http://127.0.0.1:4100/;",
            f"{ssl}proxy_pass https://{TARGET}/ads/api/;",
            1,
            "video ads API",
        ),
        (
            "proxy_pass http://127.0.0.1:4310/api/;",
            f"{ssl}proxy_pass https://{TARGET}/h5-api/;",
            1,
            "video H5 API",
        ),
        (
            "proxy_pass http://127.0.0.1:4310/uploads/;",
            f"{ssl}proxy_pass https://{TARGET}/h5-uploads/;",
            1,
            "video uploads",
        ),
    ],
)
