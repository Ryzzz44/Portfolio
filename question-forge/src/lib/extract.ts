import JSZip from 'jszip';
import { decodeUtf8, formatBytes, printableRatio, printableStrings, toBase64, wordCount } from './bytes';
import type { SourceKind, SourcePayload } from './types';

export interface Extracted {
  kind: SourceKind;
  mimeType: string;
  detail: string;
  words: number;
  payload: SourcePayload;
}

/** Claude reads these image formats directly. */
const IMAGE_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

/** Extensions we treat as plain text without sniffing. */
const TEXT_EXT = new Set(
  (
    'txt md markdown mdx rst org tex csv tsv json jsonl ndjson xml yaml yml toml ini cfg conf env log ' +
    'js jsx ts tsx mjs cjs py rb go rs java kt kts swift c h cc cpp hpp cs php sh bash zsh fish ps1 sql ' +
    'r m scala lua pl dart ex exs erl hs clj vue svelte css scss less html htm svg srt vtt ics vcf bib'
  ).split(' '),
);

/** Zip-based office / ebook formats and where their text lives. */
const ZIP_DOCS: Record<string, { label: string; match: RegExp }> = {
  docx: { label: 'Word document', match: /^word\/(document|footnotes|endnotes)\.xml$/ },
  pptx: { label: 'Slides', match: /^ppt\/(slides\/slide\d+|notesSlides\/notesSlide\d+)\.xml$/ },
  xlsx: { label: 'Spreadsheet', match: /^xl\/(sharedStrings|worksheets\/sheet\d+)\.xml$/ },
  odt: { label: 'OpenDocument text', match: /^content\.xml$/ },
  odp: { label: 'OpenDocument slides', match: /^content\.xml$/ },
  ods: { label: 'OpenDocument sheet', match: /^content\.xml$/ },
  epub: { label: 'E-book', match: /\.(x?html?)$/ },
  pages: { label: 'Pages document', match: /\.(xml|txt)$/ },
};

/** Base64 grows ~33%; the API caps a request at 32 MB, so keep the raw file well under that. */
export const MAX_NATIVE_BYTES = 20 * 1024 * 1024;
/** Plain text we keep per source (roughly 250k tokens) — plenty for a quiz. */
export const MAX_TEXT_CHARS = 900_000;

export function extensionOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i < 0 ? '' : name.slice(i + 1).toLowerCase();
}

function stripMarkup(xmlOrHtml: string): string {
  return xmlOrHtml
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|h\d|li|tr|br|a:p|w:p|text:p|text:h)>/gi, '\n')
    .replace(/<(br|w:br|w:tab|a:br)\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

function stripRtf(rtf: string): string {
  return rtf
    .replace(/\\par[d]?/g, '\n')
    .replace(/\{\\\*[^{}]*\}/g, '')
    .replace(/\\'[0-9a-f]{2}/gi, '')
    .replace(/\\[a-z]+-?\d* ?/gi, '')
    .replace(/[{}]/g, '')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

function clampText(text: string): string {
  return text.length > MAX_TEXT_CHARS ? text.slice(0, MAX_TEXT_CHARS) : text;
}

function textResult(text: string, mimeType: string, label: string, kind: SourceKind = 'text'): Extracted {
  const clean = clampText(text);
  const words = wordCount(clean);
  return {
    kind,
    mimeType,
    words,
    detail: `${label} · ${words.toLocaleString()} words`,
    payload: { text: clean },
  };
}

async function extractZipDoc(bytes: Uint8Array, ext: string): Promise<string> {
  const spec = ZIP_DOCS[ext];
  const zip = await JSZip.loadAsync(bytes);
  const names = Object.keys(zip.files)
    .filter((n) => spec.match.test(n))
    // keep slide / sheet order natural: slide2 before slide10
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const chunks: string[] = [];
  for (const n of names) {
    const xml = await zip.files[n].async('string');
    chunks.push(stripMarkup(xml));
  }
  return chunks.filter(Boolean).join('\n\n');
}

/**
 * Turn any file into something a question generator can use:
 *  - PDFs and common images are kept as bytes, because Claude reads them directly.
 *  - Office documents, e-books, HTML and RTF are unpacked to plain text.
 *  - Anything else is sniffed: text in disguise is decoded, true binaries
 *    fall back to their readable strings.
 */
export async function extractFile(name: string, mimeType: string | undefined, bytes: Uint8Array): Promise<Extracted> {
  const ext = extensionOf(name);
  const mime = (mimeType || '').toLowerCase();

  if (ext === 'pdf' || mime === 'application/pdf') {
    if (bytes.length > MAX_NATIVE_BYTES) {
      throw new Error(`This PDF is ${formatBytes(bytes.length)}. Files up to ${formatBytes(MAX_NATIVE_BYTES)} are supported.`);
    }
    return {
      kind: 'pdf',
      mimeType: 'application/pdf',
      words: 0,
      detail: `PDF · ${formatBytes(bytes.length)}`,
      payload: { base64: toBase64(bytes), mediaType: 'application/pdf' },
    };
  }

  const imageType = IMAGE_TYPES[ext] || (Object.values(IMAGE_TYPES).includes(mime) ? mime : undefined);
  if (imageType) {
    if (bytes.length > 5 * 1024 * 1024) {
      throw new Error('Images must be under 5 MB. Try a smaller export or a screenshot.');
    }
    return {
      kind: 'image',
      mimeType: imageType,
      words: 0,
      detail: `Image · ${formatBytes(bytes.length)}`,
      payload: { base64: toBase64(bytes), mediaType: imageType },
    };
  }

  if (ZIP_DOCS[ext]) {
    try {
      const text = await extractZipDoc(bytes, ext);
      if (text.trim()) return textResult(text, mime || 'application/zip', ZIP_DOCS[ext].label, 'document');
    } catch {
      // fall through to generic sniffing
    }
  }

  if (ext === 'html' || ext === 'htm' || mime === 'text/html') {
    return textResult(stripMarkup(decodeUtf8(bytes)), 'text/html', 'Web page', 'document');
  }
  if (ext === 'rtf' || mime === 'application/rtf') {
    return textResult(stripRtf(decodeUtf8(bytes)), 'application/rtf', 'Rich text', 'document');
  }

  if (TEXT_EXT.has(ext) || mime.startsWith('text/') || mime.includes('json') || mime.includes('xml')) {
    return textResult(decodeUtf8(bytes), mime || 'text/plain', ext ? ext.toUpperCase() : 'Text');
  }

  // Unknown type: is it secretly text?
  if (printableRatio(bytes) > 0.95) {
    return textResult(decodeUtf8(bytes), mime || 'text/plain', 'Text');
  }

  const strings = printableStrings(bytes);
  const words = wordCount(strings);
  return {
    kind: 'binary',
    mimeType: mime || 'application/octet-stream',
    words,
    detail:
      words > 40
        ? `${ext ? ext.toUpperCase() : 'Binary'} · ${words.toLocaleString()} readable words`
        : `${ext ? ext.toUpperCase() : 'Binary'} · ${formatBytes(bytes.length)} · little readable text`,
    payload: { text: clampText(strings) },
  };
}
