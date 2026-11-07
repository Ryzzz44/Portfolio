const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Base64-encode bytes without relying on btoa (not present on every JS engine). */
export function toBase64(bytes: Uint8Array): string {
  let out = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const a = bytes[i];
    const b = i + 1 < len ? bytes[i + 1] : 0;
    const c = i + 2 < len ? bytes[i + 2] : 0;
    const n = (a << 16) | (b << 8) | c;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < len ? B64[(n >> 6) & 63] : '=';
    out += i + 2 < len ? B64[n & 63] : '=';
  }
  return out;
}

export function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

/**
 * Share of a sample that looks like readable text. Used to decide whether an
 * unknown file is text in disguise (logs, configs, source code without a known
 * extension) or genuinely binary.
 */
export function printableRatio(bytes: Uint8Array, sample = 4096): number {
  const n = Math.min(bytes.length, sample);
  if (n === 0) return 0;
  let ok = 0;
  for (let i = 0; i < n; i++) {
    const c = bytes[i];
    if (c === 9 || c === 10 || c === 13 || (c >= 32 && c < 127) || c >= 128) ok++;
    if (c === 0) return 0; // NUL bytes almost never appear in text
  }
  return ok / n;
}

/** Pull runs of printable ASCII out of a binary blob, like the Unix `strings` tool. */
export function printableStrings(bytes: Uint8Array, minLen = 5, maxChars = 200_000): string {
  const parts: string[] = [];
  let run = '';
  let total = 0;
  for (let i = 0; i < bytes.length && total < maxChars; i++) {
    const c = bytes[i];
    if (c >= 32 && c < 127) {
      run += String.fromCharCode(c);
    } else {
      if (run.length >= minLen && /[a-zA-Z]{3}/.test(run)) {
        parts.push(run);
        total += run.length;
      }
      run = '';
    }
  }
  if (run.length >= minLen) parts.push(run);
  return parts.join('\n');
}

export function wordCount(text: string): number {
  const m = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu);
  return m ? m.length : 0;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
