# SoomgoAutomation - 역컴파일 소스 프로젝트

PyInstaller로 빌드된 `SoomgoAutomation.exe`에서 추출·역컴파일한 Python 소스입니다.

## 폴더 구조

```
source_project/
├── main.py              # GUI 진입점
├── gui_widgets.py       # 설정 팝업 위젯 (역컴파일 보완)
├── config.py            # 설정 로드/저장
├── config.json          # 실행 시 생성/갱신되는 설정
├── automation/          # Selenium 브라우저·채팅 자동화
├── features/            # 재접촉, 이모지/견적조회, 채팅 삭제
├── images/              # 이미지 폴더 (1, 2, 3, ...)
└── requirements.txt
```

## 실행 방법

```powershell
cd source_project
pip install -r requirements.txt
python main.py
```

Chrome 브라우저와 ChromeDriver(Selenium 4.x는 자동 관리)가 필요합니다.

## 역컴파일 도구

| 도구 | 용도 |
|------|------|
| pyinstxtractor | EXE → `.pyc` 추출 |
| pycdc (Decompyle++) | `.pyc` → `.py` |
| xdis | 디스어셈블리 백업 (`decompiled_source/`) |

도구는 `decompile_tools/` 폴더에 있습니다.

## 알려진 제한

- Python 3.12 바이트코드라 **100% 원본 복원은 불가**합니다.
- 일부 복잡한 함수는 `# WARNING: Decompyle incomplete` 상태일 수 있습니다.
  - 상세 바이트코드: `decompiled_source/*.dis.txt` 참고
- `features/combined_feature.py`, `features/recontact.py`, `automation/chat_list.py` 등 일부 메서드는 수동 보완이 필요할 수 있습니다.

## PyInstaller 재빌드 (선택)

```powershell
pip install pyinstaller
pyinstaller --noconfirm --windowed --name SoomgoAutomation ^
  --add-data "config.json;." ^
  --add-data "images;images" ^
  main.py
```

## 원본 추출물

- `SoomgoAutomation.exe_extracted/` - EXE에서 추출한 `.pyc`
- `decompiled_source/` - xdis 디스어셈블리 백업
