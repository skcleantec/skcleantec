; 청소비서 미소 연동 — Inno Setup (상담사 PC, Python 동봉, SDK는 첫 실행 때 받음)
; 빌드: scripts\build-installer.ps1 -Version 0.3.0

#ifndef MyAppVersion
#define MyAppVersion "0.3.5"
#endif

#define MyAppName "청소비서 미소 연동"
#define MyAppPublisher "청소비서"
#define MyAppLaunchScript "launch-desktop.vbs"
#define MyAppURL "https://www.cbiseo.com"

[Setup]
AppId={{C4E8B2A1-7D55-4F19-8A63-2B9E0F6D4C18}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\Cbiseo\MisoBridge
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=..\dist
OutputBaseFilename=MisoBridge-Setup-{#MyAppVersion}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
ArchitecturesInstallIn64BitMode=x64
; 파일 이름만으로 pythonw를 닫으면 숨고 연동까지 죽는다. 설치 폴더 프로세스만 코드에서 닫는다.
CloseApplications=no
RestartApplications=no
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
Filename: "{sys}\wscript.exe"; Parameters: """{app}\{#MyAppLaunchScript}"""; WorkingDir: "{app}"; Description: "청소비서 미소 연동 실행"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}"

[Code]
function BundledPythonReady(): Boolean;
begin
  Result := FileExists(ExpandConstant('{app}\python\pythonw.exe'));
end;

procedure CloseInstallDirProcesses;
var
  ResultCode: Integer;
  App, Cmd: String;
begin
  App := LowerCase(ExpandConstant('{app}'));
  StringChangeEx(App, '''', '', True);
  Cmd :=
    '-NoProfile -ExecutionPolicy Bypass -Command "' +
    'Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.ToLower().StartsWith(''' + App + ''') } | ' +
    'ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"';
  Exec('powershell.exe', Cmd, '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ConfigDir, ConfigPath, Json: String;
begin
  if CurStep = ssInstall then
    CloseInstallDirProcesses;
  if CurStep = ssPostInstall then
  begin
    ConfigDir := ExpandConstant('{localappdata}\Cbiseo\MisoBridge');
    ForceDirectories(ConfigDir);
    ConfigPath := ConfigDir + '\config.json';
    if not FileExists(ConfigPath) then
    begin
      Json := '{' + #13#10 +
        '  "manifestMode": "auto"' + #13#10 +
        '}' + #13#10;
      SaveStringToFile(ConfigPath, Json, False);
    end;
    if not BundledPythonReady() then
      MsgBox(
        '설치는 완료되었지만 내장 Python이 없습니다.' + #13#10 +
        '릴리스 설치 파일을 다시 받아 주세요.',
        mbInformation, MB_OK);
  end;
end;
