import { PDFDocument, rgb } from 'pdf-lib';

export type HighlightAnnotation = {
  type: 'highlight';
  page: number; // 1-based
  x: number;
  y: number;
  width: number;
  height: number;
  color?: { r: number; g: number; b: number };
  comment?: string;
};

export type Annotation = HighlightAnnotation;

export async function applyAnnotations(pdfBytes: Uint8Array, annotations: unknown[]): Promise<Uint8Array> {
  if (!Array.isArray(annotations) || annotations.length === 0) return pdfBytes;

  const parsed: Annotation[] = annotations
    .map((a) => a as Partial<HighlightAnnotation>)
    .filter((a): a is HighlightAnnotation => a?.type === 'highlight' && typeof a.page === 'number');

  if (parsed.length === 0) return pdfBytes;

  const pdf = await PDFDocument.load(pdfBytes);
  const pages = pdf.getPages();

  for (const a of parsed) {
    const pageIdx = a.page - 1;
    const page = pages[pageIdx];
    if (!page) continue;

    const c = a.color ?? { r: 1, g: 1, b: 0 };
    page.drawRectangle({
      x: a.x,
      y: a.y,
      width: a.width,
      height: a.height,
      color: rgb(c.r, c.g, c.b),
      opacity: 0.35,
      borderOpacity: 0,
    });

    if (a.comment && a.comment.trim().length > 0) {
      page.drawText(a.comment.trim().slice(0, 140), {
        x: a.x,
        y: Math.max(0, a.y + a.height + 4),
        size: 9,
        color: rgb(0, 0, 0),
      });
    }
  }

  return await pdf.save();
}
