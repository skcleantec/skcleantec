@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ========================================
echo  SK클린텍 로컬 개발 시작
echo  폴더: %CD%
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [오류] node 를 찾을 수 없습니다.
  echo        Node.js 설치 후, 또는 탐색기 대신 "명령 프롬프트"에서 이 bat을 실행해 보세요.
  echo.
  goto :end_pause
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [오류] npm 을 찾을 수 없습니다. Node.js LTS를 설치하세요.
  echo.
  goto :end_pause
)

where docker >nul 2>&1
if errorlevel 1 (
  echo [오류] docker 명령을 찾을 수 없습니다. Docker Desktop을 설치하세요.
  echo.
  goto :end_pause
)

docker info >nul 2>&1
if errorlevel 1 (
  echo [오류] Docker가 실행 중이 아닙니다. Docker Desktop을 켠 뒤 다시 실행하세요.
  echo.
  goto :end_pause
)

echo [1/3] PostgreSQL 컨테이너 시작 ^(docker compose^)...
call npm run db:up
if errorlevel 1 (
  echo.
  echo [오류] docker compose 실패. 위 메시지를 확인하세요.
  echo.
  goto :end_pause
)

echo [2/3] PostgreSQL 연결 대기 ^(Docker DB가 받을 때까지^)...
set /a DB_WAIT=0
:wait_pg
docker compose exec -T db pg_isready -U skcleanteck -d skcleanteck >nul 2>&1
if not errorlevel 1 goto :pg_ready
set /a DB_WAIT+=1
if %DB_WAIT% geq 45 (
  echo [오류] 90초 안에 DB가 준비되지 않았습니다. Docker 로그를 확인하세요.
  echo.
  goto :end_pause
)
timeout /t 2 /nobreak >nul
goto wait_pg
:pg_ready
echo DB 준비됨 ^(localhost:5432 / skcleanteck^)
echo.

REM 따옴표 안에서 경로 끝에 \ 넣지 않음 (CMD가 따옴표를 깨뜨림)
if not exist "node_modules" (
  echo 루트 npm 패키지 설치...
  call npm.cmd install
  if errorlevel 1 (
    echo [오류] npm install 실패 ^(루트^).
    goto :end_pause
  )
)
if not exist "server\node_modules" (
  echo server npm 패키지 설치...
  pushd server
  call npm.cmd install
  popd
  if errorlevel 1 (
    echo [오류] npm install 실패 ^(server^).
    goto :end_pause
  )
)
if not exist "client\node_modules" (
  echo client npm 패키지 설치...
  pushd client
  call npm.cmd install
  popd
  if errorlevel 1 (
    echo [오류] npm install 실패 ^(client^).
    goto :end_pause
  )
)

if not exist "server\.env" (
  if exist "server\env.docker.template" (
    copy /Y "server\env.docker.template" "server\.env" >nul
    echo [알림] server\.env 없음 - env.docker.template 으로 생성했습니다. ^(Docker DB와 동일 주소^)
    echo.
  ) else (
    echo.
    echo [알림] server\.env 파일이 없고 env.docker.template 도 없습니다.
    echo        DATABASE_URL=postgresql://skcleanteck:skcleanteck@localhost:5432/skcleanteck 를 넣어 주세요.
    echo.
    goto :end_pause
  )
)

echo [3/3] API 서버 ^(3000^) + Vite ^(5173^) — 창 두 개로 실행합니다.
echo   - 처음 DB만 쓸 때는 한 번: npm run db:setup
echo.
REM 한 창에서 concurrently 쓰지 않고, API / 프론트를 각각 띄워 서버가 분명히 켜지게 함
start "SK클린텍 API :3000" "%~dp0dev-server.bat"
timeout /t 3 /nobreak >nul
start "SK클린텍 Vite :5173" "%~dp0dev-client.bat"
echo.
echo API 창과 Vite 창이 열렸습니다. 종료할 때는 각 창에서 Ctrl+C 하세요.
echo 브라우저: http://localhost:5173
echo.

:end_pause
pause
endlocal
