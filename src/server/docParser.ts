import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import mammoth from 'mammoth';
import { extractText, getDocumentProxy } from 'unpdf';
import {
  detectGarbledFontEncoding,
  normalizeExtractedText,
} from '../utils/textNormalize.ts';

export { normalizeExtractedText };

const nodeRequire = createRequire(import.meta.url);

function toPdfJsFactoryDirUrl(dirPath: string): string {
  // unpdf / pdfjs-dist getFactoryUrlProp strictly requires a trailing forward slash ('/'),
  // even on Windows where path.sep is '\\', while NodeBinaryDataFactory reads via fs/promises.readFile.
  return `${dirPath.replace(/\\/g, '/').replace(/\/+$/, '')}/`;
}

function resolvePdfJsAssetOptions(): Record<string, unknown> {
  const candidates: string[] = [];
  try {
    const pkgPath = nodeRequire.resolve('pdfjs-dist/package.json');
    candidates.push(path.dirname(pkgPath));
  } catch {
    // Fallback to workspace node_modules lookup
  }
  candidates.push(path.resolve(process.cwd(), 'node_modules', 'pdfjs-dist'));

  for (const dir of candidates) {
    const standardFontsDir = path.join(dir, 'standard_fonts');
    if (fs.existsSync(standardFontsDir)) {
      const cmapsDir = path.join(dir, 'cmaps');
      const wasmDir = path.join(dir, 'wasm');
      return {
        useSystemFonts: false,
        useWorkerFetch: false,
        standardFontDataUrl: toPdfJsFactoryDirUrl(standardFontsDir),
        ...(fs.existsSync(cmapsDir)
          ? { cMapUrl: toPdfJsFactoryDirUrl(cmapsDir), cMapPacked: true }
          : {}),
        ...(fs.existsSync(wasmDir)
          ? { wasmUrl: toPdfJsFactoryDirUrl(wasmDir) }
          : {}),
        verbosity: 0,
      };
    }
  }

  return {
    useSystemFonts: true,
    verbosity: 0,
  };
}

const PDFJS_ASSET_OPTIONS = resolvePdfJsAssetOptions();

export class DocumentValidationError extends Error {
  public readonly code:
    | 'UNSUPPORTED_FILE_TYPE'
    | 'FILE_TOO_LARGE'
    | 'EMPTY_DOCUMENT'
    | 'CORRUPTED_DOCUMENT'
    | 'SCANNED_PDF_UNREADABLE';

  constructor(
    code:
      | 'UNSUPPORTED_FILE_TYPE'
      | 'FILE_TOO_LARGE'
      | 'EMPTY_DOCUMENT'
      | 'CORRUPTED_DOCUMENT'
      | 'SCANNED_PDF_UNREADABLE',
    message: string
  ) {
    super(message);
    this.name = 'DocumentValidationError';
    this.code = code;
  }
}

export interface ParsedDocumentMetadata {
  text: string;
  fileType: 'pdf' | 'docx';
  wordCount: number;
  pageCount: number;
  isMultiColumn?: boolean;
  structuralNotes: string[];
}

export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

