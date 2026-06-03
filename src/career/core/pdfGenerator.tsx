/**
 * PDF Generator
 * Ported from cv-tailor/src/core/pdfGenerator.tsx
 * Uses react-pdf/renderer for in-memory PDF generation.
 */

import { pdf } from '@react-pdf/renderer';
import ResumeDocument from './resumeDocument';
import type { MasterResume } from './types';
import { parseRewrittenResume, mergeRewrittenIntoOriginal } from './resumeParser';

/**
 * Generate and trigger a browser download of the tailored PDF.
 */
export async function generateResumePDF(
  resumeText: string,
  filename: string,
  masterResume?: MasterResume
): Promise<void> {
  if (!masterResume) throw new Error('Master resume is required for PDF generation');

  const blob = await buildBlob(resumeText, masterResume);
  const safeName = filename || buildFilename(masterResume.name);
  triggerDownload(blob, safeName);
}

/**
 * Return the tailored PDF as a Blob (for upload, preview, etc.).
 */
export async function generateResumePDFBlob(
  resumeText: string,
  masterResume?: MasterResume
): Promise<Blob> {
  if (!masterResume) throw new Error('Master resume is required for PDF generation');
  return buildBlob(resumeText, masterResume);
}

/**
 * Build filename: FirstName_LastName_Tailored_CV.pdf
 */
export function buildFilename(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const formatted = parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join('_');
  return `${formatted}_Resume.pdf`;
}

async function buildBlob(resumeText: string, masterResume: MasterResume): Promise<Blob> {
  console.log('[PDFGenerator] Building PDF blob...');

  const parsed = parseRewrittenResume(resumeText);
  console.log('[PDFGenerator] Parsed sections:', {
    summary: parsed.summary ? parsed.summary.substring(0, 100) + '...' : '(none)',
    experiences: parsed.experiences.length,
    projects: parsed.projects.length,
    skills: parsed.skills.length,
  });

  const merged = mergeRewrittenIntoOriginal(masterResume, parsed);

  const instance = pdf(<ResumeDocument resume={merged} />);
  const blob = await instance.toBlob();
  console.log('[PDFGenerator] ✅ PDF blob generated, size:', blob.size, 'bytes');
  return blob;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
