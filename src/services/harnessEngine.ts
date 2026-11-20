import { CURATED_TOPICS, CuratedTopic } from '../data/curatedTopics';
import { findLocalizedCuratedTopic } from '../data/localizedCuratedTopics';
import {
  ChatGPTOAuthSettings,
  DarijaScript,
  DepthLevel,
  ExplanationSection,
  GeminiModelOption,
  GeminiSettings,
  HarnessSettings,
  KeyTerm,
  LearningStage,
  MaterialKind,
  OpenAISettings,
  QCMQuestion,
  QCMTag,
  SessionSource,
  StudyRoadmapItem,
  StudySession,
  TutorLanguage,
  UploadedMaterial,
} from '../types/harness';
import {
  formatMaterialsForPrompt,
  synthesizeLocalSessionFromMaterials,
} from './documentParser';
import { buildLanguageInstruction } from './languageConfig';
import { runChatGPTOAuthInference } from './openaiOAuthClient';

export const GEMINI_2026_MODELS: GeminiModelOption[] = [
  {
    id: 'gemini-3.8-flash',
    label: 'Gemini 3.8 Flash',
    badge: 'Newest Free Flash · Recommended',
    freeTier: true,
    quotaNote: 'Free of charge on Standard · Google’s default for new projects (1M ctx)',
  },
  {
    id: 'gemini-3.5-flash-lite',
    label: 'Gemini 3.5 Flash-Lite',
    badge: 'Free · High Daily Quota',
    freeTier: true,
    quotaNote: 'Free of charge · Up to ~500 RPD / 15 RPM on free projects',
  },
  {
    id: 'gemini-4-hydrogen',
    label: 'Gemini 4 Hydrogen',
    badge: 'Gemini 4 Free Tier',
    freeTier: true,
    quotaNote: 'Only Gemini 4 model with a Free Tier row on Standard (GA Nov 2026)',
  },
  {
    id: 'gemini-3.6-flash',
    label: 'Gemini 3.6 Flash',
    badge: 'Free · Stable 3.x',
    freeTier: true,
    quotaNote: 'Free of charge · Stable previous-release Flash model',
  },
  {
    id: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash-Lite',
    badge: 'Free · High Quota',
    freeTier: true,
    quotaNote: 'Free of charge · Lightweight 1M/64k workhorse (~500 RPD)',
  },
  {
    id: 'gemini-3-flash-preview',
    label: 'Gemini 3 Flash Preview',
    badge: 'Free · Preview',
    freeTier: true,
    quotaNote: 'Free of charge in Gemini API (1M input / 64k output)',
  },
  {
    id: 'gemma-4-31b-it',
    label: 'Gemma 4 31B Instruct',
    badge: 'Free · Highest Quota (14.4k/day)',
    freeTier: true,
    quotaNote: 'Free open-weight model via Gemini API key · ~30 RPM / 14,400 RPD',
  },
  {
    id: 'gemma-4-26b-a4b-it',
    label: 'Gemma 4 26B MoE (A4B)',
    badge: 'Free · Ultra-Fast MoE',
    freeTier: true,
    quotaNote: 'Free open-weight active-4B MoE via Gemini API key · ~30 RPM / 14,400 RPD',
  },
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash (Legacy)',
    badge: 'Legacy Free · Older Keys Only',
    freeTier: true,
    quotaNote: 'Restricted on new 2026 projects; use 3.8-flash or 3.5-flash-lite for new keys',
  },
  {
    id: 'gemini-2.5-flash-lite',
    label: 'Gemini 2.5 Flash-Lite (Legacy)',
    badge: 'Legacy Free · Older Keys Only',
    freeTier: true,
    quotaNote: 'Limited to projects that previously used 2.5 models',
  },
  {
    id: 'gemini-4-argon',
    label: 'Gemini 4 Argon (Paid Only)',
    badge: 'Paid Billing Required',
    freeTier: false,
    quotaNote: 'Flagship reasoning model — not available on the Free Tier',
  },
  {
    id: 'gemini-4-carbon',
    label: 'Gemini 4 Carbon (Paid Only)',
    badge: 'Paid Billing Required',
    freeTier: false,
    quotaNote: 'Frontier reasoning model — requires linked Cloud Billing',
  },
  {
    id: 'gemini-3.1-pro-preview',
    label: 'Gemini 3.1 Pro Preview (Paid Only)',
    badge: 'Paid Billing Required',
    freeTier: false,
    quotaNote: 'No free tier in the Gemini API (free only inside AI Studio UI)',
  },
];

function uid(prefix = 'id'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeQuery(raw: string): string {
  return raw
    .toLowerCase()
    .replace(
      /^(explain|what is|what are|how does|how do|tell me about|teach me|describe|explique|qu'est-ce que|comment fonctionne|اشرح|ما هو|ما هي|كيف يعمل|kifach|chrah|chno howa|chno hiya)\s+/i,
      ''
    )
    .replace(/[?!.,؟]+$/g, '')
    .trim();
}

export function findCuratedTopic(rawQuery: string): CuratedTopic | null {
  const cleaned = normalizeQuery(rawQuery);
  if (!cleaned) return null;

  let best: { topic: CuratedTopic; score: number } | null = null;
  const queryWords = cleaned.split(/\s+/).filter((w) => w.length > 2);

  for (const topic of CURATED_TOPICS) {
    let score = 0;
    const titleLower = topic.title.toLowerCase();
    if (titleLower === cleaned || topic.slug === cleaned) score += 100;
    if (titleLower.includes(cleaned) || cleaned.includes(titleLower)) score += 45;

    for (const kw of topic.keywords) {
      if (cleaned === kw) score += 80;
      else if (cleaned.includes(kw)) score += 40;
      else if (kw.includes(cleaned) && cleaned.length >= 4) score += 25;
    }

    for (const w of queryWords) {
      if (titleLower.includes(w)) score += 8;
      if (topic.keywords.some((kw) => kw.includes(w))) score += 10;
    }

    if (score >= 25 && (!best || score > best.score)) {
      best = { topic, score };
    }
  }

  return best ? best.topic : null;
}

function cleanWikiText(text: string): string {
  return text
    .replace(/\([^)]*listen[^)]*\)/gi, '')
    .replace(/\/[^/]{2,30}\//g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitSentences(text: string): string[] {
  const cleaned = cleanWikiText(text);
  const raw = cleaned.match(/[^.!?؟]+[.!?؟]+/g) || [];
  return raw
    .map((s) => s.trim())
    .filter(
      (s) =>
        s.length >= 40 &&
        s.length <= 280 &&
        !s.startsWith('See also') &&
        !s.startsWith('Voir aussi') &&
        !s.startsWith('انظر أيضًا')
    );
}

const FALLBACK_DISTRACTORS = [
  'None of the mechanisms described apply under standard conditions',
  'It operates independently of any underlying structural constraints',
  'It reverses its primary effect whenever observed directly',
  'It only holds in a narrow edge case that contradicts the core definition',
  'It describes a neighboring concept, not the one being tested here',
];

/**
 * Builds a shuffled option list with a variable number of choices (3–5),
 * mimicking what the AI does when it picks per-question option counts.
 */
function shuffleWithCorrect(
  correct: string,
  distractors: string[],
  optionCount?: number
): { options: string[]; correctIndex: number } {
  const totalChoices =
    optionCount && optionCount >= 2 && optionCount <= 6
      ? Math.floor(optionCount)
      : 3 + Math.floor(Math.random() * 3); // 3, 4, or 5
  const neededDistractors = totalChoices - 1;

  const uniqueDistractors = Array.from(
    new Set(distractors.map((d) => d.trim()).filter((d) => d && d !== correct))
  ).slice(0, neededDistractors);

  let fallbackIdx = 0;
  while (uniqueDistractors.length < neededDistractors) {
    const candidate = FALLBACK_DISTRACTORS[fallbackIdx % FALLBACK_DISTRACTORS.length];
    fallbackIdx += 1;
    if (candidate !== correct && !uniqueDistractors.includes(candidate)) {
      uniqueDistractors.push(candidate);
    }
  }

  const tagged = [
    { text: correct, isCorrect: true },
    ...uniqueDistractors.map((text) => ({ text, isCorrect: false })),
  ];

  for (let i = tagged.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tagged[i], tagged[j]] = [tagged[j], tagged[i]];
  }

  return {
    options: tagged.map((t) => t.text),
    correctIndex: tagged.findIndex((item) => item.isCorrect),
  };
}

