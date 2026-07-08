; SK클린텍 숨고 브릿지 — Inno Setup 설치 프로그램 (상담사 PC 권장)
; 빌드: scripts\build-installer.ps1 -Version 2.0.0

#ifndef MyAppVersion
#define MyAppVersion "2.0.1"
#endif

#define MyAppName "SK클린텍 숨고 연동"
#define MyAppPublisher "SK클린텍"
#define MyAppExeName "run-desktop.bat"
#define MyAppURL "https://github.com/skcleantec/skcleantec"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}/releases
DefaultDirName={autopf}\SKCleantec\SoomgoBridge
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
Name: "startup"; Description: "Windows 시작 시 자동 실행"; GroupDescription: "추가 작업:"; Flags: checkedonce

[Files]
Source: "..\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "installer\*,dist\*,__pycache__\*,*.pyc,.git\*"

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; Tasks: desktopicon
Name: "{userstartup}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; Tasks: startup

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "숨고 연동 프로그램 실행"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}"

[Code]
var
  ManifestPage: TInputQueryWizardPage;

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
      'Python 3이 설치되어 있지 않습니다.' + #13#10 +
      'https://www.python.org/downloads/ 에서 Python 3.11 이상을 설치한 뒤' + #13#10 +
      '「Add python.exe to PATH」를 체크하고 다시 실행해 주세요.',
      mbError, MB_OK);
    Result := False;
  end;
end;

procedure InitializeWizard;
begin
  ManifestPage := CreateInputQueryPage(wpSelectTasks,
    '업데이트 서버 설정',
    '텔레CRM과 자동 업데이트에 쓰는 주소입니다.',
    '운영·스테이징 URL을 입력하세요. 비우면 로컬 개발용 주소가 사용됩니다.' + #13#10 +
    '예: https://your-app.up.railway.app/api/public/soomgo-bridge/manifest');
  ManifestPage.Add('매니페스트 URL:', False);
  ManifestPage.Values[0] := '';
end;

function JsonEscape(const S: String): String;
var
  I: Integer;
  C: String;
begin
  Result := '';
  for I := 1 to Length(S) do
  begin
    C := S[I];
    if C = '\' then
      Result := Result + '\\'
    else if C = '"' then
      Result := Result + '\"'
    else
      Result := Result + C;
  end;
end;

procedure WriteManifestConfig(const Url: String);
var
  ConfigDir, ConfigPath, Json, ManifestUrl: String;
begin
  ConfigDir := ExpandConstant('{localappdata}\SKCleantec\SoomgoBridge');
  ForceDirectories(ConfigDir);
  ConfigPath := ConfigDir + '\config.json';
  ManifestUrl := Trim(Url);
  if ManifestUrl = '' then
    ManifestUrl := 'http://127.0.0.1:3000/api/public/soomgo-bridge/manifest';
  Json := '{' + #13#10 +
    '  "manifestUrl": "' + JsonEscape(ManifestUrl) + '"' + #13#10 +
    '}' + #13#10;
  SaveStringToFile(ConfigPath, Json, False);
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
    WriteManifestConfig(ManifestPage.Values[0]);
end;
