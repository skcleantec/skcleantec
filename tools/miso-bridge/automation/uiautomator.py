"""UIAutomator dump + tap helpers (adb)."""
from __future__ import annotations

import re
import tempfile
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path

from automation.adb_client import pull_file, shell, tap
from bridge_config import MISO_PACKAGE

BOUNDS_RE = re.compile(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]')


@dataclass
class UiNode:
    text: str
    content_desc: str
    bounds: str
    clickable: bool
    scrollable: bool
    resource_id: str

    @property
    def center(self) -> tuple[int, int] | None:
        m = BOUNDS_RE.match(self.bounds or '')
        if not m:
            return None
        x1, y1, x2, y2 = map(int, m.groups())
        return (x1 + x2) // 2, (y1 + y2) // 2


def parse_bounds(bounds: str) -> tuple[int, int, int, int] | None:
    m = BOUNDS_RE.match(bounds or '')
    if not m:
        return None
    return tuple(map(int, m.groups()))  # type: ignore[return-value]


def release_uiautomator(serial: str | None) -> None:
    """uiautomator dump 후 에뮬 마우스/터치가 막히는 현상 완화."""
    for cmd in (
        'pkill -f uiautomator 2>/dev/null || true',
        'pkill -f UiAutomator 2>/dev/null || true',
    ):
        try:
            shell(serial, cmd, timeout=5)
        except RuntimeError:
            pass


def dump_ui(serial: str | None, tag: str = 'miso-ui') -> ET.Element:
    remote = f'/sdcard/{tag}.xml'
    try:
        shell(serial, f'uiautomator dump {remote}', timeout=45)
        with tempfile.NamedTemporaryFile(suffix='.xml', delete=False) as tmp:
            local = Path(tmp.name)
        try:
            pull_file(serial, remote, local)
            return ET.parse(local).getroot()
        finally:
            local.unlink(missing_ok=True)
    finally:
        release_uiautomator(serial)
        time.sleep(0.15)


def iter_nodes(root: ET.Element):
    yield from root.iter('node')


def collect_nodes(root: ET.Element) -> list[UiNode]:
    nodes: list[UiNode] = []
    for n in iter_nodes(root):
        nodes.append(
            UiNode(
                text=(n.get('text') or '').strip(),
                content_desc=(n.get('content-desc') or '').strip(),
                bounds=(n.get('bounds') or '').strip(),
                clickable=n.get('clickable') == 'true',
                scrollable=n.get('scrollable') == 'true',
                resource_id=(n.get('resource-id') or '').strip(),
            )
        )
    return nodes


def tap_node(serial: str | None, node: UiNode) -> None:
    center = node.center
    if not center:
        raise RuntimeError('tap target has no bounds')
    tap(serial, center[0], center[1])


def find_clickable_by_desc_contains(root: ET.Element, needle: str) -> UiNode | None:
    for n in collect_nodes(root):
        if not n.clickable:
            continue
        if needle in n.content_desc:
            return n
    return None


def find_by_text(root: ET.Element, text: str, *, clickable: bool | None = None) -> UiNode | None:
    for n in collect_nodes(root):
        if n.text != text:
            continue
        if clickable is not None and n.clickable != clickable:
            continue
        return n
    return None


def launch_miso_app(serial: str | None) -> None:
    shell(
        serial,
        f'monkey -p {MISO_PACKAGE} -c android.intent.category.LAUNCHER 1',
        timeout=30,
    )
    time.sleep(2.5)


def press_back(serial: str | None, times: int = 1) -> None:
    for _ in range(times):
        shell(serial, 'input keyevent 4', timeout=8)
        time.sleep(0.4)
