// ---------------------------------------------------------------------------
// Tiny rich-text helpers for section headings / statements.
//
// Section fields can carry a `richText` HTML string (produced by the builder's
// RichTextEditor) so campaign staff can bold text and, most importantly, turn a
// raw URL into a real clickable link. Everything here is allowlist-sanitised so
// the stored HTML is safe to render with dangerouslySetInnerHTML.
// ---------------------------------------------------------------------------

const ALLOWED_TAGS = new Set([
  'A', 'B', 'STRONG', 'I', 'EM', 'U', 'BR', 'P', 'SPAN', 'DIV', 'UL', 'OL', 'LI',
]);

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Normalise/whitelist a link target. Blocks javascript:, data:, etc. */
export function sanitizeHref(href: string): string {
  const trimmed = (href ?? '').trim();
  if (!trimmed) return '';
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed;
  // Any other explicit scheme (javascript:, data:, vbscript:…) is rejected.
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return '';
  // No scheme → assume a web address.
  return `https://${trimmed}`;
}

function cleanNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent ?? '');
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const el = node as HTMLElement;
  const inner = Array.from(el.childNodes).map(cleanNode).join('');
  const tag = el.tagName;

  if (!ALLOWED_TAGS.has(tag)) return inner; // unwrap unknown tags, keep text
  if (tag === 'BR') return '<br>';
  if (tag === 'A') {
    const href = sanitizeHref(el.getAttribute('href') ?? '');
    if (!href) return inner;
    return `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer nofollow">${inner}</a>`;
  }
  const lower = tag.toLowerCase();
  return `<${lower}>${inner}</${lower}>`;
}

/** Strip everything except a small safe set of tags/attributes. */
export function sanitizeRichText(html: string): string {
  if (!html) return '';
  if (typeof document === 'undefined') return html.replace(/<[^>]+>/g, '');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const cleaned = Array.from(doc.body.childNodes).map(cleanNode).join('').trim();
  // contentEditable inserts blank lines as empty <p>s — they become huge gaps in Outlook.
  return cleaned.replace(/<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, '');
}

/** Plain-text version of rich HTML (used for search, list previews, summaries). */
export function richTextToPlain(html: string): string {
  if (!html) return '';
  if (typeof document === 'undefined') return html.replace(/<[^>]+>/g, '').trim();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** True when the HTML has no visible text (empty tags / whitespace only). */
export function isRichTextEmpty(html?: string | null): boolean {
  return !html || richTextToPlain(html).length === 0;
}

/** Turn bare http(s) URLs in plain text into clickable links (legacy fallback). */
export function linkifyPlain(text: string): string {
  const escaped = escapeHtml(text ?? '');
  return escaped.replace(/(https?:\/\/[^\s<]+)/g, (url) => {
    const m = url.match(/[.,;:!?)\]]+$/);
    const tail = m ? m[0] : '';
    const u = tail ? url.slice(0, -tail.length) : url;
    return `<a href="${escapeAttr(u)}" target="_blank" rel="noopener noreferrer nofollow">${u}</a>${tail}`;
  });
}

/**
 * The HTML to render for a heading/section field: its rich text when present,
 * otherwise the plain label with bare URLs auto-linked so older forms still
 * show clickable links.
 */
export function headingDisplayHtml(label: string, richText?: string | null): string {
  if (!isRichTextEmpty(richText)) return sanitizeRichText(richText as string);
  return linkifyPlain(label ?? '');
}

/**
 * Render stored notes that may be either rich HTML (new) or plain text
 * (legacy). Plain text keeps newlines and gets bare URLs linked.
 */
export function notesDisplayHtml(notes?: string | null): string {
  if (!notes) return '';
  if (/<[a-z][\s\S]*>/i.test(notes)) return sanitizeRichText(notes);
  return linkifyPlain(notes).replace(/\n/g, '<br>');
}
