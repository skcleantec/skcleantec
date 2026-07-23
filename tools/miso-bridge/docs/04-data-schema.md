# extract 데이터 · 텔레CRM 매핑 (초안)

PoC Phase C에서 **실측값**으로 갱신합니다.  
필드명은 브릿지 JSON과 텔레CRM lookup **공통 계약** 후보입니다.

---

## `MisoExtractPayload` (POST `/extract` 응답 body)

```json
{
  "ok": true,
  "source": "miso",
  "extractedAt": "2026-07-23T12:00:00+09:00",
  "chatId": "…",
  "customerName": "홍*동",
  "phone": "01012345678",
  "phoneAvailable": true,
  "requestSummary": "입주 청소 / 강남구 …",
  "statusLabel": "고용 완료",
  "statusCode": "HIRED",
  "quoteAmount": null,
  "scheduledAt": null,
  "rawStatusText": "앱 화면에 보이는 원문",
  "messagesPreview": "최근 채팅 한 줄…",
  "orderDetail": {
    "screenTitle": "이사청소/입주청소",
    "serviceDate": "6월 30일(화)",
    "quoteAmount": "상담 후 결정",
    "quoteSubmittedAt": "6월 22일(월) 오후 4시 35분",
    "quoteSubmittedAuto": true,
    "areaPyung": "24 (전용)",
    "serviceTypeDetail": "이사청소",
    "roomLayout": "거실 + 방 2개",
    "residenceType": null
  }
}
```

### 필드 설명

| 필드 | 필수 | 설명 |
|------|------|------|
| `source` | ○ | 항상 `"miso"` (CRM 채널 구분) |
| `chatId` | ○ | 방/문의 고유 id (PoC에서 확정) |
| `customerName` | ○ | 표시 이름 |
| `phone` | △ | **고용 후** 실번호. 없으면 `null` |
| `phoneAvailable` | ○ | 번호 노출 여부 (UI 분기) |
| `requestSummary` | ○ | 서비스·지역·요청 요약 |
| `statusLabel` | ○ | 앱에 보이는 한글 상태 |
| `statusCode` | △ | 정규화 코드 (아래 표) |
| `orderDetail` | △ | 헤더 박스 탭 화면 — 견적·주문 정보 |
| `quoteAmount` | × | 견적 금액 (`orderDetail`과 동기) |
| `scheduledAt` | × | 예약 일시 ISO (있으면) |
| `rawStatusText` | △ | 파싱 실패 시 디버그·수동 매핑용 |
| `messagesPreview` | × | 목록/CRM 미리보기 |

---

## `orderDetail` (헤더 박스 탭 화면 — 2026-07-23 실측)

| 필드 | UI 라벨 | 예 (이*화 건) |
|------|---------|---------------|
| `screenTitle` | GNB | `이사청소/입주청소` |
| `serviceDate` | 대표 날짜 | `6월 30일(화)` |
| `quoteAmount` | 견적 금액 | `상담 후 결정` |
| `quoteSubmittedAt` | 견적 제출 일시 | `6월 22일(월) 오후 4시 35분` |
| `quoteSubmittedAuto` | `자동` 뱃지 | true |
| `areaPyung` | 평 수 | `24 (전용)` |
| `serviceTypeDetail` | 서비스 타입 | `이사청소` |
| `roomLayout` | 방 개수 | `거실 + 방 2개` |
| `residenceType` | 거주지 종류 | (스크롤 후) |

`requestSummary` 생성 예: `{serviceTypeDetail} / {areaPyung} / {roomLayout}`

---

| statusCode | 의미 (예) | phone 기대 |
|------------|-----------|------------|
| `EXPIRED` | **기한 만료** | 없음 |
| `INQUIRY` | 문의/채팅만 | 없음 |
| `QUOTE_PENDING` | 견적 대기·협의 | 없음 |
| `QUOTE_SENT` | 견적 발송 | 없음 |
| `HIRED` | 고용/매칭 | **있음** |
| `SCHEDULED` | 일정 확정 | 있음 |
| `COMPLETED` | 완료 | 있음 |
| `CANCELLED` | 취소 | — |
| `UNKNOWN` | 매핑 불명 | — |

> PoC에서 미소 앱 **실제 문구**를 `rawStatusText`로 모은 뒤 이 표를 확정합니다.

---

## 텔레CRM lookup 매핑 (초안)

| MisoExtractPayload | 텔레CRM / 접수 쪽 |
|--------------------|-------------------|
| `customerName` | 고객명 |
| `phone` | 연락처 (고용 후) |
| `requestSummary` | 메모·요청 요약 |
| `statusLabel` / `statusCode` | 채널 상태 표시·배지 |
| `chatId` | 외부 채널 키 (중복 lookup) |
| `source: "miso"` | 유입 채널 = 미소 |

숨고 extract와 **동일 UX**:

- 번호 있음 → CRM 연락처 필드·Android 다이얼 **번호만 전달** (자동 발신 없음)
- 번호 없음 → 「고용 후 연락처가 표시됩니다」 안내

---

## 목록 항목 `MisoChatListItem`

`POST /open-chats` → `items[]`

| 필드 | 설명 |
|------|------|
| `chatId` | extract 시 선택 키 |
| `title` | 목록 제목 |
| `preview` | 마지막 메시지 미리보기 |
| `updatedAt` | ISO 8601 |
| `unread` | boolean |
| `statusLabel` | 목록에 보이는 상태 (있으면) |

---

## 샘플 파일

PoC 후 가명 데이터:

- `poc/sample-extract.json` (직접 작성)
- `poc/sample-chats.json` (선택)

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-07-23 | 초안 |
