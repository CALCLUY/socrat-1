import React, { useState } from 'react';
import { ArrowRight, Eye, EyeOff, ExternalLink } from 'lucide-react';
import {
  getTutorLanguageBadge,
  isRtlLearningContent,
} from '../services/languageConfig';
import { LearningStage, SessionSource, StudySession } from '../types/harness';

interface ExplanationCardProps {
  session: StudySession;
  stage: LearningStage;
  stageIndex: number;
  totalStages: number;
  onDrillTopic?: (topic: string) => void;
}

const SOURCE_LABELS: Record<SessionSource, string> = {
  curated: 'Curated lesson',
  'live-wiki': 'Wikipedia synthesis',
  document: 'Uploaded material',
  gemini: 'Google Gemini',
  'chatgpt-oauth': 'ChatGPT',
  'openai-api': 'OpenAI API',
};

export const ExplanationCard: React.FC<ExplanationCardProps> = ({
  session,
  stage,
  stageIndex,
  totalStages,
  onDrillTopic,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const explanation = stage.explanation;
  const isRtl = isRtlLearningContent(session.tutorLanguage, session.darijaScript);
  const contentDir = isRtl ? 'rtl' : 'ltr';
  const languageLabel =
    session.tutorLanguage && session.tutorLanguage !== 'en'
      ? getTutorLanguageBadge(session.tutorLanguage, session.darijaScript)
      : null;

  const materialLabel =
    session.materialNames && session.materialNames.length > 0
      ? `${session.materialKind === 'exam' ? 'Exam / Exercises' : 'Course'}: ${session.materialNames.join(', ')}`
      : null;

  const meta = [
    SOURCE_LABELS[session.source],
    session.modelUsed,
    session.depth,
    languageLabel,
    materialLabel,
  ].filter(Boolean);

  return (
    <section className="animate-fade-slide border-b border-[#E3E1D9] pb-8 dark:border-[#242422]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#96938A] dark:text-[#77776F]">
            {meta.map((item, index) => (
              <React.Fragment key={`${item}-${index}`}>
                {index > 0 && <span aria-hidden="true">·</span>}
                <span className={item === session.modelUsed ? 'font-mono-code' : undefined}>
                  {item}
                </span>
              </React.Fragment>
            ))}
            {session.sourceUrl && (
              <>
                <span aria-hidden="true">·</span>
                <a
                  href={session.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 transition-colors hover:text-[#292824] dark:hover:text-[#EDEDEB]"
                >
                  Reference
                  <ExternalLink className="h-3 w-3" />
                </a>
              </>
            )}
          </div>

          <h1
            dir={contentDir}
            className={`mt-2 font-editorial text-[32px] leading-[1.08] tracking-tight text-[#292824] sm:text-4xl dark:text-[#EDEDEB] ${
              isRtl ? 'text-right' : ''
            }`}
          >
            {session.title}
          </h1>

          {totalStages > 1 && (
            <div className="mt-3">
              <p className="text-[11px] font-medium tracking-[0.08em] text-[#5B55C9] uppercase dark:text-[#A5B4FC]">
                Step {stageIndex + 1} of {totalStages}
              </p>
              <h2
                dir={contentDir}
                className={`mt-0.5 text-lg leading-snug font-semibold text-[#292824] dark:text-[#EDEDEB] ${
                  isRtl ? 'text-right' : ''
                }`}
              >
                {stage.title}
              </h2>
              {stage.goal && (
                <p
                  dir={contentDir}
                  className={`mt-1 text-[13px] leading-relaxed text-[#73716B] dark:text-[#A1A09A] ${
                    isRtl ? 'text-right' : ''
                  }`}
                >
                  {stage.goal}
                </p>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="mt-1 inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-[#85837C] transition-colors hover:text-[#292824] dark:text-[#85857D] dark:hover:text-[#EDEDEB]"
          title="Hide explanation to practice active recall"
        >
          {collapsed ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{collapsed ? 'Show notes' : 'Hide notes'}</span>
        </button>
      </div>

      {!collapsed ? (
        <div className="mt-7 space-y-7">
          {stageIndex === 0 && session.studyRoadmap && session.studyRoadmap.length > 0 && (
            <div>
              <h2 className="mb-2.5 text-[11px] font-semibold tracking-[0.08em] text-[#96938A] uppercase dark:text-[#77776F]">
                {session.materialKind === 'exam'
                  ? 'What You Need to Learn for These Exercises'
                  : 'What You Need to Learn'}
              </h2>
              <ul className="divide-y divide-[#ECEAE3] dark:divide-[#242422]">
                {session.studyRoadmap.map((item, index) => (
                  <li
                    key={`${item.topic}-${index}`}
                    className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div
                      dir={contentDir}
                      className={`min-w-0 flex-1 ${isRtl ? 'text-right' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          aria-label={`${item.priority} priority`}
                          title={`${item.priority} priority`}
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                            item.priority === 'high'
                              ? 'bg-[#5B55C9] dark:bg-[#818CF8]'
                              : 'bg-[#C4C2B8] dark:bg-[#52524B]'
                          }`}
                        />
                        <span className="text-[13.5px] font-medium text-[#292824] dark:text-[#EDEDEB]">
                          {item.topic}
                        </span>
                      </div>
                      {item.why && (
                        <p className="mt-0.5 pl-3.5 text-xs leading-relaxed text-[#73716B] dark:text-[#94948B]">
                          {item.why}
                        </p>
                      )}
                    </div>
                    {onDrillTopic && (
                      <button
                        type="button"
                        onClick={() => onDrillTopic(item.topic)}
                        className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-[#5B55C9] transition-colors hover:bg-[#ECEAE3] dark:text-[#A5B4FC] dark:hover:bg-[#232320]"
                        title={`Study "${item.topic}" in its own session`}
                      >
                        <span>Drill</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h2 className="mb-2 text-[11px] font-semibold tracking-[0.08em] text-[#96938A] uppercase dark:text-[#77776F]">
              The Big Picture
            </h2>
            <p
              dir={contentDir}
              className={`text-[15px] leading-[1.75] text-[#33312C] dark:text-[#E7E7E2] ${
                isRtl ? 'text-right' : ''
              }`}
            >
              {explanation.bigPicture}
            </p>
          </div>

          {explanation.mechanics.length > 0 && (
            <div>
              <h2 className="mb-3 text-[11px] font-semibold tracking-[0.08em] text-[#96938A] uppercase dark:text-[#77776F]">
                How It Works
              </h2>
              <ol className="space-y-3">
                {explanation.mechanics.map((step, index) => (
                  <li key={index} className="flex gap-3 text-sm leading-[1.7] text-[#44423B] dark:text-[#D8D8D1]">
                    <span className="font-mono-code w-4 shrink-0 pt-0.5 text-[11px] text-[#A3A198] dark:text-[#68685F]">
                      {index + 1}
                    </span>
                    <span dir={contentDir} className={`flex-1 ${isRtl ? 'text-right' : ''}`}>
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {explanation.pitfall && (
            <div className="border-l-2 border-amber-400 pl-4 dark:border-amber-500/70">
              <h2 className="mb-1 text-[11px] font-semibold tracking-[0.08em] text-amber-700 uppercase dark:text-amber-300">
                Common Pitfall
              </h2>
              <p
                dir={contentDir}
                className={`text-[13px] leading-relaxed text-[#5B5648] dark:text-[#D6CDBB] ${
                  isRtl ? 'text-right' : ''
                }`}
              >
                {explanation.pitfall}
              </p>
            </div>
          )}

          {explanation.keyTerms.length > 0 && (
            <div>
              <h2 className="mb-3 text-[11px] font-semibold tracking-[0.08em] text-[#96938A] uppercase dark:text-[#77776F]">
                Key Concepts
              </h2>
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
                {explanation.keyTerms.map((item, index) => (
                  <div key={index} dir={contentDir} className={isRtl ? 'text-right' : ''}>
                    <dt className="text-xs font-semibold text-[#33312C] dark:text-[#EDEDEB]">
                      {item.term}
                    </dt>
                    <dd className="mt-1 text-xs leading-relaxed text-[#85837C] dark:text-[#94948B]">
                      {item.definition}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      ) : (
        <p className="mt-5 text-xs text-[#96938A] dark:text-[#77776F]">
          Notes hidden. Use the questions below for recall.
        </p>
      )}
    </section>
  );
};
