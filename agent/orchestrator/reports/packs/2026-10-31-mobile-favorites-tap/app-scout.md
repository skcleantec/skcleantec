# AppScout — 모바일 즐겨찾기 별이 눌러도 안 열리는 문제

## 추천 방법
1. 별 버튼의 탭으로 시트를 연 뒤, 그 탭이 새로 생긴 전체 화면 배경을 누르지 못하게 한다.
2. 배경은 손가락이 배경 위에서 새로 눌린 뒤에만 닫는다.
3. 연 직후 약 0.3초는 시트 전체가 터치를 받지 않는다.
4. 화면 모양·색·메뉴 글자는 그대로 둔다.

## 타 앱 작동방식
| 앱·출처 | 최신 흐름 | 우리에게 쓸 점 |
|---------|-----------|----------------|
| Shelf 검색 창 (Safari) https://github.com/Shelf-nu/website-v2/pull/102 | 버튼을 누르면 창이 열리고, Safari가 같은 탭을 새 배경에 다시 보내 바로 닫힘. 고친 방법은 연 뒤 250ms 동안 배경 `pointer-events: none`. | 시각을 effect에서 찍으면 늦다. 첫 페인트부터 터치를 막는다. |
| Lucarne 할 일 팝오버 (iPad) https://github.com/Babel-Innovations/ha-lucarne/pull/78 | 길게 누른 손을 떼면 팝오버가 열리고, 그 click이 배경에 떨어져 닫힘. 배경에서 pointerdown이 시작된 탭만 닫기로 고침. | 그냥 click만으로 닫지 않는다. |
| Bootstrap 오프캔버스 https://github.com/twbs/bootstrap/issues/39987 | pointerup으로 열면 Android·터치에서 배경이 추가 이벤트를 받아 바로 닫힘. 우회는 열린 직후 배경을 잠시 정적으로 둠. | 관리·팀장 FAB가 pointerup으로 여는 구조와 같다. |
| Material 모달 시트 https://m2.material.io/components/sheets-bottom | 모바일에서 선택 목록은 시트. 바깥(스크림)을 누르면 닫고, 닫기 버튼으로도 닫는다. | 지금 상단 시트를 유지. 레이아웃은 바꾸지 않음. |

## 모바일 인기 디자인 레퍼런스
| 순위 | 출처 URL | 왜 인기인가 | 가져올 패턴 |
|------|----------|-------------|-------------|
| 1 | https://m3.material.io/components/bottom-sheets | Material 3 공식. 폰 너비에서 보조 내용을 시트에 두고, 바깥을 눌러 닫음. | 이미 있는 상단 시트를 유지. 새 모양은 만들지 않음. |
| 2 | https://m2.material.io/components/sheets-bottom | Material 2 공식. 모달 시트는 스크림 탭·닫기·항목 선택으로 닫음. | 항목을 누르면 이동, 바깥을 누르면 닫기. |

## 하지 말 것
- 즐겨찾기 버튼 색·위치를 다시 그리지 않는다.
- 제목 옆 별과 오른쪽 떠 있는 별을 한쪽으로 합치지 않는다.

## DesignPulse / 구현에 넘길 한 줄
모양은 유지하고, 연 직후 같은 탭이 시트를 닫지 못하게만 한다.
