; 청소비서 숨고 연동 — Inno Setup (상담사 PC, Python 별도 설치 불필요)
; 빌드: scripts\build-installer.ps1 -Version 2.2.8

#ifndef MyAppVersion
#define MyAppVersion "2.2.12"
#endif

#define MyAppName "청소비서 숨고 연동"
#define MyAppPublisher "청소비서"
#define MyAppLaunchScript "launch-desktop.vbs"
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
CloseApplications=yes
CloseApplicationsFilter=pythonw.exe;python.exe;wscript.exe;chrome.exe;chromedriver.exe
UninstallDisplayIcon={sys}\wscript.exe

[Tasks]
Name: "desktopicon"; Description: "바탕화면 바로 가기 만들기"; GroupDescription: "추가 작업:"
Name: "startup"; Description: "Windows 시작 시 자동 실행 (권장)"; GroupDescription: "추가 작업:"; Flags: checkedonce

[Files]
Source: "..\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "installer\*,dist\*,runtime\*,__pycache__\*,*.pyc,.git\*"
Source: "..\runtime\python\*"; DestDir: "{app}\python"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\{#MyAppLaunchScript}"""; WorkingDir: "{app}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\{#MyAppLaunchScript}"""; WorkingDir: "{app}"; Tasks: desktopicon
Name: "{userstartup}\{#MyAppName}"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\{#MyAppLaunchScript}"""; WorkingDir: "{app}"; Tasks: startup

[Run]
Filename: "{sys}\wscript.exe"; Parameters: """{app}\{#MyAppLaunchScript}"""; WorkingDir: "{app}"; Description: "청소비서 숨고 연동 실행"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}"

[Code]
function BundledPythonReady(): Boolean;
begin
  Result := FileExists(ExpandConstant('{app}\python\pythonw.exe'));
end;

function InitializeSetup(): Boolean;
begin
  Result := True;
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
    if not BundledPythonReady() then
      MsgBox(
        '설치는 완료되었지만 내장 Python이 없습니다.' + #13#10 +
        '개발용 빌드이거나 runtime이 누락되었을 수 있습니다.' + #13#10 +
        '릴리스 Setup.exe를 사용하거나 Python 3.11+를 설치해 주세요.',
        mbInformation, MB_OK);
  end;
end;
