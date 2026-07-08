; SK클린텍 숨고 브릿지 — Inno Setup 스크립트 (빌드 시 ISCC.exe 로 컴파일)
; 사전: Python embedded 또는 전체 폴더를 zip으로 패키징 후 downloadUrl에 등록해도 됨.

#define MyAppName "SK클린텍 숨고 연동"
#define MyAppVersion "2.0.0"
#define MyAppPublisher "SK클린텍"
#define MyAppExeName "run-desktop.bat"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\SKCleantec\SoomgoBridge
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputBaseFilename=SoomgoBridge-Setup-{#MyAppVersion}
Compression=lzma
SolidCompression=yes
WizardStyle=modern

[Tasks]
Name: "desktopicon"; Description: "바탕화면 바로 가기"; GroupDescription: "추가 작업:"
Name: "startup"; Description: "Windows 시작 시 자동 실행"; GroupDescription: "추가 작업:"; Flags: unchecked

[Files]
Source: "..\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "installer\*,__pycache__\*,*.pyc"

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon
Name: "{userstartup}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: startup

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "숨고 연동 프로그램 실행"; Flags: nowait postinstall skipifsilent
