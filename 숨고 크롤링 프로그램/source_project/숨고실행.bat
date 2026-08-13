@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 숨고 채팅 자동화

echo ========================================
echo   숨고 채팅 자동화 (Python 실행)
echo   EXE 없이 실행 - Windows 보안에 안전
echo ========================================
echo.

where python >nul 2>&1
if errorlevel 1 (
    echo [오류] Python이 설치되어 있지 않습니다.
    echo.
    echo 1. https://www.python.org/downloads/ 에서 Python 설치
    echo 2. 설치 시 "Add python.exe to PATH" 체크
    echo 3. 이 파일을 다시 실행
    echo.
    pause
    exit /b 1
)

echo Python 확인 완료
python --version
echo.

if not exist "config.json" (
    if exist "config.json.example" (
        echo config.json 없음 - 예시 파일 복사 중...
        copy /Y "config.json.example" "config.json"
    )
)

if not exist "..\images" (
    if not exist "images" (
        echo [참고] images 폴더가 없습니다. 이미지 전송 기능 사용 시 images 폴더를 추가하세요.
    )
)

echo 필요한 패키지 설치 중...
python -m pip install -r requirements.txt -q
if errorlevel 1 (
    echo [오류] 패키지 설치 실패
    pause
    exit /b 1
)

echo.
echo 프로그램 시작...
python main.py
if errorlevel 1 (
    echo.
    echo [오류] 프로그램 실행 중 문제가 발생했습니다.
    pause
)
