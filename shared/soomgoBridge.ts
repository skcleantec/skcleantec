/** 텔레CRM ↔ 로컬 숨고 브릿지 (127.0.0.1) */
export const SOOMGO_BRIDGE_BASE_URL = 'http://127.0.0.1:17890';

/** 안심번호·2분할 등 신규 API 최소 버전 */
export const SOOMGO_BRIDGE_MIN_VERSION = 2;

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
  lastError?: string | null;
  port?: number;
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
};
