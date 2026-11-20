# Socratic — Explain & Learn Harness

A local-first active-recall learning harness. You ask a topic, it teaches you from zero and checks you with adaptive QCMs.

UI language is always English. Tutor / learning content language is selectable.

---

## Quick Start

```bash
npm install
npm run dev      # http://127.0.0.1:5173
npm run build    # single-file production build -> dist/index.html
```

No backend required. All sessions live in `localStorage` (`socratic_qcm_history_v1`, settings in `socratic_qcm_settings_v3`, sidebar state and theme).

---

## Core Concept

**From-scratch staged paths** — the AI decides prerequisites per topic.

- Stage 1 assumes you know nothing. It picks the true baseline (e.g. *complex numbers* starts at “what numbers are / what addition means”).
- Each stage introduces exactly one new idea using only prior stages. The last stage reaches your requested topic.
- Number of stages is topic-dependent: simple topics need fewer stages; genuinely complex topics get more. No fixed stage count.
- Each stage contains **1–4 QCMs** chosen by content need. Total session size is also AI-decided (typically ~6–14); there is no user-facing “3 / 5 / 7 QCM” selector.

**AI-chosen answer counts**

- Each question has 2–6 options. The model picks the count that fits the question:
  - `2`= sharp binary judgment, `3`= quick recall, `4`= normal default, `5–6`= many plausible confusions.
  - `correctIndex` is zero-based inside that question’s own option list.

**QCM-only teaching**

The app does not show a separate lecture text pane. Learning happens through the staged QCM sequence and short contextual explanations inside rationales. The “big picture / mechanics / pitfall” copy is kept stage-scoped and minimal; the session is the quiz.

**Wrong-answer loop**

```
Wrong answer
  -> show correct answer + rationale
  -> jump to the prerequisite stage that question depends on
  -> re-test later with a similar variant of the same idea
```

Each QCM carries `prerequisiteStageIndex` and a `retryQuestion` variant (different wording/example, possibly different option count). A miss creates a `PendingRetry`; returning to the prerequisite stage injects that retry question there. Getting the retry right clears it.

---

## Data Model

### Session

`StudySession` contains:

- `stages: LearningStage[]` — ordered from foundations to target. Each `LearningStage` holds `title`, `goal`, `explanation` (short, stage-scoped), and its `questions: QCMQuestion[]`.
- Flattened `questions` and `explanation` are derived from the final stages (back-compat, scoring, and offline paths).
- `tutorLanguage` / `darijaScript` remembered per session.
- Optional `materialNames`, `materialKind`, and `studyRoadmap` when built from uploaded files.

### QCM Question

```ts
interface QCMQuestion {
  id: string;
  prompt: string;
  options: string[];            // 2–6, AI-chosen
  correctIndex: number;         // 0-based into options
  tag: QCMTag;                  // Core Concept | Mechanism | Misconception | Application
  rationale: string;
  deepNote?: string;
  prerequisiteStageIndex?: number | null; // null = foundations
  retryQuestion?: QCMRetryVariant;        // variant to ask later
  retryOf?: string;                      // original question id for delayed retries
}
```

### History Persistence

`SessionHistoryItem` stores score, answered count, per-question answers, active stage index, pending retries, and remediated ids. Stages are rebuilt from `StudySession.stages`; saved items without `stages` are backfilled into one stage.

Collapsible sidebar groups history by date (`Today / Yesterday / Previous 7 days / Older`), supports search, per-session delete, and “clear all”.

---

## Generation Modes

Four interchangeable providers, chosen in **Harness Engine** settings:

| Provider | When it runs | What it does |
|---|---|---|
| **Built-in** (default) | No API key | Curated deep modules, Wikipedia synthesis, or local document extraction |
| **Gemini 2026** | Google AI Studio key | Calls `generativelanguage.googleapis.com` with the staged schema |
| **OpenAI OAuth (Sign in with ChatGPT)** | Encrypted IndexedDB session or `npx openai-oauth` proxy | Codex `/v1/responses` staged JSON |
| **OpenAI API / compatible** | `sk-…` key + endpoint | Chat completions staged JSON |

