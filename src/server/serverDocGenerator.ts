import { Packer } from 'docx';
import type { ResumeDocumentData } from '../types.ts';
import {
  createResumeDocxInstance,
  createResumeJsPdfInstance,
} from '../utils/exportResume.ts';

export async function generateServerPdfBuffer(
  data: ResumeDocumentData,
  templateSlug = 'modern-tech'
): Promise<Buffer> {
  const doc = createResumeJsPdfInstance(data, templateSlug);
  const arrayBuf = doc.output('arraybuffer');
  return Buffer.from(arrayBuf);
}

export async function generateServerDocxBuffer(
  data: ResumeDocumentData,
  templateSlug = 'modern-tech'
): Promise<Buffer> {
  const docxDoc = createResumeDocxInstance(data, templateSlug);
  const buffer = await Packer.toBuffer(docxDoc);
  return Buffer.from(buffer);
}