interface PositionedGlyphRun {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LineFragment {
  text: string;
  xStart: number;
  xEnd: number;
  y: number;
  height: number;
}

function joinRunsIntoFragments(
  runs: PositionedGlyphRun[],
  maxIntraFragmentGapPt = 24
): LineFragment[] {
  if (runs.length === 0) return [];

  // Sort top-to-bottom (higher Y first in PDF coordinates), then left-to-right
  const sorted = [...runs].sort((a, b) => {
    if (Math.abs(b.y - a.y) > 3.2) return b.y - a.y;
    return a.x - b.x;
  });

  // Group into horizontal baselines first
  const baselineGroups: PositionedGlyphRun[][] = [];
  for (const run of sorted) {
    const tolerance = Math.max(3.2, run.height * 0.42);
    const matchingRow = baselineGroups.find(
      (group) => Math.abs(group[0].y - run.y) <= tolerance
    );
    if (matchingRow) {
      matchingRow.push(run);
    } else {
      baselineGroups.push([run]);
    }
  }

  const fragments: LineFragment[] = [];

  for (const row of baselineGroups) {
    row.sort((a, b) => a.x - b.x);
    let currentText = '';
    let xStart = row[0].x;
    let xEnd = row[0].x + Math.max(row[0].width, row[0].str.length * 4.2);
    let ySum = 0;
    let count = 0;
    let maxH = row[0].height;

    for (let i = 0; i < row.length; i++) {
      const item = row[i];
      const itemWidth = Math.max(item.width, item.str.length * 3.8);
      if (i === 0) {
        currentText = item.str;
        xStart = item.x;
        xEnd = item.x + itemWidth;
        ySum = item.y;
        count = 1;
        maxH = item.height;
        continue;
      }

      const gap = item.x - xEnd;
      if (gap > maxIntraFragmentGapPt) {
        // Commit previous fragment and start a new horizontal fragment on this baseline
        if (currentText.trim()) {
          fragments.push({
            text: currentText.trim(),
            xStart,
            xEnd,
            y: ySum / count,
            height: maxH,
          });
        }
        currentText = item.str;
        xStart = item.x;
        xEnd = item.x + itemWidth;
        ySum = item.y;
        count = 1;
        maxH = item.height;
      } else {
        const avgCharWidth = Math.max(2.5, item.height * 0.25);
        const needsSpace =
          gap > avgCharWidth &&
          !currentText.endsWith(' ') &&
          !currentText.endsWith('-') &&
          !item.str.startsWith(' ');
        currentText += (needsSpace ? ' ' : '') + item.str;
        xEnd = Math.max(xEnd, item.x + itemWidth);
        ySum += item.y;
        count++;
        maxH = Math.max(maxH, item.height);
      }
    }

    if (currentText.trim()) {
      fragments.push({
        text: currentText.trim(),
        xStart,
        xEnd,
        y: ySum / count,
        height: maxH,
      });
    }
  }

  return fragments;
}

function mergeFragmentsAsSingleColumn(fragments: LineFragment[]): string {
  if (fragments.length === 0) return '';
  const sorted = [...fragments].sort((a, b) => {
    if (Math.abs(b.y - a.y) > 3.5) return b.y - a.y;
    return a.xStart - b.xStart;
  });

  const rows: LineFragment[][] = [];
  for (const frag of sorted) {
    const lastRow = rows[rows.length - 1];
    if (lastRow && Math.abs(lastRow[0].y - frag.y) <= 3.8) {
      lastRow.push(frag);
    } else {
      rows.push([frag]);
    }
  }

  const lines: string[] = [];
  let prevY: number | null = null;
  let prevHeight = 11;

  for (const row of rows) {
    row.sort((a, b) => a.xStart - b.xStart);
    const rowY = row[0].y;
    if (prevY !== null && prevY - rowY > Math.max(16, prevHeight * 1.65)) {
      lines.push('');
    }
    const lineText = row.map((f) => f.text).join('  ');
    lines.push(lineText);
    prevY = rowY;
    prevHeight = row[0].height || 11;
  }

  return lines.join('\n');
}

function reconstructPageTextWithColumnDetection(
  runs: PositionedGlyphRun[],
  pageWidth: number
): { pageText: string; detectedMultiColumn: boolean } {
  const fragments = joinRunsIntoFragments(runs, 24);
  if (fragments.length === 0) {
    return { pageText: '', detectedMultiColumn: false };
  }

  // Test candidate vertical column gutters between 24% and 76% of page width
  const minGutterX = pageWidth * 0.24;
  const maxGutterX = pageWidth * 0.76;
  const stepPt = 10;

  let bestGutter: {
    x: number;
    leftFrags: LineFragment[];
    rightFrags: LineFragment[];
    spanningFrags: LineFragment[];
    score: number;
  } | null = null;

  for (let gx = minGutterX; gx <= maxGutterX; gx += stepPt) {
    const leftFrags: LineFragment[] = [];
    const rightFrags: LineFragment[] = [];
    const spanningFrags: LineFragment[] = [];

    for (const f of fragments) {
      if (f.xEnd <= gx + 4) {
        leftFrags.push(f);
      } else if (f.xStart >= gx - 4) {
        rightFrags.push(f);
      } else {
        spanningFrags.push(f);
      }
    }

    // Genuine multi-column resumes have multi-word prose/headings in BOTH columns
    // (as opposed to right-aligned 2-word dates like "May 2024" or "Jun 2023 – Sep 2023")
    const substantiveLeft = leftFrags.filter(
      (f) => f.text.length >= 14 || /^[A-Z][A-Z\s&/]{3,}$/.test(f.text)
    );
    const substantiveRight = rightFrags.filter(
      (f) =>
        (f.text.length >= 18 && !/^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{4})/i.test(f.text)) ||
        /^[A-Z][A-Z\s&/]{3,}$/.test(f.text)
    );

    if (substantiveLeft.length < 4 || substantiveRight.length < 4) {
      continue;
    }

    // Check vertical overlap between Left and Right columns
    const leftMinY = Math.min(...leftFrags.map((f) => f.y));
    const leftMaxY = Math.max(...leftFrags.map((f) => f.y));
    const rightMinY = Math.min(...rightFrags.map((f) => f.y));
    const rightMaxY = Math.max(...rightFrags.map((f) => f.y));

    const overlapTop = Math.min(leftMaxY, rightMaxY);
    const overlapBottom = Math.max(leftMinY, rightMinY);
    const overlapHeight = overlapTop - overlapBottom;

    if (overlapHeight < 90) {
      continue;
    }

    // Count spanning fragments that cross the gutter INSIDE the column overlap band
    const midBandSpanning = spanningFrags.filter(
      (f) => f.y <= overlapTop - 8 && f.y >= overlapBottom + 8
    );
    if (
      midBandSpanning.length >
      Math.max(1, Math.floor((leftFrags.length + rightFrags.length) * 0.12))
    ) {
      continue;
    }

    const score =
      Math.min(substantiveLeft.length, substantiveRight.length) * 10 -
      midBandSpanning.length * 25;

    if (!bestGutter || score > bestGutter.score) {
      bestGutter = {
        x: gx,
        leftFrags,
        rightFrags,
        spanningFrags,
        score,
      };
    }
  }

