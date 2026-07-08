@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo [debug] Stop old bridge on port 17890...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :17890 ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul
ping 127.0.0.1 -n 2 > NUL
echo [debug] Python packages...
python -m pip install -r requirements.txt -r requirements-desktop.txt -q
echo [debug] Start tray (console visible)...
python -m desktop.tray_app