function invertStatement(
  sentence: string,
  topicTitle: string,
  wikiLang = 'en'
): string {
  const swaps: [RegExp, string][] =
    wikiLang === 'fr'
      ? [
          [/\baugmente\b/i, 'diminue'],
          [/\bdiminue\b/i, 'augmente'],
          [/\bnécessite\b/i, 'supprime le besoin de'],
          [/\bempêche\b/i, 'accélère'],
          [/\bpermet\b/i, 'bloque'],
          [/\bjamais\b/i, 'toujours'],
          [/\buniquement\b/i, 'jamais'],
          [/\bsans\b/i, 'exclusivement via'],
          [/\bplus élevé\b/i, 'plus faible'],
        ]
      : wikiLang === 'ar' || wikiLang === 'ary'
        ? [
            [/يزيد/, 'يقلل'],
            [/يقلل/, 'يزيد'],
            [/يتطلب/, 'يستغني عن'],
            [/يمنع/, 'يسرّع'],
            [/يسمح/, 'يمنع'],
            [/لا يمكن/, 'دائماً يمكن'],
            [/فقط/, 'أبداً لا'],
          ]
        : [
            [/\bincreases\b/i, 'decreases'],
            [/\bdecreases\b/i, 'increases'],
            [/\brequires\b/i, 'eliminates the need for'],
            [/\bprevents\b/i, 'accelerates'],
            [/\ballows\b/i, 'blocks'],
            [/\bprimary\b/i, 'unrelated secondary'],
            [/\bcannot\b/i, 'always'],
            [/\bnever\b/i, 'invariably'],
            [/\bonly\b/i, 'never'],
            [/\bwithout\b/i, 'exclusively through'],
            [/\bhigher\b/i, 'lower'],
            [/\blower\b/i, 'higher'],
            [/\bdirectly\b/i, 'never'],
            [/\bmost\b/i, 'least'],
          ];

  for (const [pattern, replacement] of swaps) {
    if (pattern.test(sentence)) {
      return sentence.replace(pattern, replacement);
    }
  }

  if (wikiLang === 'fr') {
    return `Contrairement aux principes établis, ${topicTitle} fonctionne sans faire intervenir le mécanisme décrit ci-dessus.`;
  }
  if (wikiLang === 'ar' || wikiLang === 'ary') {
    return `على عكس الفهم العلمي الصحيح، يعمل ${topicTitle} دون تدخل الآلية الأساسية المذكورة أعلاه.`;
  }
  return `Contrary to standard understanding, ${topicTitle} operates without involving the core mechanism described above.`;
}

function truncateClause(text: string, maxLen = 155): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  const cut = clean.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 60 ? lastSpace : maxLen)}…`;
}

interface WikiArticle {
  title: string;
  extract: string;
  fullurl: string;
  wikiLang: string;
}

function getWikiSubdomain(language: TutorLanguage, script: DarijaScript): string {
  if (language === 'fr') return 'fr';
  if (language === 'ar') return 'ar';
  if (language === 'darija-fr') return script === 'arabic' ? 'ary' : 'fr';
  return 'en';
}

async function searchWikipedia(
  query: string,
  wikiLang = 'en'
): Promise<{ title: string; snippet: string }[]> {
  const url = `https://${wikiLang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
    query
  )}&srlimit=5&format=json&origin=*`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Wikipedia search failed');
  const data = await res.json();
  return (data?.query?.search || []).map((item: { title: string; snippet: string }) => ({
    title: item.title,
    snippet: item.snippet.replace(/<[^>]+>/g, ''),
  }));
}

async function resolveWikiLangLink(
  title: string,
  fromLang: string,
  toLang: string
): Promise<string | null> {
  const url = `https://${fromLang}.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=${encodeURIComponent(
    toLang
  )}&titles=${encodeURIComponent(title)}&redirects=1&format=json&origin=*`;
  const res = await fetch(url).catch(() => null);
  if (!res || !res.ok) return null;
  const data = await res.json().catch(() => null);
  const pages = data?.query?.pages;
  if (!pages) return null;
  const firstKey = Object.keys(pages)[0];
  const page = pages[firstKey];
  const linkTitle = page?.langlinks?.[0]?.['*'];
  return typeof linkTitle === 'string' && linkTitle.trim() ? linkTitle.trim() : null;
}

async function fetchWikiArticle(
  title: string,
  wikiLang = 'en'
): Promise<WikiArticle | null> {
  const url = `https://${wikiLang}.wikipedia.org/w/api.php?action=query&prop=extracts|info&inprop=url&explaintext=1&exsectionformat=plain&titles=${encodeURIComponent(
    title
  )}&redirects=1&format=json&origin=*`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const pages = data?.query?.pages;
  if (!pages) return null;
  const firstKey = Object.keys(pages)[0];
  const page = pages[firstKey];
  if (!page || page.missing || !page.extract) return null;
  return {
    title: page.title,
    extract: page.extract,
    fullurl:
      page.fullurl ||
      `https://${wikiLang}.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
    wikiLang,
  };
}

