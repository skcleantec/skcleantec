"""설치가 끝난 뒤 트레이를 다시 띄운다."""
from __future__ import annotations

import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    time.sleep(8)
    vbs = ROOT / 'launch-desktop.vbs'
    if vbs.is_file():
        subprocess.Popen(['wscript.exe', str(vbs)], cwd=str(ROOT))


if __name__ == '__main__':
    main()
