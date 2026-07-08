# 텔레CRM 숨고 브릿지

마케터 PC에서 실행하는 로컬 서비스입니다. 텔레CRM이 `http://127.0.0.1:17890` 으로 통신합니다.

## 상담사 PC — 설치 프로그램 (권장)

1. 텔레CRM **설정 → 숨고 연동** 또는 상단 바에서 **설치 프로그램** 다운로드
2. `SoomgoBridge-Setup-x.y.z.exe` 실행
3. 설치 마법사에서 **매니페스트 URL** 입력 (예: `https://your-app.up.railway.app/api/public/soomgo-bridge/manifest`)
4. 완료 후 트레이 아이콘 확인 → 텔레CRM **숨고 연동** 사용

Setup 방식의 장점:

- ZIP 압축 해제·경로 설정 불필요
- 시작 프로그램·바탕화면 바로 가기
- CRM **업데이트** 시 `/SILENT` 자동 재설치
- Windows **앱 제거**로 깔끔하게 삭제

**사전 요구:** Python 3.11+ (`PATH`에 등록). 설치 파일이 없으면 Python 미설치 시 안내합니다.

## 개발 PC — 소스에서 실행

```bat
cd tools\soomgo-bridge
run-desktop.bat
```

- 시스템 트레이에 **「SK클린텍 숨고 연동」** 아이콘이 표시됩니다.
- 브릿지 API 서버를 백그라운드로 기동하고, 상태창·자동 업데이트를 제공합니다.

### 설정 (수동)

`%LOCALAPPDATA%\SKCleantec\SoomgoBridge\config.json` — Setup 설치 시 마법사가 자동 생성합니다.

```json
{
  "manifestUrl": "https://your-app.example.com/api/public/soomgo-bridge/manifest"
}
```

환경변수 `SOOMGO_BRIDGE_MANIFEST_URL` 로도 지정할 수 있습니다.

## 개발용 — 브릿지만

```bat
run-bridge.bat
```

트레이·자동 업데이트 없이 Python API만 띄웁니다.

## 서버 매니페스트 (Railway)

| 환경변수 | 설명 |
|----------|------|
| `SOOMGO_BRIDGE_REQUIRED_VERSION` | 최소 API 버전 (기본 `2`) |
| `SOOMGO_BRIDGE_LATEST_VERSION` | 설치 프로그램 semver (기본 `2.0.0`) |
| `SOOMGO_BRIDGE_DOWNLOAD_URL` | **Setup.exe** 다운로드 URL (ZIP은 보조) |
| `SOOMGO_BRIDGE_RELEASE_NOTES` | 릴리스 안내 (선택) |
| `SOOMGO_BRIDGE_SHA256` | Setup.exe SHA256 (자동 업데이트 검증) |

## 릴리스 빌드

```powershell
cd tools\soomgo-bridge
.\scripts\build-release.ps1 -Version 2.0.1
```

- **Setup.exe** (`dist/SoomgoBridge-Setup-*.exe`) — 상담사 배포 기본
- **ZIP** — 개발·수동 업데이트 폴백
- `dist/railway-env-*.txt` — Railway 변수 (Setup SHA256 기준)

로컬에서 Setup만: `.\scripts\build-installer.ps1` (Inno Setup 6 필요)

GitHub Actions: 태그 `soomgo-bridge-v*` 푸시 시 Setup+ZIP 자동 빌드

## API

| Method | Path | 설명 |
|--------|------|------|
| GET | `/status` | 브릿지·로그인·현재 채팅방·앱 버전 상태 |
| POST | `/start` | Chrome 시작 |
| POST | `/login` | `{ email, password }` |
| POST | `/open-chats` | 채팅 목록 열기 |
| POST | `/extract` | 고객 요청·안심번호 원스톱 추출 |
| POST | `/watch-call-button` | 「안심번호로 통화하기」 클릭 감시 |
| POST | `/ack-pending-call` | pending 번호 처리 완료 |
| POST | `/open-call-modal` | 전화 아이콘 → 통화 모달 |
| POST | `/extract-call-number` | 모달에서 0504 안심번호 추출 |
| POST | `/send-message` | `{ message }` 숨고 채팅 전송 |
| POST | `/request-update` | 트레이 앱에 업데이트 확인 요청 |

`bridgeVersion: 2` 이상이 필요합니다 (안심번호·2분할·원스톱 extract).

## 안심번호 → CRM·앱

채팅방 **전화 아이콘 → 안심번호로 통화하기** 클릭 시 브릿지가 `0504-…` 를 감지합니다.
텔레CRM **숨고 연동** 바가 열려 있으면 연락처에 자동 입력되고, 휴대폰 앱 다이얼에 번호만 전달됩니다(자동 발신 없음).

**정보 갖고오기**는 고객 요청 모달 파싱 → 모달 닫기 → 안심번호 추출까지 한 번에 수행합니다.