function getWikiCopy(
  wikiLang: string,
  tutorLanguage: TutorLanguage,
  darijaScript: DarijaScript,
  title: string,
  neighborTitle?: string
) {
  if (tutorLanguage === 'darija-fr' && darijaScript === 'arabizi') {
    return {
      defPrompt: `Chno hiya l-affirmation li katwssf "${title}" b tari9a s7i7a?`,
      defDistractor1: `Fikra nazariya ma 3ndha 7ta 3ala9a b "${title}".`,
      defDistractor2: `Tari9a 9dima t7yydat kamla 9bel l-ab7at l-7adita 3la "${title}".`,
      defRationale: (s: string) => `L-ta3rif l-asassi: ${s}`,
      defDeep: `L-fahm dyal "${title}" kayferr9o 3la "${neighborTitle || 'les concepts l-khrin'}".`,
      mechPrompt1: `Achmen mécanisme kaychre7 kifach "${title}" kaykhdem?`,
      mechPrompt2: `Achmen 3ala9a sababiya s7i7a b nissba l "${title}"?`,
      mechDistractor1: `Kay3tamed ghir 3la l-7azz bla ta nizam.`,
      mechDistractor2: `Had l-processus kayw9e3 dima b l-3aks w ma kaydkhlch f "${title}".`,
      mechRationale: (s: string) => `L-mécanisme l-asassi: ${s}`,
      mechDeep: `Rkkz 3la r-rabit s-sababi f had l-mar7ala.`,
      misPrompt: `Achmen no9ta mohimma f "${title}" katmn3na mn ghalat cha2i3?`,
      misDistractor1: `Ma kaynin ta istisna2at melli kantbb9o "${title}".`,
      misDistractor2: `Les experts kay3tabro "${title}" b7alo b7al "${neighborTitle || 'kolla concept akhor'}".`,
      misRationale: (s: string) => `Far9 mohim: ${s}`,
      misDeep: `Had t-tfri9 kay7mi mn les confusions l-ma3rofin.`,
      appPrompt: `F t-tatbi9 dyal "${title}", achmen jomla s7i7a?`,
      factPrompt: `Achmen ma3loma s7i7a 3la "${title}"?`,
      appDistractor1: `"${title}" mamnou3 ytfa3el m3a ay système akhor.`,
      appDistractor2: `Les expériences binno belli had l-khassiya ghalta.`,
      factRationale: (s: string) => `Ma3loma mo2akkada: ${s}`,
      pitfallFallback:
        `Rdd l-bal ma tkhlletch "${title}" m3a concepts 9rab lih (Astuce: l-mode Built-in kayjib texte mn Wikipedia; zyd Gemini wla ChatGPT OAuth f Settings bach tchra7 b Darija + Français kamla 3la ay mawdou3).`,
    };
  }
  if (tutorLanguage === 'darija-fr' && darijaScript === 'arabic') {
    return {
      defPrompt: `شنو هي الجملة اللي كتوصف "${title}" بطريقة صحيحة؟`,
      defDistractor1: `افتراض نظري معندو حتى علاقة بـ "${title}".`,
      defDistractor2: `طريقة قديمة تخلّاو عليها تماماً قبل الأبحاث الحديثة على "${title}".`,
      defRationale: (s: string) => `التعريف الأساسي: ${s}`,
      defDeep: `فهم "${title}" كيفرّقو على "${neighborTitle || 'المفاهيم المجاورة'}".`,
      mechPrompt1: `أشمن mécanisme كيشرح كيفاش "${title}" كيخدم؟`,
      mechPrompt2: `أشمن علاقة سببية صحيحة بالنسبة لـ "${title}"؟`,
      mechDistractor1: `كيعتمد غير على الصدفة بلا حتى نظام.`,
      mechDistractor2: `هاد الـ processus كيوقع ديما بالعكس وما كيدخلش فـ "${title}".`,
      mechRationale: (s: string) => `الـ mécanisme الأساسي: ${s}`,
      mechDeep: `ركّز على الرابط السببي فهاد المرحلة.`,
      misPrompt: `أشمن نقطة مهمة فـ "${title}" كتمنعنا من غلط شائع؟`,
      misDistractor1: `ما كاينين تا استثناءات ملي كنطبقو "${title}".`,
      misDistractor2: `الخبراء كيعتبرو "${title}" بحالو بحال "${neighborTitle || 'أي مفهوم آخر'}".`,
      misRationale: (s: string) => `فرق مهم: ${s}`,
      misDeep: `هاد التوضيح كيحمي من الأغلاط المعروفة.`,
      appPrompt: `فالتطبيق ديال "${title}"، أشمن جملة صحيحة؟`,
      factPrompt: `أشمن معلومة صحيحة على "${title}"؟`,
      appDistractor1: `"${title}" ممنوع يتفاعل مع أي نظام خارجي.`,
      appDistractor2: `التجارب بينات باللي هاد الخاصية غالطة.`,
      factRationale: (s: string) => `معلومة مؤكدة: ${s}`,
      pitfallFallback:
        `ردّ البال ما تخلطش "${title}" مع مفاهيم قريبة ليه (ملاحظة: فـ وضع Built-in هاد الموضوع جا من Wikipedia؛ يلا بغيتي شرح كامل بالدارجة + الفرنسية لأي موضوع، اختار Gemini أو ChatGPT من الإعدادات).`,
    };
  }
  if (wikiLang === 'fr' || tutorLanguage === 'fr') {
    return {
      defPrompt: `Quelle affirmation caractérise le plus fidèlement « ${title} » ?`,
      defDistractor1: `Une simple hypothèse théorique sans lien avec le comportement réel de ${title}.`,
      defDistractor2: `Une convention ancienne totalement abandonnée avant l’étude moderne de ${title}.`,
      defRationale: (s: string) => `D’après la définition centrale : ${s}`,
      defDeep: `Bien définir « ${title} » permet de le distinguer de notions voisines comme ${
        neighborTitle || 'les concepts associés'
      }.`,
      mechPrompt1: `Quel mécanisme ou relation explique correctement le fonctionnement de « ${title} » ?`,
      mechPrompt2: `Laquelle de ces relations causales concernant « ${title} » est exacte ?`,
      mechDistractor1: `Ce phénomène repose uniquement sur le hasard sans interaction structurée.`,
      mechDistractor2: `Ce processus se déroule toujours en sens inverse et n’implique jamais ${title}.`,
      mechRationale: (s: string) => `Mécanisme clé : ${s}`,
      mechDeep: `Observez le lien causal : inverser la direction ou retirer la condition brise le mécanisme.`,
      misPrompt: `Quelle nuance à propos de « ${title} » permet d’éviter une confusion fréquente ?`,
      misDistractor1: `Il n’existe aucune exception ni condition limite lors de l’application de ${title}.`,
      misDistractor2: `Les spécialistes considèrent ${title} comme strictement identique à ${
        neighborTitle || 'toute notion voisine'
      }.`,
      misRationale: (s: string) => `Distinction importante : ${s}`,
      misDeep: `Les nuances contrastives révèlent là où l’intuition peut tromper.`,
      appPrompt: `En pratique, lorsqu’on analyse « ${title} », quelle proposition est vraie ?`,
      factPrompt: `Quel fait décrit avec exactitude un aspect de « ${title} » ?`,
      appDistractor1: `${title} ne peut en aucun cas interagir avec des systèmes externes.`,
      appDistractor2: `Les observations réfutent systématiquement cette propriété de ${title}.`,
      factRationale: (s: string) => `Point vérifié : ${s}`,
      pitfallFallback: `Veillez à ne pas confondre « ${title} » avec des notions voisines — concentrez-vous sur son mécanisme spécifique.`,
    };
  }
  if (wikiLang === 'ar' || wikiLang === 'ary' || tutorLanguage === 'ar') {
    return {
      defPrompt: `أي عبارة تصف «${title}» بأدق صورة؟`,
      defDistractor1: `افتراض نظري بحت لا علاقة له بخصائص «${title}» الفعلية.`,
      defDistractor2: `اصطلاح قديم تم التخلي عنه بالكامل قبل الدراسة الحديثة لـ «${title}».`,
      defRationale: (s: string) => `استناداً إلى التعريف الأساسي: ${s}`,
      defDeep: `يساعد فهم تعريف «${title}» على تمييزه عن المفاهيم القريبة مثل ${
        neighborTitle || 'المفاهيم المجاورة'
      }.`,
      mechPrompt1: `أي آلية أو علاقة تشرح كيفية عمل «${title}» بدقة؟`,
      mechPrompt2: `أي من العلاقات السببية التالية حول «${title}» صحيحة؟`,
      mechDistractor1: `يعتمد هذا الأمر على العشوائية المطلقة دون أي تفاعل منظم.`,
      mechDistractor2: `تحدث هذه العملية دائماً بالعكس ولا ترتبط بـ «${title}».`,
      mechRationale: (s: string) => `الآلية الرئيسية: ${s}`,
      mechDeep: `انتبه للربط السببي؛ فعكس الاتجاه أو غياب الشرط يوقف الظاهرة.`,
      misPrompt: `أي تمييز دقيق حول «${title}» يساعد على تجنب خطأ شائع؟`,
      misDistractor1: `لا توجد أي استثناءات أو شروط حدية عند تطبيق «${title}».`,
      misDistractor2: `يعدّ الخبراء «${title}» مطابقاً تماماً لـ ${
        neighborTitle || 'كل مفهوم مجاور'
      }.`,
      misRationale: (s: string) => `تمييز مهم: ${s}`,
      misDeep: `تساعد الفروق الدقيقة على تثبيت الفهم الصحيح.`,
      appPrompt: `عند تحليل «${title}» عملياً، أي عبارة تبقى صحيحة؟`,
      factPrompt: `أي حقيقة تصف جانباً من «${title}» بدقة؟`,
      appDistractor1: `يُمنع تفاعل «${title}» مع أي أنظمة خارجية مطلقاً.`,
      appDistractor2: `أثبتت الأدلة التجريبية عدم صحة هذه الخاصية في «${title}».`,
      factRationale: (s: string) => `نقطة موثقة: ${s}`,
      pitfallFallback: `احرص على عدم الخلط بين «${title}» والمفاهيم القريبة منه، وركّز على آليته المميزة.`,
    };
  }
  return {
    defPrompt: `Which statement most accurately characterizes ${title}?`,
    defDistractor1: `A purely theoretical assumption unrelated to observable ${title.toLowerCase()} behavior.`,
    defDistractor2: `A legacy convention that was completely abandoned before modern study of ${title}.`,
    defRationale: (s: string) => `Grounded in the core definition: ${s}`,
    defDeep: `Understanding how ${title} is formally defined separates it from neighboring concepts like ${
      neighborTitle || 'related frameworks'
    }.`,
    mechPrompt1: `Which mechanism or relationship accurately explains how ${title} works?`,
    mechPrompt2: `Which of the following causal claims about ${title} is supported by the explanation?`,
    mechDistractor1: `It relies exclusively on random trial-and-error rather than structured interactions.`,
    mechDistractor2: `This process occurs only in reverse and never involves ${title.toLowerCase()}.`,
    mechRationale: (s: string) => `Key mechanism: ${s}`,
    mechDeep: `Look for the causal link here—swapping direction or removing the enabling condition breaks the phenomenon.`,
    misPrompt: `Which nuance or distinction about ${title} helps avoid a common misunderstanding?`,
    misDistractor1: `There are no exceptions or boundary conditions when applying ${title}.`,
    misDistractor2: `Experts universally treat ${title} as identical to ${
      neighborTitle || 'every adjacent concept'
    }.`,
    misRationale: (s: string) => `Important distinction: ${s}`,
    misDeep: `Contrastive statements highlight where intuition often slips up.`,
    appPrompt: `When analyzing ${title} in practice, which statement holds true?`,
    factPrompt: `Which fact accurately describes an aspect of ${title}?`,
    appDistractor1: `${title} is strictly forbidden from interacting with external systems.`,
    appDistractor2: `Empirical evidence consistently disproves this property of ${title}.`,
    factRationale: (s: string) => `Verified point: ${s}`,
    pitfallFallback: `Be careful not to confuse ${title} with closely related ideas—focus on its specific defining mechanism.`,
  };
}

function buildWikiQuestions(
  article: WikiArticle,
  neighborSummaries: { title: string; summary: string }[],
  requestedCount: number,
  excludePrompts: Set<string> = new Set(),
  tutorLanguage: TutorLanguage = 'en',
  darijaScript: DarijaScript = 'arabizi'
): QCMQuestion[] {
  const sentences = splitSentences(article.extract);
  const title = article.title;
  const copy = getWikiCopy(
    article.wikiLang,
    tutorLanguage,
    darijaScript,
    title,
    neighborSummaries[0]?.title
  );
  const questions: QCMQuestion[] = [];

  const neighborStatements = neighborSummaries
    .flatMap((n) => splitSentences(n.summary).slice(0, 2))
    .map((s) => truncateClause(s));

  const usedSentences = new Set<string>();

  const defSentence =
    sentences.find((s) =>
      /\b(is a|is an|is the|refers to|describes|est un|est une|désigne|est l'|هو|هي|يُعد|تُعد|تشير)\b/i.test(
        s
      )
    ) || sentences[0];

  if (defSentence) {
    usedSentences.add(defSentence);
    const prompt = copy.defPrompt;
    if (!excludePrompts.has(prompt)) {
      const correct = truncateClause(defSentence);
      const distractors = [
        truncateClause(invertStatement(defSentence, title, article.wikiLang)),
        neighborStatements[0] || copy.defDistractor1,
        neighborStatements[1] || copy.defDistractor2,
      ];
      const { options, correctIndex } = shuffleWithCorrect(correct, distractors);
      questions.push({
        id: uid('wq'),
        tag: 'Core Concept',
        prompt,
        options,
        correctIndex,
        rationale: copy.defRationale(defSentence),
        deepNote: copy.defDeep,
      });
    }
  }

  const causalSentences = sentences.filter(
    (s) =>
      !usedSentences.has(s) &&
      /(because|causes|enables|allows|results in|produces|through|uses|converts|operates|depends on|car|provoque|permet|entraîne|produit|utilise|dépend|لأن|يسبب|يسمح|يؤدي|ينتج|عبر|يستخدم|يعتمد)/i.test(
        s
      )
  );

  for (const cs of causalSentences.slice(0, 3)) {
    if (questions.length >= requestedCount) break;
    usedSentences.add(cs);

    const variantPrompt =
      questions.filter((q) => q.tag === 'Mechanism').length === 0
        ? copy.mechPrompt1
        : copy.mechPrompt2;

    if (excludePrompts.has(variantPrompt)) continue;

    const correct = truncateClause(cs);
    const distractors = [
      truncateClause(invertStatement(cs, title, article.wikiLang)),
      neighborStatements[questions.length % Math.max(1, neighborStatements.length)] ||
        copy.mechDistractor1,
      copy.mechDistractor2,
    ];

    const { options, correctIndex } = shuffleWithCorrect(correct, distractors);
    questions.push({
      id: uid('wq'),
      tag: 'Mechanism',
      prompt: variantPrompt,
      options,
      correctIndex,
      rationale: copy.mechRationale(cs),
      deepNote: copy.mechDeep,
    });
  }

  const contrastSentences = sentences.filter(
    (s) =>
      !usedSentences.has(s) &&
      /(however|unlike|although|whereas|contrast|instead|rather than|despite|cependant|contrairement|bien que|tandis que|malgré|لكن|بينما|على عكس|رغم|إلا أن)/i.test(
        s
      )
  );

  for (const con of contrastSentences.slice(0, 2)) {
    if (questions.length >= requestedCount) break;
    usedSentences.add(con);
    const prompt = copy.misPrompt;
    if (excludePrompts.has(prompt)) continue;

    const correct = truncateClause(con);
    const distractors = [
      truncateClause(invertStatement(con, title, article.wikiLang)),
      neighborStatements[2] || copy.misDistractor1,
      copy.misDistractor2,
    ];

    const { options, correctIndex } = shuffleWithCorrect(correct, distractors);
    questions.push({
      id: uid('wq'),
      tag: 'Misconception',
      prompt,
      options,
      correctIndex,
      rationale: copy.misRationale(con),
      deepNote: copy.misDeep,
    });
  }

  const remaining = sentences.filter((s) => !usedSentences.has(s));
  let idx = 0;
  while (questions.length < requestedCount && idx < remaining.length) {
    const s = remaining[idx++];
    usedSentences.add(s);
    const tags: QCMTag[] = ['Application', 'Core Concept', 'Mechanism'];
    const tag = tags[questions.length % tags.length];
    const prompt = tag === 'Application' ? copy.appPrompt : copy.factPrompt;

    if (excludePrompts.has(prompt)) continue;

    const correct = truncateClause(s);
    const distractors = [
      truncateClause(invertStatement(s, title, article.wikiLang)),
      neighborStatements[(idx + 1) % Math.max(1, neighborStatements.length)] ||
        copy.appDistractor1,
      copy.appDistractor2,
    ];

    const { options, correctIndex } = shuffleWithCorrect(correct, distractors);
    questions.push({
      id: uid('wq'),
      tag,
      prompt,
      options,
      correctIndex,
      rationale: copy.factRationale(s),
    });
  }

  return questions.slice(0, requestedCount);
}

