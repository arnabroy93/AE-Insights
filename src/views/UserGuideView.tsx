import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Download,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  Lightbulb,
  ChevronRight,
  FileText,
  Monitor,
} from 'lucide-react';
import {
  USER_GUIDE_SECTIONS,
  FAQ_ITEMS,
  renderGuideScreenshotCanvas,
  generateUserGuidePdf,
  GuideScreenshotId,
} from '../utils/userGuidePdf';

export const UserGuideView: React.FC = () => {
  const [downloading, setDownloading] = useState(false);
  const [screenshots, setScreenshots] = useState<Record<string, string>>({});
  const [activeSectionId, setActiveSectionId] = useState<string>('all');

  useEffect(() => {
    const map: Record<string, string> = {};
    USER_GUIDE_SECTIONS.forEach((sec) => {
      map[sec.screenshotId] = renderGuideScreenshotCanvas(sec.screenshotId as GuideScreenshotId);
    });
    setScreenshots(map);
  }, []);

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      await generateUserGuidePdf();
    } catch (err) {
      console.error('Failed to generate User Guide PDF:', err);
    } finally {
      setDownloading(false);
    }
  };

  const visibleSections =
    activeSectionId === 'all'
      ? USER_GUIDE_SECTIONS
      : USER_GUIDE_SECTIONS.filter((s) => s.id === activeSectionId);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Hero Banner with Prominent PDF Download Button */}
      <div className="bg-gradient-to-r from-[#008C95] via-[#00747C] to-[#005F66] rounded-2xl p-6 sm:p-8 text-white shadow-md border border-teal-600/30">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2.5 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-teal-50 text-xs font-bold tracking-wide uppercase">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Official External User Guide · Simple English Edition</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
              AE INSIGHT — Complete Visual User Guide
            </h1>
            <p className="text-sm text-teal-50/95 leading-relaxed">
              Written in plain, everyday English for anyone using the platform—even if you are new to dashboards.
              Follow the numbered red circles <span className="font-bold text-white">(1, 2, 3, 4)</span> on each
              screenshot below, or download the complete illustrated 10-page PDF manual to share with your team.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
            <button
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="flex items-center justify-center gap-2.5 px-6 py-3.5 bg-white text-[#005F66] hover:bg-teal-50 disabled:opacity-60 rounded-xl font-extrabold text-sm shadow-lg transition-all cursor-pointer"
            >
              <Download className="w-5 h-5 text-[#008C95]" />
              <span>{downloading ? 'Generating Illustrated PDF...' : 'Download User Guide (PDF)'}</span>
            </button>
            <div className="text-[11px] text-teal-100 text-center">
              Includes all 8 annotated screenshots, step-by-step guides &amp; FAQ
            </div>
          </div>
        </div>
      </div>

      {/* Section Quick Filter Pills */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">
          Jump to Section:
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveSectionId('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeSectionId === 'all'
                ? 'bg-[#008C95] text-white shadow-2xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Show All Sections (1–8)
          </button>
          {USER_GUIDE_SECTIONS.map((sec) => (
            <button
              key={sec.id}
              onClick={() => setActiveSectionId(sec.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeSectionId === sec.id
                  ? 'bg-[#008C95] text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {sec.number}: {sec.title.split(':')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Main Illustrated Sections */}
      <div className="space-y-8">
        {visibleSections.map((sec) => (
          <section
            key={sec.id}
            id={sec.id}
            className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden"
          >
            {/* Section Header Bar */}
            <div className="bg-slate-900 text-white px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <span className="inline-block text-[11px] font-extrabold uppercase tracking-wider text-teal-400">
                  {sec.number}
                </span>
                <h2 className="text-lg sm:text-xl font-bold leading-snug">{sec.title}</h2>
                <p className="text-xs text-slate-300 mt-0.5">{sec.subtitle}</p>
              </div>
              <button
                onClick={handleDownloadPdf}
                disabled={downloading}
                className="self-start sm:self-center flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0"
              >
                <FileText className="w-3.5 h-3.5 text-teal-400" />
                <span>Save PDF</span>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Plain English Summary Box */}
              <div className="bg-[#E6F4F5]/60 border border-[#008C95]/30 rounded-xl p-4">
                <div className="text-xs font-extrabold text-[#005F66] uppercase tracking-wider mb-1">
                  What is this in simple terms?
                </div>
                <p className="text-sm text-slate-800 whitespace-pre-line leading-relaxed">
                  {sec.whatIsIt}
                </p>
              </div>

              {/* Annotated Screenshot Display */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <Monitor className="w-4 h-4 text-[#008C95]" />
                  <span>Visual Screen Guide (Match the red numbers on the image with the guide below):</span>
                </div>
                {screenshots[sec.screenshotId] && (
                  <div className="rounded-xl overflow-hidden border-2 border-slate-200 shadow-sm bg-slate-50">
                    <img
                      src={screenshots[sec.screenshotId]}
                      alt={sec.title}
                      className="w-full h-auto block"
                    />
                  </div>
                )}
                <p className="text-xs text-slate-500 italic text-center">{sec.screenshotCaption}</p>
              </div>

              {/* Live Platform Reference Screenshots for Section 5 (Hiring Concerns & Challenges) */}
              {sec.id === 'hiring-and-challenges' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/70 space-y-2">
                    <div className="text-xs font-bold text-slate-800">
                      Actual Screen Preview: Hiring Concerns Table
                    </div>
                    <img
                      src="/assets/aistudio/image_8168f35c.png"
                      alt="Hiring Concerns Table Screenshot"
                      className="w-full h-auto rounded-lg border border-slate-200"
                    />
                  </div>
                  <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/70 space-y-2">
                    <div className="text-xs font-bold text-slate-800">
                      Actual Screen Preview: Challenges &amp; Impact Table
                    </div>
                    <img
                      src="/assets/aistudio/image_008938b2.png"
                      alt="Challenges and Impact Table Screenshot"
                      className="w-full h-auto rounded-lg border border-slate-200"
                    />
                  </div>
                </div>
              )}

              {/* Two-Column Breakdown: Numbered Callouts + Step-by-Step Instructions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                {/* Left: Numbered Red Circle Callouts */}
                <div className="space-y-3">
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-rose-600 text-white text-xs flex items-center justify-center font-bold">
                      #
                    </span>
                    <span>What the Numbered Circles Mean</span>
                  </h3>
                  <div className="space-y-2.5">
                    {sec.callouts.map((c) => (
                      <div
                        key={c.badge}
                        className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80"
                      >
                        <div className="w-7 h-7 rounded-full bg-rose-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                          {c.badge}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">{c.title}</div>
                          <div className="text-xs text-slate-600 mt-0.5 leading-relaxed">{c.text}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Step-by-Step How to Use */}
                <div className="space-y-3 flex flex-col justify-between">
                  <div className="space-y-3">
                    <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#008C95]" />
                      <span>Step-by-Step Instructions</span>
                    </h3>
                    <ol className="space-y-2.5">
                      {sec.steps.map((step, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-3 p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs"
                        >
                          <span className="px-2 py-0.5 rounded-md bg-[#008C95] text-white font-bold text-[11px] shrink-0 mt-0.5">
                            Step {i + 1}
                          </span>
                          <span className="text-xs text-slate-700 leading-relaxed font-medium">
                            {step}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* Pro Tip Box */}
                  <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-200 flex items-start gap-2.5 mt-4">
                    <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-900 leading-relaxed">
                      <span className="font-bold">Helpful Tip: </span>
                      {sec.proTip}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>

      {/* Frequently Asked Questions (FAQ) & Quick Reference */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <HelpCircle className="w-5 h-5 text-[#008C95]" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Frequently Asked Questions (FAQ) for External Users
              </h2>
              <p className="text-xs text-slate-500">
                Quick answers to the most common questions when using AE INSIGHT
              </p>
            </div>
          </div>

          <button
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="flex items-center gap-2 px-4 py-2 bg-[#008C95] hover:bg-[#00747C] text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{downloading ? 'Generating PDF...' : 'Download Full User Guide PDF'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FAQ_ITEMS.map((item, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5"
            >
              <div className="text-xs font-bold text-slate-900 flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-[#008C95] shrink-0 mt-0.5" />
                <span>{item.q}</span>
              </div>
              <p className="text-xs text-slate-600 pl-6 leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
