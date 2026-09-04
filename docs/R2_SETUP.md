# Cloudflare R2 — 웹하드 설정 (청소비서)

새 사진·PDF는 R2에 올립니다. 이미 Cloudinary에 있는 파일 주소는 그대로 열립니다.  
**키·비밀번호는 채팅·깃에 넣지 마세요.** `server/.env`와 Railway Variables에만 둡니다.

## Cloudflare에서 할 일

1. [dash.cloudflare.com](https://dash.cloudflare.com) 로그인 (계정 없으면 만들기)
2. 왼쪽 **R2 오브젝트 스토리지** → 처음이면 **R2 사용** 켜기 (카드 등록이 필요할 수 있음. 무료 한도가 큼)
3. **버킷 만들기**
   - 이름: `cbiseo` (다른 이름도 가능)
   - 위치: 기본값 그대로
4. 만든 버킷 → **설정** → **공개 액세스**
   - **R2.dev 하위 도메인 허용** 켜기
   - 표시되는 주소 복사 (예: `https://pub-xxxx.r2.dev`)
5. R2 개요 화면에서 **계정 ID** 복사
6. R2 → **API 관리** → **API 토큰 만들기**
   - 권한: **개체 읽기 및 쓰기**
   - 적용: 방금 만든 버킷만
   - 만들기 후 **Access Key ID** · **Secret Access Key** 를 한 번만 보여 줍니다. 바로 저장

## 서버·Railway에 넣을 값 (5개)

| 이름 | 어디서 |
|------|--------|
| `R2_ACCOUNT_ID` | R2 개요 오른쪽 계정 ID |
| `R2_ACCESS_KEY_ID` | API 토큰 |
| `R2_SECRET_ACCESS_KEY` | API 토큰 (다시 안 보임) |
| `R2_BUCKET` | `cbiseo` |
| `R2_PUBLIC_BASE_URL` | `https://pub-xxxx.r2.dev` (끝 `/` 없이) |

**로컬:** `server/.env`  
**운영·스테이징:** Railway → clean solution → Variables → **staging / production 둘 다**

채팅에는 값을 보내지 마세요. 위 다섯 줄을 넣었다고만 알려 주시면 이어서 확인합니다.

## 아직 지우지 말 것

`CLOUDINARY_URL` 은 그대로 둡니다. 예전에 올린 사진·전자계약 직업로드가 이 주소를 씁니다. Plus 해지는 R2가 잘 올라간 뒤에 하면 됩니다.
