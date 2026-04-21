/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Vite가 /api·/ws 를 넘길 백엔드 주소 (끝에 /api 없이). 기본 http://127.0.0.1:3000 */
  readonly VITE_PROXY_API_TARGET?: string;
  /** 예: `http://127.0.0.1:3000/api` — Vite 프록시 없이 API에 직접 붙을 때 */
  readonly VITE_API_PREFIX?: string;
  /** 공개 HTTPS URL — 스케줄「접수건 위치 검색」버튼 아이콘(미설정 시 코드 기본값) */
  readonly VITE_ADMIN_SCHEDULE_MAP_ICON_URL?: string;
}
