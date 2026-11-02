import { jsPDF } from 'jspdf';
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  Packer,
  Paragraph,
  TabStopPosition,
  TabStopType,
  TextRun,
} from 'docx';
import type { ResumeDocumentData, ResumeSectionKey } from '../types.ts';
import { DEFAULT_SECTION_ORDER } from '../data/demoSamples.ts';

export function sanitizeResumeFileName(title: string): string {
  const cleaned = (title || '')
    .replace(/[^a-z0-9-_]+/gi, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || 'RESUMIQ_Resume';
}

function normalizeExternalUrl(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

const SECTION_TITLES: Record<ResumeSectionKey, string> = {
  objective: 'PROFESSIONAL SUMMARY',
  education: 'EDUCATION',
  skills: 'TECHNICAL SKILLS',
  internships: 'WORK EXPERIENCE & INTERNSHIPS',
  projects: 'PROJECTS',
  certifications: 'CERTIFICATIONS',
  achievements: 'ACHIEVEMENTS & AWARDS',
};

export function createResumeJsPdfInstance(
  data: ResumeDocumentData,
  templateSlug = 'classic-executive'
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const isCompact = templateSlug === 'compact-ats';
  const isModern = templateSlug === 'modern-tech';
  const isMinimalist = templateSlug === 'minimalist-academic';

  const marginX = isCompact ? 38 : 48;
  const contentWidth = pageWidth - marginX * 2;
  let cursorY = isCompact ? 42 : 52;

  const primaryFont =
    isMinimalist || templateSlug === 'classic-executive' ? 'times' : 'helvetica';
  const accentColor: [number, number, number] = isModern
    ? [30, 58, 138]
    : isMinimalist
      ? [30, 41, 59]
      : [15, 23, 42];

  const ensureSpace = (neededHeight: number) => {
    if (cursorY + neededHeight > pageHeight - 44) {
      doc.addPage();
      cursorY = 48;
    }
  };

  // Header — Name
  const headerAlign = templateSlug === 'classic-executive' ? 'center' : 'left';
  const headerX = headerAlign === 'center' ? pageWidth / 2 : marginX;

  doc.setFont(primaryFont, 'bold');
  doc.setFontSize(isCompact ? 18 : 22);
  doc.setTextColor(...accentColor);
  doc.text(data.fullName?.trim() || 'Candidate Name', headerX, cursorY, {
    align: headerAlign,
  });
  cursorY += isCompact ? 15 : 18;

  // Contact Row with Clickable mailto: & https:// Portfolio Links
  type ContactToken = { text: string; url?: string };
  const contactTokens: ContactToken[] = [];
  if (data.location?.trim()) {
    contactTokens.push({ text: data.location.trim() });
  }
  if (data.phone?.trim()) {
    const digits = data.phone.replace(/[^+\d]/g, '');
    contactTokens.push({
      text: data.phone.trim(),
      url: digits.length >= 7 ? `tel:${digits}` : undefined,
    });
  }
  if (data.email?.trim()) {
    contactTokens.push({
      text: data.email.trim(),
      url: `mailto:${data.email.trim()}`,
    });
  }
  if (data.websiteOrLinkedin?.trim()) {
    contactTokens.push({
      text: data.websiteOrLinkedin.trim(),
      url: normalizeExternalUrl(data.websiteOrLinkedin.trim()),
    });
  }

  if (contactTokens.length > 0) {
    const contactFontSize = isCompact ? 9 : 9.5;
    doc.setFont(primaryFont, 'normal');
    doc.setFontSize(contactFontSize);
    const separator = '  |  ';
    const sepWidth = doc.getTextWidth(separator);

    // Group tokens into wrapped lines that fit within contentWidth
    const rows: ContactToken[][] = [[]];
    let currentWidth = 0;

    for (const tok of contactTokens) {
      const tokW = doc.getTextWidth(tok.text);
      const needed = rows[rows.length - 1].length > 0 ? sepWidth + tokW : tokW;
      if (currentWidth + needed > contentWidth && rows[rows.length - 1].length > 0) {
        rows.push([tok]);
        currentWidth = tokW;
      } else {
        rows[rows.length - 1].push(tok);
        currentWidth += needed;
      }
    }

    for (const row of rows) {
      const rowTotalWidth = row.reduce(
        (sum, tok, idx) => sum + doc.getTextWidth(tok.text) + (idx > 0 ? sepWidth : 0),
        0
      );
      let xPos =
        headerAlign === 'center'
          ? Math.max(marginX, (pageWidth - rowTotalWidth) / 2)
          : marginX;

      for (let i = 0; i < row.length; i++) {
        if (i > 0) {
          doc.setTextColor(100, 116, 139);
          doc.text(separator, xPos, cursorY);
          xPos += sepWidth;
        }
        const tok = row[i];
        const tokW = doc.getTextWidth(tok.text);
        if (tok.url) {
          doc.setTextColor(30, 58, 138);
          doc.textWithLink(tok.text, xPos, cursorY, { url: tok.url });
        } else {
          doc.setTextColor(71, 85, 105);
          doc.text(tok.text, xPos, cursorY);
        }
        xPos += tokW;
      }
      cursorY += 13;
    }
    cursorY += 3;
  }

  doc.setDrawColor(...accentColor);
  doc.setLineWidth(isModern ? 1.1 : 0.6);
  doc.line(marginX, cursorY, pageWidth - marginX, cursorY);
  cursorY += isCompact ? 14 : 18;

  const renderSectionHeader = (title: string) => {
    ensureSpace(28);
    doc.setFont(primaryFont, 'bold');
    doc.setFontSize(isCompact ? 9.5 : 10.5);
    doc.setTextColor(...accentColor);
    doc.text(title, marginX, cursorY);
    cursorY += 4;
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.5);
    doc.line(marginX, cursorY, pageWidth - marginX, cursorY);
    cursorY += isCompact ? 11 : 13;
  };

  const renderBodyLines = (
    text: string,
    indent = 0,
    fontSize = isCompact ? 9.2 : 9.8
  ) => {
    doc.setFont(primaryFont, 'normal');
    doc.setFontSize(fontSize);
    doc.setTextColor(30, 41, 59);
    const lines = doc.splitTextToSize(text, contentWidth - indent);
    for (const line of lines) {
      ensureSpace(13);
      doc.text(line, marginX + indent, cursorY);
      cursorY += isCompact ? 11.5 : 13;
    }
  };

  const renderBullet = (bullet: string) => {
    if (!bullet || !bullet.trim()) return;
    doc.setFont(primaryFont, 'normal');
    doc.setFontSize(isCompact ? 9.2 : 9.8);
    doc.setTextColor(30, 41, 59);
    const lines = doc.splitTextToSize(bullet.trim(), contentWidth - 14);
    ensureSpace(13);
    doc.text('•', marginX + 2, cursorY);
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) ensureSpace(13);
      doc.text(lines[i], marginX + 14, cursorY);
      cursorY += isCompact ? 11.5 : 13;
    }
  };

  const order = data.sectionOrder?.length ? data.sectionOrder : DEFAULT_SECTION_ORDER;

  for (const section of order) {
    if (section === 'objective' && data.careerObjective?.trim()) {
      renderSectionHeader(SECTION_TITLES.objective);
      renderBodyLines(data.careerObjective.trim());
      cursorY += isCompact ? 6 : 9;
    }

    if (section === 'education') {
      const validEdu = (data.education || []).filter(
        (e) => e.institution?.trim() || e.degree?.trim()
      );
      if (validEdu.length > 0) {
        renderSectionHeader(SECTION_TITLES.education);
        for (const edu of validEdu) {
          ensureSpace(26);
          doc.setFont(primaryFont, 'bold');
          doc.setFontSize(isCompact ? 9.8 : 10.5);
          doc.setTextColor(15, 23, 42);
          doc.text(edu.institution || 'Institution', marginX, cursorY);
          if (edu.graduationDate) {
            doc.setFont(primaryFont, 'normal');
            doc.setFontSize(isCompact ? 9 : 9.5);
            doc.text(edu.graduationDate, pageWidth - marginX, cursorY, {
              align: 'right',
            });
          }
          cursorY += 12;

          const subLine = [
            [edu.degree, edu.field].filter(Boolean).join(' in '),
            edu.gpaOrHonors,
            edu.location,
          ]
            .filter(Boolean)
            .join(' · ');
          if (subLine) {
            renderBodyLines(subLine);
          }
          cursorY += 4;
        }
        cursorY += 4;
      }
    }

    if (section === 'skills') {
      const validSkills = (data.technicalSkills || []).filter((s) => s.items?.trim());
      if (validSkills.length > 0) {
        renderSectionHeader(SECTION_TITLES.skills);
        for (const group of validSkills) {
          ensureSpace(14);
          const prefix = group.category?.trim() ? `${group.category.trim()}: ` : '';
          doc.setFont(primaryFont, 'bold');
          doc.setFontSize(isCompact ? 9.2 : 9.8);
          doc.setTextColor(15, 23, 42);
          const prefixWidth = prefix ? doc.getTextWidth(prefix) : 0;
          if (prefix) {
            doc.text(prefix, marginX, cursorY);
          }
          doc.setFont(primaryFont, 'normal');
          doc.setTextColor(30, 41, 59);
          const wrappedItems = doc.splitTextToSize(
            group.items.trim(),
            Math.max(120, contentWidth - prefixWidth)
          );
          if (wrappedItems.length > 0) {
            doc.text(wrappedItems[0], marginX + prefixWidth, cursorY);
            cursorY += isCompact ? 11.5 : 13;
            for (let i = 1; i < wrappedItems.length; i++) {
              ensureSpace(13);
              doc.text(wrappedItems[i], marginX, cursorY);
              cursorY += isCompact ? 11.5 : 13;
            }
          }
        }
        cursorY += 6;
      }
    }

    if (section === 'internships') {
      const validExp = (data.internships || []).filter(
        (e) => e.role?.trim() || e.company?.trim()
      );
      if (validExp.length > 0) {
        renderSectionHeader(SECTION_TITLES.internships);
        for (const exp of validExp) {
          ensureSpace(28);
          doc.setFont(primaryFont, 'bold');
          doc.setFontSize(isCompact ? 9.8 : 10.5);
          doc.setTextColor(15, 23, 42);
          const roleTitle = [exp.role, exp.company].filter(Boolean).join(' — ');
          doc.text(roleTitle, marginX, cursorY);

          const dateRange = [exp.startDate, exp.endDate].filter(Boolean).join(' – ');
          if (dateRange) {
            doc.setFont(primaryFont, 'normal');
            doc.setFontSize(isCompact ? 9 : 9.5);
            doc.text(dateRange, pageWidth - marginX, cursorY, { align: 'right' });
          }
          cursorY += 12;

          const meta = [exp.type, exp.location].filter(Boolean).join(' · ');
          if (meta) {
            doc.setFont(primaryFont, 'italic');
            doc.setFontSize(isCompact ? 8.8 : 9.2);
            doc.setTextColor(71, 85, 105);
            doc.text(meta, marginX, cursorY);
            cursorY += 12;
          }

          for (const b of exp.bullets || []) {
            renderBullet(b);
          }
          cursorY += 5;
        }
        cursorY += 3;
      }
    }

    if (section === 'projects') {
      const validProjects = (data.projects || []).filter((p) => p.name?.trim());
      if (validProjects.length > 0) {
        renderSectionHeader(SECTION_TITLES.projects);
        for (const proj of validProjects) {
          ensureSpace(26);
          doc.setFont(primaryFont, 'bold');
          doc.setFontSize(isCompact ? 9.8 : 10.5);
          doc.setTextColor(15, 23, 42);
          const headerText = proj.techStack?.trim()
            ? `${proj.name.trim()} (${proj.techStack.trim()})`
            : proj.name.trim();
          doc.text(headerText, marginX, cursorY);
          if (proj.date?.trim()) {
            doc.setFont(primaryFont, 'normal');
            doc.setFontSize(isCompact ? 9 : 9.5);
            doc.text(proj.date.trim(), pageWidth - marginX, cursorY, {
              align: 'right',
            });
          }
          cursorY += 12;

          if (proj.link?.trim()) {
            doc.setFont(primaryFont, 'normal');
            doc.setFontSize(8.8);
            doc.setTextColor(30, 58, 138);
            doc.textWithLink(proj.link.trim(), marginX, cursorY, {
              url: normalizeExternalUrl(proj.link.trim()),
            });
            cursorY += 11;
          }

          for (const b of proj.bullets || []) {
            renderBullet(b);
          }
          cursorY += 5;
        }
        cursorY += 3;
      }
    }

    if (section === 'certifications') {
      const validCerts = (data.certifications || []).filter((c) => c.name?.trim());
      if (validCerts.length > 0) {
        renderSectionHeader(SECTION_TITLES.certifications);
        for (const cert of validCerts) {
          const line = [
            cert.name,
            cert.issuer ? `— ${cert.issuer}` : '',
            cert.date ? `(${cert.date})` : '',
            cert.credentialId ? `[ID: ${cert.credentialId}]` : '',
          ]
            .filter(Boolean)
            .join(' ');
          renderBullet(line);
        }
        cursorY += 6;
      }
    }

    if (section === 'achievements') {
      const validAch = (data.achievements || []).filter((a) => a.title?.trim());
      if (validAch.length > 0) {
        renderSectionHeader(SECTION_TITLES.achievements);
        for (const ach of validAch) {
          const summary = [
            ach.title,
            ach.issuerOrContext ? `— ${ach.issuerOrContext}` : '',
            ach.date ? `(${ach.date})` : '',
            ach.description ? `: ${ach.description}` : '',
          ]
            .filter(Boolean)
            .join(' ');
          renderBullet(summary);
        }
        cursorY += 6;
      }
    }
  }

  return doc;
}

