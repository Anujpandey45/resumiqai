import {
  detectGarbledFontEncoding,
  normalizeExtractedText,
} from './textNormalize.ts';

export interface ClientParsedDocument {
  text: string;
  fileType: 'pdf' | 'docx';
  wordCount: number;
  pageCount: number;
  isMultiColumn: boolean;
  structuralNotes: string[];
}

interface GlyphRun {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

function reconstructBrowserPageLines(runs: GlyphRun[], pageWidth: number): {
  pageText: string;
  detectedMultiColumn: boolean;
} {
  if (runs.length === 0) {
    return { pageText: '', detectedMultiColumn: false };
  }

  const sorted = [...runs].sort((a, b) => {
    if (Math.abs(b.y - a.y) > 3.2) return b.y - a.y;
    return a.x - b.x;
  });

  const rows: GlyphRun[][] = [];
  for (const run of sorted) {
    const tol = Math.max(3.2, run.height * 0.42);
    const match = rows.find((g) => Math.abs(g[0].y - run.y) <= tol);
    if (match) {
      match.push(run);
    } else {
      rows.push([run]);
    }
  }

  let splitRowCount = 0;
  const midMin = pageWidth * 0.25;
  const midMax = pageWidth * 0.72;

  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
    for (let i = 1; i < row.length; i++) {
      const prevEnd = row[i - 1].x + row[i - 1].width;
      const gap = row[i].x - prevEnd;
      if (gap > 26 && row[i].x >= midMin && row[i].x <= midMax) {
        splitRowCount++;
        break;
      }
    }
  }

  const detectedMultiColumn = rows.length >= 8 && splitRowCount >= 5;

  if (detectedMultiColumn) {
    const splitX = pageWidth * 0.44;
    const leftRuns = runs.filter((r) => r.x < splitX);
    const rightRuns = runs.filter((r) => r.x >= splitX);
    if (leftRuns.length >= 4 && rightRuns.length >= 4) {
      const leftText = joinSingleColumnRuns(leftRuns);
      const rightText = joinSingleColumnRuns(rightRuns);
      return {
        pageText: `${leftText}\n\n${rightText}`.trim(),
        detectedMultiColumn: true,
      };
    }
  }

  return {
    pageText: joinSingleColumnRuns(runs),
    detectedMultiColumn: false,
  };
}

function joinSingleColumnRuns(runs: GlyphRun[]): string {
  const sorted = [...runs].sort((a, b) => {
    if (Math.abs(b.y - a.y) > 3.2) return b.y - a.y;
    return a.x - b.x;
  });

  const rows: GlyphRun[][] = [];
  for (const run of sorted) {
    const tol = Math.max(3.2, run.height * 0.42);
    const match = rows.find((g) => Math.abs(g[0].y - run.y) <= tol);
    if (match) {
      match.push(run);
    } else {
      rows.push([run]);
    }
  }

  const lines: string[] = [];
  let prevY: number | null = null;
  let prevH = 11;

  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
    const rowY = row[0].y;
    if (prevY !== null && prevY - rowY > Math.max(16, prevH * 1.65)) {
      lines.push('');
    }

    let line = '';
    let prevEnd = row[0].x;
    for (let i = 0; i < row.length; i++) {
      const item = row[i];
      if (i === 0) {
        line = item.str;
        prevEnd = item.x + item.width;
        continue;
      }
      const gap = item.x - prevEnd;
      const needsSpace =
        gap > Math.max(2.2, item.height * 0.22) &&
        !line.endsWith(' ') &&
        !line.endsWith('-') &&
        !item.str.startsWith(' ');
      line += (needsSpace ? ' ' : '') + item.str;
      prevEnd = Math.max(prevEnd, item.x + item.width);
    }

    if (line.trim()) {
      lines.push(line.trim());
    }
    prevY = rowY;
    prevH = row[0].height || 11;
  }

  return lines.join('\n');
}

