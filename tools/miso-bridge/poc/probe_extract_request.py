#!/usr/bin/env python3
"""PoC: tap chat header box -> scrape request info -> back (Soomgo request-modal parity)."""
from __future__ import annotations

import json
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

ADB = Path.home() / "AppData/Local/Android/Sdk/platform-tools/adb.exe"
PKG = "com.miso.cleaner"
OUT = Path(__file__).resolve().parent

HEADER_BOX_DESC_PREFIX = "기한"
CHAT_BACK_BOUNDS = (42, 189, 105, 252)
DETAIL_BACK_BOUNDS = CHAT_BACK_BOUNDS  # same top-left arrow pattern
HEADER_BOX_FALLBACK_CENTER = (540, 431)

# Label -> orderDetail field (screen: 견적 정보 / 주문 정보)
LABEL_FIELDS: dict[str, str] = {
    "견적 금액": "quoteAmount",
    "견적 제출 일시": "quoteSubmittedAt",
    "평 수": "areaPyung",
    "서비스 타입": "serviceTypeDetail",
    "방 개수": "roomLayout",
    "거주지 종류": "residenceType",
    "거주지 종...": "residenceType",
}

STATUS_TO_CODE = {
    "기한 만료": "EXPIRED",
}


def adb(*args: str) -> str:
    r = subprocess.run([str(ADB), *args], capture_output=True, text=True, timeout=120)
    if r.returncode != 0:
        raise RuntimeError(r.stderr or r.stdout or "adb failed")
    return (r.stdout or "").strip()


def dump_ui(name: str) -> ET.Element:
    adb("shell", "uiautomator", "dump", f"/sdcard/{name}.xml")
    local = OUT / f"_{name}.xml"
    adb("pull", f"/sdcard/{name}.xml", str(local))
    return ET.parse(local).getroot()


def tap_center(bounds: tuple[int, int, int, int]) -> None:
    x1, y1, x2, y2 = bounds
    adb("shell", "input", "tap", str((x1 + x2) // 2), str((y1 + y2) // 2))


def collect_texts(root: ET.Element) -> list[str]:
    out: list[str] = []
    for n in root.iter("node"):
        t = (n.get("text") or "").strip()
        if t and len(t) < 500:
            out.append(t)
    return out


def find_header_box(root: ET.Element) -> tuple[int, int, int, int] | None:
    for n in root.iter("node"):
        d = (n.get("content-desc") or "").strip()
        if not d or HEADER_BOX_DESC_PREFIX not in d:
            continue
        if "이사" in d or "청소" in d or "상담" in d:
            m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", n.get("bounds") or "")
            if m:
                return tuple(map(int, m.groups()))
    return None


def parse_header_summary(desc: str) -> dict:
    parts = [p.strip() for p in desc.split(",")]
    status = parts[1] if len(parts) > 1 else ""
    return {
        "serviceDate": parts[0] if parts else "",
        "rawStatusText": status,
        "statusLabel": status,
        "statusCode": STATUS_TO_CODE.get(status, "UNKNOWN"),
        "serviceType": parts[2] if len(parts) > 2 else "",
        "priceHint": parts[3] if len(parts) > 3 else "",
        "raw": desc,
    }


def parse_order_detail(texts: list[str]) -> dict:
    detail: dict = {"quoteSubmittedAuto": "자동" in texts}
    if texts:
        detail["screenTitle"] = texts[0] if "청소" in texts[0] else ""
    for i, t in enumerate(texts):
        key = LABEL_FIELDS.get(t)
        if not key:
            continue
        for j in range(i + 1, len(texts)):
            nxt = texts[j]
            if nxt in LABEL_FIELDS or nxt in ("견적 정보", "주문 정보", "자동"):
                continue
            if nxt.startswith("메모"):
                continue
            detail[key] = nxt
            break
    # Main date line (e.g. 6월 30일(화)) often before sections
    for t in texts:
        if re.match(r"\d+월 \d+일", t):
            detail.setdefault("serviceDate", t)
            break
    for t in texts:
        if t in STATUS_TO_CODE:
            detail.setdefault("statusLabel", t)
            break
    return detail


def build_extract_payload(header: dict, order_detail: dict, customer: str = "이*화") -> dict:
    summary_parts = [
        order_detail.get("serviceTypeDetail"),
        order_detail.get("areaPyung"),
        order_detail.get("roomLayout"),
    ]
    summary = " / ".join(p for p in summary_parts if p)
    return {
        "ok": True,
        "source": "miso",
        "customerName": customer,
        "statusLabel": header.get("statusLabel") or order_detail.get("statusLabel"),
        "statusCode": header.get("statusCode", "UNKNOWN"),
        "quoteAmount": order_detail.get("quoteAmount"),
        "scheduledAt": order_detail.get("serviceDate") or header.get("serviceDate"),
        "requestSummary": summary or header.get("serviceType", ""),
        "orderDetail": order_detail,
    }


def main() -> int:
    if not ADB.is_file():
        print("adb not found", file=sys.stderr)
        return 1
    if "device" not in adb("devices").replace("List of devices attached", ""):
        print("no emulator — open chat detail first", file=sys.stderr)
        return 1

    print("=== Miso request box extract probe ===")
    chat_root = dump_ui("extract-chat")
    if PKG not in (chat_root.find(".//node").get("package") or ""):
        print("not on miso app — open chat detail first", file=sys.stderr)
        return 2

    box = find_header_box(chat_root)
    header_desc = ""
    for n in chat_root.iter("node"):
        d = (n.get("content-desc") or "").strip()
        if box and n.get("bounds") == f"[{box[0]},{box[1]}][{box[2]},{box[3]}]":
            header_desc = d
            break

    if box:
        print("tap header box:", header_desc[:80])
        tap_center(box)
    else:
        print("header box not found — tap fallback center")
        adb("shell", "input", "tap", *map(str, HEADER_BOX_FALLBACK_CENTER))
    time.sleep(2)

    detail_root = dump_ui("extract-detail")
    texts = collect_texts(detail_root)
    header = parse_header_summary(header_desc) if header_desc else {}
    order_detail = parse_order_detail(texts)
    payload = build_extract_payload(header, order_detail)

    print(json.dumps(payload, ensure_ascii=False, indent=2))

    print("tap back -> chat")
    tap_center(DETAIL_BACK_BOUNDS)
    time.sleep(1)
    after = dump_ui("extract-after")
    has_input = any("메시지" in (n.get("text") or "") for n in after.iter("node"))
    print("back on chat:", has_input)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