All three AI modes receive the same staged schema. Responses are parsed by `parseQuestion / parseRetryQuestion` and normalized into `LearningStage[]`.

### Automatic question count vs manual

The user no longer picks `3 / 5 / 7`. The model decides per stage. Built-in offline paths derive their count from material headings/terms/exam tasks (documents) or article length (Wikipedia), capped in the 5–14 range.

### Retry variants

Every AI question is expected to include `retryQuestion`. Offline fallback `makeBuiltinRetryQuestion` rotates option order and swaps prompt framing so the retry is similar without being identical.

---

## Uploaded Materials

`PromptCanvas` accepts **PDF, Markdown, TXT, LaTeX (.tex), CSV, RST, HTML, JSON** via:

- “Add PDF / MD / TXT” file picker (multiple files at once)
- Drag-and-drop onto the prompt card

Behind the scenes:

1. `documentParser.parseUploadedFile` extracts text. PDFs use `unpdf.extractText` (runs in the browser with `vite-plugin-singlefile`; no external worker path). Text files strip HTML/scripts for `.html`, keep raw text for `.md/.txt/.tex`.
2. `detectMaterialKind(fileName, text)` auto-labels each file as `Course` vs `Exam`; the label is a clickable per-file toggle before submission.
3. `formatMaterialsForPrompt(materials, 28_000 chars)` compresses file excerpts for the AI (preserves head + tail per file). Limit: 6 files, ~80k chars stored each, 15 MB max.
4. An empty prompt is allowed when files are attached — the harness extracts “what you need to learn” directly.

Two downstream behaviors:

**With AI keys (Gemini / ChatGPT / API):** `buildSystemPrompt` + `buildMaterialUserPrompt` inject the uploaded text, `studyRoadmap` schema, and a distinction between *Course Notes* vs *Exam/Exercises* (for exams it reverse-engineers concepts, traps, and methods rather than echoing question statements). The model then fills `stages` grounded in the files.

**Offline (no API key):** `synthesizeLocalSessionFromMaterials` parses headings, `Term: definition` lines, and exam problem lines, then assembles a small offline lesson: title from the prompt or first heading/file name, a `studyRoadmap` of up to 6 high-leverage items, a short staged explanation, and 5–14 local QCMs (key-term definitions + fact-claim checks).

Each session remembers its source file names and kind. Roadmap topics have a “Drill →” action to open a focused follow-up on that single extracted concept.

---

## Tutor Language & Darija Mode

Configured in `Harness Engine` → **Tutor Language**:

- **English** (default), **French**, **Arabic (الدارجة/الفصحى)**, **Darija + French (FR tech terms)**.
- Darija + French exposes a second switch: **Arabizi (Latin digits `3/7/9/5`)** vs **Arabic script**. French scientific terms (e.g. *la dérivée*, *l’algorithme*, *l’intrication quantique*) are preserved even inside Darija answers.

`languageConfig.buildLanguageInstruction(language, script)` injects the requirement into system prompts; QCM generation and `ExplanationCard` rendering respect it. Only learning content (titles, goals, prompts, options, rationales, deep notes, `relatedTopics`, roadmap entries) switches language. Every chrome label stays English.

Offline rendering: RTL support via `isRtlLearningContent`, `dir="rtl"` and `text-right` on stage titles/goals/prompts/options/rationales when Arabic script is active.

Pre-localized curated content: `data/localizedCuratedTopics.ts` maps a handful of flagship topics (e.g. *Complex Numbers / Les Nombres Complexes / الدارجة*). AI can localize any topic beyond that; offline documents are rendered as-is.

---

## UI

### Layout

- Fixed history sidebar (`src/components/HistorySidebar.tsx`) + main column (`src/components/PromptCanvas.tsx` / staged view). Respects `prefers-reduced-motion`.
- Desktop: sidebar collapses to an icon rail (64 px) and remembers the state (`localStorage` — `socratic_sidebar_collapsed_v1`). Mobile: slide-over drawer with scrim.
- Top bar (`TopBar.tsx`) shows session title and stage progress, plus theme toggle and settings.

