import React, { useRef, useState } from 'react';
import {
  ArrowRight,
  FileText,
  Languages,
  Loader2,
  Paperclip,
  X,
} from 'lucide-react';
import {
  DepthLevel,
  HarnessSettings,
  MaterialKind,
  UploadedMaterial,
} from '../types/harness';
import {
  ACCEPTED_FILE_EXTENSIONS,
  parseUploadedFile,
} from '../services/documentParser';
import { getTutorLanguageBadge } from '../services/languageConfig';

interface PromptCanvasProps {
  query: string;
  depth: DepthLevel;
  materials: UploadedMaterial[];
  isLoading: boolean;
  error: string | null;
  harnessSettings: HarnessSettings;
  onQueryChange: (val: string) => void;
  onDepthChange: (d: DepthLevel) => void;
  onAddMaterials: (items: UploadedMaterial[]) => void;
  onRemoveMaterial: (id: string) => void;
  onToggleMaterialKind: (id: string, kind: MaterialKind) => void;
  onSubmit: (overrideQuery?: string) => void;
  onOpenSettings: () => void;
}

const STARTER_TOPICS = [
  'How Transformer Self-Attention Works',
  'Quantum Entanglement',
  'CRISPR-Cas9 Gene Editing',
  'HTTP/3 & QUIC',
  'Backpropagation & Gradient Descent',
  'Game Theory',
];

const DEPTH_OPTIONS: { id: DepthLevel; label: string }[] = [
  { id: 'intro', label: 'Intro' },
  { id: 'standard', label: 'Standard' },
  { id: 'deep', label: 'Deep' },
];

const segmentedShellClass =
  'flex items-center gap-0.5 rounded-md bg-[#F1F1EC] p-0.5 dark:bg-[#1C1C1A]';

function segmentedButtonClass(active: boolean) {
  return `rounded px-2 py-1 text-[11px] font-medium transition-colors ${
    active
      ? 'bg-white text-[#292824] shadow-2xs dark:bg-[#2B2B27] dark:text-[#EDEDEB]'
      : 'text-[#85837C] hover:text-[#292824] dark:text-[#85857D] dark:hover:text-[#EDEDEB]'
  }`;
}

