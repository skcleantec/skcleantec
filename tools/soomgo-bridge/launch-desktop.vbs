' 청소비서 숨고 연동 — 설치본 번들 Python 우선, 콘솔 없이 트레이만 실행
Set fso = CreateObject("Scripting.FileSystemObject")
appDir = fso.GetParentFolderName(WScript.ScriptFullName)
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = appDir

bundledPyw = appDir & "\python\pythonw.exe"
If fso.FileExists(bundledPyw) Then
  pyw = """" & bundledPyw & """"
Else
  pyw = "pythonw"
End If

sh.Run pyw & " -m desktop.tray_app", 0, False
