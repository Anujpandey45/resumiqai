import React from 'react';
import type { ResumeDocumentData, ResumeSectionKey } from '../types.ts';
import { DEFAULT_SECTION_ORDER } from '../data/demoSamples.ts';

interface ResumeLivePreviewProps {
  data: ResumeDocumentData;
  templateSlug: string;
}

const SECTION_LABELS: Record<ResumeSectionKey, string> = {
  objective: 'Professional Summary',
  education: 'Education',
  skills: 'Technical Skills',
  internships: 'Work Experience & Internships',
  projects: 'Projects',
  certifications: 'Certifications',
  achievements: 'Achievements',
};

export function ResumeLivePreview({ data, templateSlug }: ResumeLivePreviewProps) {
  const isClassic = templateSlug === 'classic-executive';
  const isModern = templateSlug === 'modern-tech';
  const isMinimalist = templateSlug === 'minimalist-academic';
  const isCompact = templateSlug === 'compact-ats';

  const order = data.sectionOrder?.length ? data.sectionOrder : DEFAULT_SECTION_ORDER;
  const contactItems = [
    data.location,
    data.phone,
    data.email,
    data.websiteOrLinkedin,
  ].filter((item) => item && item.trim().length > 0);

  const headingClasses = isModern
    ? 'text-[11px] font-bold tracking-wider uppercase text-[#1E3A8A] border-b-2 border-[#1E3A8A]/25 pb-1 mb-2.5'
    : isMinimalist
      ? 'text-xs font-semibold tracking-wide text-slate-900 border-b border-slate-200 pb-1 mb-2.5'
      : isCompact
        ? 'text-[10px] font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-0.5 mb-1.5'
        : 'text-[11px] font-bold uppercase tracking-widest text-slate-900 border-b border-slate-300 pb-1 mb-2';

  const bodySize = isCompact ? 'text-[11px] leading-[1.42]' : 'text-[12px] leading-[1.55]';
  const sectionSpacing = isCompact ? 'mb-3' : 'mb-4.5';

  return (
    <div
      className={`w-full bg-white text-slate-900 border border-slate-200 rounded-lg ${
        isCompact ? 'p-6' : 'p-8 sm:p-10'
      } ${isClassic || isMinimalist ? 'font-sans' : 'font-sans'}`}
    >
      {/* Header */}
      <div
        className={`${
          isClassic ? 'text-center' : 'text-left'
        } pb-3.5 mb-4 border-b ${
          isModern ? 'border-[#1E3A8A]' : 'border-slate-300'
        }`}
      >
        <h1
          className={`${
            isCompact ? 'text-xl' : 'text-2xl'
          } font-bold tracking-tight ${
            isModern ? 'text-[#0F172A]' : 'text-slate-900'
          }`}
        >
          {data.fullName.trim() || 'Your Full Name'}
        </h1>
        <p className="mt-1 text-[11px] text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {contactItems.length > 0 ? (
            <>
              {data.location.trim() && <span>{data.location.trim()}</span>}
              {data.location.trim() &&
                (data.phone.trim() ||
                  data.email.trim() ||
                  data.websiteOrLinkedin.trim()) && <span aria-hidden="true">·</span>}
              {data.phone.trim() && <span>{data.phone.trim()}</span>}
              {data.phone.trim() &&
                (data.email.trim() || data.websiteOrLinkedin.trim()) && (
                  <span aria-hidden="true">·</span>
                )}
              {data.email.trim() && (
                <a
                  href={`mailto:${data.email.trim()}`}
                  className="text-[#1E3A8A] underline underline-offset-2"
                >
                  {data.email.trim()}
                </a>
              )}
              {data.email.trim() && data.websiteOrLinkedin.trim() && (
                <span aria-hidden="true">·</span>
              )}
              {data.websiteOrLinkedin.trim() && (
                <a
                  href={
                    /^https?:\/\//i.test(data.websiteOrLinkedin.trim())
                      ? data.websiteOrLinkedin.trim()
                      : `https://${data.websiteOrLinkedin.trim()}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#1E3A8A] underline underline-offset-2"
                >
                  {data.websiteOrLinkedin.trim()}
                </a>
              )}
            </>
          ) : (
            <span>City, Country · +1 (555) 000-0000 · you@email.com</span>
          )}
        </p>
      </div>

      {/* Ordered Sections */}
      {order.map((section) => {
        if (section === 'objective') {
          if (!data.careerObjective.trim()) return null;
          return (
            <section key={section} className={sectionSpacing}>
              <h2 className={headingClasses}>{SECTION_LABELS.objective}</h2>
              <p className={`${bodySize} text-slate-700`}>{data.careerObjective}</p>
            </section>
          );
        }

        if (section === 'education') {
          const validEdu = data.education.filter(
            (e) => e.institution.trim() || e.degree.trim() || e.field.trim()
          );
          if (validEdu.length === 0) return null;
          return (
            <section key={section} className={sectionSpacing}>
              <h2 className={headingClasses}>{SECTION_LABELS.education}</h2>
              <div className="space-y-2.5">
                {validEdu.map((edu) => (
                  <div key={edu.id}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={`${bodySize} font-semibold text-slate-900`}>
                        {edu.institution || 'University / Institution'}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono tabular-nums shrink-0">
                        {edu.graduationDate}
                      </span>
                    </div>
                    <p className={`${bodySize} text-slate-700`}>
                      {[
                        [edu.degree, edu.field].filter(Boolean).join(' in '),
                        edu.gpaOrHonors,
                        edu.location,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          );
        }

        if (section === 'skills') {
          const validSkills = data.technicalSkills.filter((s) => s.items.trim());
          if (validSkills.length === 0) return null;
          return (
            <section key={section} className={sectionSpacing}>
              <h2 className={headingClasses}>{SECTION_LABELS.skills}</h2>
              <div className="space-y-1">
                {validSkills.map((group) => (
                  <p key={group.id} className={`${bodySize} text-slate-700`}>
                    {group.category.trim() && (
                      <span className="font-semibold text-slate-900">
                        {group.category.trim()}:{' '}
                      </span>
                    )}
                    <span>{group.items}</span>
                  </p>
                ))}
              </div>
            </section>
          );
        }

        if (section === 'internships') {
          const validExp = data.internships.filter(
            (e) => e.role.trim() || e.company.trim()
          );
          if (validExp.length === 0) return null;
          return (
            <section key={section} className={sectionSpacing}>
              <h2 className={headingClasses}>{SECTION_LABELS.internships}</h2>
              <div className="space-y-3">
                {validExp.map((exp) => (
                  <div key={exp.id}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={`${bodySize} font-semibold text-slate-900`}>
                        {[exp.role, exp.company].filter(Boolean).join(' — ')}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono tabular-nums shrink-0">
                        {[exp.startDate, exp.endDate].filter(Boolean).join(' – ')}
                      </span>
                    </div>
                    {(exp.type || exp.location) && (
                      <p className="text-[11px] text-slate-500">
                        {[exp.type, exp.location].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    <ul className="mt-1 list-disc pl-4 space-y-0.5">
                      {exp.bullets
                        .filter((b) => b.trim())
                        .map((bullet, idx) => (
                          <li key={idx} className={`${bodySize} text-slate-700`}>
                            {bullet}
                          </li>
                        ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          );
        }

        if (section === 'projects') {
          const validProj = data.projects.filter((p) => p.name.trim());
          if (validProj.length === 0) return null;
          return (
            <section key={section} className={sectionSpacing}>
              <h2 className={headingClasses}>{SECTION_LABELS.projects}</h2>
              <div className="space-y-3">
                {validProj.map((proj) => (
                  <div key={proj.id}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={`${bodySize} font-semibold text-slate-900`}>
                        {proj.name}
                        {proj.techStack && (
                          <span className="font-normal text-slate-600">
                            {' '}
                            · {proj.techStack}
                          </span>
                        )}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono tabular-nums shrink-0">
                        {proj.date}
                      </span>
                    </div>
                    {proj.link.trim() && (
                      <p className="text-[11px]">
                        <a
                          href={
                            /^https?:\/\//i.test(proj.link.trim())
                              ? proj.link.trim()
                              : `https://${proj.link.trim()}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#1E3A8A] underline underline-offset-2"
                        >
                          {proj.link.trim()}
                        </a>
                      </p>
                    )}
                    <ul className="mt-1 list-disc pl-4 space-y-0.5">
                      {proj.bullets
                        .filter((b) => b.trim())
                        .map((bullet, idx) => (
                          <li key={idx} className={`${bodySize} text-slate-700`}>
                            {bullet}
                          </li>
                        ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          );
        }

        if (section === 'certifications') {
          const validCerts = data.certifications.filter((c) => c.name.trim());
          if (validCerts.length === 0) return null;
          return (
            <section key={section} className={sectionSpacing}>
              <h2 className={headingClasses}>{SECTION_LABELS.certifications}</h2>
              <ul className="list-disc pl-4 space-y-1">
                {validCerts.map((cert) => (
                  <li key={cert.id} className={`${bodySize} text-slate-700`}>
                    <span className="font-semibold text-slate-900">{cert.name}</span>
                    {cert.issuer && ` — ${cert.issuer}`}
                    {cert.date && ` (${cert.date})`}
                    {cert.credentialId && ` · ID: ${cert.credentialId}`}
                  </li>
                ))}
              </ul>
            </section>
          );
        }

        if (section === 'achievements') {
          const validAch = data.achievements.filter((a) => a.title.trim());
          if (validAch.length === 0) return null;
          return (
            <section key={section} className={sectionSpacing}>
              <h2 className={headingClasses}>{SECTION_LABELS.achievements}</h2>
              <ul className="list-disc pl-4 space-y-1">
                {validAch.map((ach) => (
                  <li key={ach.id} className={`${bodySize} text-slate-700`}>
                    <span className="font-semibold text-slate-900">{ach.title}</span>
                    {ach.issuerOrContext && ` — ${ach.issuerOrContext}`}
                    {ach.date && ` (${ach.date})`}
                    {ach.description && `: ${ach.description}`}
                  </li>
                ))}
              </ul>
            </section>
          );
        }

        return null;
      })}
    </div>
  );
}
