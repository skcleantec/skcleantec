/** 텔레CRM ↔ 로컬 숨고 브릿지 (127.0.0.1) */
export const SOOMGO_BRIDGE_BASE_URL = 'http://127.0.0.1:17890';

/** 안심번호·2분할 등 신규 API 최소 버전 */
export const SOOMGO_BRIDGE_MIN_VERSION = 2;

/** 데스크톱 설치 프로그램 표시 버전 (semver) */
export const SOOMGO_BRIDGE_APP_VERSION = '2.2.7';

/** CRM manifest → `/request-update` 전달 지원 최소 앱 버전 */
export const SOOMGO_BRIDGE_CRM_MANIFEST_PASSTHROUGH_MIN_VERSION = '2.2.3';

/** 채팅 목록 알림 watcher 최소 앱 버전 */
export const SOOMGO_BRIDGE_CHAT_ALERTS_MIN_VERSION = '2.2.0';

/** 순차 메시지 매크로(`/send-sequence`) 최소 앱 버전 */
export const SOOMGO_BRIDGE_SEQUENCE_MIN_VERSION = '2.1.0';

/** semver → 정수 배열 (비교용) */
export function parseSoomgoSemver(version: string): number[] {
  return version
    .trim()
    .replace(/^v/i, '')
    .split('.')
    .map((piece) => {
      const n = parseInt(piece, 10);
      return Number.isFinite(n) ? n : 0;
    });
}