function buildWikiExplanation(
  article: WikiArticle,
  depth: DepthLevel,
  tutorLanguage: TutorLanguage = 'en',
  darijaScript: DarijaScript = 'arabizi'
): ExplanationSection {
  const paragraphs = article.extract
    .split(/\n+/)
    .map((p) => cleanWikiText(p))
    .filter(
      (p) =>
        p.length > 80 &&
        !p.startsWith('See also') &&
        !p.startsWith('References') &&
        !p.startsWith('Voir aussi') &&
        !p.startsWith('Notes et références') &&
        !p.startsWith('انظر أيضًا')
    );

  const introSentences = splitSentences(paragraphs[0] || article.extract);
  const bigPicture =
    introSentences.slice(0, depth === 'intro' ? 2 : 3).join(' ') ||
    truncateClause(article.extract, 360);

  const allSentences = splitSentences(article.extract);
  const mechanicPool = allSentences
    .slice(introSentences.length)
    .filter((s) => s.length >= 50 && s.length <= 240);

  const mechanicCount = depth === 'intro' ? 2 : depth === 'deep' ? 4 : 3;
  const mechanics = (mechanicPool.length >= mechanicCount ? mechanicPool : allSentences).slice(
    0,
    mechanicCount
  );

  const pitfallSentence = allSentences.find((s) =>
    /(however|unlike|although|not to be confused|common|misconception|contrast|despite|cependant|contrairement|ne pas confondre|لكن|على عكس|رغم)/i.test(
      s
    )
  );

  const keyTerms: KeyTerm[] = [];
  for (const s of allSentences.slice(0, 14)) {
    const match = s.match(
      /^([A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÖØ-öø-ÿ0-9\s-]{2,34})\s+(?:is|are|refers to|means|est un|est une|désigne)\s+(.{25,140})/
    );
    if (match && keyTerms.length < 3) {
      const term = match[1].trim();
      const def = truncateClause(match[2].trim(), 130);
      if (!keyTerms.some((k) => k.term.toLowerCase() === term.toLowerCase())) {
        keyTerms.push({ term, definition: def });
      }
    }
  }

  const copy = getWikiCopy(article.wikiLang, tutorLanguage, darijaScript, article.title);

  return {
    bigPicture,
    mechanics: mechanics.length > 0 ? mechanics : [bigPicture],
    pitfall: pitfallSentence || copy.pitfallFallback,
    keyTerms,
  };
}

function buildSystemPrompt(
  tutorLanguage: TutorLanguage,
  darijaScript: DarijaScript,
  hasMaterials = false,
  hasExamMaterial = false,
  requireRetryVariant = true
): string {
  const materialSchema = hasMaterials
    ? `  "studyRoadmap": [
    {
      "topic": "Concise concept or skill the student must learn from the uploaded file(s)",
      "why": "1 sentence explaining why this concept is needed (e.g. which exam exercise or course section requires it)",
      "priority": "high" | "medium"
    }
  ],
`
    : '';

  const materialRules = hasMaterials
    ? hasExamMaterial
      ? `\nUploaded Material Mode (EXAM / EXERCISES):
The student uploaded exam papers, problem sets, or exercises (possibly alongside course notes).
1. Reverse-engineer what the student NEEDS TO LEARN to solve these exams/exercises confidently (theorems, formulas, mechanisms, problem-solving patterns, traps) and list 4–6 prioritized items in "studyRoadmap".
2. Build the "stages" path so each stage teaches the underlying concepts behind those exercises — WHY methods work, not just rote steps.
3. Write original diagnostic QCMs inside each stage testing those exact required concepts, hypotheses, edge cases, and exam traps.\n`
      : `\nUploaded Material Mode (COURSE NOTES):
The student uploaded course notes / slides / lecture documents.
1. Extract the 4–6 highest-leverage concepts the student MUST learn from this material in "studyRoadmap" with priorities.
2. Build the "stages" path grounded strictly in the uploaded material (and the user's focus prompt if provided).
3. Write diagnostic QCMs inside each stage testing true comprehension of the uploaded course material.\n`
    : '';

  const retrySchema = requireRetryVariant
    ? `,
          "retryQuestion": {
            "prompt": "A related question that tests the same idea using different wording or a new example",
            "options": ["2 to 6 answer choices; choose the count for this retry"],
            "correctIndex": 0,
            "rationale": "Short explanation"
          }`
    : '';

  return `You are a Socratic active-recall tutor that ALWAYS teaches from literal scratch. Given any topic or uploaded study material, return ONLY valid JSON (no markdown fences, no extra text) matching this exact schema:
{
  "title": "Concise overall topic title",
${materialSchema}  "stages": [
    {
      "title": "Stage title (a single small concept)",
      "goal": "One sentence: what the learner can do after this stage",
      "explanation": {
        "bigPicture": "2 sentence intuitive mental model for THIS stage only",
        "mechanics": ["2 to 3 crisp steps or core pillars for THIS stage"],
        "pitfall": "1 sentence on this stage's most common misconception",
        "keyTerms": [{"term": "Term", "definition": "Short crisp definition"}]
      },
      "questions": [
        {
          "tag": "Core Concept" | "Mechanism" | "Misconception" | "Application",
          "prompt": "Diagnostic question about THIS stage only",
          "options": ["2 to 6 answer choices — YOU choose the count (see rules)"],
          "correctIndex": 0,
          "rationale": "Why the correct answer is true and why the key distractor is false",
          "deepNote": "Optional 1-sentence deeper insight",
          "prerequisiteStageIndex": null${retrySchema}
        }
      ]
    }
  ],
  "relatedTopics": ["Related Topic 1", "Related Topic 2", "Related Topic 3"]
}

FROM-SCRATCH PATH RULES (follow strictly):
1. Assume the learner knows NOTHING about the topic. Stage 1 must start from the most basic prerequisite a beginner needs (e.g. for "complex numbers": what numbers are and what addition means — you choose the true starting point per topic).
2. Each stage introduces exactly ONE small new idea that builds ONLY on previous stages. Never forward-reference concepts from later stages.
3. The final stage arrives at the requested topic itself. Earlier stages are the ladder; the last stage is the destination.
4. Choose the number of stages from the actual prerequisite ladder: normally 3–6, fewer for simple topics and more only when there are real prerequisite gaps.
5. YOU choose how many QCMs each stage needs and the total number (usually 6–14): use 1–4 per stage according to the concept's difficulty. There is no fixed user-selected count.
6. Keep each stage tight: 1–3 key terms and concise scaffolding only. The learner interface presents questions rather than a prose lesson.

VARIABLE ANSWER-COUNT RULES (you choose per question):
- Use 2 options ONLY for sharp binary judgments (true/false style, "which claim is correct").
- Use 3 options for quick recall or warm-up checks.
- Use 4 options as the standard default.
- Use 5–6 options when the concept has many plausible confusions worth distinguishing.
- Every option must be plausible; never pad with joke or obviously absurd options.
- "correctIndex" is the 0-based index into YOUR options array.
${requireRetryVariant ? '- Every question after stage 0 MUST set "prerequisiteStageIndex" to the nearest earlier prerequisite stage. Stage 0 uses null. Every question MUST also include "retryQuestion": a genuinely similar but differently worded/exampled QCM for later retesting after the learner reviews that prerequisite.' : ''}
${materialRules}
${buildLanguageInstruction(tutorLanguage, darijaScript)}`;
}

