@echo off
cd /d "%~dp0"
echo [1/4] Stop old bridge on port 17890...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :17890 ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul
ping 127.0.0.1 -n 2 > NUL
echo [2/4] Python packages...
python -m pip install -r requirements.txt -r requirements-desktop.txt -q
echo [3/4] Manifest URL (optional: set SOOMGO_BRIDGE_MANIFEST_URL)
if not exist "%LOCALAPPDATA%\SKCleantec\SoomgoBridge" mkdir "%LOCALAPPDATA%\SKCleantec\SoomgoBridge"
echo [4/4] Start SK CleanTec Soomgo Bridge Desktop...
python -m desktop.tray_app
