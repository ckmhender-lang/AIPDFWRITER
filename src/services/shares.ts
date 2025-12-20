export type Share = {
  id: string;
  ownerUserId: string;
  documentId: string;
  token: string;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
};

const sharesByToken = new Map<string, Share>();
const sharesById = new Map<string, Share>();

export function createShare(input: {
  ownerUserId: string;
  documentId: string;
  expiresInDays?: number;
}): Share {
  const now = new Date().toISOString();
  const expiresAt =
    typeof input.expiresInDays === 'number'
      ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60_000).toISOString()
      : null;

  const share: Share = {
    id: `shr_${crypto.randomUUID()}`,
    ownerUserId: input.ownerUserId,
    documentId: input.documentId,
    token: `shrt_${crypto.randomUUID()}`,
    createdAt: now,
    expiresAt,
    revokedAt: null,
  };

  sharesById.set(share.id, share);
  sharesByToken.set(share.token, share);
  return share;
}

export function getShareByToken(token: string): Share | null {
  return sharesByToken.get(token) ?? null;
}

export function revokeShare(ownerUserId: string, id: string): boolean {
  const existing = sharesById.get(id);
  if (!existing) return false;
  if (existing.ownerUserId !== ownerUserId) return false;
  if (existing.revokedAt) return true;
  const updated: Share = { ...existing, revokedAt: new Date().toISOString() };
  sharesById.set(updated.id, updated);
  sharesByToken.set(updated.token, updated);
  return true;
}

export function isShareActive(share: Share): boolean {
  if (share.revokedAt) return false;
  if (share.expiresAt && new Date(share.expiresAt).getTime() < Date.now()) return false;
  return true;
}
