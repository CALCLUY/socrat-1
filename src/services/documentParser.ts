import { extractText } from 'unpdf';
import {
  DarijaScript,
  DepthLevel,
  ExplanationSection,
  KeyTerm,
  MaterialKind,
  QCMQuestion,
  QCMTag,
  StudyRoadmapItem,
  TutorLanguage,
  UploadedMaterial,
} from '../types/harness';

export const ACCEPTED_FILE_EXTENSIONS =
  '.pdf,.md,.markdown,.txt,.tex,.csv,.rst,.html,.htm,.json';

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB
const MAX_STORED_CHARS_PER_FILE = 80_000;

function uid(prefix = 'mat'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function cleanExtractedText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectMaterialKind(fileName: string, text: string): MaterialKind {
  const lowerName = fileName.toLowerCase();
  if (
    /(exam|examen|midterm|final|quiz|qcm|td|tp|exercice|exercise|homework|assignment|problem[-_\s]?set|sujet|devoir|controle|contrôle|annale|test|worksheet|فرض|امتحان|تمرين|تمارين)/i.test(
      lowerName
    )
  ) {
    return 'exam';
  }

  const sample = text.slice(0, 4000);
  let examSignals = 0;
  if (/(?:exercice|exercise|problem|question|problème|تمرين|سؤال)\s*[0-9]+/gi.test(sample)) {
    examSignals += 2;
  }
  if (/\b(?:calculate|prove|show that|determine|find|solve|calculez|montrer que|déterminer|résoudre|احسب|برهن|أثبت)\b/gi.test(sample)) {
    examSignals += 1;
  }
  if (/\(\s*\d+\s*(?:pts?|points?|marks?|نقط)\s*\)/gi.test(sample)) {
    examSignals += 2;
  }
  const questionMarks = (sample.match(/[?؟]/g) || []).length;
  if (questionMarks >= 5) examSignals += 1;

  return examSignals >= 2 ? 'exam' : 'course';
}

export async function parseUploadedFile(file: File): Promise<UploadedMaterial> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`"${file.name}" is larger than 15 MB. Please upload a smaller file.`);
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  let text = '';
  let pageCount: number | undefined;

  if (ext === 'pdf' || file.type === 'application/pdf') {
    const buffer = await file.arrayBuffer();
    const result = await extractText(new Uint8Array(buffer), { mergePages: false });
    pageCount = result.totalPages;
    const pages = Array.isArray(result.text) ? result.text : [String(result.text || '')];
    text = pages
      .map((p, i) => (pages.length > 1 ? `[Page ${i + 1}]\n${p}` : p))
      .join('\n\n');
  } else {
    const raw = await file.text();
    text = ext === 'html' || ext === 'htm' ? stripHtml(raw) : raw;
  }

  const cleaned = cleanExtractedText(text);
  if (cleaned.length < 25) {
    throw new Error(
      `Could not extract readable text from "${file.name}". If it is a scanned PDF image, run OCR or upload a text-selectable PDF / Markdown / TXT file.`
    );
  }

  const trimmedText = cleaned.slice(0, MAX_STORED_CHARS_PER_FILE);
  const wordCount = trimmedText.split(/\s+/).filter(Boolean).length;

  return {
    id: uid('mat'),
    name: file.name,
    kind: detectMaterialKind(file.name, trimmedText),
    text: trimmedText,
    size: file.size,
    pageCount,
    wordCount,
  };
}

export function formatMaterialsForPrompt(
  materials: UploadedMaterial[],
  maxTotalChars = 28_000
): string {
  const perFileBudget = Math.max(
    4_000,
    Math.floor(maxTotalChars / Math.max(1, materials.length))
  );

  return materials
    .map((m, i) => {
      const kindLabel = m.kind === 'exam' ? 'EXAM / EXERCISES' : 'COURSE NOTES';
      const excerpt =
        m.text.length > perFileBudget
          ? `${m.text.slice(0, Math.floor(perFileBudget * 0.72))}\n\n[... middle excerpt omitted ...]\n\n${m.text.slice(-Math.floor(perFileBudget * 0.24))}`
          : m.text;
      return `=== MATERIAL ${i + 1}: ${m.name} (${kindLabel}) ===\n${excerpt}`;
    })
    .join('\n\n');
}

