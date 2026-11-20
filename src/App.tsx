import { useCallback, useEffect, useRef, useState } from 'react';
import { completeLogin } from '@openai-oauth/web';
import { Loader2 } from 'lucide-react';
import { ExplanationCard } from './components/ExplanationCard';
import { HistorySidebar } from './components/HistorySidebar';
import { LearningPath } from './components/LearningPath';
import { PromptCanvas } from './components/PromptCanvas';
import { QCMDeck } from './components/QCMDeck';
import { SettingsModal } from './components/SettingsModal';
import { TopBar } from './components/TopBar';
import {
  generateMoreQuestions,
  generateStudySession,
} from './services/harnessEngine';
import {
  DEFAULT_LOCAL_OAUTH_PROXY,
  extractAccountSummaryFromSession,
  readStoredChatGPTSession,
  sharedOAuthSessionStore,
} from './services/openaiOAuthClient';
import {
  attachRetriesToStages,
  createRetryQuestion,
} from './services/learningPath';
import {
  DepthLevel,
  HarnessSettings,
  MaterialKind,
  PendingRetry,
  QCMQuestion,
  SessionHistoryItem,
  StudySession,
  UploadedMaterial,
} from './types/harness';

const HISTORY_KEY = 'socratic_qcm_history_v1';
const SETTINGS_KEY = 'socratic_qcm_settings_v3';
const THEME_KEY = 'socratic_theme_v1';
const SIDEBAR_KEY = 'socratic_sidebar_collapsed_v1';

const LEGACY_GEMINI_MODELS = new Set([
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
]);

const DEFAULT_HARNESS_SETTINGS: HarnessSettings = {
  activeProvider: 'builtin',
  tutorLanguage: 'en',
  darijaScript: 'arabizi',
  gemini: {
    apiKey: '',
    model: 'gemini-3.8-flash',
    customModel: '',
  },
  chatgptOAuth: {
    mode: 'browser-extension',
    preferredModel: 'auto',
    discoveredModels: [],
    proxyUrl: DEFAULT_LOCAL_OAUTH_PROXY,
    proxyToken: '',
    accountSummary: null,
  },
  openai: {
    apiKey: '',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-5.4-mini',
  },
};

function loadStoredSettings(): HarnessSettings {
  try {
    const raw =
      localStorage.getItem(SETTINGS_KEY) ||
      localStorage.getItem('socratic_qcm_settings_v2') ||
      localStorage.getItem('socratic_qcm_settings_v1');
    if (!raw) return DEFAULT_HARNESS_SETTINGS;
    const parsed = JSON.parse(raw);

    const storedGeminiModel = parsed.gemini?.model || 'gemini-3.8-flash';
    const migratedGeminiModel = LEGACY_GEMINI_MODELS.has(storedGeminiModel)
      ? 'gemini-3.8-flash'
      : storedGeminiModel;

    const validLanguages = new Set(['en', 'fr', 'ar', 'darija-fr']);
    const tutorLanguage = validLanguages.has(parsed.tutorLanguage)
      ? parsed.tutorLanguage
      : DEFAULT_HARNESS_SETTINGS.tutorLanguage;
    const darijaScript =
      parsed.darijaScript === 'arabic' ? 'arabic' : 'arabizi';

    return {
      activeProvider:
        parsed.activeProvider ||
        (parsed.enabled
          ? 'openai-api'
          : DEFAULT_HARNESS_SETTINGS.activeProvider),
      tutorLanguage,
      darijaScript,
      gemini: {
        apiKey: parsed.gemini?.apiKey || '',
        model: migratedGeminiModel,
        customModel: parsed.gemini?.customModel || '',
      },
      chatgptOAuth: {
        mode: parsed.chatgptOAuth?.mode || 'browser-extension',
        preferredModel: parsed.chatgptOAuth?.preferredModel || 'auto',
        discoveredModels: Array.isArray(parsed.chatgptOAuth?.discoveredModels)
          ? parsed.chatgptOAuth.discoveredModels
          : [],
        proxyUrl: parsed.chatgptOAuth?.proxyUrl || DEFAULT_LOCAL_OAUTH_PROXY,
        proxyToken: parsed.chatgptOAuth?.proxyToken || '',
        accountSummary: parsed.chatgptOAuth?.accountSummary || null,
      },
      openai: {
        apiKey: parsed.openai?.apiKey || parsed.apiKey || '',
        endpoint:
          parsed.openai?.endpoint ||
          parsed.endpoint ||
          'https://api.openai.com/v1/chat/completions',
        model: parsed.openai?.model || parsed.model || 'gpt-5.4-mini',
      },
    };
  } catch {
    return DEFAULT_HARNESS_SETTINGS;
  }
}

