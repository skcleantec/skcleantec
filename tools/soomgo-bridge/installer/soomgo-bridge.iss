; 청소비서 숨고 연동 — Inno Setup (상담사 PC, URL 입력 없음)
; 빌드: scripts\build-installer.ps1 -Version 2.0.2

#ifndef MyAppVersion
#define MyAppVersion "2.0.6"
#endif

#define MyAppName "청소비서 숨고 연동"
#define MyAppPublisher "청소비서"
#define MyAppExeName "run-desktop.bat"
#define MyAppURL "https://www.cbiseo.com"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\Cbiseo\SoomgoBridge
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=..\dist
OutputBaseFilename=SoomgoBridge-Setup-{#MyAppVersion}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
ArchitecturesInstallIn64BitMode=x64
UninstallDisplayIcon={app}\run-desktop.bat

[Tasks]
Name: "desktopicon"; Description: "바탕화면 바로 가기 만들기"; GroupDescription: "추가 작업:"
Name: "startup"; Description: "Windows 시작 시 자동 실행 (권장)"; GroupDescription: "추가 작업:"; Flags: checkedonce

[Files]
Source: "..\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "installer\*,dist\*,__pycache__\*,*.pyc,.git\*"

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; Tasks: desktopicon
Name: "{userstartup}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; Tasks: startup

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "청소비서 숨고 연동 실행"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}"

[Code]
function PythonInstalled(): Boolean;
var
  ResultCode: Integer;
begin
  Result := Exec('python', '--version', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0);
  if not Result then
    Result := Exec('py', '-3 --version', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0);
end;

function InitializeSetup(): Boolean;
begin
  Result := True;
  if not PythonInstalled() then
  begin
    MsgBox(
      '청소비서 숨고 연동을 쓰려면 Python 3가 필요합니다.' + #13#10 + #13#10 +
      'https://www.python.org/downloads/ 에서 Python 3.11 이상을 설치하고' + #13#10 +
      '설치 화면에서 「Add python.exe to PATH」에 체크한 뒤' + #13#10 +
      '이 설치 프로그램을 다시 실행해 주세요.',
      mbError, MB_OK);
    Result := False;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ConfigDir, ConfigPath, Json: String;
begin
  if CurStep = ssPostInstall then
  begin
    ConfigDir := ExpandConstant('{localappdata}\Cbiseo\SoomgoBridge');
    ForceDirectories(ConfigDir);
    ConfigPath := ConfigDir + '\config.json';
    Json := '{' + #13#10 +
      '  "manifestMode": "auto"' + #13#10 +
      '}' + #13#10;
    SaveStringToFile(ConfigPath, Json, False);
  end;
end;
