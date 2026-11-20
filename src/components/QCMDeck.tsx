import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  Loader2,
  PlusCircle,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { isRtlLearningContent } from '../services/languageConfig';
import {
  DarijaScript,
  LearningStage,
  PendingRetry,
  QCMQuestion,
  QCMTag,
  TutorLanguage,
} from '../types/harness';

interface QCMDeckProps {
  questions: QCMQuestion[];
  answers: Record<string, number>;
  tutorLanguage?: TutorLanguage;
  darijaScript?: DarijaScript;
  relatedTopics: string[];
  isGeneratingMore: boolean;
  /** Stage context for the from-scratch path (optional, defaults to single-stage). */
  stageIndex?: number;
  totalStages?: number;
  stages?: LearningStage[];
  questionOffset?: number;
  totalQuestionCount?: number;
  pendingRetries?: PendingRetry[];
  remediatedQuestionIds?: string[];
  onSelectAnswer: (questionId: string, optionIndex: number) => void;
  onRetakeAll: () => void;
  onRetestMissed: (missedQuestions: QCMQuestion[]) => void;
  onGenerateMore: () => Promise<number>;
  onExploreTopic: (topic: string) => void;
  onNewTopic: () => void;
  onNextStage?: () => void;
  onPrevStage?: () => void;
  onReviewPrerequisite?: (question: QCMQuestion) => void;
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

const TAG_COLORS: Record<QCMTag, string> = {
  'Core Concept': 'text-[#5B55C9] dark:text-[#A5B4FC]',
  Mechanism: 'text-sky-700 dark:text-sky-300',
  Misconception: 'text-amber-700 dark:text-amber-300',
  Application: 'text-emerald-700 dark:text-emerald-300',
};

export const QCMDeck: React.FC<QCMDeckProps> = ({
  questions,
  answers,
  tutorLanguage,
  darijaScript,
  relatedTopics,
  isGeneratingMore,
  stageIndex = 0,
  totalStages = 1,
  stages = [],
  questionOffset = 0,
  totalQuestionCount,
  pendingRetries = [],
  remediatedQuestionIds = [],
  onSelectAnswer,
  onRetakeAll,
  onRetestMissed,
  onGenerateMore,
  onExploreTopic,
  onNewTopic,
  onNextStage,
  onPrevStage,
  onReviewPrerequisite,
}) => {
  const isRtl = isRtlLearningContent(tutorLanguage, darijaScript);
  const contentDir = isRtl ? 'rtl' : 'ltr';
  const globalTotal = totalQuestionCount ?? questions.length;
  const hasNextStage = onNextStage !== undefined && stageIndex < totalStages - 1;
  const [currentIndex, setCurrentIndex] = useState(() =>
    Math.max(
      0,
      questions.findIndex((question) => answers[question.id] === undefined),
    ),
  );
  const [showSummary, setShowSummary] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (currentIndex >= questions.length) {
      setCurrentIndex(Math.max(0, questions.length - 1));
    }
  }, [questions.length, currentIndex]);

  const currentQuestion = questions[Math.min(currentIndex, questions.length - 1)];
  const answeredCount = questions.filter((q) => answers[q.id] !== undefined).length;
  const correctCount = questions.filter(
    (q) => answers[q.id] !== undefined && answers[q.id] === q.correctIndex,
  ).length;
  const allAnswered = questions.length > 0 && answeredCount === questions.length;
  const isRemediated = (question: QCMQuestion) =>
    remediatedQuestionIds.includes(question.retryOf ?? question.id);
  const unresolvedWrongQuestions = questions.filter(
    (question) =>
      answers[question.id] !== undefined &&
      answers[question.id] !== question.correctIndex &&
      !isRemediated(question),
  );
  const hasUnresolvedWrong = unresolvedWrongQuestions.length > 0;
  const currentHasUnresolvedWrong = Boolean(
    currentQuestion &&
      answers[currentQuestion.id] !== undefined &&
      answers[currentQuestion.id] !== currentQuestion.correctIndex &&
      !isRemediated(currentQuestion),
  );
  const getPrerequisiteStageIndex = (question: QCMQuestion) => {
    const dependency = question.prerequisiteStageIndex;
    return typeof dependency === 'number' && dependency >= 0 && dependency < stageIndex
      ? dependency
      : Math.max(0, stageIndex - 1);
  };
  const getPrerequisiteStageTitle = (question: QCMQuestion) =>
    stages[getPrerequisiteStageIndex(question)]?.title ?? 'this foundation';

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (showSummary || !currentQuestion) return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      const target = e.target as HTMLElement | null;
      if (
        target?.closest(
          'input, textarea, select, [contenteditable="true"], #session-sidebar',
        )
      ) {
        return;
      }

      const selected = answers[currentQuestion.id];
      const key = e.key.toUpperCase();

      if (selected === undefined) {
        const keyMap: Record<string, number> = {
          '1': 0,
          '2': 1,
          '3': 2,
          '4': 3,
          '5': 4,
          '6': 5,
          A: 0,
          B: 1,
          C: 2,
          D: 3,
          E: 4,
          F: 5,
        };
        if (key in keyMap && keyMap[key] < currentQuestion.options.length) {
          e.preventDefault();
          onSelectAnswer(currentQuestion.id, keyMap[key]);
          return;
        }
      }

      // An incorrect answer must be reviewed before advancing to another question.
      if (currentHasUnresolvedWrong && (e.key === 'ArrowRight' || e.key === 'Enter')) return;

      if (e.key === 'Enter' && target?.closest('button, a')) return;

      if (e.key === 'ArrowRight' || (e.key === 'Enter' && selected !== undefined)) {
        e.preventDefault();
        if (currentIndex < questions.length - 1) {
          setCurrentIndex((i) => i + 1);
        } else if (allAnswered) {
          setShowSummary(true);
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentIndex > 0) setCurrentIndex((i) => i - 1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    showSummary,
    currentQuestion,
    currentHasUnresolvedWrong,
    answers,
    currentIndex,
    questions.length,
    allAnswered,
    onSelectAnswer,
  ]);

  if (questions.length === 0 || !currentQuestion) return null;

  if (showSummary) {
    const pct = Math.round((correctCount / questions.length) * 100);
    const missedQuestions = questions.filter((q) => answers[q.id] !== q.correctIndex);

    const tagStats: Partial<Record<QCMTag, { total: number; correct: number }>> = {};
    for (const q of questions) {
      const entry = tagStats[q.tag] || { total: 0, correct: 0 };
      entry.total += 1;
      if (answers[q.id] === q.correctIndex) entry.correct += 1;
      tagStats[q.tag] = entry;
    }

    return (
      <section className="animate-fade-slide">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#E3E1D9] pb-5 dark:border-[#242422]">
          <div>
            <p className="mb-1 text-[11px] text-[#96938A] dark:text-[#77776F]">
              {totalStages > 1 ? `Step ${stageIndex + 1} of ${totalStages} complete` : 'Session complete'}
            </p>
            <h2 className="font-editorial text-3xl text-[#292824] dark:text-[#EDEDEB]">
              {pct >= 80
                ? 'Strong conceptual grasp'
                : pct >= 50
                  ? 'Solid foundation, a few gaps'
                  : 'Good diagnostic run—worth another pass'}
            </h2>
          </div>
          <div className="text-right">
            <div className="font-mono-code text-xl text-[#292824] dark:text-[#EDEDEB]">
              {correctCount}/{questions.length}
            </div>
            <div className="text-[11px] text-[#96938A] dark:text-[#77776F]">{pct}% accuracy</div>
          </div>
        </div>

        <div className="mt-5">
          <h3 className="mb-1 text-[11px] font-semibold tracking-[0.08em] text-[#96938A] uppercase dark:text-[#77776F]">
            Mastery by Dimension
          </h3>
          <div>
            {(Object.entries(tagStats) as [QCMTag, { total: number; correct: number }][]).map(
              ([tag, stat]) => (
                <div
                  key={tag}
                  className="flex items-center justify-between border-b border-[#ECEAE3] py-2.5 last:border-0 dark:border-[#242422]"
                >
                  <span className={`text-xs font-medium ${TAG_COLORS[tag]}`}>{tag}</span>
                  <span className="font-mono-code text-xs text-[#5F5C55] dark:text-[#C5C5BC]">
                    {stat.correct}/{stat.total}
                  </span>
                </div>
              ),
            )}
          </div>
        </div>

        {missedQuestions.length > 0 && (
          <div className="mt-7">
            <h3 className="mb-3 text-[11px] font-semibold tracking-[0.08em] text-[#96938A] uppercase dark:text-[#77776F]">
              Concepts to Revisit ({missedQuestions.length})
            </h3>
            <div className="space-y-4">
              {missedQuestions.map((mq) => {
                const origIdx = questions.findIndex((q) => q.id === mq.id);
                return (
                  <div key={mq.id} className="border-l-2 border-[#D66A5E] pl-3 dark:border-[#B85448]">
                    <div className="flex items-start justify-between gap-3">
                      <p
                        dir={contentDir}
                        className={`flex-1 text-xs font-medium text-[#33312C] dark:text-[#EDEDEB] ${
                          isRtl ? 'text-right' : ''
                        }`}
                      >
                        {mq.prompt}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentIndex(origIdx >= 0 ? origIdx : 0);
                          setShowSummary(false);
                        }}
                        className="shrink-0 text-[11px] font-medium text-[#5B55C9] hover:underline dark:text-[#A5B4FC]"
                      >
                        Inspect Q{origIdx + 1}
                      </button>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-[#85837C] dark:text-[#94948B]">
                      <span className="font-medium text-[#3F7D52] dark:text-[#4ADE80]">Answer: </span>
                      <span dir={contentDir}>{mq.options[mq.correctIndex]}</span>
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#ECEAE3] pt-4 dark:border-[#242422]">
          {hasNextStage ? (
            <button
              type="button"
              onClick={onNextStage}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#292824] px-3 text-xs font-medium text-white transition-colors hover:bg-black dark:bg-[#EDEDEB] dark:text-[#171716] dark:hover:bg-white"
            >
              Continue to Step {stageIndex + 2}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            missedQuestions.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  onRetestMissed(missedQuestions);
                  setCurrentIndex(0);
                  setShowSummary(false);
                }}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#292824] px-3 text-xs font-medium text-white transition-colors hover:bg-black dark:bg-[#EDEDEB] dark:text-[#171716] dark:hover:bg-white"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Retest {missedQuestions.length} Missed
              </button>
            )
          )}

          {hasNextStage && missedQuestions.length > 0 && (
            <button
              type="button"
              onClick={() => {
                onRetestMissed(missedQuestions);
                setCurrentIndex(0);
                setShowSummary(false);
              }}
              className="inline-flex items-center gap-1.5 text-xs text-[#73716B] transition-colors hover:text-[#292824] dark:text-[#A1A09A] dark:hover:text-[#EDEDEB]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Retest {missedQuestions.length} Missed
            </button>
          )}

          <button
            type="button"
            disabled={isGeneratingMore}
            onClick={async () => {
              const prevLen = questions.length;
              const addedCount = await onGenerateMore();
              if (addedCount > 0) {
                setCurrentIndex(prevLen);
                setShowSummary(false);
              }
            }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5B55C9] transition-opacity hover:opacity-75 disabled:opacity-40 dark:text-[#A5B4FC]"
          >
            {isGeneratingMore ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <PlusCircle className="h-3.5 w-3.5" />
            )}
            Generate More QCMs
          </button>

          <button
            type="button"
            onClick={() => {
              onRetakeAll();
              setCurrentIndex(0);
              setShowSummary(false);
            }}
            className="text-xs text-[#73716B] transition-colors hover:text-[#292824] dark:text-[#A1A09A] dark:hover:text-[#EDEDEB]"
          >
            Retake Full Quiz
          </button>

          <button
            type="button"
            onClick={() => setShowSummary(false)}
            className="ml-auto text-xs text-[#73716B] transition-colors hover:text-[#292824] dark:text-[#A1A09A] dark:hover:text-[#EDEDEB]"
          >
            Back to Questions
          </button>
        </div>

        {relatedTopics.length > 0 && (
          <div className="mt-7">
            <h3 className="mb-2 text-[11px] font-semibold tracking-[0.08em] text-[#96938A] uppercase dark:text-[#77776F]">
              Continue Learning Next
            </h3>
            <div className="flex flex-wrap gap-x-1 gap-y-1">
              {relatedTopics.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => onExploreTopic(topic)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-[#5F5C55] transition-colors hover:bg-[#F0F0EA] hover:text-[#292824] dark:text-[#C5C5BC] dark:hover:bg-[#20201E] dark:hover:text-[#EDEDEB]"
                >
                  <span dir={contentDir}>{topic}</span>
                  <ChevronRight className="h-3 w-3" />
                </button>
              ))}
              <button
                type="button"
                onClick={onNewTopic}
                className="rounded-md px-2 py-1.5 text-xs text-[#96938A] transition-colors hover:bg-[#F0F0EA] hover:text-[#292824] dark:text-[#77776F] dark:hover:bg-[#20201E] dark:hover:text-[#EDEDEB]"
              >
                Ask custom topic…
              </button>
            </div>
          </div>
        )}
      </section>
    );
  }

  const chosenIndex = answers[currentQuestion.id];
  const isAnswered = chosenIndex !== undefined;
  const isCorrect = isAnswered && chosenIndex === currentQuestion.correctIndex;
  const progressPct = Math.round((answeredCount / questions.length) * 100);
  const optionCount = currentQuestion.options.length;

  return (
    <section className="animate-fade-slide">
      <div className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] text-[#96938A] dark:text-[#77776F]">
            <span className="font-medium tracking-[0.08em] uppercase">Comprehension Check</span>
            <span className="font-mono-code ml-2">
              Q{questionOffset + currentIndex + 1} of {globalTotal}
            </span>
          </p>

          <div className="flex flex-wrap items-center gap-1">
            {questions.map((q, idx) => {
              const ans = answers[q.id];
              const active = idx === currentIndex;
              let dotStyle =
                'text-[#A3A198] hover:bg-[#F0F0EA] dark:text-[#68685F] dark:hover:bg-[#20201E]';
              if (ans !== undefined) {
                dotStyle =
                  ans === q.correctIndex
                    ? 'text-[#3F7D52] dark:text-[#4ADE80]'
                    : 'text-[#B85448] dark:text-[#F87171]';
              }
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`font-mono-code flex h-5 w-5 items-center justify-center rounded text-[10px] transition-colors ${dotStyle} ${
                    active ? 'bg-[#ECEAE3] text-[#292824] dark:bg-[#2B2B27] dark:text-[#EDEDEB]' : ''
                  }`}
                  title={`Jump to Question ${idx + 1}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3 h-px w-full bg-[#E3E1D9] dark:bg-[#242422]">
          <div
            className="h-px bg-[#6D68D8] transition-all duration-300 dark:bg-[#818CF8]"
            style={{ width: `${Math.max(3, progressPct)}%` }}
          />
        </div>
      </div>

      <p className={`mb-2 text-[11px] font-medium ${TAG_COLORS[currentQuestion.tag]}`}>
        {currentQuestion.tag}
      </p>

      <h2
        dir={contentDir}
        className={`text-[17px] leading-snug font-semibold text-[#292824] sm:text-lg dark:text-[#EDEDEB] ${
          isRtl ? 'text-right' : ''
        }`}
      >
        {currentQuestion.prompt}
      </h2>

      <div className="mt-4 space-y-1.5">
        {currentQuestion.options.map((opt, idx) => {
          const isSelected = chosenIndex === idx;
          const isRightOption = idx === currentQuestion.correctIndex;

          let containerClass =
            'border-[#E3E1D9] bg-white hover:border-[#B9B7AD] hover:bg-[#FAFAF7] dark:border-[#2A2A27] dark:bg-[#171716] dark:hover:border-[#45453F] dark:hover:bg-[#1C1C1A]';
          let letterClass = 'text-[#96938A] dark:text-[#77776F]';

          if (isAnswered) {
            if (isRightOption) {
              containerClass =
                'border-[#8DBB9B] bg-[#F2F8F3] dark:border-[#3E6B4C] dark:bg-[#122417]';
              letterClass = 'text-[#3F7D52] dark:text-[#4ADE80]';
            } else if (isSelected && !isRightOption) {
              containerClass =
                'border-[#D99A91] bg-[#FBF3F1] dark:border-[#704139] dark:bg-[#2A1714]';
              letterClass = 'text-[#B85448] dark:text-[#F87171]';
            } else {
              containerClass = 'border-[#E3E1D9]/70 opacity-50 dark:border-[#2A2A27]/70';
            }
          }

          return (
            <button
              key={idx}
              type="button"
              data-testid="qcm-option"
              disabled={isAnswered}
              onClick={() => onSelectAnswer(currentQuestion.id, idx)}
              className={`flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${containerClass} ${
                !isAnswered ? 'cursor-pointer' : 'cursor-default'
              }`}
            >
              <span
                className={`font-mono-code w-4 shrink-0 pt-0.5 text-center text-[11px] font-medium ${letterClass}`}
              >
                {LETTERS[idx] ?? idx + 1}
              </span>
              <span
                dir={contentDir}
                className={`flex-1 text-sm leading-relaxed text-[#33312C] dark:text-[#EDEDEB] ${
                  isRtl ? 'text-right' : ''
                }`}
              >
                {opt}
              </span>
              {isAnswered && isRightOption && (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#3F7D52] dark:text-[#4ADE80]" />
              )}
              {isAnswered && isSelected && !isRightOption && (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#B85448] dark:text-[#F87171]" />
              )}
            </button>
          );
        })}
      </div>

      {isAnswered && (
        <div
          className={`animate-fade-slide mt-5 border-l-2 pl-4 ${
            isCorrect
              ? 'border-[#6FA982] dark:border-[#4ADE80]/70'
              : 'border-[#D66A5E] dark:border-[#F87171]/70'
          }`}
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <span
              className={`text-xs font-medium ${
                isCorrect ? 'text-[#3F7D52] dark:text-[#4ADE80]' : 'text-[#B85448] dark:text-[#F87171]'
              }`}
            >
              {isCorrect
                ? 'Correct'
                : `Not quite — ${LETTERS[currentQuestion.correctIndex] ?? currentQuestion.correctIndex + 1} is correct`}
            </span>
            {currentQuestion.deepNote && (
              <button
                type="button"
                onClick={() =>
                  setExpandedNotes((prev) => ({
                    ...prev,
                    [currentQuestion.id]: !prev[currentQuestion.id],
                  }))
                }
                className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-[#5B55C9] hover:underline dark:text-[#A5B4FC]"
              >
                <HelpCircle className="h-3 w-3" />
                {expandedNotes[currentQuestion.id] ? 'Hide note' : 'More'}
              </button>
            )}
          </div>

          <p
            dir={contentDir}
            className={`text-[13px] leading-relaxed text-[#5F5C55] dark:text-[#C5C5BC] ${
              isRtl ? 'text-right' : ''
            }`}
          >
            {currentQuestion.rationale}
          </p>

          {currentQuestion.deepNote && expandedNotes[currentQuestion.id] && (
            <p
              dir={contentDir}
              className={`mt-2 text-xs leading-relaxed text-[#85837C] dark:text-[#94948B] ${
                isRtl ? 'text-right' : ''
              }`}
            >
              {currentQuestion.deepNote}
            </p>
          )}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-[#ECEAE3] pt-3 dark:border-[#242422]">
        <button
          type="button"
          disabled={currentIndex === 0 && !onPrevStage}
          onClick={() => {
            if (currentIndex > 0) setCurrentIndex((i) => Math.max(0, i - 1));
            else onPrevStage?.();
          }}
          className="inline-flex items-center gap-1 text-xs text-[#73716B] transition-colors hover:text-[#292824] disabled:cursor-not-allowed disabled:opacity-35 dark:text-[#A1A09A] dark:hover:text-[#EDEDEB]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Previous
        </button>

        {allAnswered ? (
          <button
            type="button"
            onClick={() => setShowSummary(true)}
            className="inline-flex h-8 items-center rounded-md bg-[#292824] px-3 text-xs font-medium text-white transition-colors hover:bg-black dark:bg-[#EDEDEB] dark:text-[#171716] dark:hover:bg-white"
          >
            View Mastery Summary
          </button>
        ) : currentIndex < questions.length - 1 ? (
          <button
            type="button"
            onClick={() => setCurrentIndex((i) => i + 1)}
            className={`inline-flex items-center gap-1 text-xs font-medium transition-colors ${
              isAnswered
                ? 'text-[#5B55C9] hover:text-[#4338CA] dark:text-[#A5B4FC]'
                : 'text-[#73716B] hover:text-[#292824] dark:text-[#A1A09A] dark:hover:text-[#EDEDEB]'
            }`}
          >
            Next Question
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        ) : hasNextStage ? (
          <button
            type="button"
            onClick={onNextStage}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#5B55C9] transition-colors hover:text-[#4338CA] dark:text-[#A5B4FC]"
          >
            Next Step
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        ) : (
          <span className="text-[11px] text-[#96938A] dark:text-[#77776F]">
            {questions.length - answeredCount} left · {optionCount} choices
          </span>
        )}
      </div>
    </section>
  );
};