  if (!bestGutter) {
    return {
      pageText: mergeFragmentsAsSingleColumn(fragments),
      detectedMultiColumn: false,
    };
  }

  // Separate top full-width banner lines (above columns) from bottom full-width lines
  const columnTopY = Math.max(
    ...bestGutter.leftFrags.map((f) => f.y),
    ...bestGutter.rightFrags.map((f) => f.y)
  );
  const topBanner = bestGutter.spanningFrags.filter((f) => f.y >= columnTopY - 8);
  const bottomBanner = bestGutter.spanningFrags.filter((f) => f.y < columnTopY - 8);

  const sections: string[] = [];
  if (topBanner.length > 0) {
    sections.push(mergeFragmentsAsSingleColumn(topBanner));
  }
  sections.push(mergeFragmentsAsSingleColumn(bestGutter.leftFrags));
  sections.push(mergeFragmentsAsSingleColumn(bestGutter.rightFrags));
  if (bottomBanner.length > 0) {
    sections.push(mergeFragmentsAsSingleColumn(bottomBanner));
  }

  return {
    pageText: sections.filter(Boolean).join('\n\n'),
    detectedMultiColumn: true,
  };
}

function hasPdfMagicHeader(buffer: Buffer): boolean {
  if (buffer.length < 5) return false;
  const slice = buffer.subarray(0, Math.min(buffer.length, 1024)).toString('latin1');
  return slice.includes('%PDF-');
}

function hasZipDocxMagicHeader(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  return (
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07)
  );
}

