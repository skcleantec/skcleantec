/** 텔레CRM ↔ 로컬 숨고 브릿지 (127.0.0.1) */
export const SOOMGO_BRIDGE_BASE_URL = 'http://127.0.0.1:17890';

export type SoomgoBridgeStatus = {
  ok: boolean;
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
  lastError?: string | null;
  port?: number;
};

export type SoomgoExtractedChat = {
  chatId: string | null;
  nickname: string | null;
  phone: string | null;
  address: string | null;
  pyeong: string | null;
  memo: string | null;
  lastMessage: string | null;
  customerMessages: string[];
  currentUrl?: string;
};
