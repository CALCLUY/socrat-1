import {
  LearningStage,
  PendingRetry,
  QCMQuestion,
  QCMRetryVariant,
} from '../types/harness';

function uid(): string {
  return `retry-${Math.random().toString(36).slice(2, 9)}`;
}

function validRetryVariant(raw?: QCMRetryVariant): QCMRetryVariant | undefined {
  if (!raw || !raw.prompt?.trim() || !Array.isArray(raw.options)) return undefined;
  const options = raw.options
    .filter((option): option is string => typeof option === 'string' && option.trim().length > 0)
    .slice(0, 6);
  if (options.length < 2) return undefined;
  const correctIndex = Number.isInteger(raw.correctIndex) && raw.correctIndex >= 0 && raw.correctIndex < options.length
    ? raw.correctIndex
    : 0;
  return {
    prompt: raw.prompt.trim(),
    options,
    correctIndex,
    rationale: typeof raw.rationale === 'string' ? raw.rationale : '',
    deepNote: typeof raw.deepNote === 'string' ? raw.deepNote : undefined,
  };
}

/** Uses the model's alternate item when available; otherwise rephrases and reorders a similar check. */
export function createRetryQuestion(
  original: QCMQuestion,
  prerequisiteStageIndex: number,
  stageTitle: string,
): QCMQuestion {
  const retry = validRetryVariant(original.retryQuestion);
  let options: string[];
  let correctIndex: number;
  let prompt: string;
  let rationale: string;
  let deepNote: string | undefined;

  if (retry) {
    options = retry.options;
    correctIndex = retry.correctIndex;
    prompt = retry.prompt;
    rationale = retry.rationale || original.rationale;
    deepNote = retry.deepNote || original.deepNote;
  } else {
    const n = Math.min(6, Math.max(2, original.options.length));
    const originalOptions = original.options.slice(0, n);
    const rotation = originalOptions.length > 2 ? 1 : 0;
    options = originalOptions.map((_, i) => originalOptions[(i + rotation) % originalOptions.length]);
    correctIndex = options.indexOf(original.options[original.correctIndex]);
    const framing: Record<QCMQuestion['tag'], string> = {
      'Core Concept': `A similar check on ${stageTitle}: which statement captures the same core idea?`,
      Mechanism: `Try this related check on ${stageTitle}: which mechanism is responsible?`,
      Misconception: `Check the same distinction again: which correction is right about ${stageTitle}?`,
      Application: `Apply the same idea to another case: which statement about ${stageTitle} is correct?`,
    };
    prompt = framing[original.tag];
    rationale = original.rationale;
    deepNote = original.deepNote;
  }

  return {
    id: uid(),
    tag: original.tag,
    prompt,
    options,
    correctIndex: Math.max(0, correctIndex),
    rationale: rationale || original.rationale,
    deepNote,
    prerequisiteStageIndex,
    retryOf: original.retryOf ?? original.id,
  };
}

export function attachRetriesToStages(
  stages: LearningStage[],
  pending: PendingRetry[],
  targetStageIndex: number,
): { stages: LearningStage[]; attached: PendingRetry[] } {
  const attached = pending.filter((item) => item.sourceStageIndex === targetStageIndex);
  if (attached.length === 0 || !stages[targetStageIndex]) {
    return { stages, attached: [] };
  }

  const retryIds = new Set(attached.map((item) => item.retryQuestion.id));
  const nextStages = stages.map((stage, index) => {
    if (index !== targetStageIndex) return stage;
    return {
      ...stage,
      questions: [
        ...stage.questions.filter((q) => !retryIds.has(q.id)),
        ...attached.map((item) => item.retryQuestion),
      ],
    };
  });

  return { stages: nextStages, attached };
}