function buildMaterialUserPrompt(
  query: string,
  depthHint: string,
  materials: UploadedMaterial[],
  extraQuestionCount?: number,
): string {
  const countHint = extraQuestionCount
    ? `For this follow-up request, add about ${extraQuestionCount} stage-local questions without rebuilding the path.`
    : 'Choose how many QCMs are needed from topic complexity, prerequisite distance, and the mastery checks required. There is no fixed user-selected count.';
  const pathHint = `Build a from-scratch path that starts at the simplest real prerequisite. ${countHint} For EACH QCM, choose the number of plausible answer options yourself (2–6).`;

  if (materials.length === 0) {
    return `${depthHint}
${pathHint}
Topic to explain and quiz: "${query}"`;
  }

  const focusLine = query.trim()
    ? `Student focus / instruction: "${query.trim()}"`
    : 'Student focus: Extract everything essential I need to learn from the attached material and quiz me on it.';

  return `${depthHint}
${focusLine}
${pathHint}
Generate 4-6 items in "studyRoadmap" grounded in the uploaded files below.

${formatMaterialsForPrompt(materials)}`;
}

function extractJsonObject(raw: string): Record<string, unknown> {
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error('Model response did not contain valid JSON.');
  }
}

const VALID_QCM_TAGS: QCMTag[] = ['Core Concept', 'Mechanism', 'Misconception', 'Application'];

function parseRetryQuestion(raw: unknown): QCMQuestion['retryQuestion'] {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const retry = raw as Record<string, unknown>;
  if (typeof retry.prompt !== 'string' || !Array.isArray(retry.options)) return undefined;
  const options = retry.options
    .filter((option): option is string => typeof option === 'string' && option.trim().length > 0)
    .slice(0, 6);
  if (options.length < 2) return undefined;
  const correctIndex =
    typeof retry.correctIndex === 'number' &&
    Number.isInteger(retry.correctIndex) &&
    retry.correctIndex >= 0 &&
    retry.correctIndex < options.length
      ? retry.correctIndex
      : 0;
  return {
    prompt: retry.prompt,
    options,
    correctIndex,
    rationale: typeof retry.rationale === 'string' ? retry.rationale : '',
    deepNote: typeof retry.deepNote === 'string' ? retry.deepNote : undefined,
  };
}

function parseQuestion(raw: unknown, idPrefix: string, stageIndex: number): QCMQuestion | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const q = raw as Partial<QCMQuestion> & Record<string, unknown>;
  const options = Array.isArray(q.options)
    ? q.options.filter((option): option is string => typeof option === 'string' && option.trim().length > 0).slice(0, 6)
    : [];
  if (typeof q.prompt !== 'string' || options.length < 2) return null;
  const correctIndex =
    typeof q.correctIndex === 'number' &&
    Number.isInteger(q.correctIndex) &&
    q.correctIndex >= 0 &&
    q.correctIndex < options.length
      ? q.correctIndex
      : 0;
  const rawPrerequisite = q.prerequisiteStageIndex;
  const prerequisiteStageIndex =
    typeof rawPrerequisite === 'number' &&
    Number.isInteger(rawPrerequisite) &&
    rawPrerequisite >= 0 &&
    rawPrerequisite < stageIndex
      ? rawPrerequisite
      : stageIndex > 0
        ? stageIndex - 1
        : null;
  return {
    id: uid(idPrefix),
    tag: VALID_QCM_TAGS.includes(q.tag as QCMTag) ? (q.tag as QCMTag) : 'Core Concept',
    prompt: q.prompt,
    options,
    correctIndex,
    rationale: typeof q.rationale === 'string' ? q.rationale : '',
    deepNote: typeof q.deepNote === 'string' ? q.deepNote : undefined,
    prerequisiteStageIndex,
    retryQuestion: parseRetryQuestion(q.retryQuestion),
  };
}

function parseExplanation(raw: unknown): ExplanationSection {
  const exp = (raw || {}) as Record<string, unknown>;
  const keyTerms = Array.isArray(exp.keyTerms)
    ? (exp.keyTerms as Partial<KeyTerm>[])
        .filter((k) => k && typeof k.term === 'string' && typeof k.definition === 'string')
        .map((k) => ({ term: k.term as string, definition: k.definition as string }))
        .slice(0, 4)
    : [];
  return {
    bigPicture: typeof exp.bigPicture === 'string' ? exp.bigPicture : '',
    mechanics: Array.isArray(exp.mechanics)
      ? exp.mechanics.filter((m): m is string => typeof m === 'string').slice(0, 5)
      : [],
    pitfall: typeof exp.pitfall === 'string' ? exp.pitfall : '',
    keyTerms,
  };
}

function parseJsonToSession(
  query: string,
  depth: DepthLevel,
  source: SessionSource,
  parsed: Record<string, unknown>,
  modelUsed?: string,
  tutorLanguage: TutorLanguage = 'en',
  darijaScript: DarijaScript = 'arabizi',
  materials?: UploadedMaterial[]
): StudySession {
  const rawRelated = Array.isArray(parsed.relatedTopics) ? parsed.relatedTopics : [];
  const rawRoadmap = Array.isArray(parsed.studyRoadmap) ? parsed.studyRoadmap : [];
  const studyRoadmap: StudyRoadmapItem[] = rawRoadmap
    .filter(
      (item): item is Partial<StudyRoadmapItem> =>
        typeof item === 'object' && item !== null && typeof (item as StudyRoadmapItem).topic === 'string'
    )
    .map((item) => ({
      topic: item.topic!.trim(),
      why: typeof item.why === 'string' ? item.why.trim() : '',
      priority: (item.priority === 'medium' ? 'medium' : 'high') as 'high' | 'medium',
    }))
    .filter((item) => item.topic.length > 0)
    .slice(0, 8);

  const hasMaterials = Boolean(materials && materials.length > 0);
  const materialKind: MaterialKind | undefined = hasMaterials
    ? materials!.some((m) => m.kind === 'exam')
      ? 'exam'
      : 'course'
    : undefined;

  // New staged format: stages[] — plus legacy flat fallback (explanation + questions).
  const rawStages = Array.isArray(parsed.stages) ? parsed.stages : [];
  let stages: LearningStage[] = rawStages
    .map((raw, index) => {
      if (typeof raw !== 'object' || raw === null) return null;
      const s = raw as {
        title?: unknown;
        goal?: unknown;
        explanation?: unknown;
        questions?: unknown;
      };
      const questions = (Array.isArray(s.questions) ? s.questions : [])
        .map((q) => parseQuestion(q, 'ai-q', index))
        .filter((q): q is QCMQuestion => q !== null)
        .slice(0, 6);
      if (questions.length === 0) return null;
      return {
        id: uid('stage'),
        order: index,
        title: typeof s.title === 'string' && s.title.trim() ? s.title.trim() : `Step ${index + 1}`,
        goal: typeof s.goal === 'string' ? s.goal.trim() : '',
        explanation: parseExplanation(s.explanation),
        questions,
      } as LearningStage;
    })
    .filter((s): s is LearningStage => s !== null)
    .slice(0, 6);

  if (stages.length === 0) {
    // Legacy flat response (also used by older mocks/tests): wrap into one stage.
    const legacyQuestions = (Array.isArray(parsed.questions) ? parsed.questions : [])
      .map((q) => parseQuestion(q, 'ai-q', 0))
      .filter((q): q is QCMQuestion => q !== null);
    const legacyTitle =
      typeof parsed.title === 'string' && parsed.title
        ? parsed.title
        : query || materials?.[0]?.name || 'Study Session';
    stages = [
      {
        id: uid('stage'),
        order: 0,
        title: legacyTitle,
        goal: '',
        explanation: parseExplanation(parsed.explanation),
        questions: legacyQuestions,
      },
    ];
  }

  // Re-number stage order after filtering.
  stages = stages.map((s, i) => ({ ...s, order: i }));

  const flatQuestions = stages.flatMap((s) => s.questions);
  const flattenedExplanation =
    stages.length === 1 ? stages[0].explanation : stages[stages.length - 1].explanation;

  return {
    id: uid('sess'),
    query: query || (hasMaterials ? materials!.map((m) => m.name).join(', ') : ''),
    title:
      typeof parsed.title === 'string' && parsed.title
        ? parsed.title
        : query || materials?.[0]?.name || 'Study Session',
    depth,
    tutorLanguage,
    darijaScript,
    source,
    modelUsed,
    materialNames: hasMaterials ? materials!.map((m) => m.name) : undefined,
    materialKind,
    studyRoadmap: studyRoadmap.length > 0 ? studyRoadmap : undefined,
    stages,
    explanation: flattenedExplanation,
    questions: flatQuestions,
    relatedTopics: rawRelated
      .filter((r): r is string => typeof r === 'string')
      .slice(0, 3),
    createdAt: Date.now(),
  };
}

// ================= Google Gemini API Provider (2026 Models) =================

function resolveGeminiModelId(settings: GeminiSettings): string {
  if (settings.model === 'custom' && settings.customModel?.trim()) {
    return settings.customModel.trim().replace(/^models\//, '');
  }
  return (settings.model.trim() || 'gemini-3.8-flash').replace(/^models\//, '');
}

function extractGeminiCandidateText(data: unknown): string {
  const root = data as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string; thought?: boolean }>;
      };
    }>;
  };
  const parts = root?.candidates?.[0]?.content?.parts || [];
  // Filter out internal reasoning trace parts (thought: true) emitted by Gemini 3.x / 4 thinking models
  const nonThoughtParts = parts.filter(
    (p) => !p.thought && typeof p.text === 'string' && p.text.trim().length > 0
  );
  if (nonThoughtParts.length > 0) {
    return nonThoughtParts.map((p) => p.text).join('\n').trim();
  }
  // Fallback if all parts lacked the flag
  return parts
    .map((p) => p.text || '')
    .join('\n')
    .trim();
}