export function createResumeDocxInstance(
  data: ResumeDocumentData,
  templateSlug = 'classic-executive'
): Document {
  const children: Paragraph[] = [];
  const isCentered = templateSlug === 'classic-executive';

  // Full Name
  children.push(
    new Paragraph({
      alignment: isCentered ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: data.fullName?.trim() || 'Candidate Name',
          bold: true,
          size: 36,
          color: '0F172A',
        }),
      ],
    })
  );

  // Contact Info with clickable mailto: and https:// links
  const contactChildren: (TextRun | ExternalHyperlink)[] = [];
  const pushSep = () => {
    if (contactChildren.length > 0) {
      contactChildren.push(
        new TextRun({
          text: '  |  ',
          size: 19,
          color: '64748B',
        })
      );
    }
  };

  if (data.location?.trim()) {
    pushSep();
    contactChildren.push(
      new TextRun({
        text: data.location.trim(),
        size: 19,
        color: '475569',
      })
    );
  }
  if (data.phone?.trim()) {
    pushSep();
    contactChildren.push(
      new TextRun({
        text: data.phone.trim(),
        size: 19,
        color: '475569',
      })
    );
  }
  if (data.email?.trim()) {
    pushSep();
    contactChildren.push(
      new ExternalHyperlink({
        link: `mailto:${data.email.trim()}`,
        children: [
          new TextRun({
            text: data.email.trim(),
            size: 19,
            color: '1E3A8A',
            underline: {},
          }),
        ],
      })
    );
  }
  if (data.websiteOrLinkedin?.trim()) {
    pushSep();
    contactChildren.push(
      new ExternalHyperlink({
        link: normalizeExternalUrl(data.websiteOrLinkedin.trim()),
        children: [
          new TextRun({
            text: data.websiteOrLinkedin.trim(),
            size: 19,
            color: '1E3A8A',
            underline: {},
          }),
        ],
      })
    );
  }

  if (contactChildren.length > 0) {
    children.push(
      new Paragraph({
        alignment: isCentered ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { after: 200 },
        border: {
          bottom: {
            color: 'CBD5E1',
            space: 6,
            style: BorderStyle.SINGLE,
            size: 6,
          },
        },
        children: contactChildren,
      })
    );
  }

  const pushHeading = (title: string) => {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 220, after: 100 },
        border: {
          bottom: {
            color: 'E2E8F0',
            space: 3,
            style: BorderStyle.SINGLE,
            size: 4,
          },
        },
        children: [
          new TextRun({
            text: title,
            bold: true,
            size: 21,
            color: '1E3A8A',
          }),
        ],
      })
    );
  };

  const order = data.sectionOrder?.length ? data.sectionOrder : DEFAULT_SECTION_ORDER;

  for (const section of order) {
    if (section === 'objective' && data.careerObjective?.trim()) {
      pushHeading(SECTION_TITLES.objective);
      children.push(
        new Paragraph({
          spacing: { after: 120 },
          children: [
            new TextRun({
              text: data.careerObjective.trim(),
              size: 20,
              color: '1E293B',
            }),
          ],
        })
      );
    }

    if (section === 'education') {
      const validEdu = (data.education || []).filter(
        (e) => e.institution?.trim() || e.degree?.trim()
      );
      if (validEdu.length > 0) {
        pushHeading(SECTION_TITLES.education);
        for (const edu of validEdu) {
          children.push(
            new Paragraph({
              tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
              spacing: { after: 40 },
              children: [
                new TextRun({
                  text: edu.institution || 'Institution',
                  bold: true,
                  size: 21,
                  color: '0F172A',
                }),
                new TextRun({
                  text: edu.graduationDate ? `\t${edu.graduationDate}` : '',
                  size: 19,
                  color: '475569',
                }),
              ],
            })
          );
          const subLine = [
            [edu.degree, edu.field].filter(Boolean).join(' in '),
            edu.gpaOrHonors,
            edu.location,
          ]
            .filter(Boolean)
            .join(' · ');
          if (subLine) {
            children.push(
              new Paragraph({
                spacing: { after: 100 },
                children: [new TextRun({ text: subLine, size: 19, color: '334155' })],
              })
            );
          }
        }
      }
    }

    if (section === 'skills') {
      const validSkills = (data.technicalSkills || []).filter((s) => s.items?.trim());
      if (validSkills.length > 0) {
        pushHeading(SECTION_TITLES.skills);
        for (const group of validSkills) {
          children.push(
            new Paragraph({
              spacing: { after: 70 },
              children: [
                ...(group.category?.trim()
                  ? [
                      new TextRun({
                        text: `${group.category.trim()}: `,
                        bold: true,
                        size: 20,
                        color: '0F172A',
                      }),
                    ]
                  : []),
                new TextRun({
                  text: group.items.trim(),
                  size: 20,
                  color: '1E293B',
                }),
              ],
            })
          );
        }
      }
    }

    if (section === 'internships') {
      const validExp = (data.internships || []).filter(
        (e) => e.role?.trim() || e.company?.trim()
      );
      if (validExp.length > 0) {
        pushHeading(SECTION_TITLES.internships);
        for (const exp of validExp) {
          const dateRange = [exp.startDate, exp.endDate].filter(Boolean).join(' – ');
          children.push(
            new Paragraph({
              tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
              spacing: { after: 30 },
              children: [
                new TextRun({
                  text: [exp.role, exp.company].filter(Boolean).join(' — '),
                  bold: true,
                  size: 21,
                  color: '0F172A',
                }),
                new TextRun({
                  text: dateRange ? `\t${dateRange}` : '',
                  size: 19,
                  color: '475569',
                }),
              ],
            })
          );
          const meta = [exp.type, exp.location].filter(Boolean).join(' · ');
          if (meta) {
            children.push(
              new Paragraph({
                spacing: { after: 50 },
                children: [
                  new TextRun({
                    text: meta,
                    italics: true,
                    size: 18,
                    color: '64748B',
                  }),
                ],
              })
            );
          }
          for (const b of (exp.bullets || []).filter((line) => line?.trim())) {
            children.push(
              new Paragraph({
                bullet: { level: 0 },
                spacing: { after: 45 },
                children: [new TextRun({ text: b.trim(), size: 20, color: '1E293B' })],
              })
            );
          }
        }
      }
    }

    if (section === 'projects') {
      const validProj = (data.projects || []).filter((p) => p.name?.trim());
      if (validProj.length > 0) {
        pushHeading(SECTION_TITLES.projects);
        for (const proj of validProj) {
          children.push(
            new Paragraph({
              tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
              spacing: { after: 40 },
              children: [
                new TextRun({
                  text: proj.techStack?.trim()
                    ? `${proj.name.trim()} (${proj.techStack.trim()})`
                    : proj.name.trim(),
                  bold: true,
                  size: 21,
                  color: '0F172A',
                }),
                new TextRun({
                  text: proj.date ? `\t${proj.date}` : '',
                  size: 19,
                  color: '475569',
                }),
              ],
            })
          );
          if (proj.link?.trim()) {
            children.push(
              new Paragraph({
                spacing: { after: 45 },
                children: [
                  new ExternalHyperlink({
                    link: normalizeExternalUrl(proj.link.trim()),
                    children: [
                      new TextRun({
                        text: proj.link.trim(),
                        size: 18,
                        color: '1E3A8A',
                        underline: {},
                      }),
                    ],
                  }),
                ],
              })
            );
          }
          for (const b of (proj.bullets || []).filter((line) => line?.trim())) {
            children.push(
              new Paragraph({
                bullet: { level: 0 },
                spacing: { after: 45 },
                children: [new TextRun({ text: b.trim(), size: 20, color: '1E293B' })],
              })
            );
          }
        }
      }
    }

    if (section === 'certifications') {
      const validCerts = (data.certifications || []).filter((c) => c.name?.trim());
      if (validCerts.length > 0) {
        pushHeading(SECTION_TITLES.certifications);
        for (const cert of validCerts) {
          const text = [
            cert.name,
            cert.issuer ? `— ${cert.issuer}` : '',
            cert.date ? `(${cert.date})` : '',
            cert.credentialId ? `[ID: ${cert.credentialId}]` : '',
          ]
            .filter(Boolean)
            .join(' ');
          children.push(
            new Paragraph({
              bullet: { level: 0 },
              spacing: { after: 45 },
              children: [new TextRun({ text, size: 20, color: '1E293B' })],
            })
          );
        }
      }
    }

    if (section === 'achievements') {
      const validAch = (data.achievements || []).filter((a) => a.title?.trim());
      if (validAch.length > 0) {
        pushHeading(SECTION_TITLES.achievements);
        for (const ach of validAch) {
          const text = [
            ach.title,
            ach.issuerOrContext ? `— ${ach.issuerOrContext}` : '',
            ach.date ? `(${ach.date})` : '',
            ach.description ? `: ${ach.description}` : '',
          ]
            .filter(Boolean)
            .join(' ');
          children.push(
            new Paragraph({
              bullet: { level: 0 },
              spacing: { after: 45 },
              children: [new TextRun({ text, size: 20, color: '1E293B' })],
            })
          );
        }
      }
    }
  }

  return new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });
}

export async function exportResumeAsPdf(
  data: ResumeDocumentData,
  templateSlug: string,
  fileTitle: string
): Promise<void> {
  const doc = createResumeJsPdfInstance(data, templateSlug);
  doc.save(`${sanitizeResumeFileName(fileTitle)}.pdf`);
}

export async function exportResumeAsDocx(
  data: ResumeDocumentData,
  templateSlug: string,
  fileTitle: string
): Promise<void> {
  const docxDoc = createResumeDocxInstance(data, templateSlug);
  const blob = await Packer.toBlob(docxDoc);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${sanitizeResumeFileName(fileTitle)}.docx`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
