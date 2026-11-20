import { DarijaScript, TutorLanguage } from '../types/harness';

export const TUTOR_LANGUAGE_OPTIONS: {
  id: TutorLanguage;
  label: string;
  shortLabel: string;
  hint: string;
}[] = [
  {
    id: 'en',
    label: 'English',
    shortLabel: 'English',
    hint: 'Explanations and QCMs in English',
  },
  {
    id: 'fr',
    label: 'French',
    shortLabel: 'French',
    hint: 'Explanations and QCMs in French',
  },
  {
    id: 'ar',
    label: 'Arabic',
    shortLabel: 'Arabic',
    hint: 'Explanations and QCMs in Arabic',
  },
  {
    id: 'darija-fr',
    label: 'Darija + French',
    shortLabel: 'Darija + FR',
    hint: 'Moroccan Arabic with French scientific & technical terms',
  },
];

export const DARIJA_SCRIPT_OPTIONS: {
  id: DarijaScript;
  label: string;
  example: string;
}[] = [
  {
    id: 'arabizi',
    label: 'Arabizi (Latin)',
    example: 'Kifach kaykhdem l-algorithme…',
  },
  {
    id: 'arabic',
    label: 'Arabic script',
    example: 'كيفاش كيخدم الـ algorithme…',
  },
];

export function getTutorLanguageBadge(
  language: TutorLanguage = 'en',
  script: DarijaScript = 'arabizi'
): string {
  switch (language) {
    case 'fr':
      return 'French';
    case 'ar':
      return 'Arabic';
    case 'darija-fr':
      return script === 'arabic' ? 'Darija + FR (Arabic)' : 'Darija + FR (Arabizi)';
    default:
      return 'English';
  }
}

export function isRtlLearningContent(
  language: TutorLanguage = 'en',
  script: DarijaScript = 'arabizi'
): boolean {
  return language === 'ar' || (language === 'darija-fr' && script === 'arabic');
}

export function buildLanguageInstruction(
  language: TutorLanguage = 'en',
  script: DarijaScript = 'arabizi'
): string {
  switch (language) {
    case 'fr':
      return `Language requirement:
Write the entire learning content ("title", "bigPicture", "mechanics", "pitfall", "keyTerms", "questions.prompt", "questions.options", "questions.rationale", "questions.deepNote", and "relatedTopics") in natural, clear, rigorous French (français).
Keep all JSON property keys in English and keep "tag" strictly as one of: "Core Concept", "Mechanism", "Misconception", "Application".`;

    case 'ar':
      return `Language requirement:
Write the entire learning content ("title", "bigPicture", "mechanics", "pitfall", "keyTerms", "questions.prompt", "questions.options", "questions.rationale", "questions.deepNote", and "relatedTopics") in natural, clear Modern Standard Arabic (العربية الفصحى) using Arabic script. Standard mathematical notation or standard symbols may remain as needed.
Keep all JSON property keys in English and keep "tag" strictly as one of: "Core Concept", "Mechanism", "Misconception", "Application".`;

    case 'darija-fr':
      if (script === 'arabic') {
        return `Language & script requirement (Moroccan Darija + French technical terms, Arabic script):
Write all explanations, steps, pitfalls, questions, options, rationales, and notes in natural Moroccan Darija (الدارجة المغربية) using Arabic script (حروف عربية), while keeping ALL scientific, mathematical, medical, and technical terms in French (e.g., "la rétropropagation", "l'algorithme", "la dérivée", "l'intrication quantique", "l'ADN", "la fréquence", "le réseau de neurones").
Write naturally the way Moroccan engineering/science tutors explain things in Arabic-script Darija mixed with French technical vocabulary (for example: "فهاد الـ mécanisme، كل token كيتحول لـ trois vecteurs: Query و Key و Value...").
Do NOT write the Darija words in Arabizi/Latin letters — write Darija words in Arabic script and scientific/technical terms in French.
Keep all JSON property keys in English and keep "tag" strictly as one of: "Core Concept", "Mechanism", "Misconception", "Application".`;
      }
      return `Language & script requirement (Moroccan Darija + French technical terms, Arabizi / Latin script):
Write all explanations, steps, pitfalls, questions, options, rationales, and notes in natural Moroccan Darija written in Arabizi (Latin letters + Moroccan chat numerals: 3 for ع, 7 for ح, 9 for ق, 5/kh for خ, gh for غ, ch for ش), while keeping ALL scientific, mathematical, medical, and technical terms in French (e.g., "la rétropropagation", "le gradient", "l'intrication quantique", "l'ADN", "l'ARN messager", "le protocole", "l'algorithme").
Write naturally the way Moroccan STEM students and tutors explain concepts in Arabizi + French (for example: "F had l-mécanisme, kolla token kayt7wwel l trois vecteurs: Query, Key, w Value...").
Do NOT use Arabic script (ا ب ت...) anywhere in the output — use ONLY Latin/Arabizi script + French scientific/technical terms.
Keep all JSON property keys in English and keep "tag" strictly as one of: "Core Concept", "Mechanism", "Misconception", "Application".`;

    default:
      return `Language requirement:
Write the entire learning content ("title", "bigPicture", "mechanics", "pitfall", "keyTerms", "questions.prompt", "questions.options", "questions.rationale", "questions.deepNote", and "relatedTopics") in clear, natural English.
Keep all JSON property keys in English and keep "tag" strictly as one of: "Core Concept", "Mechanism", "Misconception", "Application".`;
  }
}
