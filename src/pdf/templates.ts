export type TemplateId = 'report' | 'invoice' | 'letterhead' | 'resume';

export type PdfStyle = {
  pageSize: 'letter' | 'a4';
  margin: number;
  fontSize: number;
  titleSize: number;
  lineHeight: number;
};

export const DEFAULT_STYLE: PdfStyle = {
  pageSize: 'letter',
  margin: 54,
  fontSize: 12,
  titleSize: 18,
  lineHeight: 16,
};

export function resolveStyle(input: {
  templateId: string | null;
  settings: Record<string, unknown>;
}): PdfStyle {
  const t = (input.templateId ?? '').toLowerCase();

  const base: PdfStyle = (() => {
    switch (t) {
      case 'invoice':
        return { ...DEFAULT_STYLE, titleSize: 20, fontSize: 11, lineHeight: 15 };
      case 'resume':
        return { ...DEFAULT_STYLE, titleSize: 16, fontSize: 11, lineHeight: 14, margin: 48 };
      case 'letterhead':
        return { ...DEFAULT_STYLE, titleSize: 22 };
      case 'report':
      default:
        return { ...DEFAULT_STYLE };
    }
  })();

  const pageSize = input.settings.pageSize;
  const margin = input.settings.margin;
  const fontSize = input.settings.fontSize;
  const titleSize = input.settings.titleSize;
  const lineHeight = input.settings.lineHeight;

  return {
    pageSize: pageSize === 'a4' || pageSize === 'letter' ? pageSize : base.pageSize,
    margin: typeof margin === 'number' ? margin : base.margin,
    fontSize: typeof fontSize === 'number' ? fontSize : base.fontSize,
    titleSize: typeof titleSize === 'number' ? titleSize : base.titleSize,
    lineHeight: typeof lineHeight === 'number' ? lineHeight : base.lineHeight,
  };
}
