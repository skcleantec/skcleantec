@echo off
setlocal
REM 텔레CRM Android — debug APK 빌드 후 USB 기기에 설치 (Run 실패 시 우회)
set SDK=%LOCALAPPDATA%\Android\Sdk\platform-tools
set ADB=%SDK%\adb.exe
if not exist "%ADB%" (
  echo [ERROR] adb not found: %ADB%
  echo Android Studio SDK platform-tools 를 설치하세요.
  exit /b 1
)

cd /d "%~dp0"
echo [1/4] ADB 재시작...
"%ADB%" kill-server >nul 2>&1
timeout /t 2 /nobreak >nul
"%ADB%" start-server
timeout /t 1 /nobreak >nul

echo [2/4] 연결 기기 확인...
"%ADB%" devices -l
for /f "tokens=1" %%D in ('"%ADB%" devices ^| findstr /r "device$"') do set DEVICE=%%D
if not defined DEVICE (
  echo [ERROR] USB 디버깅 기기가 없습니다. 케이블·USB 디버깅·PC 허용을 확인하세요.
  exit /b 1
)
echo 사용 기기: %DEVICE%

echo [3/4] Debug APK 빌드...
call gradlew.bat :app:assembleDebug
if errorlevel 1 exit /b 1

set APK=app\build\outputs\apk\debug\app-debug.apk
if not exist "%APK%" (
  echo [ERROR] APK 없음: %APK%
  exit /b 1
)

echo [4/4] 설치 중...
"%ADB%" -s %DEVICE% install -r "%APK%"
if errorlevel 1 (
  echo [ERROR] install 실패 — Android Studio를 닫고 다시 시도하거나 USB 포트를 바꿔 보세요.
  exit /b 1
)

echo.
echo 설치 완료. 폰에서 「청소비서 전화」 앱을 실행하세요.
endlocal
