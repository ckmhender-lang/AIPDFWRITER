import { marked } from 'marked';

function stripHtml(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/p\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function normalizeContent(input: {
  content: string;
  contentFormat: 'plain' | 'markdown' | 'html';
}): string {
  if (input.contentFormat === 'plain') return input.content;
  if (input.contentFormat === 'html') return stripHtml(input.content);

  // markdown
  const html = marked.parse(input.content, { async: false }) as string;
  return stripHtml(html);
}
