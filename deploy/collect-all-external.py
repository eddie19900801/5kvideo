#!/usr/bin/env python3
import argparse
import concurrent.futures
import datetime
import html
import json
import os
import random
import re
import shutil
import tempfile
import time
import urllib.parse
import urllib.request
import uuid

PRIMARY = "https://hsckzy888.com/api.php/provide/vod/from/hsckm3u8/at/json/"
FALLBACK = "https://hszyckapi.vip/api.php/provide/vod/from/hsckm3u8/at/json/"


def request_page(page):
    query = urllib.parse.urlencode({"ac": "detail", "pg": page})
    last = None
    for attempt in range(4):
        for base in (PRIMARY, FALLBACK):
            try:
                request = urllib.request.Request(base + "?" + query, headers={"User-Agent": "5KVIDEO-Collector/1.0"})
                with urllib.request.urlopen(request, timeout=30) as response:
                    payload = json.load(response)
                if not isinstance(payload.get("list"), list):
                    raise ValueError("invalid response")
                return payload
            except Exception as error:
                last = error
        time.sleep(1 + attempt * 2)
    raise RuntimeError("page %s failed: %s" % (page, last))


def clean_text(value, limit=5000):
    text = re.sub(r"<[^>]*>", " ", str(value or ""))
    return re.sub(r"\s+", " ", html.unescape(text)).strip()[:limit]


def playback_url(value):
    for entry in str(value or "").split("#"):
        url = entry.split("$", 1)[-1].strip()
        if re.match(r"^https://\S+\.m3u8(?:\?\S*)?$", url, re.I):
            return url
    return None


def duration(value):
    text = str(value or "").strip()
    if re.match(r"^\d+(?::\d+){1,2}$", text):
        total = 0
        for part in text.split(":"):
            total = total * 60 + int(part)
        return max(1, total)
    minutes = re.search(r"(\d+)\s*分", text)
    seconds = re.search(r"(\d+)\s*秒", text)
    return max(1, int(minutes.group(1)) * 60 if minutes else 0, 1) + (int(seconds.group(1)) if seconds else 0)


def video(item):
    remote_id = str(item.get("vod_id", ""))
    stream = playback_url(item.get("vod_play_url"))
    cover = str(item.get("vod_pic") or "")
    if not remote_id or not stream or not cover.startswith("https://"):
        return None
    now = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    category = clean_text(item.get("type_name"), 100)
    return {
        "id": str(uuid.uuid4()),
        "title": clean_text(item.get("vod_name"), 200) or "采集视频 " + remote_id,
        "description": clean_text(item.get("vod_content") or item.get("vod_blurb")),
        "thumbnail": cover,
        "playbackUrl": stream,
        "duration": duration(item.get("vod_duration")),
        "tags": ([category] if category else []) + ["采集视频"],
        "categoryIds": [],
        "views": random.randint(0, 99),
        "aspectRatio": "landscape",
        "isAdult": True,
        "status": "draft",
        "createdAt": now,
        "sourceType": "external",
        "externalSource": {
            "sourceKey": "hsckm3u8",
            "remoteId": remote_id,
            "remoteUpdatedAt": str(item.get("vod_time") or ""),
            "importedAt": now,
        },
    }


def fetch_all(output, workers):
    first = request_page(1)
    page_count = int(first.get("pagecount") or 1)
    pages = {1: first}
    failures = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {executor.submit(request_page, page): page for page in range(2, page_count + 1)}
        done = 1
        for future in concurrent.futures.as_completed(futures):
            page = futures[future]
            try:
                pages[page] = future.result()
            except Exception as error:
                failures.append(str(error))
            done += 1
            if done % 100 == 0 or done == page_count:
                print("FETCH_PROGRESS %s/%s failures=%s" % (done, page_count, len(failures)), flush=True)
    if failures:
        raise RuntimeError("fetch failed: " + "; ".join(failures[:20]))
    rows = []
    seen = set()
    for page in range(1, page_count + 1):
        for item in pages[page].get("list", []):
            converted = video(item)
            if converted and converted["externalSource"]["remoteId"] not in seen:
                seen.add(converted["externalSource"]["remoteId"])
                rows.append(converted)
    with open(output, "w", encoding="utf-8") as file:
        json.dump({"pageCount": page_count, "videos": rows}, file, ensure_ascii=False)
    print("FETCH_COMPLETE pages=%s playable=%s output=%s" % (page_count, len(rows), output), flush=True)


def merge(output, database_path):
    with open(output, encoding="utf-8") as file:
        collected = json.load(file)["videos"]
    with open(database_path, encoding="utf-8") as file:
        database = json.load(file)
    existing = {
        str(row.get("externalSource", {}).get("remoteId"))
        for row in database.get("videos", [])
        if row.get("externalSource", {}).get("sourceKey") == "hsckm3u8"
    }
    additions = [row for row in collected if row["externalSource"]["remoteId"] not in existing]
    backup = database_path + ".before-full-collect-" + datetime.datetime.now().strftime("%Y%m%d%H%M%S")
    shutil.copy2(database_path, backup)
    database.setdefault("videos", [])[0:0] = additions
    tag_names = {str(tag.get("name", "")).lower() for tag in database.setdefault("tags", [])}
    now = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    for row in additions:
        for name in row["tags"]:
            if name.lower() not in tag_names:
                database["tags"].append({"id": str(uuid.uuid4()), "name": name, "createdAt": now})
                tag_names.add(name.lower())
    directory = os.path.dirname(database_path)
    descriptor, temporary = tempfile.mkstemp(prefix="db-full-collect-", suffix=".json", dir=directory)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as file:
            json.dump(database, file, ensure_ascii=False, indent=2)
            file.flush()
            os.fsync(file.fileno())
        os.replace(temporary, database_path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    print("MERGE_COMPLETE imported=%s skipped=%s totalVideos=%s backup=%s" % (len(additions), len(collected) - len(additions), len(database["videos"]), backup), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command")
    fetch_parser = sub.add_parser("fetch")
    fetch_parser.add_argument("output")
    fetch_parser.add_argument("--workers", type=int, default=12)
    merge_parser = sub.add_parser("merge")
    merge_parser.add_argument("output")
    merge_parser.add_argument("database")
    arguments = parser.parse_args()
    if not arguments.command:
        parser.error("command is required")
    if arguments.command == "fetch":
        fetch_all(arguments.output, max(1, min(arguments.workers, 20)))
    else:
        merge(arguments.output, arguments.database)
