' 청소비서 숨고 연동 — 숨김 실행 (로그는 launch-desktop.cmd → launch.log)
Set fso = CreateObject("Scripting.FileSystemObject")
appDir = fso.GetParentFolderName(WScript.ScriptFullName)
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = appDir
launcher = appDir & "\launch-desktop.cmd"
If fso.FileExists(launcher) Then
  sh.Run "cmd /c """ & launcher & """", 0, False
Else
  bundledPyw = appDir & "\python\pythonw.exe"
  If fso.FileExists(bundledPyw) Then
    pyw = """" & bundledPyw & """"
  Else
    pyw = "pythonw"
  End If
  sh.Run pyw & " -m desktop.tray_app", 0, False
End If
