' 로그온 시와 5분마다: 연동 프로그램이 꺼져 있으면 다시 켠다. 켜져 있으면 아무것도 하지 않는다.
Option Explicit
Dim fso, sh, appDir, beat, age
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
appDir = fso.GetParentFolderName(WScript.ScriptFullName)
beat = sh.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Cbiseo\MisoBridge\instance.heartbeat"
If fso.FileExists(beat) Then
  age = DateDiff("s", fso.GetFile(beat).DateLastModified, Now)
  If age >= 0 And age < 40 Then
    WScript.Quit 0
  End If
End If
sh.Run "wscript.exe //B """ & appDir & "\launch-desktop.vbs""", 0, False
