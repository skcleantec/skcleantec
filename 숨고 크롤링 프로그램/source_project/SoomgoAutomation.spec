# -*- mode: python ; coding: utf-8 -*-
import os

from PyInstaller.utils.hooks import collect_data_files, collect_submodules

spec_dir = os.path.dirname(os.path.abspath(SPEC))

selenium_hiddenimports = collect_submodules('selenium')

a = Analysis(
    ['main.py'],
    pathex=[spec_dir],
    binaries=[],
    datas=collect_data_files('selenium')
    + [
        (
            os.path.join(spec_dir, 'build_bundle_config.json'),
            '.',
        ),
        (
            os.path.join(spec_dir, 'scripts', 'apply_zip_update.ps1'),
            'scripts',
        ),
    ],
    hiddenimports=[
        'tkinter',
        'tkinter.ttk',
        'tkinter.messagebox',
        'tkinter.filedialog',
        'tkinter.scrolledtext',
        'requests',
        'desktop',
        'desktop.config',
        'desktop.manifest_client',
        'desktop.update_manager',
        'desktop.update_progress_ui',
        'version_info',
        'selenium.webdriver.chrome.webdriver',
        'selenium.webdriver.chrome.service',
        'selenium.webdriver.chrome.options',
        'selenium.webdriver.chromium.webdriver',
        'selenium.webdriver.chromium.service',
        'selenium.webdriver.remote.webdriver',
        'selenium.webdriver.remote.webelement',
        'selenium.webdriver.common.selenium_manager',
    ]
    + selenium_hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='SoomgoAutomation',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='SoomgoAutomation',
)
