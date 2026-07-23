#!/usr/bin/env python3
"""PoC: Miso chat list/detail UI dump via adb (no Appium). Run while emulator + miso logged in."""
from __future__ import annotations

import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

ADB = Path.home() / "AppData/Local/Android/Sdk/platform-tools/adb.exe"
PKG = "com.miso.cleaner"
OUT = Path(__file__).resolve().parent


def adb(*args: str) -> str:
    cmd = [str(ADB), *args]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if r.returncode != 0:
        raise RuntimeError(r.stderr or r.stdout or "adb failed")
    return r.stdout.strip()


def dump_ui(name: str) -> ET.Element:
    adb("shell", "uiautomator", "dump", f"/sdcard/{name}.xml")
    local = OUT / f"_{name}.xml"
    adb("pull", f"/sdcard/{name}.xml", str(local))
    return ET.parse(local).getroot()


def nodes(root: ET.Element):
    yield from root.iter("node")


def tap_chat_tab():
    root = dump_ui("probe-nav")
    for n in nodes(root):
        d = (n.get("content-desc") or "").strip()
        if "대화하기" in d and n.get("clickable") == "true":
            b = n.get("bounds") or ""
            m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", b)
            if not m:
                continue
            x1, y1, x2, y2 = map(int, m.groups())
            adb("shell", "input", "tap", str((x1 + x2) // 2), str((y1 + y2) // 2))
            return
    raise RuntimeError("chat tab not found")


def launch_and_open_chat_list():
    adb("shell", "am", "force-stop", PKG)
    time.sleep(1)
    adb("shell", "monkey", "-p", PKG, "-c", "android.intent.category.LAUNCHER", "1")
    time.sleep(4)
    adb("shell", "input", "keyevent", "4")
    time.sleep(0.5)
    adb("shell", "input", "keyevent", "4")
    time.sleep(1)
    tap_chat_tab()


def parse_list_rows(root: ET.Element) -> list[dict]:
    rows: list[dict] = []
    for n in nodes(root):
        if n.get("clickable") != "true":
            continue
        d = (n.get("content-desc") or "").strip()
        if not d or "고객," not in d and " 고객," not in d:
            continue
        if "•" not in d and "기한" not in d:
            continue
        parts = [p.strip() for p in d.split(",")]
        rows.append(
            {
                "raw": d,
                "bounds": n.get("bounds"),
                "previewName": parts[1] if len(parts) > 1 else "",
                "lastAt": parts[2] if len(parts) > 2 else "",
                "previewMessage": parts[3] if len(parts) > 3 else "",
                "statusLine": parts[4] if len(parts) > 4 else "",
            }
        )
    return rows


def parse_detail(root: ET.Element) -> dict:
    texts: list[str] = []
    descs: list[str] = []
    for n in nodes(root):
        t = (n.get("text") or "").strip()
        d = (n.get("content-desc") or "").strip()
        if t:
            texts.append(t)
        if d:
            descs.append(d)
    blob = "\n".join(texts + descs)
    phones = re.findall(r"0\d{1,2}[- ]?\d{3,4}[- ]?\d{4}", blob)
    header = next((d for d in descs if "기한" in d or "이사" in d or "청소" in d), "")
    return {
        "headerDesc": header,
        "phonesFound": phones,
        "inputHint": next((t for t in texts if "메시지" in t), ""),
        "hasSend": any(d == "send" for d in descs),
        "messageSamples": [t for t in texts if len(t) > 8][:5],
    }


def main() -> int:
    if not ADB.is_file():
        print("adb not found:", ADB, file=sys.stderr)
        return 1
    dev = adb("devices")
    if "device" not in dev.replace("List of devices attached", ""):
        print("no emulator device", file=sys.stderr)
        return 1

    print("=== Miso chat PoC probe ===")
    launch_and_open_chat_list()
    time.sleep(2)
    list_root = dump_ui("probe-chatlist")
    rows = parse_list_rows(list_root)
    print(f"chat list rows: {len(rows)}")
    for i, row in enumerate(rows[:5]):
        print(f"  [{i}] {row['previewName']} | {row['lastAt']} | {row['statusLine'][:50]}")

    if not rows:
        print("no list rows — open 대화하기 manually and retry")
        return 2

    b = rows[0]["bounds"] or ""
    m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", b)
    if m:
        x1, y1, x2, y2 = map(int, m.groups())
        adb("shell", "input", "tap", str((x1 + x2) // 2), str((y1 + y2) // 2))
        time.sleep(2)
        detail = parse_detail(dump_ui("probe-chatdetail"))
        print("detail extract probe:")
        print("  header:", detail["headerDesc"][:80])
        print("  phones:", detail["phonesFound"])
        print("  send ready:", detail["hasSend"], detail["inputHint"])

    print("OK — list/detail readable via UIAutomator content-desc")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
