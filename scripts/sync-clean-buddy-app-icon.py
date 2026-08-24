#!/usr/bin/env python3
"""clean-buddy-app-icon.png → favicon·PWA·Android launcher 파생 리사이즈."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / 'client/public/brand/clean-buddy-app-icon.png'

TARGETS: dict[Path, int] = {
    ROOT / 'client/public/icons/app-icon-512.png': 512,
    ROOT / 'client/public/icons/app-icon-192.png': 192,
    ROOT / 'client/public/apple-touch-icon.png': 180,
    ROOT / 'apps/cbiseo-android/app/src/main/res/drawable-nodpi/ic_launcher_foreground.png': 512,
}


def main() -> None:
    if not MASTER.is_file():
        raise SystemExit(f'Master missing: {MASTER}')
    img = Image.open(MASTER).convert('RGBA')
    for path, size in TARGETS.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        img.resize((size, size), Image.Resampling.LANCZOS).save(path, 'PNG')
        print(f'wrote {path.relative_to(ROOT)} ({size}x{size})')
    ico = ROOT / 'client/public/favicon.ico'
    img.save(ico, format='ICO', sizes=[(16, 16), (32, 32), (48, 48)])
    print(f'wrote {ico.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