export function validateUploadMetadata(
  buffer: Buffer | undefined,
  originalName: string
): 'pdf' | 'docx' {
  if (!buffer || buffer.length === 0) {
    throw new DocumentValidationError(
      'EMPTY_DOCUMENT',
      'The uploaded file is empty (0 bytes). Please upload a valid PDF or DOCX resume containing selectable text.'
    );
  }

  if (buffer.length > MAX_UPLOAD_SIZE_BYTES) {
    throw new DocumentValidationError(
      'FILE_TOO_LARGE',
      'File size exceeds the 10 MB maximum limit. Please upload a compact PDF or DOCX resume.'
    );
  }

  const lower = (originalName || '').toLowerCase().trim();
  if (!lower.endsWith('.pdf') && !lower.endsWith('.docx')) {
    throw new DocumentValidationError(
      'UNSUPPORTED_FILE_TYPE',
      'Unsupported file format. Only PDF (.pdf) and Microsoft Word (.docx) resumes are accepted.'
    );
  }

  if (lower.endsWith('.pdf')) {
    if (!hasPdfMagicHeader(buffer)) {
      throw new DocumentValidationError(
        'CORRUPTED_DOCUMENT',
        'Invalid or corrupted PDF file header. Please export a valid PDF directly from your word processor or Resume Builder.'
      );
    }
    return 'pdf';
  }

  if (!hasZipDocxMagicHeader(buffer)) {
    throw new DocumentValidationError(
      'CORRUPTED_DOCUMENT',
      'Invalid or corrupted DOCX file header. Ensure the file is a genuine Microsoft Word (.docx) document.'
    );
  }
  return 'docx';
}

