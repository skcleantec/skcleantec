@echo off
REM locale-ko.ok 가 없을 때만 -change-locale ko-KR. 적용 뒤 다음 부팅은 옵션 없이.
set "MISO_LOCALE_EXTRA="
if exist "%LOCALAPPDATA%\Cbiseo\MisoBridge\locale-ko.ok" exit /b 0
if not exist "%LOCALAPPDATA%\Cbiseo\MisoBridge" mkdir "%LOCALAPPDATA%\Cbiseo\MisoBridge"
echo 1>"%LOCALAPPDATA%\Cbiseo\MisoBridge\locale-change.tried"
set "MISO_LOCALE_EXTRA=-change-locale ko-KR"
exit /b 0