function formatGeminiApiError(status: number, rawMessage: string, model: string): string {
  if (status === 429 || /quota|limit:\s*0|RESOURCE_EXHAUSTED/i.test(rawMessage)) {
    const known = GEMINI_2026_MODELS.find((m) => m.id === model);
    if (known && !known.freeTier) {
      return `${model} is not included in the Gemini API Free Tier (${rawMessage}). Switch to gemini-3.8-flash, gemini-3.5-flash-lite, gemini-4-hydrogen, or gemma-4-31b-it for free-tier usage.`;
    }
    return `Gemini rate/quota limit reached on ${model}: ${rawMessage}. Tip: gemini-3.5-flash-lite (~500/day) and gemma-4-31b-it (~14,400/day) have higher free-tier allowances.`;
  }
  if (status === 404) {
    return `Model "${model}" was not found for this API key (${rawMessage}). Note: legacy 2.5 models are restricted on new 2026 projects—use gemini-3.8-flash or gemini-3.5-flash-lite, or click "Fetch Live Models".`;
  }
  return rawMessage || `Google Gemini API returned HTTP ${status}`;
}

export async function fetchAvailableGeminiModels(
  apiKey: string
): Promise<{ id: string; displayName: string }[]> {
  const key = apiKey.trim();
  if (!key) throw new Error('Enter your Google AI Studio API key first.');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?pageSize=100&key=${encodeURIComponent(
      key
    )}`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status} listing Gemini models`);
  }

  const data = await res.json();
  const models: Array<{
    name?: string;
    displayName?: string;
    supportedGenerationMethods?: string[];
  }> = Array.isArray(data?.models) ? data.models : [];

  return models
    .filter(
      (m) =>
        typeof m.name === 'string' &&
        Array.isArray(m.supportedGenerationMethods) &&
        m.supportedGenerationMethods.includes('generateContent') &&
        !m.name.includes('embedding') &&
        !m.name.includes('imagen') &&
        !m.name.includes('veo') &&
        !m.name.includes('tts') &&
        !m.name.includes('image')
    )
    .map((m) => {
      const id = (m.name || '').replace(/^models\//, '');
      return {
        id,
        displayName: m.displayName || id,
      };
    });
}

async function callGeminiGenerateContent(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const isGemma = model.toLowerCase().startsWith('gemma-');

  const primaryBody = isGemma
    ? {
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
          },
        ],
        generationConfig: {
          temperature: 0.35,
        },
      }
    : {
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.35,
          responseMimeType: 'application/json',
        },
      };

  let res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(primaryBody),
  });

  // If a preview/open model rejects JSON mode or systemInstruction with 400, retry plain prompt
  if (!res.ok && res.status === 400 && !isGemma) {
    const fallbackRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
          },
        ],
        generationConfig: { temperature: 0.35 },
      }),
    });
    if (fallbackRes.ok) {
      res = fallbackRes;
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(formatGeminiApiError(res.status, err?.error?.message || '', model));
  }

  const data = await res.json();
  return extractGeminiCandidateText(data);
}

export async function testGeminiConnection(
  settings: GeminiSettings
): Promise<{ ok: boolean; message: string }> {
  try {
    const key = settings.apiKey.trim();
    if (!key) return { ok: false, message: 'Google Gemini API key is missing.' };

    const model = resolveGeminiModelId(settings);
    await callGeminiGenerateContent(
      key,
      model,
      'Return valid JSON only.',
      'Respond with {"status":"ok"}'
    );

    return { ok: true, message: `Verified ${model} on Google Gemini API!` };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Network error reaching Google Gemini API',
    };
  }
}

export async function generateWithGemini(
  query: string,
  depth: DepthLevel,
  settings: GeminiSettings,
  tutorLanguage: TutorLanguage = 'en',
  darijaScript: DarijaScript = 'arabizi',
  materials: UploadedMaterial[] = [],
  extraQuestionCount?: number,
): Promise<StudySession> {
  const key = settings.apiKey.trim();
  if (!key) {
    throw new Error('Please enter your Google AI Studio API Key in Engine Settings.');
  }

  const model = resolveGeminiModelId(settings);

  const depthHint =
    depth === 'intro'
      ? 'Target audience is an inquisitive beginner; prioritize intuitive mental models.'
      : depth === 'deep'
      ? 'Target audience wants a rigorous deep-dive with edge cases and architectural trade-offs.'
      : 'Target audience wants clear, solid conceptual mechanics with realistic examples.';

  const hasMaterials = materials.length > 0;
  const hasExam = materials.some((m) => m.kind === 'exam');
  const userPrompt = buildMaterialUserPrompt(query, depthHint, materials, extraQuestionCount);
  const systemPrompt = buildSystemPrompt(tutorLanguage, darijaScript, hasMaterials, hasExam);

  const rawText = await callGeminiGenerateContent(key, model, systemPrompt, userPrompt);
  const parsed = extractJsonObject(rawText);
  return parseJsonToSession(
    query,
    depth,
    'gemini',
    parsed,
    model,
    tutorLanguage,
    darijaScript,
    materials
  );
}

// ================= OpenAI OAuth (Sign in with ChatGPT) Provider =================

export async function generateWithChatGPTOAuth(
  query: string,
  depth: DepthLevel,
  oauthSettings: ChatGPTOAuthSettings,
  tutorLanguage: TutorLanguage = 'en',
  darijaScript: DarijaScript = 'arabizi',
  materials: UploadedMaterial[] = [],
  extraQuestionCount?: number,
): Promise<StudySession> {
  const depthHint =
    depth === 'intro'
      ? 'Keep explanation intuitive and beginner-friendly.'
      : depth === 'deep'
      ? 'Provide a deep, rigorous explanation touching subtle edge cases.'
      : 'Provide a crystal-clear explanation with balanced depth.';

  const hasMaterials = materials.length > 0;
  const hasExam = materials.some((m) => m.kind === 'exam');
  const userPrompt = buildMaterialUserPrompt(query, depthHint, materials, extraQuestionCount);
  const systemPrompt = buildSystemPrompt(tutorLanguage, darijaScript, hasMaterials, hasExam);

  const { text, modelUsed } = await runChatGPTOAuthInference({
    instructions: systemPrompt,
    userPrompt,
    settings: oauthSettings,
  });

  const parsed = extractJsonObject(text);
  return parseJsonToSession(
    query,
    depth,
    'chatgpt-oauth',
    parsed,
    modelUsed,
    tutorLanguage,
    darijaScript,
    materials
  );
}

// ================= OpenAI API / Compatible Provider =================

export async function testOpenAIConnection(
  apiKey: string,
  endpoint = 'https://api.openai.com/v1/chat/completions',
  model = 'gpt-4o-mini'
): Promise<{ ok: boolean; message: string }> {
  try {
    const key = apiKey.trim();
    if (!key) return { ok: false, message: 'API key is missing.' };

    const res = await fetch(endpoint.trim() || 'https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: model.trim() || 'gpt-4o-mini',
        max_tokens: 8,
        messages: [{ role: 'user', content: 'ping' }],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        ok: false,
        message: err?.error?.message || `HTTP ${res.status}: Connection test failed`,
      };
    }

    return { ok: true, message: `Connected to ${model} successfully!` };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Network error reaching endpoint',
    };
  }
}

export async function generateWithOpenAI(
  query: string,
  depth: DepthLevel,
  settings: OpenAISettings,
  tutorLanguage: TutorLanguage = 'en',
  darijaScript: DarijaScript = 'arabizi',
  materials: UploadedMaterial[] = [],
  extraQuestionCount?: number,
): Promise<StudySession> {
  const key = settings.apiKey.trim();
  if (!key) {
    throw new Error('Please configure a valid API Key in Engine Settings.');
  }

  const endpoint = settings.endpoint.trim() || 'https://api.openai.com/v1/chat/completions';
  const model = settings.model.trim() || 'gpt-4o-mini';

  const depthHint =
    depth === 'intro'
      ? 'Target audience is a beginner; prioritize intuitive mental models.'
      : depth === 'deep'
      ? 'Target audience wants a rigorous deep-dive with edge cases.'
      : 'Target audience wants clear, solid conceptual mechanics with realistic examples.';

  const hasMaterials = materials.length > 0;
  const hasExam = materials.some((m) => m.kind === 'exam');
  const systemPrompt = buildSystemPrompt(tutorLanguage, darijaScript, hasMaterials, hasExam);
  const userPrompt = buildMaterialUserPrompt(query, depthHint, materials, extraQuestionCount);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    const errText = errData?.error?.message || (await res.text().catch(() => ''));
    throw new Error(`API returned ${res.status}: ${errText.slice(0, 160)}`);
  }

  const data = await res.json();
  const content: string = data?.choices?.[0]?.message?.content || '';
  const parsed = extractJsonObject(content);
  return parseJsonToSession(
    query,
    depth,
    'openai-api',
    parsed,
    model,
    tutorLanguage,
    darijaScript,
    materials
  );
}

// ================= Main Dispatcher =================

