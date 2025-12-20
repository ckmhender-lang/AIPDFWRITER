import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { normalizeContent } from './normalizeContent.js';
import { resolveStyle } from './templates.js';

export type GeneratePdfInput = {
  title: string;
  content: string;
  contentFormat?: 'plain' | 'markdown' | 'html';
  templateId?: string | null;
  settings?: Record<string, unknown>;
};

export type GeneratePdfResult = {
  pdfBytes: Uint8Array;
  pageCount: number;
};

const PAGE_SIZES = {
  letter: { width: 612, height: 792 },
  a4: { width: 595.28, height: 841.89 },
} as const;

function wrapText(text: string, maxWidth: number, measure: (t: string) => number): string[] {
  const lines: string[] = [];

  for (const rawLine of text.replaceAll('\r\n', '\n').split('\n')) {
    const words = rawLine.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }

    let current = '';
    for (const w of words) {
      const next = current.length === 0 ? w : `${current} ${w}`;
      if (measure(next) <= maxWidth) {
        current = next;
      } else {
        if (current.length > 0) lines.push(current);
        // If a single word is longer than maxWidth, hard-split it.
        if (measure(w) > maxWidth) {
          let buf = '';
          for (const ch of w) {
            const candidate = buf + ch;
            if (measure(candidate) <= maxWidth) {
              buf = candidate;
            } else {
              if (buf.length > 0) lines.push(buf);
              buf = ch;
            }
          }
          current = buf;
        } else {
          current = w;
        }
      }
    }
    if (current.length > 0) lines.push(current);
  }

  return lines;
}

export async function generatePdf(input: GeneratePdfInput): Promise<GeneratePdfResult> {
  const pdf = await PDFDocument.create();

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const titleFont = await pdf.embedFont(StandardFonts.HelveticaBold);

  const style = resolveStyle({
    templateId: input.templateId ?? null,
    settings: input.settings ?? {},
  });
  const pageSize = PAGE_SIZES[style.pageSize];
  const usableWidth = pageSize.width - style.margin * 2;

  const normalized = normalizeContent({
    content: input.content,
    contentFormat: input.contentFormat ?? 'plain',
  });
  const measure = (t: string) => font.widthOfTextAtSize(t, style.fontSize);
  const wrapped = wrapText(normalized, usableWidth, measure);

  // First page includes title
  let page = pdf.addPage([pageSize.width, pageSize.height]);
  let y = pageSize.height - style.margin;

  page.drawText(input.title, {
    x: style.margin,
    y: y - style.titleSize,
    size: style.titleSize,
    font: titleFont,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= style.titleSize + 18;

  for (const line of wrapped) {
    if (y - style.lineHeight < style.margin) {
      page = pdf.addPage([pageSize.width, pageSize.height]);
      y = pageSize.height - style.margin;
    }

    page.drawText(line, {
      x: style.margin,
      y: y - style.fontSize,
      size: style.fontSize,
      font,
      color: rgb(0, 0, 0),
    });

    y -= style.lineHeight;
  }

  const pdfBytes = await pdf.save();
  return { pdfBytes, pageCount: pdf.getPageCount() };
}
