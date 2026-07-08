# 텔레CRM 숨고 브릿지

마케터 PC에서 실행하는 로컬 서비스입니다. CRM 4열 패널이 `http://127.0.0.1:17890` 으로 통신합니다.

## 실행

```bat
cd tools\soomgo-bridge
run-bridge.bat
```

## API

| Method | Path | 설명 |
|--------|------|------|
| GET | `/status` | 브릿지·로그인·현재 채팅방 상태 |
| POST | `/start` | Chrome 시작 |
| POST | `/login` | `{ email, password }` |
| POST | `/open-chats` | 채팅 목록 열기 |
| POST | `/extract` | 현재 채팅방 정보 파싱 |
| POST | `/watch-call-button` | 채팅방에서 「안심번호로 통화하기」 클릭 감시 시작 |
| POST | `/ack-pending-call` | CRM이 pending 번호 처리 완료 알림 |
| POST | `/open-call-modal` | 전화 아이콘 클릭 → 통화 모달 열기 |
| POST | `/extract-call-number` | 모달에서 0504 안심번호 추출 |

| POST | `/send-message` | `{ message }` 숨고 채팅 전송 |

## 안심번호 → CRM·앱

채팅방에서 숨고 **전화 아이콘 → 안심번호로 통화하기**를 누르면 브릿지가 `0504-…` 번호를 감지합니다.
텔레CRM(숨고 연동 바 열림)이 자동으로 **신규 연락처**에 넣고, 휴대폰 앱 다이얼에 번호만 전달합니다(자동 발신 없음).

텔레CRM 왼쪽 도구의 **숨고 연동**으로 채팅 화면을 엽니다. 로그인 후 **채팅 목록**으로 이동하며, 이미 연 **상세 채팅방**은 유지됩니다.
