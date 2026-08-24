import type { VendorRecord } from '../../services/api';

export const RFQ_CHAT_OPEN_EVENT = 'p2p-open-rfq-chat';

export type RfqChatOpenDetail = {
  vendor?: VendorRecord;
};

type Opener = (detail?: RfqChatOpenDetail) => void;

let opener: Opener | null = null;

export function registerRfqChatOpener(fn: Opener | null) {
  opener = fn;
}

export function openRfqChat(detail?: RfqChatOpenDetail) {
  if (opener) {
    opener(detail);
    return;
  }
  window.dispatchEvent(new CustomEvent(RFQ_CHAT_OPEN_EVENT, { detail }));
}