async function fetchLocalizedWikiBundle(
  query: string,
  tutorLanguage: TutorLanguage,
  darijaScript: DarijaScript
): Promise<{
  mainArticle: WikiArticle;
  neighborTitles: string[];
  neighborSummaries: { title: string; summary: string }[];
}> {
  const cleaned = normalizeQuery(query) || query;
  const targetWikiLang = getWikiSubdomain(tutorLanguage, darijaScript);

  let wikiLang = targetWikiLang;
  let searchResults = await searchWikipedia(cleaned, wikiLang);

  // If user queried in English while tutorLanguage is French/Arabic/Darija, bridge via English Wikipedia langlinks
  if (searchResults.length === 0 && targetWikiLang !== 'en') {
    const enHits = await searchWikipedia(cleaned, 'en');
    if (enHits.length > 0) {
      const linked = await resolveWikiLangLink(enHits[0].title, 'en', targetWikiLang);
      if (linked) {
        searchResults = [{ title: linked, snippet: '' }];
      } else if (targetWikiLang === 'ary') {
        const arLinked = await resolveWikiLangLink(enHits[0].title, 'en', 'ar');
        if (arLinked) {
          wikiLang = 'ar';
          searchResults = [{ title: arLinked, snippet: '' }];
        } else {
          wikiLang = 'en';
          searchResults = enHits;
        }
      } else {
        wikiLang = 'en';
        searchResults = enHits;
      }
    }
  }

  if (searchResults.length === 0 && targetWikiLang === 'ary') {
    wikiLang = 'ar';
    searchResults = await searchWikipedia(cleaned, 'ar');
  }

  if (searchResults.length === 0) {
    throw new Error(
      `Could not find a reference article for "${query}". Try phrasing it as a core concept or select Google Gemini or ChatGPT OAuth in Engine Settings.`
    );
  }

  let mainArticle = await fetchWikiArticle(searchResults[0].title, wikiLang);

  // If target article uses English title after direct search hit nothing, try resolving langlink to target language
  if (mainArticle && targetWikiLang !== 'en' && wikiLang === 'en') {
    const translatedTitle = await resolveWikiLangLink(mainArticle.title, 'en', targetWikiLang);
    if (translatedTitle) {
      const translatedArticle = await fetchWikiArticle(translatedTitle, targetWikiLang);
      if (translatedArticle) {
        mainArticle = translatedArticle;
        wikiLang = targetWikiLang;
      }
    }
  }

  if (!mainArticle) {
    throw new Error(`Unable to load structured knowledge for "${searchResults[0].title}".`);
  }

  const neighborSearch =
    searchResults.length > 1
      ? searchResults
      : await searchWikipedia(mainArticle.title, wikiLang).catch(() => []);
  const neighborTitles = neighborSearch
    .filter((r) => r.title !== mainArticle!.title)
    .slice(0, 3)
    .map((r) => r.title);

  const neighborArticles = await Promise.all(
    neighborTitles.slice(0, 2).map((t) => fetchWikiArticle(t, wikiLang).catch(() => null))
  );

  const neighborSummaries = neighborArticles
    .filter((a): a is WikiArticle => Boolean(a))
    .map((a) => ({ title: a.title, summary: a.extract.slice(0, 800) }));

  return { mainArticle, neighborTitles, neighborSummaries };
}

function getBuiltinStageCopy(
  tutorLanguage: TutorLanguage,
  darijaScript: DarijaScript
): { titles: string[]; goals: string[] } {
  if (tutorLanguage === 'fr') {
    return {
      titles: [
        "Fondations : l'idée centrale",
        'Briques de base : le fonctionnement',
        'Plus loin : détails et pièges',
        'Maîtrise : cas limites et pratique',
      ],
      goals: [
        'Comprendre ce que c’est, avec vos propres mots.',
        'Expliquer comment ça marche, étape par étape.',
        'Éviter les confusions fréquentes.',
        'Appliquer le concept à des cas subtils.',
      ],
    };
  }
  if (tutorLanguage === 'ar') {
    return {
      titles: [
        'الأساسيات: الفكرة الجوهرية',
        'اللبنات: آلية العمل',
        'أبعد: التفاصيل والأخطاء الشائعة',
        'الإتقان: الحالات الحدية والتطبيق',
      ],
      goals: [
        'فهم ماهية المفهوم بكلماتك الخاصة.',
        'شرح آلية العمل خطوة بخطوة.',
        'تجنب الخلط الشائع.',
        'تطبيق المفهوم على حالات دقيقة.',
      ],
    };
  }
  if (tutorLanguage === 'darija-fr') {
    if (darijaScript === 'arabic') {
      return {
        titles: [
          'الأساس: الفكرة المركزية',
          'اللبنات: كيفاش كيخدم',
          'أبعد: التفاصيل والأغلاط',
          'الإتقان: les cas limites والتطبيق',
        ],
        goals: [
          'تفهم شنو هو الـ concept بكلماتك.',
          'تشرح le mécanisme خطوة بخطوة.',
          'تتفادى les confusions المعروفة.',
          'تطبق le concept على حالات دقيقة.',
        ],
      };
    }
    return {
      titles: [
        'L-asas: l-fikra l-markaziya',
        'Les briques: kifach kaykhdem',
        "B3id: t-tafasil w l-aghlat",
        'L-it9an: les cas limites w t-tatbi9',
      ],
      goals: [
        'Tfhem chno howa le concept b klamk.',
        'Tchreh le mécanisme khotwa b khotwa.',
        'Ttfada les confusions l-ma3rofin.',
        'T77et le concept 3la 7alat d9i9a.',
      ],
    };
  }
  return {
    titles: [
      'Foundations: The Core Idea',
      'Building Blocks: How It Works',
      'Going Further: Details & Traps',
      'Mastery: Edge Cases & Practice',
    ],
    goals: [
      'Say what it is in your own words.',
      'Explain how it works, step by step.',
      'Dodge the common confusions.',
      'Apply it to tricky cases.',
    ],
  };
}

function makeBuiltinRetryQuestion(question: QCMQuestion, stageTitle: string): QCMQuestion['retryQuestion'] {
  const options = question.options.slice(0, 6);
  if (options.length < 2) return undefined;
  // Rotate answers so the learner has to recall the concept, not its answer position.
  const shift = options.length > 2 ? 1 : 0;
  const retryOptions = options.map((_, i) => options[(i + shift) % options.length]);
  const prompts: Record<QCMTag, string> = {
    'Core Concept': `Similar check: which statement captures the core idea in "${stageTitle}"?`,
    Mechanism: `Try another way: which mechanism explains the relationship in "${stageTitle}"?`,
    Misconception: `A similar claim about "${stageTitle}" comes up. Which correction is right?`,
    Application: `New quick check: which option applies the idea from "${stageTitle}" correctly?`,
  };
  return {
    prompt: prompts[question.tag],
    options: retryOptions,
    correctIndex: retryOptions.indexOf(options[question.correctIndex]),
    rationale: question.rationale,
    deepNote: question.deepNote,
  };
}

/** Creates a lightweight fallback path for the no-key built-in engine. */
function splitBuiltinIntoStages(params: {
  explanation: ExplanationSection;
  questions: QCMQuestion[];
  depth: DepthLevel;
  tutorLanguage: TutorLanguage;
  darijaScript: DarijaScript;
  stageTitles?: string[];
  stageGoals?: string[];
}): LearningStage[] {
  const { explanation, questions, depth, tutorLanguage, darijaScript } = params;
  const copy = getBuiltinStageCopy(tutorLanguage, darijaScript);

  const maxStages = depth === 'deep' && questions.length >= 6 ? 4 : 3;
  const stageCount = Math.max(2, Math.min(maxStages, Math.max(1, questions.length)));
  const titles = (params.stageTitles?.length ? params.stageTitles : copy.titles).slice(
    0,
    stageCount
  );
  while (titles.length < stageCount) {
    titles.push(copy.titles[titles.length % copy.titles.length]);
  }
  const goals = (params.stageGoals?.length ? params.stageGoals : copy.goals).slice(0, stageCount);
  while (goals.length < stageCount) {
    goals.push(copy.goals[goals.length % copy.goals.length]);
  }

  // Arrange foundations before mechanisms, then applications/misconceptions.
  const buckets: QCMQuestion[][] = Array.from({ length: stageCount }, () => []);
  const tagOrder: Record<QCMTag, number> = {
    'Core Concept': 0,
    Mechanism: 1,
    Misconception: 2,
    Application: 3,
  };
  const orderedQuestions = questions
    .map((q, originalIndex) => ({ q, originalIndex }))
    .sort((a, b) => tagOrder[a.q.tag] - tagOrder[b.q.tag] || a.originalIndex - b.originalIndex);
  orderedQuestions.forEach(({ q }, i) => {
    const stageIndex = Math.min(stageCount - 1, Math.floor((i * stageCount) / orderedQuestions.length));
    buckets[stageIndex].push({
      ...q,
      prerequisiteStageIndex: stageIndex > 0 ? stageIndex - 1 : null,
      retryQuestion: q.retryQuestion ?? makeBuiltinRetryQuestion(q, titles[stageIndex]),
    });
  });

  // Distribute mechanics + key terms across stages.
  const mechBuckets: string[][] = Array.from({ length: stageCount }, () => []);
  explanation.mechanics.forEach((m, i) => mechBuckets[i % stageCount].push(m));
  const termBuckets: KeyTerm[][] = Array.from({ length: stageCount }, () => []);
  explanation.keyTerms.forEach((t, i) => termBuckets[i % stageCount].push(t));

  return buckets.map((bucket, i) => ({
    id: uid('stage'),
    order: i,
    title: titles[i],
    goal: goals[i],
    explanation: {
      bigPicture: i === 0 ? explanation.bigPicture : (mechBuckets[i][0] ?? explanation.bigPicture),
      mechanics: i === 0 ? mechBuckets[i].slice(0, 2) : mechBuckets[i],
      pitfall: i === stageCount - 1 ? explanation.pitfall : '',
      keyTerms: termBuckets[i],
    },
    questions: bucket,
  }));
}

