/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Vite가 /api·/ws 를 넘길 백엔드 주소 (끝에 /api 없이). 기본 http://127.0.0.1:3000 */
  readonly VITE_PROXY_API_TARGET?: string;
  /** `1` 이면 상대 `/api` 만 사용(Vite 프록시 강제) */
  readonly VITE_USE_VITE_PROXY?: string;
  /** 예: `http://127.0.0.1:3000/api` — Vite 프록시 없이 API에 직접 붙을 때 */
  readonly VITE_API_PREFIX?: string;
  /** 개발 서버에서만 vite.config define 으로 주입 — `http://127.0.0.1:PORT/api` */
  readonly VITE_INTERNAL_API_BASE?: string;
  /** 공개 HTTPS URL — 스케줄「접수건 위치 검색」버튼 아이콘(미설정 시 코드 기본값) */
  readonly VITE_ADMIN_SCHEDULE_MAP_ICON_URL?: string;
  /** 테넌트 서브도메인 base — 예: cbiseo.com */
  readonly VITE_TENANT_HOST_BASE_DOMAIN?: string;
  /** apex alias — 쉼표 구분, 예: skcleantec.com */
  readonly VITE_TENANT_HOST_ALIAS_DOMAINS?: string;
  readonly VITE_PLATFORM_HOST_SUBDOMAIN?: string;
}
