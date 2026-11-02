export function normalizeExtractedText(raw: string): string {
  return (raw || '')
    .replace(/\u0000/g, '')
    .replace(/\uFB00/g, 'ff')
    .replace(/\uFB01/g, 'fi')
    .replace(/\uFB02/g, 'fl')
    .replace(/\uFB03/g, 'ffi')
    .replace(/\uFB04/g, 'ffl')
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\uFEFF]/g, ' ')
    .replace(/[▪◦●➢❖▸►]/g, '•')
    .replace(/[–—]/g, '–')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

export function detectGarbledFontEncoding(text: string): boolean {
  const nonSpace = text.replace(/\s+/g, '');
  if (nonSpace.length < 20) return false;

  const garbledMatches =
    nonSpace.match(/[\uE000-\uF8FF\uFFFD\u0001-\u0008\u000E-\u001F\u007F]/g) || [];
  if (garbledMatches.length / nonSpace.length > 0.15) {
    return true;
  }

  const readableAlphaNum = (nonSpace.match(/[a-zA-Z0-9]/g) || []).length;
  if (readableAlphaNum / nonSpace.length < 0.35) {
    return true;
  }

  return false;
}
