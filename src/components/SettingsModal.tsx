import React, { useEffect, useState } from 'react';
import {
  Cpu,
  Eye,
  EyeOff,
  Languages,
  Loader2,
  RefreshCw,
  Server,
  X,
  Zap,
} from 'lucide-react';
import {
  ChatGPTOAuthSettings,
  HarnessProviderType,
  HarnessSettings,
} from '../types/harness';
import {
  fetchAvailableGeminiModels,
  GEMINI_2026_MODELS,
  testGeminiConnection,
  testOpenAIConnection,
} from '../services/harnessEngine';
import {
  DARIJA_SCRIPT_OPTIONS,
  TUTOR_LANGUAGE_OPTIONS,
} from '../services/languageConfig';
import { ChatGPTOAuthPanel } from './ChatGPTOAuthPanel';
import { GeminiGradientIcon, OpenAIIcon } from './Icons';

interface SettingsModalProps {
  isOpen: boolean;
  settings: HarnessSettings;
  onClose: () => void;
  onSave: (next: HarnessSettings) => void;
}

const PROVIDERS: {
  id: HarnessProviderType;
  label: string;
  icon: React.ReactNode;
}[] = [
  { id: 'builtin', label: 'Built-in', icon: <Cpu className="h-3.5 w-3.5" /> },
  { id: 'gemini', label: 'Gemini', icon: <GeminiGradientIcon className="h-3.5 w-3.5" /> },
  { id: 'openai-oauth', label: 'ChatGPT', icon: <OpenAIIcon className="h-3.5 w-3.5" /> },
  { id: 'openai-api', label: 'API Key', icon: <Server className="h-3.5 w-3.5" /> },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  settings,
  onClose,
  onSave,
}) => {
  const [draft, setDraft] = useState<HarnessSettings>(settings);
  const [showKey, setShowKey] = useState(false);
  const [liveModels, setLiveModels] = useState<{ id: string; displayName: string }[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDraft(settings);
      setStatus(null);
      setShowKey(false);
    }
  }, [isOpen, settings]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const update = (patch: Partial<HarnessSettings>) => setDraft((d) => ({ ...d, ...patch }));

  const handleOAuthChange = (nextOAuth: ChatGPTOAuthSettings) => {
    const updated: HarnessSettings = { ...draft, chatgptOAuth: nextOAuth };
    setDraft(updated);
    onSave(updated);
  };

  const runGeminiTest = async () => {
    setBusy('gemini-test');
    setStatus(null);
    const result = await testGeminiConnection(draft.gemini);
    setBusy(null);
    setStatus({ ok: result.ok, text: result.message });
  };

  const runOpenAITest = async () => {
    setBusy('openai-test');
    setStatus(null);
    const result = await testOpenAIConnection(
      draft.openai.apiKey,
      draft.openai.endpoint,
      draft.openai.model
    );
    setBusy(null);
    setStatus({ ok: result.ok, text: result.message });
  };

  const runFetchModels = async () => {
    setBusy('fetch-models');
    setStatus(null);
    try {
      const models = await fetchAvailableGeminiModels(draft.gemini.apiKey);
      setLiveModels(models);
      setStatus({ ok: true, text: `${models.length} models available on your key.` });
    } catch (err) {
      setStatus({
        ok: false,
        text: err instanceof Error ? err.message : 'Failed to list models.',
      });
    } finally {
      setBusy(null);
    }
  };

  const freeModels = GEMINI_2026_MODELS.filter((m) => m.freeTier && !m.id.startsWith('gemini-2.5'));
  const legacyModels = GEMINI_2026_MODELS.filter((m) => m.id.startsWith('gemini-2.5'));
  const paidModels = GEMINI_2026_MODELS.filter((m) => !m.freeTier);
  const extraModels = liveModels.filter(
    (lm) => !GEMINI_2026_MODELS.some((gm) => gm.id === lm.id)
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1918]/40 p-4 backdrop-blur-xs dark:bg-black/65"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="harness-engine-title"
        className="animate-fade-slide max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-[#E3E1D9] bg-white p-4 shadow-xl dark:border-[#2A2A27] dark:bg-[#181816]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="harness-engine-title"
            className="font-editorial text-[22px] text-[#292824] dark:text-[#EDEDEB]"
          >
            Harness Engine
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="rounded-lg p-1.5 text-[#6B6965] transition-colors hover:bg-[#FBFBFA] hover:text-[#1A1918] dark:text-[#A1A09A] dark:hover:bg-[#232320] dark:hover:text-[#EDEDEB]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Provider pills */}
        <div className="mb-4 grid grid-cols-4 gap-0.5 rounded-lg bg-[#F1F1EC] p-0.5 dark:bg-[#111110]">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setStatus(null);
                update({ activeProvider: p.id });
              }}
              className={`flex items-center justify-center gap-1 rounded-md px-1.5 py-1.5 text-[11px] font-medium transition-colors ${
                draft.activeProvider === p.id
                  ? 'bg-white text-[#292824] shadow-2xs dark:bg-[#232320] dark:text-[#EDEDEB]'
                  : 'text-[#85837C] hover:text-[#292824] dark:text-[#85857D] dark:hover:text-[#EDEDEB]'
              }`}
            >
              {p.icon}
              <span>{p.label}</span>
            </button>
          ))}
        </div>

        {/* Config area */}
        <div className="space-y-3.5">
          {draft.activeProvider === 'builtin' && (
            <p className="px-1 py-2 text-xs leading-relaxed text-[#85837C] dark:text-[#85857D]">
              Built-in lessons and Wikipedia synthesis. No key required.
            </p>
          )}

          {draft.activeProvider === 'gemini' && (
            <>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-[#6B6965] dark:text-[#A1A09A]">
                  Gemini API Key
                </label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={draft.gemini.apiKey}
                    onChange={(e) =>
                      update({
                        gemini: { ...draft.gemini, apiKey: e.target.value },
                      })
                    }
                    placeholder="AIzaSy..."
                    className="font-mono-code w-full rounded-lg border border-[#E5E5E0] bg-white px-3 py-2 pr-9 text-xs text-[#1A1918] focus:border-[#1E88E5] focus:outline-none dark:border-[#2A2A27] dark:bg-[#111110] dark:text-[#EDEDEB]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((s) => !s)}
                    aria-label={showKey ? 'Hide API key' : 'Show API key'}
                    className="absolute top-1/2 right-2.5 -translate-y-1/2 text-[#6B6965] hover:text-[#1A1918] dark:text-[#A1A09A] dark:hover:text-[#EDEDEB]"
                  >
                    {showKey ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-[11px] font-medium text-[#6B6965] dark:text-[#A1A09A]">
                    Model
                  </label>
                  <button
                    type="button"
                    disabled={busy === 'fetch-models' || !draft.gemini.apiKey.trim()}
                    onClick={runFetchModels}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1E88E5] hover:underline disabled:opacity-40 dark:text-[#60A5FA]"
                  >
                    {busy === 'fetch-models' ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    <span>Sync</span>
                  </button>
                </div>
                <select
                  value={draft.gemini.model}
                  onChange={(e) =>
                    update({ gemini: { ...draft.gemini, model: e.target.value } })
                  }
                  className="font-mono-code w-full rounded-lg border border-[#E5E5E0] bg-white px-3 py-2 text-xs text-[#1A1918] focus:border-[#1E88E5] focus:outline-none dark:border-[#2A2A27] dark:bg-[#111110] dark:text-[#EDEDEB]"
                >
                  <optgroup label="Free tier">
                    {freeModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.id}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Legacy free (existing 2.5 projects)">
                    {legacyModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.id}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Paid only">
                    {paidModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.id}
                      </option>
                    ))}
                  </optgroup>
                  {extraModels.length > 0 && (
                    <optgroup label="On your key">
                      {extraModels.map((lm) => (
                        <option key={lm.id} value={lm.id}>
                          {lm.id}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <option value="custom">Custom…</option>
                </select>

                {draft.gemini.model === 'custom' && (
                  <input
                    type="text"
                    value={draft.gemini.customModel || ''}
                    onChange={(e) =>
                      update({
                        gemini: { ...draft.gemini, customModel: e.target.value },
                      })
                    }
                    placeholder="gemini-3.8-flash"
                    className="font-mono-code mt-2 w-full rounded-lg border border-[#E5E5E0] bg-white px-3 py-2 text-xs text-[#1A1918] focus:border-[#1E88E5] focus:outline-none dark:border-[#2A2A27] dark:bg-[#111110] dark:text-[#EDEDEB]"
                  />
                )}
              </div>
            </>
          )}

          {draft.activeProvider === 'openai-oauth' && (
            <ChatGPTOAuthPanel value={draft.chatgptOAuth} onChange={handleOAuthChange} />
          )}

          {draft.activeProvider === 'openai-api' && (
            <>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-[#6B6965] dark:text-[#A1A09A]">
                  Endpoint
                </label>
                <input
                  type="url"
                  value={draft.openai.endpoint}
                  onChange={(e) =>
                    update({ openai: { ...draft.openai, endpoint: e.target.value } })
                  }
                  placeholder="https://api.openai.com/v1/chat/completions"
                  className="font-mono-code w-full rounded-lg border border-[#E5E5E0] bg-white px-3 py-2 text-xs text-[#1A1918] focus:border-[#4338CA] focus:outline-none dark:border-[#2A2A27] dark:bg-[#111110] dark:text-[#EDEDEB]"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#6B6965] dark:text-[#A1A09A]">
                    Model
                  </label>
                  <input
                    type="text"
                    value={draft.openai.model}
                    onChange={(e) =>
                      update({ openai: { ...draft.openai, model: e.target.value } })
                    }
                    placeholder="gpt-5.4-mini"
                    className="font-mono-code w-full rounded-lg border border-[#E5E5E0] bg-white px-3 py-2 text-xs text-[#1A1918] focus:border-[#4338CA] focus:outline-none dark:border-[#2A2A27] dark:bg-[#111110] dark:text-[#EDEDEB]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#6B6965] dark:text-[#A1A09A]">
                    API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={draft.openai.apiKey}
                      onChange={(e) =>
                        update({ openai: { ...draft.openai, apiKey: e.target.value } })
                      }
                      placeholder="sk-..."
                      className="font-mono-code w-full rounded-lg border border-[#E5E5E0] bg-white px-3 py-2 pr-9 text-xs text-[#1A1918] focus:border-[#4338CA] focus:outline-none dark:border-[#2A2A27] dark:bg-[#111110] dark:text-[#EDEDEB]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey((s) => !s)}
                      aria-label={showKey ? 'Hide API key' : 'Show API key'}
                      className="absolute top-1/2 right-2.5 -translate-y-1/2 text-[#6B6965] hover:text-[#1A1918] dark:text-[#A1A09A] dark:hover:text-[#EDEDEB]"
                    >
                      {showKey ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Tutor Language */}
          <div className="space-y-2 border-t border-[#ECEAE3] pt-3 dark:border-[#242422]">
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-1.5 text-[11px] font-medium text-[#73716B] dark:text-[#A1A09A]">
                <Languages className="h-3.5 w-3.5" />
                <span>Tutor Language</span>
              </label>
              <span className="text-[10px] text-[#96938A] dark:text-[#77776F]">
                UI stays English
              </span>
            </div>

            <div className="grid grid-cols-4 gap-0.5 rounded-lg bg-[#F1F1EC] p-0.5 dark:bg-[#111110]">
              {TUTOR_LANGUAGE_OPTIONS.map((opt) => {
                const active = draft.tutorLanguage === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => update({ tutorLanguage: opt.id })}
                    title={opt.hint}
                    className={`rounded-md px-1 py-1.5 text-[11px] font-medium transition-colors ${
                      active
                        ? 'bg-white text-[#292824] shadow-2xs dark:bg-[#232320] dark:text-[#EDEDEB]'
                        : 'text-[#85837C] hover:text-[#292824] dark:text-[#85857D] dark:hover:text-[#EDEDEB]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {draft.tutorLanguage === 'darija-fr' && (
              <div className="animate-fade-slide pt-1">
                <div className="mb-1 text-[11px] font-medium text-[#85837C] dark:text-[#85857D]">
                  Darija Script
                </div>
                <div className="grid grid-cols-2 gap-0.5 rounded-lg bg-[#F1F1EC] p-0.5 dark:bg-[#111110]">
                  {DARIJA_SCRIPT_OPTIONS.map((scriptOpt) => {
                    const active = draft.darijaScript === scriptOpt.id;
                    return (
                      <button
                        key={scriptOpt.id}
                        type="button"
                        onClick={() => update({ darijaScript: scriptOpt.id })}
                        className={`rounded-md px-2 py-1.5 text-left transition-colors ${
                          active
                            ? 'bg-white text-[#292824] shadow-2xs dark:bg-[#232320] dark:text-[#EDEDEB]'
                            : 'text-[#85837C] hover:text-[#292824] dark:text-[#85857D] dark:hover:text-[#EDEDEB]'
                        }`}
                      >
                        <div className="text-[11px] font-medium">{scriptOpt.label}</div>
                        <div
                          dir={scriptOpt.id === 'arabic' ? 'rtl' : 'ltr'}
                          className="mt-0.5 truncate text-[10px] opacity-70"
                        >
                          {scriptOpt.example}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Status + test */}
          {(draft.activeProvider === 'gemini' || draft.activeProvider === 'openai-api') && (
            <div className="flex items-center justify-between gap-2 border-t border-[#E5E5E0] pt-3 dark:border-[#2A2A27]">
              <div className="min-w-0 flex-1 text-[11px] font-medium">
                {status && (
                  <span
                    className={
                      status.ok
                        ? 'text-[#15803D] dark:text-[#4ADE80]'
                        : 'text-[#B91C1C] dark:text-[#F87171]'
                    }
                  >
                    {status.text}
                  </span>
                )}
              </div>
              <button
                type="button"
                disabled={
                  busy !== null ||
                  (draft.activeProvider === 'gemini' && !draft.gemini.apiKey.trim()) ||
                  (draft.activeProvider === 'openai-api' && !draft.openai.apiKey.trim())
                }
                onClick={
                  draft.activeProvider === 'gemini' ? runGeminiTest : runOpenAITest
                }
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#E5E5E0] bg-white px-3 py-1.5 text-xs font-medium text-[#1A1918] hover:bg-[#FBFBFA] disabled:opacity-40 dark:border-[#2A2A27] dark:bg-[#111110] dark:text-[#EDEDEB] dark:hover:bg-[#232320]"
              >
                {busy !== null ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Zap className="h-3 w-3" />
                )}
                <span>Test</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-end gap-2 border-t border-[#E5E5E0] pt-3 dark:border-[#2A2A27]">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3.5 py-2 text-xs font-medium text-[#6B6965] hover:text-[#1A1918] dark:text-[#A1A09A] dark:hover:text-[#EDEDEB]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onSave(draft);
              onClose();
            }}
            className="rounded-lg bg-[#1A1918] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#33312E] dark:bg-[#EDEDEB] dark:text-[#111110] dark:hover:bg-white"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
