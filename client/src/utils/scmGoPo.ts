import { rfqApi, ScmRfqEntryItem } from '../services/api';

export type GoPoTarget = Pick<
  ScmRfqEntryItem,
  'prId' | 'recommendedInvitationId' | 'recommendationJustification' | 'vendorSelection' | 'canGoPo'
>;

export function rfqEntryPath(prId: number) {
  return `/scm/rfq-entry/${prId}`;
}

export async function finalizeGoPo(item: GoPoTarget) {
  const recId = Number(item.recommendedInvitationId);
  const justification = String(item.recommendationJustification || '').trim();
  if (!recId || !justification) {
    throw new Error('Choose a recommended vendor and write why before Go PO');
  }
  const res = await rfqApi.finalize(item.prId, recId, undefined, justification);
  const isOwn = String(item.vendorSelection || '').toLowerCase() === 'own';
  return {
    message:
      res.message ||
      (isOwn ? 'RFQ finalized. Continue to Create PO.' : 'RFQ finalized. Task is now in RFQ Approval.'),
    isOwn,
    nextPath: isOwn
      ? `/scm/create-po?prId=${item.prId}&from=rfq-approval`
      : '/scm/purchase-requests',
  };
}
