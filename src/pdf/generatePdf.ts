import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export type GeneratePdfInput = {
  title: string;
  content: string;
};

export type GeneratePdfResult = {
  pdfBytes: Uint8Array;
  pageCount: number;
};

const PAGE = {
  width: 612, // Letter
  height: 792,
  margin: 54,
};

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

export async function generatePdf({ title, content }: GeneratePdfInput): Promise<GeneratePdfResult> {
  const pdf = await PDFDocument.create();

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const titleFont = await pdf.embedFont(StandardFonts.HelveticaBold);

  const fontSize = 12;
  const titleSize = 18;
  const lineHeight = 16;

  const usableWidth = PAGE.width - PAGE.margin * 2;

  const measure = (t: string) => font.widthOfTextAtSize(t, fontSize);
  const wrapped = wrapText(content, usableWidth, measure);

  // First page includes title
  let page = pdf.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - PAGE.margin;

  page.drawText(title, {
    x: PAGE.margin,
    y: y - titleSize,
    size: titleSize,
    font: titleFont,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= titleSize + 18;

  for (const line of wrapped) {
    if (y - lineHeight < PAGE.margin) {
      page = pdf.addPage([PAGE.width, PAGE.height]);
      y = PAGE.height - PAGE.margin;
    }

    page.drawText(line, {
      x: PAGE.margin,
      y: y - fontSize,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });

    y -= lineHeight;
  }

  const pdfBytes = await pdf.save();
  return { pdfBytes, pageCount: pdf.getPageCount() };
}
