"""UIAutomator dump + tap helpers (adb)."""
from __future__ import annotations

import re
import tempfile
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path

from automation.adb_client import installed_miso_package, pull_file, shell, shell_result, tap
from bridge_config import MISO_PACKAGES

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


class ScreenReadError(RuntimeError):
    """uiautomator 가 화면 파일을 만들지 못했을 때. UI_CHANGED 와 구분한다."""

    code = 'SCREEN_READ_FAILED'

    def __init__(self) -> None:
        super().__init__(
            '가상폰 화면을 읽지 못했습니다. 가상폰이 느리거나 화면이 계속 움직이고 있습니다.'
        )


def _dump_succeeded(text: str) -> bool:
    lowered = (text or '').lower()
    return 'dumped to' in lowered


def dump_ui(serial: str | None, tag: str = 'miso-ui') -> ET.Element:
    """화면 XML 을 읽는다. 실패하면 1.5초 간격으로 최대 3번 다시 시도한다."""
    remote = f'/sdcard/{tag}.xml'
    try:
        for attempt in range(3):
            if attempt:
                time.sleep(1.5)
            code, out, err = shell_result(serial, f'uiautomator dump {remote}', timeout=45)
            blob = f'{out}\n{err}'.strip()
            if code != 0 or not _dump_succeeded(blob):
                release_uiautomator(serial)
                continue
            with tempfile.NamedTemporaryFile(suffix='.xml', delete=False) as tmp:
                local = Path(tmp.name)
            try:
                pull_file(serial, remote, local)
                return ET.parse(local).getroot()
            except (RuntimeError, ET.ParseError, OSError):
                release_uiautomator(serial)
                continue
            finally:
                local.unlink(missing_ok=True)
        raise ScreenReadError()
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
    package = installed_miso_package(serial) or MISO_PACKAGES[0]
    shell(
        serial,
        f'monkey -p {package} -c android.intent.category.LAUNCHER 1',
        timeout=30,
    )
    time.sleep(2.5)


def press_back(serial: str | None, times: int = 1) -> None:
    for _ in range(times):
        shell(serial, 'input keyevent 4', timeout=8)
        time.sleep(0.4)