/** a < b 이면 음수, 같으면 0, a > b 이면 양수 */
export function compareSoomgoSemver(a: string, b: string): number {
  const aa = parseSoomgoSemver(a);
  const bb = parseSoomgoSemver(b);
  const len = Math.max(aa.length, bb.length);
  for (let i = 0; i < len; i += 1) {
    const diff = (aa[i] ?? 0) - (bb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function isSoomgoAppOutdated(
  appVersion: string | null | undefined,
  manifest: SoomgoBridgeManifest | null | undefined,
): boolean {
  const latest = manifest?.latestVersion?.trim();
  const current = appVersion?.trim();
  if (!latest || !current) return false;
  return compareSoomgoSemver(current, latest) < 0;
}

/** API 호환 깨짐 — 연동 차단(하드 업데이트). bridgeVersion 미보고 시 차단하지 않음 */
export function isSoomgoBridgeApiOutdated(
  status: SoomgoBridgeStatus | null | undefined,
  manifest?: SoomgoBridgeManifest | null,
): boolean {
  const v = status?.bridgeVersion;
  if (v == null || !Number.isFinite(v)) return false;
  if (v < SOOMGO_BRIDGE_MIN_VERSION) return true;
  const required = manifest?.requiredVersion;
  if (required != null && Number.isFinite(required) && v < required) return true;
  return false;
}

/** 앱 semver가 manifest latest 이상 */
export function isSoomgoBridgeAppAtLatest(
  status: SoomgoBridgeStatus | null | undefined,
  manifest?: SoomgoBridgeManifest | null,
): boolean {
  const current = status?.appVersion?.trim();
  const latest = manifest?.latestVersion?.trim() || status?.latestVersion?.trim();
  if (!current || !latest) return false;
  return compareSoomgoSemver(current, latest) >= 0;
}

/** 앱 semver만 뒤처짐 — 연동 유지·안내(소프트 업데이트) */
export function isSoomgoAppUpdateAvailable(
  status: SoomgoBridgeStatus | null | undefined,
  manifest?: SoomgoBridgeManifest | null,
): boolean {
  if (!status?.bridgeRunning) return false;
  return isSoomgoAppOutdated(status.appVersion, manifest);
}

/** CRM이 넘긴 manifest로 업데이트·설치 가능 (구버전은 cbiseo.com manifest만 사용) */
export function isSoomgoBridgeCrmManifestPassthroughSupported(
  status: SoomgoBridgeStatus | null | undefined,
): boolean {
  const current = status?.appVersion?.trim();
  if (!current) return false;
  return compareSoomgoSemver(current, SOOMGO_BRIDGE_CRM_MANIFEST_PASSTHROUGH_MIN_VERSION) >= 0;
}

/** 설치 중 Chrome·브릿지 재시작 — 숨고 창 열기·감시 일시 중단 (최신 버전이면 stale installing 무시) */
export function isSoomgoBridgeUpdateInstalling(
  status: SoomgoBridgeStatus | null | undefined,
  manifest?: SoomgoBridgeManifest | null,
): boolean {
  if (status?.updatePhase !== 'installing') return false;
  if (isSoomgoBridgeAppAtLatest(status, manifest)) return false;
  return true;
}

/** 숨고 Chrome·채팅 연동 차단 — API 호환 깨짐 또는 실제 설치 진행 중 */
export function isSoomgoBridgeUseBlocked(
  status: SoomgoBridgeStatus | null | undefined,
  manifest?: SoomgoBridgeManifest | null,
): boolean {
  if (!status?.bridgeRunning) return false;
  if (isSoomgoBridgeApiOutdated(status, manifest)) return true;
  return isSoomgoBridgeUpdateInstalling(status, manifest);
}

export type SoomgoBridgeManifest = {
  requiredVersion: number;
  latestVersion: string;
  downloadUrl: string;
  releaseNotes?: string;
  sha256?: string;
};

export type SoomgoChatAlertKind = 'message' | 'quote_read' | 'smart_quote' | 'unknown';

export type SoomgoChatAlert = {
  id: string;
  chatId: string;
  customerName: string | null;
  previewText: string;
  previewKind: SoomgoChatAlertKind;
  unreadCount: number;
  listTimeLabel: string | null;
  capturedAt: number;
};

/** 채팅 목록 전체 스캔 행 — 알림 해소(reconcile)용 */
export type SoomgoChatListSnapshotRow = {
  chatId: string;
  customerName: string | null;
  previewText: string;
  previewKind: SoomgoChatAlertKind;
  unreadCount: number;
  listTimeLabel: string | null;
  capturedAt: number;
};

export type SoomgoBridgeStatus = {
  ok: boolean;
  bridgeVersion?: number;
  bridgeRunning?: boolean;
  browserRunning?: boolean;
  loggedIn?: boolean;
  inChatRoom?: boolean;
  /** 채팅 목록(/pro/chats) */
  onChatList?: boolean;
  /** 받은요청 등 비채팅 고수 화면 */
  onRequestsPage?: boolean;
  pageMode?: 'chat_room' | 'chat_list' | 'requests' | 'other';
  currentUrl?: string | null;
  chatId?: string | null;
  nickname?: string | null;
  /** 숨고 모달 「안심번호로 통화하기」 클릭으로 감지된 번호 */
  pendingCallPhone?: string | null;
  /** pendingCallPhone 감지 시각(ms) — 중복 처리·ack용 */
  pendingCallAt?: number | null;
  callModalOpen?: boolean;
  callWatchActive?: boolean;
  /** 채팅 목록 미읽음 감시 활성 */
  chatWatchActive?: boolean;
  /** CRM 대기(집중 감시) chatId 목록 */
  watchedChatIds?: string[];
  /** CRM 미수신 알림 (브릿지 pending) */
  chatAlerts?: SoomgoChatAlert[];
  chatAlertCount?: number;
  /** 세션 누적 알림함 (최근순) */
  chatInbox?: SoomgoChatAlert[];
  /** 채팅 목록 live 스캔 — 미읽음 해소 감지 */
  chatListSnapshot?: SoomgoChatListSnapshotRow[];
  lastError?: string | null;
  port?: number;
  /** 데스크톱 프로그램 semver */
  appVersion?: string | null;
  /** 트레이 앱 실행 중 */
  desktopRunning?: boolean;
  /** 서버 manifest 최신 semver (브릿지 캐시) */
  latestVersion?: string | null;
  /** 앱 semver < latest */
  updateAvailable?: boolean;
  /** API < required — 하드 업데이트 */
  updateRequired?: boolean;
  /** idle | downloading | ready | installing */
  updatePhase?: 'idle' | 'downloading' | 'ready' | 'installing' | null;
  updateMessage?: string | null;
};

export type SoomgoRequestPair = {
  question: string;
  answer: string;
};

export type SoomgoExtractedChat = {
  chatId: string | null;
  nickname: string | null;
  customerName?: string | null;
  phone: string | null;
  address: string | null;
  pyeong: string | null;
  memo: string | null;
  preferredDate?: string | null;
  serviceType?: string | null;
  buildingType?: string | null;
  region?: string | null;
  requestMemo?: string | null;
  requestPairs?: SoomgoRequestPair[];
  lastMessage: string | null;
  customerMessages: string[];
  currentUrl?: string;
  /** 원스톱 추출 시 050 안심번호 (있을 때만) */
  safePhone?: string | null;
  /** 채팅 등에서 파싱한 실제 연락처(010 등) */
  mobilePhone?: string | null;
  /** 전화 모달에 안심번호 없음 — 채팅만 희망 등 */
  safePhoneSkipped?: boolean;
  /** 승인 시 전화상담 대기 — 번호 없음 */
  phoneConsultPending?: boolean;
  /** extract 시 전화상담 요청 매크로 결과 */
  phoneConsultAction?: 'requested' | 'skipped' | 'failed' | 'already_open' | null;
  /** 고객 요청 모달 — 방·화장실·베란다(발주서 balconyCount) */
  roomCount?: number | null;
  bathroomCount?: number | null;
  balconyCount?: number | null;
};
