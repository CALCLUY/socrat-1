export type DepthLevel = 'intro' | 'standard' | 'deep';

export type TutorLanguage = 'en' | 'fr' | 'ar' | 'darija-fr';

export type DarijaScript = 'arabizi' | 'arabic';

export type QCMTag =
  'Core Concept' | 'Mechanism' | 'Misconception' | 'Application';

export interface QCMRetryVariant {
  prompt: string;
  options: string[];
  correctIndex: number;
  rationale: string;
  deepNote?: string;
}

export interface QCMQuestion {
  id: string;
  prompt: string;
  /** 2–6 answer choices; the AI chooses how many fit the question. */
  options: string[];
  correctIndex: number;
  rationale: string;
  deepNote?: string;
  tag: QCMTag;
  /** Earlier zero-based learning step that this question depends on. Null = foundations. */
  prerequisiteStageIndex?: number | null;
  /** AI-authored alternate version asked after reviewing a prerequisite. */
  retryQuestion?: QCMRetryVariant;
  /** Original question ID when this is a delayed remediation question. */
  retryOf?: string;
}

export interface LearningStage {
  id: string;
  /** 0-based position in the from-scratch path. */
  order: number;
  title: string;
  /** What the learner will be able to do after finishing this stage. */
  goal: string;
  explanation: ExplanationSection;
  questions: QCMQuestion[];
}

export interface PendingRetry {
  id: string;
  sourceStageIndex: number;
  prerequisiteStageIndex: number;
  originalQuestionId: string;
  retryQuestion: QCMQuestion;
}

export interface KeyTerm {
  term: string;
  definition: string;
}

export interface ExplanationSection {
  bigPicture: string;
  mechanics: string[];
  pitfall: string;
  keyTerms: KeyTerm[];
}

export type SessionSource =
  | 'curated'
  | 'live-wiki'
  | 'document'
  | 'gemini'
  | 'chatgpt-oauth'
  | 'openai-api';

export type MaterialKind = 'course' | 'exam';

export interface UploadedMaterial {
  id: string;
  name: string;
  kind: MaterialKind;
  text: string;
  size: number;
  pageCount?: number;
  wordCount: number;
}

export interface StudyRoadmapItem {
  topic: string;
  why: string;
  priority: 'high' | 'medium';
}

export interface StudySession {
  id: string;
  query: string;
  title: string;
  depth: DepthLevel;
  tutorLanguage?: TutorLanguage;
  darijaScript?: DarijaScript;
  source: SessionSource;
  modelUsed?: string;
  sourceUrl?: string;
  materialNames?: string[];
  materialKind?: MaterialKind;
  studyRoadmap?: StudyRoadmapItem[];
  /** Ordered from-scratch learning path: absolute basics → target topic. */
  stages: LearningStage[];
  /** Flattened across stages (kept for history/compat). */
  explanation: ExplanationSection;
  questions: QCMQuestion[];
  relatedTopics: string[];
  createdAt: number;
}

export interface SessionHistoryItem {
  id: string;
  title: string;
  query: string;
  score: number;
  total: number;
  answered?: number;
  answers?: Record<string, number>;
  activeQuestionIds?: string[];
  activeStageIndex?: number;
  pendingRetries?: PendingRetry[];
  remediatedQuestionIds?: string[];
  createdAt: number;
  updatedAt?: number;
  session: StudySession;
}

export type HarnessProviderType =
  'builtin' | 'gemini' | 'openai-oauth' | 'openai-api';

export interface GeminiModelOption {
  id: string;
  label: string;
  badge: string;
  freeTier: boolean;
  quotaNote: string;
}

export interface GeminiSettings {
  apiKey: string;
  model: string;
  customModel?: string;
}

export type ChatGPTOAuthMode =
  'browser-extension' | 'local-proxy' | 'codex-import';

export interface ChatGPTAccountSummary {
  accountId: string;
  email?: string;
  name?: string;
  plan?: string;
  expiresAt?: string;
}

export interface ChatGPTOAuthSettings {
  mode: ChatGPTOAuthMode;
  preferredModel: string;
  discoveredModels: string[];
  proxyUrl: string;
  proxyToken: string;
  accountSummary: ChatGPTAccountSummary | null;
}

export interface OpenAISettings {
  apiKey: string;
  model: string;
  endpoint: string;
}

export interface HarnessSettings {
  activeProvider: HarnessProviderType;
  tutorLanguage: TutorLanguage;
  darijaScript: DarijaScript;
  gemini: GeminiSettings;
  chatgptOAuth: ChatGPTOAuthSettings;
  openai: OpenAISettings;
}

export type LLMSettings = HarnessSettings;
