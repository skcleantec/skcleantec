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
| POST | `/send-message` | `{ message }` 숨고 채팅 전송 |

## CRM 설정

텔레CRM 왼쪽 도구의 **숨고 연동**으로 채팅 화면을 엽니다. 로그인 후 **채팅 목록**으로 이동하며, 이미 연 **상세 채팅방**은 유지됩니다.