export function App() {
  const [query, setQuery] = useState('');
  const [depth, setDepth] = useState<DepthLevel>('standard');
  const [materials, setMaterials] = useState<UploadedMaterial[]>([]);
  const activeSessionMaterialsRef = useRef<UploadedMaterial[]>([]);

  const [session, setSession] = useState<StudySession | null>(null);
  const [activeQuestions, setActiveQuestions] = useState<QCMQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  /** When set, the current step shows only these questions (retest-missed mode). */
  const [stageOverride, setStageOverride] = useState<QCMQuestion[] | null>(null);
  const [pendingRetries, setPendingRetries] = useState<PendingRetry[]>([]);
  const [remediatedQuestionIds, setRemediatedQuestionIds] = useState<string[]>([]);

  /** Backfill stages for sessions saved before the from-scratch path existed. */
  const ensureStages = (raw: StudySession): StudySession => {
    if (raw.stages && raw.stages.length > 0) return raw;
    const questions = Array.isArray(raw.questions) ? raw.questions : [];
    return {
      ...raw,
      stages: [
        {
          id: `${raw.id}-stage-0`,
          order: 0,
          title: raw.title,
          goal: '',
          explanation: raw.explanation,
          questions,
        },
      ],
    };
  };

  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingMore, setIsGeneratingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const closeMobileSidebar = useCallback(() => setMobileSidebarOpen(false), []);
  const generationId = useRef(0);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, String(sidebarCollapsed));
    } catch {
      // The sidebar still works if browser storage is unavailable.
    }
  }, [sidebarCollapsed]);

  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(THEME_KEY);
      if (stored === 'dark') return true;
      if (stored === 'light') return false;
      return document.documentElement.classList.contains('dark');
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    try {
      localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
    } catch {
      // ignore
    }
  }, [isDark]);

  const [harnessSettings, setHarnessSettings] =
    useState<HarnessSettings>(loadStoredSettings);

  const [history, setHistory] = useState<SessionHistoryItem[]>(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const stored = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(stored)) return [];
      return stored
        .filter(
          (item) =>
            item?.id &&
            item?.session &&
            (Array.isArray(item.session.questions) || Array.isArray(item.session.stages)),
        )
        .map((item) => {
          const session = item.session as StudySession;
          if (session.stages && session.stages.length > 0) return item as SessionHistoryItem;
          const questions = Array.isArray(session.questions) ? session.questions : [];
          return {
            ...item,
            session: {
              ...session,
              stages: [
                {
                  id: `${session.id}-stage-0`,
                  order: 0,
                  title: session.title,
                  goal: '',
                  explanation: session.explanation,
                  questions,
                },
              ],
            },
          } as SessionHistoryItem;
        })
        .slice(0, 20);
    } catch {
      return [];
    }
  });

  const saveSettings = (next: HarnessSettings) => {
    setHarnessSettings(next);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  // Complete any returning OpenAI OAuth PKCE callback & sync encrypted IndexedDB session on mount
  useEffect(() => {
    let mounted = true;

    const syncOAuth = async () => {
      try {
        const completed = await completeLogin({
          sessionStore: sharedOAuthSessionStore,
        });
        if (completed) {
          // If inside popup opened by SignInWithChatGPT, notify opener & close
          if (window.opener && window.opener !== window) {
            window.opener.postMessage(
              { type: 'openai-oauth:signed-in' },
              window.location.origin,
            );
            setTimeout(() => window.close(), 60);
            return;
          }
          if (mounted) {
            const summary = extractAccountSummaryFromSession(completed);
            setHarnessSettings((prev) => {
              const next: HarnessSettings = {
                ...prev,
                activeProvider: 'openai-oauth',
                chatgptOAuth: {
                  ...prev.chatgptOAuth,
                  mode: 'browser-extension',
                  accountSummary: summary,
                },
              };
              try {
                localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
              } catch {
                // ignore
              }
              return next;
            });
          }
          return;
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : 'OpenAI OAuth callback failed.',
          );
        }
      }

      const { summary } = await readStoredChatGPTSession();
      if (mounted) {
        setHarnessSettings((prev) => {
          if (
            (summary?.accountId || null) ===
            (prev.chatgptOAuth.accountSummary?.accountId || null)
          ) {
            return prev;
          }
          const next: HarnessSettings = {
            ...prev,
            chatgptOAuth: {
              ...prev.chatgptOAuth,
              accountSummary: summary,
            },
          };
          try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
          } catch {
            // ignore
          }
          return next;
        });
      }
    };

    void syncOAuth();

    const onPopupMessage = (event: MessageEvent) => {
      if (
        event.origin === window.location.origin &&
        typeof event.data === 'object' &&
        event.data !== null &&
        'type' in event.data &&
        (event.data as { type?: string }).type === 'openai-oauth:signed-in'
      ) {
        void readStoredChatGPTSession().then(({ summary }) => {
          if (!mounted || !summary) return;
          setHarnessSettings((prev) => {
            const next: HarnessSettings = {
              ...prev,
              activeProvider: 'openai-oauth',
              chatgptOAuth: {
                ...prev.chatgptOAuth,
                accountSummary: summary,
              },
            };
            try {
              localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
            } catch {
              // ignore
            }
            return next;
          });
        });
      }
    };

    window.addEventListener('message', onPopupMessage);
    return () => {
      mounted = false;
      window.removeEventListener('message', onPopupMessage);
    };
  }, []);

  const persistHistory = (items: SessionHistoryItem[]) => {
    const next = items.slice(0, 20);
    setHistory(next);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  // Persist the active session to history as soon as it is created and keep it
  // updated live with every answer — so starting a new topic never loses old sessions.
  useEffect(() => {
    if (!session || activeQuestions.length === 0) return;
    const answered = activeQuestions.filter(
      (q) => answers[q.id] !== undefined,
    ).length;
    const score = activeQuestions.filter(
      (q) => answers[q.id] === q.correctIndex,
    ).length;
    setHistory((prev) => {
      const entry: SessionHistoryItem = {
        id: session.id,
        title: session.title,
        query: session.query,
        score,
        total: activeQuestions.length,
        answered,
        answers,
        activeQuestionIds: activeQuestions.map((question) => question.id),
        activeStageIndex: currentStageIndex,
        pendingRetries,
        remediatedQuestionIds,
        createdAt: session.createdAt,
        updatedAt: Date.now(),
        session,
      };
      const filtered = prev.filter((item) => item.id !== session.id);
      const next = [entry, ...filtered].slice(0, 20);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, [
    answers,
    activeQuestions,
    session,
    currentStageIndex,
    pendingRetries,
    remediatedQuestionIds,
  ]);

  const startSession = async (
    overrideQuery?: string,
    overrideMaterials?: UploadedMaterial[],
  ) => {
    const targetQuery = (overrideQuery ?? query).trim();
    const targetMaterials = overrideMaterials ?? materials;
    if (!targetQuery && targetMaterials.length === 0) return;

    const requestId = ++generationId.current;
    setIsLoading(true);
    setIsGeneratingMore(false);
    closeMobileSidebar();
    setError(null);
    try {
      const created = await generateStudySession(
        targetQuery,
        depth,
        harnessSettings,
        targetMaterials,
      );
      if (requestId !== generationId.current) return;
      activeSessionMaterialsRef.current = targetMaterials;
      const migrated = ensureStages(created);
      setSession(migrated);
      setActiveQuestions(migrated.questions);
      setAnswers({});
      setCurrentStageIndex(0);
      setStageOverride(null);
      setPendingRetries([]);
      setRemediatedQuestionIds([]);
      setQuery(targetQuery);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      if (requestId !== generationId.current) return;
      const msg =
        err instanceof Error
          ? err.message
          : 'Something went wrong synthesizing this topic.';
      setError(msg);
      setSession(null);
    } finally {
      if (requestId === generationId.current) setIsLoading(false);
    }
  };

  const handleAddMaterials = (items: UploadedMaterial[]) => {
    setMaterials((prev) => [...prev, ...items].slice(0, 6));
  };

  const handleRemoveMaterial = (id: string) => {
    setMaterials((prev) => prev.filter((item) => item.id !== id));
  };

  const handleToggleMaterialKind = (id: string, kind: MaterialKind) => {
    setMaterials((prev) =>
      prev.map((item) => (item.id === id ? { ...item, kind } : item)),
    );
  };

  const handleDrillTopic = (topic: string) => {
    const useMaterials =
      harnessSettings.activeProvider !== 'builtin'
        ? activeSessionMaterialsRef.current
        : [];
    void startSession(topic, useMaterials);
  };

  const stages = session?.stages ?? [];
  const safeStageIndex =
    stages.length === 0 ? 0 : Math.min(Math.max(0, currentStageIndex), stages.length - 1);
  const currentStage = stages[safeStageIndex];
  const displayedQuestions = stageOverride ?? currentStage?.questions ?? [];
  const questionOffset = stages
    .slice(0, safeStageIndex)
    .reduce((sum, s) => sum + s.questions.length, 0);

  const handleSelectAnswer = (questionId: string, optionIndex: number) => {
    const question = displayedQuestions.find((item) => item.id === questionId);
    if (question?.retryOf && optionIndex === question.correctIndex) {
      setRemediatedQuestionIds((prev) =>
        prev.includes(question.retryOf!) ? prev : [...prev, question.retryOf!],
      );
    }
    setAnswers((prev) => {
      if (prev[questionId] !== undefined) return prev;
      return { ...prev, [questionId]: optionIndex };
    });
  };

  const applyStageUpdate = (updatedStages: StudySession['stages']) => {
    if (!session) return;
    const nextSession: StudySession = {
      ...session,
      stages: updatedStages,
      questions: updatedStages.flatMap((stage) => stage.questions),
    };
    setSession(nextSession);
    setActiveQuestions(nextSession.questions);
  };

  const handleSelectStage = (index: number) => {
    if (!session || session.stages.length === 0) return;
    const targetIndex = Math.min(Math.max(0, index), session.stages.length - 1);
    const attached = attachRetriesToStages(session.stages, pendingRetries, targetIndex);
    if (attached.attached.length > 0) {
      applyStageUpdate(attached.stages);
      const attachedIds = new Set(attached.attached.map((retry) => retry.id));
      setPendingRetries((prev) => prev.filter((retry) => !attachedIds.has(retry.id)));
    }
    setCurrentStageIndex(targetIndex);
    setStageOverride(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReviewPrerequisite = (question: QCMQuestion) => {
    if (!session || !currentStage) return;
    const sourceStageIndex = safeStageIndex;
    const requestedPrerequisite = question.prerequisiteStageIndex;
    const prerequisiteStageIndex =
      typeof requestedPrerequisite === 'number' && requestedPrerequisite < sourceStageIndex
        ? requestedPrerequisite
        : Math.max(0, sourceStageIndex - 1);
    const prerequisiteStage = session.stages[prerequisiteStageIndex] ?? currentStage;
    const originalQuestionId = question.retryOf ?? question.id;
    if (remediatedQuestionIds.includes(originalQuestionId)) return;

    const retryQuestion = createRetryQuestion(
      question,
      prerequisiteStageIndex,
      currentStage.title,
    );
    const retry: PendingRetry = {
      id: `recovery-${originalQuestionId}-${Date.now()}`,
      sourceStageIndex,
      prerequisiteStageIndex,
      originalQuestionId,
      retryQuestion,
    };

    setAnswers((prev) => {
      const next = { ...prev };
      for (const prerequisiteQuestion of prerequisiteStage.questions) {
        delete next[prerequisiteQuestion.id];
      }
      return next;
    });
    setStageOverride(null);

    if (prerequisiteStageIndex === sourceStageIndex) {
      // At the foundation there is nowhere earlier to go; revisit it, then retry.
      const attached = attachRetriesToStages(
        session.stages,
        [retry],
        sourceStageIndex,
      );
      applyStageUpdate(attached.stages);
    } else {
      setPendingRetries((prev) => [
        ...prev.filter((item) => item.originalQuestionId !== originalQuestionId),
        retry,
      ]);
      setCurrentStageIndex(prerequisiteStageIndex);
    }

    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRetakeAll = () => {
    if (!session) return;
    const ids = new Set(displayedQuestions.map((question) => question.id));
    const resolvedIds = new Set(
      displayedQuestions.map((question) => question.retryOf).filter(Boolean),
    );
    setAnswers((prev) => {
      const next = { ...prev };
      for (const id of ids) delete next[id];
      return next;
    });
    setRemediatedQuestionIds((prev) => prev.filter((id) => !resolvedIds.has(id)));
    setStageOverride(null);
  };

  const handleRetestMissed = (missed: QCMQuestion[]) => {
    const ids = new Set(missed.map((question) => question.id));
    const resolvedIds = new Set(missed.map((question) => question.retryOf).filter(Boolean));
    setAnswers((prev) => {
      const next = { ...prev };
      for (const id of ids) delete next[id];
      return next;
    });
    setRemediatedQuestionIds((prev) => prev.filter((id) => !resolvedIds.has(id)));
    setStageOverride(missed);
  };

  const handleGenerateMore = async (): Promise<number> => {
    if (!session || !currentStage || isGeneratingMore) return 0;
    const requestId = ++generationId.current;
    setIsGeneratingMore(true);
    setError(null);
    try {
      const extra = await generateMoreQuestions(
        session,
        3,
        harnessSettings,
        currentStage.id,
      );
      if (requestId !== generationId.current) return 0;
      if (extra.length > 0) {
        const updatedStages = session.stages.map((stage) =>
          stage.id === currentStage.id
            ? { ...stage, questions: [...stage.questions, ...extra] }
            : stage,
        );
        applyStageUpdate(updatedStages);
        setStageOverride((prev) => (prev ? [...prev, ...extra] : null));
        return extra.length;
      }
      setError('No additional unique questions available for this topic right now.');
    } catch (err) {
      if (requestId !== generationId.current) return 0;
      setError(err instanceof Error ? err.message : 'Could not generate extra QCMs.');
    } finally {
      if (requestId === generationId.current) setIsGeneratingMore(false);
    }
    return 0;
  };

  const handleResumeHistory = (item: SessionHistoryItem) => {
    generationId.current += 1;
    setIsLoading(false);
    setIsGeneratingMore(false);
    const migrated = ensureStages(item.session);
    setSession(migrated);
    setActiveQuestions(migrated.questions);
    setAnswers(item.answers ?? {});
    const savedStage =
      typeof item.activeStageIndex === 'number' ? item.activeStageIndex : 0;
    setCurrentStageIndex(Math.min(Math.max(0, savedStage), Math.max(0, migrated.stages.length - 1)));
    setStageOverride(null);
    setPendingRetries(item.pendingRetries ?? []);
    setRemediatedQuestionIds(item.remediatedQuestionIds ?? []);
    setQuery(item.query);
    setDepth(migrated.depth);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNewTopic = () => {
    generationId.current += 1;
    setIsLoading(false);
    setIsGeneratingMore(false);
    setSession(null);
    setActiveQuestions([]);
    setAnswers({});
    setMaterials([]);
    activeSessionMaterialsRef.current = [];
    setCurrentStageIndex(0);
    setStageOverride(null);
    setError(null);
    setQuery('');
    closeMobileSidebar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const answeredCount = activeQuestions.filter(
    (q) => answers[q.id] !== undefined,
  ).length;
  const correctCount = activeQuestions.filter(
    (q) => answers[q.id] !== undefined && answers[q.id] === q.correctIndex,
  ).length;

  return (
    <div className="min-h-screen bg-[#FBFBFA] text-[#1A1918] transition-colors dark:bg-[#111110] dark:text-[#EDEDEB]">
      <HistorySidebar
        history={history}
        activeSessionId={session?.id ?? null}
        collapsed={sidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        onToggleCollapsed={() => setSidebarCollapsed((collapsed) => !collapsed)}
        onCloseMobile={closeMobileSidebar}
        onNewTopic={handleNewTopic}
        onResumeSession={handleResumeHistory}
        onClearHistory={() => {
          handleNewTopic();
          persistHistory([]);
        }}
      />

      <div
        inert={mobileSidebarOpen}
        className={`workspace min-h-screen min-w-0 transition-[margin-left] duration-250 ease-in-out ${sidebarCollapsed ? 'md:ml-16' : 'md:ml-[232px]'}`}
      >
        <TopBar
          session={session}
          totalQuestions={activeQuestions.length}
          answeredCount={answeredCount}
          correctCount={correctCount}
          stageIndex={safeStageIndex}
          totalStages={stages.length}
          isDark={isDark}
          mobileSidebarOpen={mobileSidebarOpen}
          onToggleTheme={() => setIsDark((d) => !d)}
          onOpenSidebar={() => setMobileSidebarOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <main>
          {!session ? (
            <PromptCanvas
              query={query}
              depth={depth}
              materials={materials}
              isLoading={isLoading}
              error={error}
              harnessSettings={harnessSettings}
              onQueryChange={setQuery}
              onDepthChange={setDepth}
              onAddMaterials={handleAddMaterials}
              onRemoveMaterial={handleRemoveMaterial}
              onToggleMaterialKind={handleToggleMaterialKind}
              onSubmit={(override) =>
                startSession(override, override ? [] : undefined)
              }
              onOpenSettings={() => setSettingsOpen(true)}
            />
          ) : (
            <div className="mx-auto w-full max-w-[720px] space-y-10 px-4 pb-16 pt-7 sm:px-6">
              {isLoading && (
                <div className="flex items-center justify-center gap-2 py-10 text-xs text-[#85837C] dark:text-[#85857D]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Preparing your lesson…</span>
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="border-l-2 border-[#C2410C] py-1 pl-3 text-xs leading-relaxed text-[#9A3412] dark:border-[#F87171] dark:text-[#FCA5A5]"
                >
                  {error}
                </div>
              )}

              {!isLoading && currentStage && (
                <>
                  <LearningPath
                    stages={stages}
                    currentIndex={safeStageIndex}
                    answers={answers}
                    tutorLanguage={session.tutorLanguage}
                    darijaScript={session.darijaScript}
                    onSelectStage={handleSelectStage}
                  />
                  <ExplanationCard
                    key={`exp-${session.id}-${currentStage.id}`}
                    session={session}
                    stage={currentStage}
                    stageIndex={safeStageIndex}
                    totalStages={stages.length}
                    onDrillTopic={handleDrillTopic}
                  />
                  <QCMDeck
                    key={`qcm-${session.id}-${currentStage.id}-${stageOverride ? 'retest' : 'full'}`}
                    questions={displayedQuestions}
                    answers={answers}
                    tutorLanguage={session.tutorLanguage}
                    darijaScript={session.darijaScript}
                    relatedTopics={session.relatedTopics}
                    isGeneratingMore={isGeneratingMore}
                    stageIndex={safeStageIndex}
                    totalStages={stages.length}
                    questionOffset={questionOffset}
                    totalQuestionCount={activeQuestions.length}
                    onSelectAnswer={handleSelectAnswer}
                    onRetakeAll={handleRetakeAll}
                    onRetestMissed={handleRetestMissed}
                    onGenerateMore={handleGenerateMore}
                    onExploreTopic={(t) => startSession(t, [])}
                    onNewTopic={handleNewTopic}
                    onNextStage={
                      safeStageIndex < stages.length - 1
                        ? () => handleSelectStage(safeStageIndex + 1)
                        : undefined
                    }
                    onPrevStage={
                      safeStageIndex > 0
                        ? () => handleSelectStage(safeStageIndex - 1)
                        : undefined
                    }
                  />
                </>
              )}
            </div>
          )}
        </main>
      </div>

      <SettingsModal
        isOpen={settingsOpen}
        settings={harnessSettings}
        onClose={() => setSettingsOpen(false)}
        onSave={saveSettings}
      />
    </div>
  );
}

export default App;