### Lesson View (staged, QCM-only)

- `LearningPath` — stepper of stage titles/goals, completion dots, per-stage progress (`x/y✓`), locked future stages visually muted.
- `ExplanationCard` — per-stage title/goal block (stage-scoped text). Roadmap (`studyRoadmap`) is shown once at the start of the session as a priority-dotted list.
- `QCMDeck` — one question at a time, Prev/Next across stages, keyboard `1–6 / A–F`. When a question is wrong, it shows the correct answer, locks advancing until the review step, and queues a delayed variant.
- Feedback states include retake (clears current stage answers) and “Generate more QCMs” (AI expands the current stage; built-in pulls unseen curated neighbors or related Wikipedia facts).

### Theme

Light/dark toggle, system-preference aware (`prefers-color-scheme`), persisted under `socratic_theme_v1`. Injected anti-flash in `index.html`.

### History Sidebar

- Grouped by recency, searchable, per-session re-open, “New session” clears work.
- Each entry shows title and short progress (e.g. `1 of 5 answered`, `2/5 correct`, `Ready to continue`).
- Empty state: “A place for your curiosity — Start a session. Your notes and quiz progress will be saved here.”

---

## Persistence & Routing

- Everything is client-side (`src/App.tsx`): no router, no server.
- Generation is cancelable via a `generationId` counter — switching sessions mid-generation discards the stale result.
- History is stored as `StudySession` snapshots in `localStorage`; `session.questions` is derived from `session.stages`.
- ChatGPT OAuth state lives in encrypted IndexedDB (`@openai-oauth/web`), handled in `services/openaiOAuthClient.ts`.

---

## Key Files

```
src/types/harness.ts              # QCMQuestion, LearningStage, StudySession, HarnessSettings, PendingRetry, …
src/data/curatedTopics.ts         # Built-in offline deep modules (English)
src/data/localizedCuratedTopics.ts # Pre-localized flagship topics (fr / ar / darija-fr)
src/services/harnessEngine.ts      # Prompt construction, AI calls, parsing staged JSON, offline Wikipedia/curated/doc paths
src/services/documentParser.ts     # unpdf + text loaders, kind detection, local offline synthesis
src/services/languageConfig.ts      # Tutor language badges, RTL detection, prompt instruction
src/services/openaiOAuthClient.ts  # ChatGPT sign-in, token storage, model discovery, /v1/responses
src/services/learningPath.ts       # PendingRetry wiring for the remediation loop
src/components/PromptCanvas.tsx    # Prompt box, drag-drop, file chips, depth selector (no question-count picker)
src/components/TopBar.tsx          # Session title + step counter (e.g. 0/5 · Step 1/3)
src/components/HistorySidebar.tsx  # Collapsible grouped sidebar
src/components/LearningPath.tsx    # Staged path stepper with per-stage progress & lock state
src/components/ExplanationCard.tsx # Per-stage header + short lesson content
src/components/QCMDeck.tsx         # QCM renderer with variable 2–6 options
src/components/ChatGPTOAuthPanel.tsx
src/components/SettingsModal.tsx   # Providers, Gemini model list, language/script switches
src/components/Icons.tsx
src/index.css                        # Tailwind v4 + dark variant + sidebar scrollbar
vite.config.ts                     # vite-plugin-singlefile for self-contained dist/index.html
index.html                         # anti-flash dark-mode script
tests/*.spec.ts                    # Playwright regression suite (scratch + language + materials + sidebar)
```

---

## Build & Test

```bash
npm run build        # -> dist/index.html (single-file offline bundle)
npm run dev          # dev server on http://127.0.0.1:5173
npx tsc --noEmit     # strict typecheck
npx playwright test  # ./node_modules/.bin/playwright test tests/ --workers=1 --reporter=list
```

---

## Limits

- Offline mode cannot read scanned/PDF-image text; use text-selectable PDFs or upload the equivalent `.md/.txt`.
- Maximum 6 attached files, 15 MB each; stored excerpts are truncated (~80k chars per file, ~28k for AI prompts).
- History is capped at 20 sessions and kept in the current browser. Clearing browser storage clears it.
