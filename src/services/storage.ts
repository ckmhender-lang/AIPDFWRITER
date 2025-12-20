export type DocumentVersion = {
  id: string;
  createdAt: string;
  title: string;
  content: string;
  contentFormat: 'plain' | 'markdown' | 'html';
  templateId: string | null;
  tags: string[];
  settings: Record<string, unknown>;
  annotations: unknown[];
};

export type Document = {
  id: string;
  ownerUserId: string;
  title: string;
  content: string;
  contentFormat: 'plain' | 'markdown' | 'html';
  templateId: string | null;
  tags: string[];
  settings: Record<string, unknown>;
  annotations: unknown[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  versions: DocumentVersion[];
  generatedPdfAssetId: string | null;
};

export type Asset = {
  id: string;
  ownerUserId: string;
  kind: 'image' | 'pdf' | 'other';
  mimeType: string;
  filename: string;
  size: number;
  createdAt: string;
  bytes: Uint8Array;
};

const documents = new Map<string, Document>();
const assets = new Map<string, Asset>();

export function createDocument(input: {
  ownerUserId: string;
  title: string;
  content: string;
  contentFormat: Document['contentFormat'];
  templateId?: string | null;
  tags?: string[];
  settings?: Record<string, unknown>;
}): Document {
  const now = new Date().toISOString();
  const doc: Document = {
    id: `doc_${crypto.randomUUID()}`,
    ownerUserId: input.ownerUserId,
    title: input.title,
    content: input.content,
    contentFormat: input.contentFormat,
    templateId: input.templateId ?? null,
    tags: input.tags ?? [],
    settings: input.settings ?? {},
    annotations: [],
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    versions: [],
    generatedPdfAssetId: null,
  };
  documents.set(doc.id, doc);
  return doc;
}

export function listDocuments(input: {
  ownerUserId: string;
  includeDeleted?: boolean;
  tag?: string;
  q?: string;
}): Document[] {
  const includeDeleted = input.includeDeleted ?? false;
  const tag = input.tag?.trim();
  const q = input.q?.trim().toLowerCase();

  return Array.from(documents.values()).filter((d) => {
    if (d.ownerUserId !== input.ownerUserId) return false;
    if (!includeDeleted && d.deletedAt) return false;
    if (tag && !d.tags.includes(tag)) return false;
    if (q && !d.title.toLowerCase().includes(q) && !d.content.toLowerCase().includes(q)) return false;
    return true;
  });
}

export function getDocument(ownerUserId: string, id: string): Document | null {
  const d = documents.get(id) ?? null;
  if (!d) return null;
  if (d.ownerUserId !== ownerUserId) return null;
  return d;
}

export function updateDocument(
  ownerUserId: string,
  id: string,
  patch: Partial<
    Pick<
      Document,
      'title' | 'content' | 'contentFormat' | 'templateId' | 'tags' | 'settings' | 'annotations' | 'generatedPdfAssetId'
    >
  >,
): Document | null {
  const existing = getDocument(ownerUserId, id);
  if (!existing) return null;
  const updatedAt = new Date().toISOString();
  const updated: Document = {
    ...existing,
    ...patch,
    updatedAt,
  };
  documents.set(id, updated);
  return updated;
}

export function softDeleteDocument(ownerUserId: string, id: string): boolean {
  const existing = getDocument(ownerUserId, id);
  if (!existing) return false;
  if (existing.deletedAt) return true;
  documents.set(id, { ...existing, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  return true;
}

export function restoreDocument(ownerUserId: string, id: string): boolean {
  const existing = getDocument(ownerUserId, id);
  if (!existing) return false;
  if (!existing.deletedAt) return true;
  documents.set(id, { ...existing, deletedAt: null, updatedAt: new Date().toISOString() });
  return true;
}

export function createVersion(ownerUserId: string, id: string): DocumentVersion | null {
  const existing = getDocument(ownerUserId, id);
  if (!existing) return null;
  const v: DocumentVersion = {
    id: `ver_${crypto.randomUUID()}`,
    createdAt: new Date().toISOString(),
    title: existing.title,
    content: existing.content,
    contentFormat: existing.contentFormat,
    templateId: existing.templateId,
    tags: [...existing.tags],
    settings: { ...existing.settings },
    annotations: Array.isArray(existing.annotations) ? [...existing.annotations] : [],
  };
  const updated: Document = { ...existing, versions: [v, ...existing.versions], updatedAt: new Date().toISOString() };
  documents.set(id, updated);
  return v;
}

export function listVersions(ownerUserId: string, id: string): DocumentVersion[] | null {
  const existing = getDocument(ownerUserId, id);
  if (!existing) return null;
  return existing.versions;
}

export function createAsset(input: {
  ownerUserId: string;
  kind: Asset['kind'];
  mimeType: string;
  filename: string;
  bytes: Uint8Array;
}): Asset {
  const now = new Date().toISOString();
  const asset: Asset = {
    id: `ast_${crypto.randomUUID()}`,
    ownerUserId: input.ownerUserId,
    kind: input.kind,
    mimeType: input.mimeType,
    filename: input.filename,
    size: input.bytes.byteLength,
    createdAt: now,
    bytes: input.bytes,
  };
  assets.set(asset.id, asset);
  return asset;
}

export function getAsset(ownerUserId: string, id: string): Asset | null {
  const a = assets.get(id) ?? null;
  if (!a) return null;
  if (a.ownerUserId !== ownerUserId) return null;
  return a;
}