export async function parseResumeFileInBrowser(
  file: File
): Promise<ClientParsedDocument> {
  if (!file || file.size === 0) {
    throw new Error(
      'The selected file is empty (0 bytes). Please upload a valid PDF or DOCX resume.'
    );
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error(
      'File size exceeds the 10 MB maximum limit. Please upload a compact PDF or DOCX resume.'
    );
  }

  const lower = file.name.toLowerCase().trim();
  if (!lower.endsWith('.pdf') && !lower.endsWith('.docx')) {
    throw new Error(
      'Unsupported file format. Only PDF (.pdf) and Microsoft Word (.docx) resumes are accepted.'
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const structuralNotes: string[] = [];

  if (lower.endsWith('.pdf')) {
    // Check %PDF- magic bytes
    if (
      bytes.length < 5 ||
      bytes[0] !== 0x25 ||
      bytes[1] !== 0x50 ||
      bytes[2] !== 0x44 ||
      bytes[3] !== 0x46
    ) {
      throw new Error(
        'Invalid or corrupted PDF file header. Please export a valid PDF directly from your word processor or Resume Builder.'
      );
    }

    const pdfjs = await import('pdfjs-dist');
    if (pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString();
    }

    const loadingTask = pdfjs.getDocument({
      data: bytes,
      useSystemFonts: true,
      verbosity: 0,
    });

    let pdfDoc: any = null;
    try {
      pdfDoc = await loadingTask.promise;
      const totalPages = Number(pdfDoc.numPages) || 1;
      let isMultiColumn = false;
      const pagesText: string[] = [];

      for (let p = 1; p <= totalPages; p++) {
        const page = await pdfDoc.getPage(p);
        const viewport = page.getViewport({ scale: 1 });
        const content = await page.getTextContent();
        const runs: GlyphRun[] = [];

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
          runs.push({ str, x, y, width, height: fontH });
        }

        const { pageText, detectedMultiColumn } = reconstructBrowserPageLines(
          runs,
          viewport.width || 612
        );
        if (detectedMultiColumn) isMultiColumn = true;
        if (pageText.trim()) pagesText.push(pageText.trim());
      }

      const cleaned = normalizeExtractedText(pagesText.join('\n\n'));
      const alphaNumericChars = (cleaned.match(/[a-zA-Z0-9]/g) || []).length;

      if (cleaned.length === 0 || alphaNumericChars < 20) {
        throw new Error(
          'This PDF appears to be an image scan or flattened graphic with no selectable text layer. Standard ATS software cannot read image-only PDFs—please upload a text-based PDF or Word (.docx) file.'
        );
      }

      if (detectGarbledFontEncoding(cleaned)) {
        throw new Error(
          'The text layer in this PDF uses unreadable or corrupted font encoding. Please re-export your resume using standard fonts (Arial, Calibri, or Times New Roman) or upload a DOCX file.'
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
    } finally {
      if (pdfDoc?.destroy) {
        await pdfDoc.destroy().catch(() => {});
      }
    }
  }

  // DOCX validation (PK\x03\x04 ZIP header)
  if (
    bytes.length < 4 ||
    bytes[0] !== 0x50 ||
    bytes[1] !== 0x4b ||
    bytes[2] !== 0x03 ||
    bytes[3] !== 0x04
  ) {
    throw new Error(
      'Invalid or corrupted DOCX file header. Ensure the file is a genuine Microsoft Word (.docx) document.'
    );
  }

  const mammothMod = await import('mammoth');
  const mammothLib: any = mammothMod.default || mammothMod;
  const [rawResult, htmlResult] = await Promise.all([
    mammothLib.extractRawText({ arrayBuffer }),
    mammothLib.convertToHtml({ arrayBuffer }),
  ]);

  const cleaned = normalizeExtractedText(rawResult?.value || '');
  const html = String(htmlResult?.value || '');
  const alphaNumericChars = (cleaned.match(/[a-zA-Z0-9]/g) || []).length;

  if (cleaned.length === 0 || alphaNumericChars < 20) {
    throw new Error(
      'The uploaded DOCX document contains no readable selectable text. Please upload a text-based Word (.docx) or PDF resume.'
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
  const pageCount = Math.max(1, Math.ceil(wordCount / 450));

  return {
    text: cleaned.slice(0, 65000),
    fileType: 'docx',
    wordCount,
    pageCount,
    isMultiColumn: hasTables,
    structuralNotes,
  };
}