function autoCuratedQuestionCount(total: number, depth: DepthLevel): number {
  if (depth === 'intro') return Math.min(total, Math.max(3, Math.ceil(total * 0.6)));
  if (depth === 'deep') return total;
  return Math.min(total, Math.max(4, Math.ceil(total * 0.8)));
}

function autoWikiQuestionCount(article: WikiArticle, depth: DepthLevel): number {
  const wordCount = article.extract.split(/\s+/).filter(Boolean).length;
  const base = depth === 'intro' ? 5 : depth === 'deep' ? 10 : 7;
  const complexityBonus = Math.min(4, Math.floor(wordCount / 1100));
  return Math.min(14, base + complexityBonus);
}

export async function generateStudySession(
  rawQuery: string,
  depth: DepthLevel,
  settings: HarnessSettings,
  materials: UploadedMaterial[] = []
): Promise<StudySession> {
  const query = rawQuery.trim();
  const hasMaterials = materials.length > 0;
  if (!query && !hasMaterials) {
    throw new Error('Enter a concept or attach a course/exam file to start.');
  }

  const tutorLanguage = settings.tutorLanguage ?? 'en';
  const darijaScript = settings.darijaScript ?? 'arabizi';

  if (settings.activeProvider === 'gemini') {
    return await generateWithGemini(
      query,
      depth,
      settings.gemini,
      tutorLanguage,
      darijaScript,
      materials
    );
  }

  if (settings.activeProvider === 'openai-oauth') {
    return await generateWithChatGPTOAuth(
      query,
      depth,
      settings.chatgptOAuth,
      tutorLanguage,
      darijaScript,
      materials
    );
  }

  if (settings.activeProvider === 'openai-api') {
    return await generateWithOpenAI(
      query,
      depth,
      settings.openai,
      tutorLanguage,
      darijaScript,
      materials
    );
  }

  // Built-in Engine: Uploaded Course / Exam Document Extractor
  if (hasMaterials) {
    const synthesized = synthesizeLocalSessionFromMaterials({
      query,
      materials,
      depth,
      tutorLanguage,
      darijaScript,
    });
    if (synthesized.questions.length === 0) {
      throw new Error(
        'Could not extract enough structured statements from the uploaded file to build QCMs. Try attaching a richer course/exam file or switching to Gemini/ChatGPT in Settings.'
      );
    }
    const roadmapTitles = synthesized.studyRoadmap.map((r) => r.topic);
    const roadmapGoals = synthesized.studyRoadmap.map((r) => r.why || r.topic);
    const stages = splitBuiltinIntoStages({
      explanation: synthesized.explanation,
      questions: synthesized.questions,
      depth,
      tutorLanguage,
      darijaScript,
      stageTitles: roadmapTitles.length >= 2 ? roadmapTitles.slice(0, 4) : undefined,
      stageGoals: roadmapGoals.length >= 2 ? roadmapGoals.slice(0, 4) : undefined,
    });
    return {
      id: uid('sess'),
      query: query || materials.map((m) => m.name).join(', '),
      title: synthesized.title,
      depth,
      tutorLanguage,
      darijaScript,
      source: 'document',
      materialNames: materials.map((m) => m.name),
      materialKind: synthesized.materialKind,
      studyRoadmap: synthesized.studyRoadmap,
      stages,
      explanation: synthesized.explanation,
      questions: stages.flatMap((s) => s.questions),
      relatedTopics: synthesized.relatedTopics,
      createdAt: Date.now(),
    };
  }

  // Built-in Engine: Curated Deep Modules (with localized content if available)
  const curated = findCuratedTopic(query);
  if (curated) {
    const localized = findLocalizedCuratedTopic(curated.slug, tutorLanguage, darijaScript);
    if (tutorLanguage === 'en' || localized) {
      const content = localized ?? curated;
      const mechanicsLimit =
        depth === 'intro' ? 2 : depth === 'deep' ? content.explanation.mechanics.length : 3;
      const flatExplanation: ExplanationSection = {
        ...content.explanation,
        mechanics: content.explanation.mechanics.slice(0, mechanicsLimit),
        keyTerms:
          depth === 'intro' ? content.explanation.keyTerms.slice(0, 2) : content.explanation.keyTerms,
      };
      const flatQuestions = content.questions.slice(
        0,
        autoCuratedQuestionCount(content.questions.length, depth)
      );
      const stages = splitBuiltinIntoStages({
        explanation: flatExplanation,
        questions: flatQuestions,
        depth,
        tutorLanguage,
        darijaScript,
      });
      return {
        id: uid('sess'),
        query,
        title: content.title,
        depth,
        tutorLanguage,
        darijaScript,
        source: 'curated',
        stages,
        explanation: flatExplanation,
        questions: stages.flatMap((s) => s.questions),
        relatedTopics: content.relatedTopics,
        createdAt: Date.now(),
      };
    }
  }

  // Built-in Engine: Live Knowledge Synthesis via Wikipedia API
  const { mainArticle, neighborTitles, neighborSummaries } = await fetchLocalizedWikiBundle(
    query,
    tutorLanguage,
    darijaScript
  );

  const explanation = buildWikiExplanation(mainArticle, depth, tutorLanguage, darijaScript);
  const questionCount = autoWikiQuestionCount(mainArticle, depth);
  const questions = buildWikiQuestions(
    mainArticle,
    neighborSummaries,
    questionCount,
    new Set(),
    tutorLanguage,
    darijaScript
  );

  if (questions.length === 0) {
    throw new Error(
      `Could not extract enough structured concepts for "${mainArticle.title}" to build QCMs.`
    );
  }

  const stages = splitBuiltinIntoStages({
    explanation,
    questions,
    depth,
    tutorLanguage,
    darijaScript,
  });

  return {
    id: uid('sess'),
    query,
    title: mainArticle.title,
    depth,
    tutorLanguage,
    darijaScript,
    source: 'live-wiki',
    sourceUrl: mainArticle.fullurl,
    stages,
    explanation,
    questions: stages.flatMap((s) => s.questions),
    relatedTopics: neighborTitles.slice(0, 3),
    createdAt: Date.now(),
  };
}

export async function generateMoreQuestions(
  session: StudySession,
  count: number,
  settings: HarnessSettings,
  stageId?: string
): Promise<QCMQuestion[]> {
  const tutorLanguage = session.tutorLanguage ?? settings.tutorLanguage ?? 'en';
  const darijaScript = session.darijaScript ?? settings.darijaScript ?? 'arabizi';
  const stage = stageId ? session.stages.find((s) => s.id === stageId) : undefined;
  const focusQuery = stage
    ? `${session.title} — within the learning stage "${stage.title}" (${stage.goal || 'keep to this stage only'}), generate additional distinct diagnostic questions not yet asked. Do not jump ahead to later stages.`
    : `${session.title} — generate additional distinct diagnostic questions not yet asked`;

  if (settings.activeProvider === 'gemini' && settings.gemini.apiKey.trim()) {
    const extra = await generateWithGemini(
      focusQuery,
      session.depth,
      settings.gemini,
      tutorLanguage,
      darijaScript,
      [],
      count
    );
    return extra.questions;
  }

  if (settings.activeProvider === 'openai-oauth') {
    const extra = await generateWithChatGPTOAuth(
      focusQuery,
      session.depth,
      settings.chatgptOAuth,
      tutorLanguage,
      darijaScript,
      [],
      count
    );
    return extra.questions;
  }

  if (settings.activeProvider === 'openai-api' && settings.openai.apiKey.trim()) {
    const extra = await generateWithOpenAI(
      focusQuery,
      session.depth,
      settings.openai,
      tutorLanguage,
      darijaScript,
      [],
      count
    );
    return extra.questions;
  }

  const existingPrompts = new Set(session.questions.map((q) => q.prompt));

  if (session.source === 'curated') {
    const curated = findCuratedTopic(session.query) || findCuratedTopic(session.title);
    if (curated) {
      const localized = findLocalizedCuratedTopic(curated.slug, tutorLanguage, darijaScript);
      const pool = (localized ?? curated).questions;
      const unseen = pool.filter((q) => !existingPrompts.has(q.prompt));
      if (unseen.length > 0) return unseen.slice(0, count);
    }
  }

  const wikiLang = getWikiSubdomain(tutorLanguage, darijaScript);
  const article =
    (await fetchWikiArticle(session.title, wikiLang).catch(() => null)) ||
    (await fetchWikiArticle(session.title, 'en').catch(() => null));
  if (!article) return [];

  const searchResults = await searchWikipedia(article.title, article.wikiLang);
  const neighborTitles = searchResults
    .filter((r) => r.title !== article.title)
    .slice(0, 2)
    .map((r) => r.title);
  const neighborArticles = await Promise.all(
    neighborTitles.map((t) => fetchWikiArticle(t, article.wikiLang).catch(() => null))
  );
  const neighborSummaries = neighborArticles
    .filter((a): a is WikiArticle => Boolean(a))
    .map((a) => ({ title: a.title, summary: a.extract.slice(0, 800) }));

  return buildWikiQuestions(
    article,
    neighborSummaries,
    count,
    existingPrompts,
    tutorLanguage,
    darijaScript
  );
}
