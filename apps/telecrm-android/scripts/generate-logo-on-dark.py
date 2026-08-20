#!/usr/bin/env python3
"""검정 배경 공식 로고 → 다크 GNB/히어로용 투명 PNG (clean_secretary_logo_on_dark.png)."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "app/src/main/res/drawable-nodpi/clean_secretary_logo.png"
OUT = ROOT / "app/src/main/res/drawable-nodpi/clean_secretary_logo_on_dark.png"
LUMINANCE_CUTOFF = 40


def main() -> None:
    im = Image.open(SRC).convert("RGBA")
    px = im.load()
    out = Image.new("RGBA", im.size)
    op = out.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            lum = 0.299 * r + 0.587 * g + 0.114 * b
            if lum < LUMINANCE_CUTOFF:
                op[x, y] = (0, 0, 0, 0)
            else:
                op[x, y] = (r, g, b, a)
    out.save(OUT)
    print(f"wrote {OUT.relative_to(ROOT)} ({out.size[0]}x{out.size[1]})")


if __name__ == "__main__":
    main()