export async function parseResumeBuffer(
  buffer: Buffer,
  originalName: string
): Promise<ParsedDocumentMetadata> {
  const fileType = validateUploadMetadata(buffer, originalName);
  const structuralNotes: string[] = [];

  if (fileType === 'pdf') {
    let rawText = '';
    let totalPages = 0;
    let isMultiColumn = false;

    let pdfProxy: Awaited<ReturnType<typeof getDocumentProxy>> | null = null;
    try {
      const uint8 = new Uint8Array(buffer);
      try {
        pdfProxy = await getDocumentProxy(uint8, PDFJS_ASSET_OPTIONS);
      } catch {
        pdfProxy = await getDocumentProxy(new Uint8Array(buffer), {
          useSystemFonts: true,
          verbosity: 0,
        });
      }
      totalPages = Number(pdfProxy.numPages) || 1;

      const reconstructedPages: string[] = [];
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const page = await pdfProxy.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1 });
        const content = await page.getTextContent();

        const runs: PositionedGlyphRun[] = [];
        for (const rawItem of content.items as any[]) {
          if (typeof rawItem?.str !== 'string') continue;
          const str = rawItem.str.replace(/\u0000/g, '');
          if (!str.trim()) continue;
          const tr = Array.isArray(rawItem.transform)
            ? rawItem.transform
            : [1, 0, 0, 1, 0, 0];
          const x = Number(tr[4]) || 0;
          const y = Number(tr[5]) || 0;
          const fontH =
            Number(rawItem.height) ||
            Math.hypot(Number(tr[2]) || 0, Number(tr[3]) || 0) ||
            10;
          const width = Number(rawItem.width) || str.length * (fontH * 0.45);
          runs.push({
            str,
            x,
            y,
            width,
            height: fontH,
          });
        }

        const { pageText, detectedMultiColumn } =
          reconstructPageTextWithColumnDetection(runs, viewport.width || 612);
        if (detectedMultiColumn) {
          isMultiColumn = true;
        }
        if (pageText.trim()) {
          reconstructedPages.push(pageText.trim());
        }
      }

      rawText = reconstructedPages.join('\n\n');

      // Fallback to unpdf extractText if custom coordinate stream yielded empty on unusual XForm streams
      if (!rawText.trim()) {
        const fallback = await extractText(pdfProxy, { mergePages: true });
        rawText =
          typeof fallback.text === 'string'
            ? fallback.text
            : String(fallback.text || '');
      }
    } catch (err) {
      if (err instanceof DocumentValidationError) {
        throw err;
      }
      throw new DocumentValidationError(
        'CORRUPTED_DOCUMENT',
        'Unable to read this PDF file. It appears damaged, password-protected, or invalid—no fake score was generated.'
      );
    } finally {
      if (pdfProxy) {
        await pdfProxy.loadingTask.destroy().catch(() => {});
      }
    }

    const cleaned = normalizeExtractedText(rawText);
    const alphaNumericChars = (cleaned.match(/[a-zA-Z0-9]/g) || []).length;

    if (cleaned.length === 0 || alphaNumericChars === 0) {
      if (buffer.length > 1200 && totalPages >= 1) {
        const rawLatin = buffer.toString('latin1');
        const hasEmbeddedImageStream =
          rawLatin.includes('/Subtype /Image') ||
          rawLatin.includes('/Subtype/Image') ||
          rawLatin.includes('/DCTDecode') ||
          rawLatin.includes('/FlateDecode');

        if (hasEmbeddedImageStream && rawLatin.includes('/Image')) {
          throw new DocumentValidationError(
            'SCANNED_PDF_UNREADABLE',
            'This PDF contains scanned images or flattened graphics with no readable text layer. Standard ATS software cannot read image-only PDFs—please upload a text-based PDF or Word (.docx) file.'
          );
        }
      }

      throw new DocumentValidationError(
        'EMPTY_DOCUMENT',
        'No readable text could be extracted from this PDF. Please upload a text-selectable PDF or Word (.docx) resume.'
      );
    }

    if (detectGarbledFontEncoding(cleaned)) {
      throw new DocumentValidationError(
        'SCANNED_PDF_UNREADABLE',
        'The text layer in this PDF uses unreadable or corrupted font encoding (garbled characters). Please re-export your resume using standard fonts (such as Arial, Calibri, or Times New Roman) or upload a DOCX file.'
      );
    }

    if (alphaNumericChars < 20) {
      throw new DocumentValidationError(
        'SCANNED_PDF_UNREADABLE',
        'Fewer than 20 readable characters were found in this PDF. It appears to be an image scan or outlined graphic unreadable by ATS software.'
      );
    }

    structuralNotes.push(`PDF Page Count: ${totalPages}`);
    if (isMultiColumn) {
      structuralNotes.push(
        'Multi-column PDF layout detected. While RESUMIQ reconstructed both columns accurately, many legacy employer ATS parsers can scramble multi-column layouts.'
      );
    }
    if (totalPages > 2) {
      structuralNotes.push(
        `Document spans ${totalPages} pages; standard resumes typically parse and review best at 1–2 pages.`
      );
    }

    const wordCount = cleaned.split(/\s+/).filter(Boolean).length;

    return {
      text: cleaned.slice(0, 65000),
      fileType: 'pdf',
      wordCount,
      pageCount: totalPages,
      isMultiColumn,
      structuralNotes,
    };
  }

  // DOCX extraction
  let cleaned = '';
  let html = '';
  try {
    const [rawResult, htmlResult] = await Promise.all([
      mammoth.extractRawText({ buffer }),
      mammoth.convertToHtml({ buffer }),
    ]);
    cleaned = normalizeExtractedText(rawResult.value || '');
    html = htmlResult.value || '';
  } catch {
    throw new DocumentValidationError(
      'CORRUPTED_DOCUMENT',
      'Unable to read this Word (.docx) document. The file appears corrupted or invalid—no fake score was generated.'
    );
  }

  const alphaNumericChars = (cleaned.match(/[a-zA-Z0-9]/g) || []).length;
  if (cleaned.length === 0 || alphaNumericChars === 0) {
    if (html.includes('<img')) {
      throw new DocumentValidationError(
        'SCANNED_PDF_UNREADABLE',
        'This DOCX contains only embedded images without selectable text. Please upload a text-based resume.'
      );
    }
    throw new DocumentValidationError(
      'EMPTY_DOCUMENT',
      'The uploaded DOCX document contains no readable text. Please upload a populated resume.'
    );
  }

  if (detectGarbledFontEncoding(cleaned) || alphaNumericChars < 20) {
    throw new DocumentValidationError(
      'EMPTY_DOCUMENT',
      'The uploaded DOCX document contains fewer than 20 readable characters and cannot be reliably scored.'
    );
  }

  const hasTables = html.includes('<table');
  if (hasTables) {
    structuralNotes.push(
      'DOCX contains layout tables (<table>). Multi-column tables in Word files can scramble chronological reading order in older ATS parsers.'
    );
  }
  if (html.includes('<img')) {
    structuralNotes.push(
      'DOCX contains embedded images; profile photos or graphic icons are ignored by ATS parsers.'
    );
  }

  const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
  const estimatedPages = Math.max(1, Math.ceil(wordCount / 450));

  return {
    text: cleaned.slice(0, 65000),
    fileType: 'docx',
    wordCount,
    pageCount: estimatedPages,
    isMultiColumn: hasTables,
    structuralNotes,
  };
}
