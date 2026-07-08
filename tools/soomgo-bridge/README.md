# 텔레CRM 숨고 브릿지

마케터 PC에서 실행하는 로컬 서비스입니다. 텔레CRM이 `http://127.0.0.1:17890` 으로 통신합니다.

## 실행 (권장 — 데스크톱·트레이)

```bat
cd tools\soomgo-bridge
run-desktop.bat
```

- 시스템 트레이에 **「SK클린텍 숨고 연동」** 아이콘이 표시됩니다.
- 브릿지 API 서버를 백그라운드로 기동하고, 상태창·자동 업데이트를 제공합니다.
- CRM에서 **업데이트** 버튼을 누르면 트레이 앱이 매니페스트를 확인해 설치를 진행합니다.

### 설정 (선택)

`%LOCALAPPDATA%\SKCleantec\SoomgoBridge\config.json`:

```json
{
  "manifestUrl": "https://your-app.example.com/api/public/soomgo-bridge/manifest"
}
```

로컬 개발 시 `config.example.json` 참고 (`http://127.0.0.1:3000/api/public/soomgo-bridge/manifest`).

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
| `SOOMGO_BRIDGE_DOWNLOAD_URL` | 설치 파일(.exe) 다운로드 URL |
| `SOOMGO_BRIDGE_RELEASE_NOTES` | 릴리스 안내 (선택) |
| `SOOMGO_BRIDGE_SHA256` | 설치 파일 SHA256 (선택) |

- 공개: `GET /api/public/soomgo-bridge/manifest`
- CRM(인증): `GET /api/crm/soomgo/bridge-manifest`

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

## 설치 프로그램 빌드 (선택)

`installer/soomgo-bridge.iss` — Inno Setup 템플릿. 빌드한 `.exe`를 GitHub Releases 등에 올리고 `SOOMGO_BRIDGE_DOWNLOAD_URL`에 연결합니다.

### ZIP 패키지 (스테이징·Releases)

```powershell
cd tools\soomgo-bridge
.\scripts\build-package.ps1 -Version 2.0.0
```

- 출력: `dist/SoomgoBridge-2.0.0.zip`, `dist/railway-env-2.0.0.txt` (SHA256·Railway 변수 예시)
- GitHub Actions: 태그 `soomgo-bridge-v2.0.0` 푸시 또는 Actions → **Soomgo Bridge Release** 수동 실행

### 상담사 PC 매니페스트 URL

```powershell
.\scripts\write-manifest-config.ps1 -ManifestUrl "https://YOUR-APP.up.railway.app/api/public/soomgo-bridge/manifest"
```