// ================= Local Built-in Extractor (No API Key Required) =================

function stripMarkdownSyntax(line: string): string {
  return line
    .replace(/^#{1,6}\s+/, '')
    .replace(/^\s*[-*+•]\s+/, '')
    .replace(/^\s*\d+[.)]\s+/, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateText(text: string, maxLen = 165): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  const cut = clean.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 60 ? lastSpace : maxLen)}…`;
}

function extractHeadingsAndTopics(text: string): string[] {
  const lines = text.split('\n');
  const candidates: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('[Page ')) continue;

    // Markdown headings
    if (/^#{1,4}\s+.{3,90}$/.test(line)) {
      candidates.push(stripMarkdownSyntax(line));
      continue;
    }

    // Numbered chapter / section / exercise headers
    if (
      /^(?:chapter|chapitre|section|part|partie|unit|module|lecture|cours|exercice|exercise|problem|problème|question|q|tp|td|الفصل|الدرس|تمرين|السؤال)\s*[0-9IVX]+[:.\-–\s]+.{3,90}$/i.test(
        line
      )
    ) {
      candidates.push(stripMarkdownSyntax(line));
      continue;
    }

    // Short standalone title lines (Title Case or bolded line)
    if (/^\*\*[^*]{4,80}\*\*$/.test(line)) {
      candidates.push(stripMarkdownSyntax(line));
      continue;
    }

    // Explicit concept headers like "1.2 Backpropagation" or "II. Intrication"
    if (/^(?:\d+(?:\.\d+)*|[IVX]+)[.)]\s+[A-ZÀ-ÖØ-Ý\u0600-\u06FF].{3,75}$/.test(line)) {
      if (!/[.?!؟]$/.test(line)) {
        candidates.push(stripMarkdownSyntax(line));
      }
    }
  }

  return Array.from(
    new Set(
      candidates
        .map((c) => c.replace(/[:\-–]+$/, '').trim())
        .filter((c) => c.length >= 4 && c.length <= 85)
    )
  );
}

function extractSentencesFromMaterial(text: string): string[] {
  const cleaned = text
    .split('\n')
    .filter((l) => !/^\[Page \d+\]$/.test(l.trim()))
    .map(stripMarkdownSyntax)
    .filter((l) => l.length > 0)
    .join(' ');

  const raw = cleaned.match(/[^.!?؟]+[.!?؟]+/g) || [];
  return raw
    .map((s) => s.trim())
    .filter((s) => s.length >= 38 && s.length <= 280);
}

function extractKeyTermsFromMaterial(text: string): KeyTerm[] {
  const lines = text.split('\n');
  const terms: KeyTerm[] = [];

  for (const rawLine of lines) {
    const line = stripMarkdownSyntax(rawLine);
    if (line.length < 20 || line.length > 260) continue;

    // Pattern 1: "Term: definition" or "Term — definition"
    const colonMatch = line.match(
      /^([A-Za-zÀ-ÖØ-öø-ÿ\u0600-\u06FF0-9\s/()'-]{2,42})\s*(?::|—|–|-)\s+(.{18,190})$/
    );
    if (colonMatch) {
      const term = colonMatch[1].trim();
      const def = truncateText(colonMatch[2].trim(), 140);
      if (
        !/^(page|note|example|exemple|exercice|exercise|question|section|chapter|part|hint|answer|réponse|solution)\b/i.test(
          term
        ) &&
        term.split(/\s+/).length <= 6 &&
        !terms.some((t) => t.term.toLowerCase() === term.toLowerCase())
      ) {
        terms.push({ term, definition: def });
      }
    }
    if (terms.length >= 4) break;
  }

  // Pattern 2: "X is / est / هو ..."
  if (terms.length < 3) {
    const sentences = extractSentencesFromMaterial(text);
    for (const s of sentences) {
      const m = s.match(
        /^([A-ZÀ-ÖØ-Ý\u0600-\u06FF][A-Za-zÀ-ÖØ-öø-ÿ\u0600-\u06FF0-9\s-]{2,34})\s+(?:is|are|refers to|means|est un|est une|désigne|هو|هي)\s+(.{20,150})/
      );
      if (m) {
        const term = m[1].trim();
        const def = truncateText(m[2].trim(), 135);
        if (!terms.some((t) => t.term.toLowerCase() === term.toLowerCase())) {
          terms.push({ term, definition: def });
        }
      }
      if (terms.length >= 3) break;
    }
  }

  return terms.slice(0, 3);
}

function extractExamProblems(text: string): string[] {
  const lines = text.split('\n');
  const problems: string[] = [];

  for (const rawLine of lines) {
    const line = stripMarkdownSyntax(rawLine);
    if (line.length < 22 || line.length > 240) continue;
    if (
      /[?؟]$/.test(line) ||
      /\b(?:calculate|prove|show that|derive|determine|find|solve|explain why|compare|calculez|montrer|déterminer|expliquer|résoudre|احسب|برهن|اشرح|قارن)\b/i.test(
        line
      )
    ) {
      problems.push(line);
    }
  }

  return Array.from(new Set(problems)).slice(0, 8);
}

function invertDocumentSentence(sentence: string): string {
  const swaps: [RegExp, string][] = [
    [/\bincreases\b/i, 'decreases'],
    [/\bdecreases\b/i, 'increases'],
    [/\brequires\b/i, 'never requires'],
    [/\bprevents\b/i, 'causes'],
    [/\ballows\b/i, 'prevents'],
    [/\blinear\b/i, 'non-linear'],
    [/\bconstant\b/i, 'exponentially varying'],
    [/\bconverges\b/i, 'always diverges'],
    [/\baugmente\b/i, 'diminue'],
    [/\bdiminue\b/i, 'augmente'],
    [/\bnécessite\b/i, 'ne nécessite jamais'],
    [/\bpermet\b/i, 'empêche'],
    [/\bjamais\b/i, 'toujours'],
    [/\binvariant\b/i, 'aléatoire'],
    [/يزيد/, 'يقلل'],
    [/يقلل/, 'يزيد'],
    [/يتطلب/, 'لا يتطلب'],
  ];

  for (const [pattern, rep] of swaps) {
    if (pattern.test(sentence)) return sentence.replace(pattern, rep);
  }
  return `The inverse of this holds: ${truncateText(sentence, 120)} does not apply in this material.`;
}

function shuffleFour(
  correct: string,
  distractors: string[]
): { options: string[]; correctIndex: number } {
  // Variable 3–5 choices, mirroring the AI's per-question choice.
  const totalChoices = 3 + Math.floor(Math.random() * 3);
  const unique = Array.from(
    new Set(distractors.map((d) => d.trim()).filter((d) => d && d !== correct))
  ).slice(0, totalChoices - 1);
  const fallbacks = [
    'This condition is ignored and has no effect on the outcome',
    'The relationship only applies when all variables are zero',
    'None of the principles stated in the material support this',
    'This reverses the cause and effect stated in the material',
  ];
  let fallbackIdx = 0;
  while (unique.length < totalChoices - 1) {
    const candidate = fallbacks[fallbackIdx % fallbacks.length];
    fallbackIdx += 1;
    if (candidate !== correct && !unique.includes(candidate)) unique.push(candidate);
  }
  const list = [
    { text: correct, ok: true },
    ...unique.map((text) => ({ text, ok: false })),
  ];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return {
    options: list.map((x) => x.text),
    correctIndex: list.findIndex((x) => x.ok),
  };
}

export function synthesizeLocalSessionFromMaterials(params: {
  query: string;
  materials: UploadedMaterial[];
  depth: DepthLevel;
  tutorLanguage: TutorLanguage;
  darijaScript: DarijaScript;
}): {
  title: string;
  materialKind: MaterialKind;
  studyRoadmap: StudyRoadmapItem[];
  explanation: ExplanationSection;
  questions: QCMQuestion[];
  relatedTopics: string[];
} {
  const { query, materials, depth } = params;
  const combinedText = materials.map((m) => m.text).join('\n\n');
  const hasExam = materials.some((m) => m.kind === 'exam');
  const materialKind: MaterialKind = hasExam ? 'exam' : 'course';

  const headings = extractHeadingsAndTopics(combinedText);
  const keyTerms = extractKeyTermsFromMaterial(combinedText);
  const examProblems = hasExam ? extractExamProblems(combinedText) : [];
  const sentences = extractSentencesFromMaterial(combinedText);
  // Derive a quiz size from material complexity; no fixed learner-facing count.
  const questionCount = Math.min(
    14,
    Math.max(
      5,
      3 + Math.min(5, headings.length) + Math.min(4, keyTerms.length) + Math.min(3, examProblems.length)
    )
  );

  // Filter sentences by user focus query if provided
  const focusWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);
  const prioritizedSentences =
    focusWords.length > 0
      ? [
          ...sentences.filter((s) =>
            focusWords.some((w) => s.toLowerCase().includes(w))
          ),
          ...sentences.filter(
            (s) => !focusWords.some((w) => s.toLowerCase().includes(w))
          ),
        ]
      : sentences;

  const baseName = materials[0].name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
  const title =
    query.trim().length > 2
      ? `${query.trim()} — ${baseName}`
      : headings[0] || (hasExam ? `Exam Prep: ${baseName}` : baseName);

  // Build "What You Need to Learn" roadmap from headings, key terms, and exam problems
  const roadmap: StudyRoadmapItem[] = [];
  const seenTopics = new Set<string>();

  const pushTopic = (topic: string, why: string, priority: 'high' | 'medium') => {
    const clean = truncateText(topic, 72);
    const key = clean.toLowerCase();
    if (!clean || seenTopics.has(key) || roadmap.length >= 6) return;
    seenTopics.add(key);
    roadmap.push({ topic: clean, why: truncateText(why, 130), priority });
  };

  if (hasExam) {
    for (const prob of examProblems.slice(0, 3)) {
      const matchedTerm = keyTerms.find((kt) =>
        prob.toLowerCase().includes(kt.term.toLowerCase())
      );
      pushTopic(
        matchedTerm ? matchedTerm.term : truncateText(prob, 64),
        `Directly tested in your uploaded exercises/exam: "${truncateText(prob, 95)}"`,
        'high'
      );
    }
  }

  for (const heading of headings.slice(0, 5)) {
    pushTopic(
      heading,
      hasExam
        ? 'Core section referenced in your exam/exercise sheet.'
        : 'Key section extracted from your uploaded course material.',
      roadmap.length < 3 ? 'high' : 'medium'
    );
  }

  for (const kt of keyTerms) {
    pushTopic(kt.term, kt.definition, roadmap.length < 3 ? 'high' : 'medium');
  }

  const bigPicture = hasExam
    ? `Extracted from ${materials.map((m) => m.name).join(', ')}: ${
        prioritizedSentences.slice(0, 2).join(' ') ||
        `Your uploaded exam/exercise material focuses on ${
          roadmap
            .slice(0, 3)
            .map((r) => r.topic)
            .join(', ') || baseName
        }. Master the underlying concepts below before re-solving each exercise.`
      }`
    : prioritizedSentences.slice(0, depth === 'intro' ? 2 : 3).join(' ') ||
      truncateText(combinedText, 360);

  const mechanicCount = depth === 'intro' ? 2 : depth === 'deep' ? 4 : 3;
  const mechanicsPool = hasExam && examProblems.length > 0
    ? [
        ...examProblems.slice(0, 2).map((p) => `Tested task: ${p}`),
        ...prioritizedSentences.slice(2, 6),
      ]
    : prioritizedSentences.slice(2, 10);

  const mechanics = (mechanicsPool.length > 0 ? mechanicsPool : prioritizedSentences)
    .slice(0, mechanicCount)
    .map((s) => truncateText(s, 230));

  const pitfallSentence = prioritizedSentences.find((s) =>
    /(however|unlike|beware|pitfall|mistake|common error|not to be confused|attention|erreur|piège|cependant|contrairement|خطأ|لكن|انتبه)/i.test(
      s
    )
  );

  const pitfall =
    pitfallSentence ||
    (hasExam
      ? 'In exams and exercises, students often jump straight to formulas without checking hypotheses or boundary conditions. Verify every assumption tested in these problems.'
      : 'Focus on the causal links between definitions and mechanisms in your notes rather than memorizing isolated sentences. (Tip: connect Gemini or ChatGPT in Settings for deeper AI synthesis in your chosen tutor language.)');

  // Build diagnostic QCMs from key terms & extracted statements
  const questions: QCMQuestion[] = [];
  const otherStatements = prioritizedSentences.map((s) => truncateText(s, 145));

  // 1. Key term QCMs
  for (let i = 0; i < keyTerms.length && questions.length < questionCount; i++) {
    const kt = keyTerms[i];
    const distractors = [
      ...keyTerms.filter((_, idx) => idx !== i).map((other) => other.definition),
      invertDocumentSentence(kt.definition),
      ...otherStatements.slice(i + 2, i + 5),
    ];
    const { options, correctIndex } = shuffleFour(kt.definition, distractors);
    questions.push({
      id: uid('doc-q'),
      tag: 'Core Concept',
      prompt: `According to your uploaded material, what best defines "${kt.term}"?`,
      options,
      correctIndex,
      rationale: `From your material: ${kt.term} — ${kt.definition}`,
    });
  }

  // 2. Statement / mechanism / exam-concept QCMs
  const factPool = prioritizedSentences.filter((s) => !/[?؟]$/.test(s));
  const tags: QCMTag[] = ['Mechanism', 'Application', 'Misconception', 'Core Concept'];

  let factCursor = 0;
  while (questions.length < questionCount && factCursor < factPool.length) {
    const fact = factPool[factCursor++];
    const correct = truncateText(fact, 150);
    const distractors = [
      truncateText(invertDocumentSentence(fact), 150),
      otherStatements[(factCursor + 3) % Math.max(1, otherStatements.length)] ||
        'The material explicitly states that this principle never applies.',
      'This result contradicts the assumptions given in the uploaded document.',
    ];
    const { options, correctIndex } = shuffleFour(correct, distractors);
    const tag = tags[questions.length % tags.length];
    const prompt = hasExam
      ? `Which concept or rule from your material is essential to solve these exercises accurately?`
      : tag === 'Mechanism'
        ? `Which statement accurately describes a mechanism from "${baseName}"?`
        : tag === 'Application'
          ? `Which principle from "${baseName}" holds true when applied?`
          : `Which statement is supported by your uploaded notes on "${baseName}"?`;

    questions.push({
      id: uid('doc-q'),
      tag,
      prompt:
        questions.some((q) => q.prompt === prompt)
          ? `${prompt} (Point #${questions.length + 1})`
          : prompt,
      options,
      correctIndex,
      rationale: `Grounded in your uploaded document: ${fact}`,
    });
  }

  const relatedTopics = Array.from(
    new Set([
      ...roadmap.slice(0, 3).map((r) => r.topic),
      ...headings.slice(1, 4),
    ])
  ).slice(0, 3);

  return {
    title,
    materialKind,
    studyRoadmap: roadmap,
    explanation: {
      bigPicture,
      mechanics: mechanics.length > 0 ? mechanics : [bigPicture],
      pitfall,
      keyTerms,
    },
    questions,
    relatedTopics,
  };
}
