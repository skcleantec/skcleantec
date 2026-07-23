/** 텔레CRM ↔ 로컬 미소 브릿지 (127.0.0.1) */
export const MISO_BRIDGE_BASE_URL = 'http://127.0.0.1:17891';

export const MISO_BRIDGE_MIN_VERSION = 1;

export type MisoBridgePhase = 'skeleton' | 'motion' | 'release';

export type MisoBridgeStatus = {
  ok: boolean;
  bridgeVersion?: number;
  appVersion?: string | null;
  phase?: MisoBridgePhase | string | null;
  host?: string;
  port?: number;
  avdName?: string | null;
  locale?: string | null;
  adbConnected?: boolean;
  emulatorReady?: boolean;
  emulatorSerial?: string | null;
  misoInstalled?: boolean;
  misoAppVersion?: string | null;
  misoForeground?: boolean;
  misoLoggedIn?: boolean | null;
  misoLoggedInNote?: string | null;
  currentChatId?: string | null;
  currentChatTitle?: string | null;
  pageSize?: number | null;
  deviceCount?: number;
  notes?: string[];
  automationActive?: boolean;
  stubs?: string[];
  lastError?: string | null;
  /** CRM 편의 — HTTP 응답 수신 여부 */
  bridgeRunning?: boolean;
};

export type MisoChatListItem = {
  chatId: string;
  title: string;
  preview?: string | null;
  updatedAt?: string | null;
  updatedAtLabel?: string | null;
  unread?: boolean;
  statusLabel?: string | null;
  rawStatusText?: string | null;
};

export type MisoSendMessageResult = {
  ok: boolean;
  sentAt?: string;
  message?: string;
  chatId?: string | null;
  error?: string;
  code?: string;
};

export type MisoOpenChatsResult = {
  ok: boolean;
  items: MisoChatListItem[];
  count?: number;
  openedAt?: string;
  error?: string;
  code?: string;
};

export type MisoOrderDetail = {
  screenTitle?: string | null;
  serviceDate?: string | null;
  quoteAmount?: string | null;
  quoteSubmittedAt?: string | null;
  quoteSubmittedAuto?: boolean;
  areaPyung?: string | null;
  serviceTypeDetail?: string | null;
  roomLayout?: string | null;
  residenceType?: string | null;
  serviceAddress?: string | null;
  statusLabel?: string | null;
  statusCode?: string | null;
};

export type MisoExtractPayload = {
  ok?: boolean;
  source?: 'miso';
  extractedAt?: string;
  chatId?: string | null;
  customerName?: string | null;
  phone?: string | null;
  phoneAvailable?: boolean;
  /** 연락처 모달은 떴으나 번호 없음 등 안내 */
  phoneNote?: string | null;
  requestSummary?: string | null;
  serviceAddress?: string | null;
  address?: string | null;
  statusLabel?: string | null;
  statusCode?: string | null;
  quoteAmount?: string | null;
  scheduledAt?: string | null;
  rawStatusText?: string | null;
  messagesPreview?: string | null;
  orderDetail?: MisoOrderDetail | null;
  error?: string;
  code?: string;
};
