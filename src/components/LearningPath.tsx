import React from 'react';
import { Check } from 'lucide-react';
import { isRtlLearningContent } from '../services/languageConfig';
import { LearningStage } from '../types/harness';
import { cn } from '../utils/cn';

interface LearningPathProps {
  stages: LearningStage[];
  currentIndex: number;
  maxUnlockedIndex: number;
  answers: Record<string, number>;
  tutorLanguage?: import('../types/harness').TutorLanguage;
  darijaScript?: import('../types/harness').DarijaScript;
  onSelectStage: (index: number) => void;
}

export const LearningPath: React.FC<LearningPathProps> = ({
  stages,
  currentIndex,
  maxUnlockedIndex,
  answers,
  tutorLanguage,
  darijaScript,
  onSelectStage,
}) => {
  const isRtl = isRtlLearningContent(tutorLanguage, darijaScript);
  const contentDir = isRtl ? 'rtl' : 'ltr';

  const totalQuestions = stages.reduce((sum, s) => sum + s.questions.length, 0);
  const totalAnswered = stages.reduce(
    (sum, s) => sum + s.questions.filter((q) => answers[q.id] !== undefined).length,
    0
  );
  const completedStages = stages.filter(
    (s) =>
      s.questions.length > 0 &&
      s.questions.every((q) => answers[q.id] !== undefined)
  ).length;

  if (stages.length <= 1) return null;

  return (
    <nav aria-label="Learning path" className="animate-fade-slide">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-[11px] font-semibold tracking-[0.08em] text-[#96938A] uppercase dark:text-[#77776F]">
          Your path from scratch
        </h2>
        <span className="font-mono-code shrink-0 text-[11px] text-[#96938A] dark:text-[#77776F]">
          {completedStages}/{stages.length} steps · {totalAnswered}/{totalQuestions} Q
        </span>
      </div>

      <ol className="overflow-hidden rounded-xl border border-[#E3E1D9] bg-white dark:border-[#2A2A27] dark:bg-[#171716]">
        {stages.map((stage, idx) => {
          const answered = stage.questions.filter((q) => answers[q.id] !== undefined).length;
          const correct = stage.questions.filter(
            (q) => answers[q.id] !== undefined && answers[q.id] === q.correctIndex
          ).length;
          const isCurrent = idx === currentIndex;
          const isDone = stage.questions.length > 0 && answered === stage.questions.length;
          const isLocked = idx > maxUnlockedIndex;

          return (
            <li key={stage.id} className={cn(idx > 0 && 'border-t border-[#ECEAE3] dark:border-[#242422]')}>
              <button
                type="button"
                disabled={isLocked}
                onClick={() => onSelectStage(idx)}
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                  isCurrent
                    ? 'bg-[#F4F3EE] dark:bg-[#1E1E1B]'
                    : 'hover:bg-[#F7F7F3] dark:hover:bg-[#1B1B19]'
                )}
              >
                <span
                  className={cn(
                    'font-mono-code flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium',
                    isDone
                      ? 'bg-[#3F7D52] text-white dark:bg-[#4ADE80] dark:text-[#0B1F12]'
                      : isCurrent
                        ? 'bg-[#292824] text-white dark:bg-[#EDEDEB] dark:text-[#171716]'
                        : 'bg-[#ECEAE3] text-[#85837C] dark:bg-[#2B2B27] dark:text-[#85857D]'
                  )}
                >
                  {isDone ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                </span>

                <span className="min-w-0 flex-1">
                  <span
                    dir={contentDir}
                    className={cn(
                      'block truncate text-[13px]',
                      isCurrent
                        ? 'font-semibold text-[#292824] dark:text-[#EDEDEB]'
                        : 'text-[#5F5C55] dark:text-[#C5C5BC]',
                      isRtl && 'text-right'
                    )}
                  >
                    {stage.title}
                  </span>
                </span>

                <span className="font-mono-code shrink-0 text-[11px] text-[#96938A] dark:text-[#77776F]">
                  {answered > 0 ? `${correct}/${answered}✓` : `${stage.questions.length}Q`}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
