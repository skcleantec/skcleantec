' 청소비서 숨고 연동 — 콘솔(CMD) 없이 트레이 앱만 실행
Set fso = CreateObject("Scripting.FileSystemObject")
appDir = fso.GetParentFolderName(WScript.ScriptFullName)
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = appDir
sh.Run "pythonw -m desktop.tray_app", 0, False
