@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo [1/4] Stop old bridge on port 17890...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :17890 ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul
ping 127.0.0.1 -n 2 > NUL
echo [2/4] Python packages...
python -m pip install -r requirements.txt -r requirements-desktop.txt -q
echo [3/4] Config (auto: cbiseo.com / staging / local)
if not exist "%LOCALAPPDATA%\Cbiseo\SoomgoBridge" mkdir "%LOCALAPPDATA%\Cbiseo\SoomgoBridge"
echo [4/4] Start 청소비서 숨고 연동...
python -m desktop.tray_app