export const PromptCanvas: React.FC<PromptCanvasProps> = ({
  query,
  depth,
  materials,
  isLoading,
  error,
  harnessSettings,
  onQueryChange,
  onDepthChange,
  onAddMaterials,
  onRemoveMaterial,
  onToggleMaterialKind,
  onSubmit,
  onOpenSettings,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isParsingFiles, setIsParsingFiles] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const canSubmit =
    !isLoading && !isParsingFiles && (query.trim().length > 0 || materials.length > 0);

  const handleFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setIsParsingFiles(true);
    setParseError(null);
    const parsed: UploadedMaterial[] = [];
    const failures: string[] = [];

    for (const file of files) {
      try {
        const mat = await parseUploadedFile(file);
        parsed.push(mat);
      } catch (err) {
        failures.push(err instanceof Error ? err.message : `Failed to read ${file.name}`);
      }
    }

    if (parsed.length > 0) {
      onAddMaterials(parsed);
    }
    if (failures.length > 0) {
      setParseError(failures.join(' '));
    }
    setIsParsingFiles(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSubmit) onSubmit();
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (isLoading || isParsingFiles) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void handleFiles(e.dataTransfer.files);
    }
  };

  const combinedError = parseError || error;

  return (
    <div className="animate-fade-slide mx-auto w-full max-w-[680px] px-4 pb-16 pt-12 sm:px-6 sm:pt-20">
      <div className="mb-7 text-center">
        <h1 className="font-editorial text-4xl leading-tight tracking-tight text-[#292824] sm:text-[44px] dark:text-[#EDEDEB]">
          What do you want to understand?
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#73716B] dark:text-[#A1A09A]">
          We start from absolute zero and climb step-by-step to your topic — or drop course
          notes, PDFs, or past exams to extract what you need to learn.
        </p>
        <button
          type="button"
          onClick={onOpenSettings}
          className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-medium text-[#85837C] transition-colors hover:text-[#292824] dark:text-[#85857D] dark:hover:text-[#EDEDEB]"
          title="Change tutor learning language"
        >
          <Languages className="h-3.5 w-3.5" />
          <span>
            Tutor:{' '}
            {getTutorLanguageBadge(
              harnessSettings.tutorLanguage,
              harnessSettings.darijaScript
            )}
          </span>
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) onSubmit();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!isDragging) setIsDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setIsDragging(false);
          }
        }}
        onDrop={handleDrop}
        className={`rounded-xl border bg-white p-3 transition-colors sm:p-4 dark:bg-[#181816] ${
          isDragging
            ? 'border-[#5B55C9] bg-[#5B55C9]/[0.03] dark:border-[#818CF8] dark:bg-[#818CF8]/[0.06]'
            : 'border-[#E3E1D9] focus-within:border-[#B9B7AD] dark:border-[#2A2A27] dark:focus-within:border-[#45453F]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_FILE_EXTENSIONS}
          aria-label="Upload course or exam files"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) {
              void handleFiles(e.target.files);
              e.target.value = '';
            }
          }}
        />

        <textarea
          rows={2}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            materials.length > 0
              ? 'Optional focus (e.g., "Focus on Exercise 2" or leave blank to extract everything)…'
              : 'Ask about a concept, or attach course PDFs / MD / TXT / exams…'
          }
          aria-label="Topic to explain"
          disabled={isLoading}
          className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-[#292824] placeholder:text-[#A3A198] focus:outline-none disabled:opacity-60 dark:text-[#EDEDEB] dark:placeholder:text-[#68685F]"
        />

        {materials.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Attached study files">
            {materials.map((mat) => (
              <div
                key={mat.id}
                className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-[#E3E1D9] bg-[#F6F6F2] px-2 py-1 text-[11px] text-[#292824] dark:border-[#2A2A27] dark:bg-[#1E1E1B] dark:text-[#EDEDEB]"
              >
                <FileText className="h-3 w-3 shrink-0 text-[#85837C] dark:text-[#85857D]" />
                <span className="max-w-[150px] truncate font-medium" title={mat.name}>
                  {mat.name}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onToggleMaterialKind(
                      mat.id,
                      mat.kind === 'exam' ? 'course' : 'exam'
                    )
                  }
                  title="Click to switch between Course Notes and Exam / Exercises"
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                    mat.kind === 'exam'
                      ? 'bg-amber-500/12 text-amber-800 hover:bg-amber-500/20 dark:bg-amber-400/15 dark:text-amber-300'
                      : 'bg-[#5B55C9]/10 text-[#5B55C9] hover:bg-[#5B55C9]/18 dark:bg-[#818CF8]/15 dark:text-[#A5B4FC]'
                  }`}
                >
                  {mat.kind === 'exam' ? 'Exam' : 'Course'}
                </button>
                <span className="font-mono-code text-[10px] text-[#96938A] dark:text-[#77776F]">
                  {mat.pageCount ? `${mat.pageCount}p` : `${mat.wordCount}w`}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveMaterial(mat.id)}
                  aria-label={`Remove ${mat.name}`}
                  className="rounded p-0.5 text-[#96938A] transition-colors hover:text-[#292824] dark:text-[#77776F] dark:hover:text-[#EDEDEB]"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#ECEAE3] pt-3 dark:border-[#242422]">
          <button
            type="button"
            disabled={isLoading || isParsingFiles}
            onClick={() => fileInputRef.current?.click()}
            title="Attach course PDF, Markdown, TXT, or exam/exercises"
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[#E3E1D9] bg-[#FBFBFA] px-2 text-[11px] font-medium text-[#5F5C55] transition-colors hover:border-[#B9B7AD] hover:text-[#292824] disabled:opacity-45 dark:border-[#2A2A27] dark:bg-[#1C1C1A] dark:text-[#A1A09A] dark:hover:border-[#45453F] dark:hover:text-[#EDEDEB]"
          >
            {isParsingFiles ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Paperclip className="h-3.5 w-3.5" />
            )}
            <span>{isParsingFiles ? 'Reading…' : 'Add PDF / MD / TXT'}</span>
          </button>

          <div className={segmentedShellClass} aria-label="Explanation depth">
            {DEPTH_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onDepthChange(opt.id)}
                className={segmentedButtonClass(depth === opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md bg-[#292824] px-3 text-xs font-medium text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-35 dark:bg-[#EDEDEB] dark:text-[#171716] dark:hover:bg-white"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Working…</span>
              </>
            ) : (
              <>
                <span>
                  {materials.length > 0 && !query.trim()
                    ? 'Extract & Quiz Me'
                    : 'Explain & Quiz Me'}
                </span>
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>
      </form>

      {combinedError && (
        <div
          role="alert"
          className="mt-4 border-l-2 border-[#C2410C] py-1 pl-3 text-xs leading-relaxed text-[#9A3412] dark:border-[#F87171] dark:text-[#FCA5A5]"
        >
          {combinedError}
        </div>
      )}

      <div className="mt-9">
        <p className="mb-2 text-[11px] font-medium text-[#96938A] dark:text-[#77776F]">
          Try one
        </p>
        <div className="flex flex-wrap gap-x-1 gap-y-1">
          {STARTER_TOPICS.map((topic) => (
            <button
              key={topic}
              type="button"
              disabled={isLoading}
              onClick={() => {
                onQueryChange(topic);
                onSubmit(topic);
              }}
              className="rounded-md px-2 py-1.5 text-[13px] text-[#73716B] transition-colors hover:bg-[#F0F0EA] hover:text-[#292824] disabled:opacity-50 dark:text-[#A1A09A] dark:hover:bg-[#20201E] dark:hover:text-[#EDEDEB]"
            >
              {topic}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
