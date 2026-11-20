import React, { useEffect, useState } from 'react';
import { SignInWithChatGPT } from '@openai-oauth/react';
import { Check, Copy, Loader2, LogOut, RefreshCw } from 'lucide-react';
import { ChatGPTOAuthMode, ChatGPTOAuthSettings } from '../types/harness';
import {
  DEFAULT_LOCAL_OAUTH_PROXY,
  discoverChatGPTOAuthModels,
  extractAccountSummaryFromSession,
  importCodexAuthJson,
  readStoredChatGPTSession,
  sharedOAuthSessionStore,
  signOutChatGPTSession,
} from '../services/openaiOAuthClient';

interface ChatGPTOAuthPanelProps {
  value: ChatGPTOAuthSettings;
  onChange: (next: ChatGPTOAuthSettings) => void;
}

const FALLBACK_MODELS = ['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.4', 'gpt-5.4-mini'];

const MODE_LABELS: Record<ChatGPTOAuthMode, string> = {
  'browser-extension': 'Browser sign-in',
  'local-proxy': 'Local CLI proxy',
  'codex-import': 'Import auth.json',
};

export const ChatGPTOAuthPanel: React.FC<ChatGPTOAuthPanelProps> = ({
  value,
  onChange,
}) => {
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [importText, setImportText] = useState('');
  const [copied, setCopied] = useState(false);

  // Sync encrypted IndexedDB session on mount
  useEffect(() => {
    let active = true;
    void (async () => {
      const { summary } = await readStoredChatGPTSession();
      if (active && summary && summary.accountId !== value.accountSummary?.accountId) {
        onChange({ ...value, accountSummary: summary });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleDiscover = async (override?: ChatGPTOAuthSettings) => {
    const target = override ?? value;
    setDiscovering(true);
    setStatus(null);
    try {
      const models = await discoverChatGPTOAuthModels(target);
      const preferred =
        target.preferredModel !== 'auto' && models.includes(target.preferredModel)
          ? target.preferredModel
          : models[0] || 'auto';
      onChange({ ...target, discoveredModels: models, preferredModel: preferred });
      setStatus({ ok: true, text: `${models.length} models found` });
    } catch (err) {
      setStatus({
        ok: false,
        text: err instanceof Error ? err.message : 'Failed to fetch models.',
      });
    } finally {
      setDiscovering(false);
    }
  };

  const handleImport = async () => {
    try {
      const { summary } = await importCodexAuthJson(importText);
      onChange({ ...value, accountSummary: summary });
      setImportText('');
      setStatus({ ok: true, text: 'Session imported' });
    } catch (err) {
      setStatus({
        ok: false,
        text: err instanceof Error ? err.message : 'Import failed.',
      });
    }
  };

  const handleDisconnect = async () => {
    await signOutChatGPTSession();
    onChange({ ...value, accountSummary: null, discoveredModels: [] });
    setStatus({ ok: true, text: 'Signed out' });
  };

  const copyCmd = async (cmd: string) => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore
    }
  };

  const models =
    value.discoveredModels.length > 0 ? value.discoveredModels : FALLBACK_MODELS;

  const cliCmd = `npx openai-oauth@latest --allow-origin ${
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'
  }`;

  return (
    <div className="space-y-3">
      {/* Mode + account status */}
      <div className="flex items-center justify-between gap-2">
        <select
          value={value.mode}
          onChange={(e) => {
            setStatus(null);
            onChange({ ...value, mode: e.target.value as ChatGPTOAuthMode });
          }}
          className="rounded-lg border border-[#E5E5E0] bg-white px-2.5 py-1.5 text-xs text-[#1A1918] focus:border-[#10A37F] focus:outline-none dark:border-[#2A2A27] dark:bg-[#111110] dark:text-[#EDEDEB]"
        >
          {(Object.keys(MODE_LABELS) as ChatGPTOAuthMode[]).map((m) => (
            <option key={m} value={m}>
              {MODE_LABELS[m]}
            </option>
          ))}
        </select>

        {value.accountSummary ? (
          <button
            type="button"
            onClick={handleDisconnect}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#B91C1C] hover:underline dark:text-[#F87171]"
          >
            <LogOut className="h-3 w-3" />
            <span>Disconnect</span>
          </button>
        ) : (
          <span className="text-[11px] text-[#6B6965] dark:text-[#A1A09A]">Not connected</span>
        )}
      </div>

      {value.accountSummary && (
        <div className="rounded-lg border border-[#E5E5E0] bg-[#FBFBFA] px-3 py-2 text-[11px] text-[#6B6965] dark:border-[#2A2A27] dark:bg-[#111110] dark:text-[#A1A09A]">
          <span className="font-medium text-[#1A1918] dark:text-[#EDEDEB]">
            {value.accountSummary.email ||
              value.accountSummary.name ||
              'ChatGPT account linked'}
          </span>
          {value.accountSummary.plan && (
            <span className="ml-1.5 rounded-full bg-[#10A37F]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#10A37F] uppercase dark:bg-[#34D399]/15 dark:text-[#34D399]">
              {value.accountSummary.plan}
            </span>
          )}
        </div>
      )}

      {/* Mode bodies */}
      {value.mode === 'browser-extension' && (
        <div className="flex justify-center py-1">
          {value.accountSummary ? (
            <button
              type="button"
              onClick={handleDisconnect}
              className="rounded-lg border border-[#E5E5E0] bg-white px-3.5 py-2 text-xs font-medium text-[#1A1918] hover:bg-[#FBFBFA] dark:border-[#2A2A27] dark:bg-[#111110] dark:text-[#EDEDEB] dark:hover:bg-[#232320]"
            >
              Disconnect ChatGPT
            </button>
          ) : (
            <SignInWithChatGPT
              sessionStore={sharedOAuthSessionStore}
              openMode="popup"
              onSuccess={(session) => {
                const summary = extractAccountSummaryFromSession(session);
                const next = { ...value, accountSummary: summary };
                onChange(next);
                void handleDiscover(next);
              }}
              onError={(err) => setStatus({ ok: false, text: err.message })}
            />
          )}
        </div>
      )}

      {value.mode === 'local-proxy' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 rounded-lg border border-[#2A2A27] bg-[#1A1918] px-3 py-2 dark:bg-[#111110]">
            <code className="font-mono-code overflow-x-auto text-[10.5px] whitespace-nowrap text-emerald-300">
              {cliCmd}
            </code>
            <button
              type="button"
              onClick={() => copyCmd(cliCmd)}
              className="inline-flex shrink-0 items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[10px] font-medium text-white hover:bg-white/20"
              title="Copy command"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>
          <input
            type="url"
            value={value.proxyUrl}
            onChange={(e) => onChange({ ...value, proxyUrl: e.target.value })}
            placeholder={DEFAULT_LOCAL_OAUTH_PROXY}
            className="font-mono-code w-full rounded-lg border border-[#E5E5E0] bg-white px-3 py-1.5 text-[11px] text-[#1A1918] focus:border-[#10A37F] focus:outline-none dark:border-[#2A2A27] dark:bg-[#111110] dark:text-[#EDEDEB]"
          />
        </div>
      )}

      {value.mode === 'codex-import' && (
        <div className="space-y-2">
          <textarea
            rows={3}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder='{"tokens":{"access_token":"...","account_id":"..."}}'
            className="font-mono-code w-full rounded-lg border border-[#E5E5E0] bg-[#FBFBFA] px-3 py-2 text-[11px] text-[#1A1918] focus:border-[#10A37F] focus:outline-none dark:border-[#2A2A27] dark:bg-[#111110] dark:text-[#EDEDEB]"
          />
          <button
            type="button"
            disabled={!importText.trim()}
            onClick={handleImport}
            className="w-full rounded-lg bg-[#10A37F] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0E8A6B] disabled:opacity-40"
          >
            Import
          </button>
        </div>
      )}

      {/* Model picker */}
      <div className="flex items-center gap-2">
        <select
          value={value.preferredModel}
          onChange={(e) => onChange({ ...value, preferredModel: e.target.value })}
          className="font-mono-code min-w-0 flex-1 rounded-lg border border-[#E5E5E0] bg-white px-2.5 py-1.5 text-[11px] text-[#1A1918] focus:border-[#10A37F] focus:outline-none dark:border-[#2A2A27] dark:bg-[#111110] dark:text-[#EDEDEB]"
        >
          <option value="auto">auto</option>
          {models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={discovering}
          onClick={() => handleDiscover()}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#E5E5E0] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#1A1918] hover:bg-[#FBFBFA] disabled:opacity-40 dark:border-[#2A2A27] dark:bg-[#111110] dark:text-[#EDEDEB] dark:hover:bg-[#232320]"
        >
          {discovering ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          <span>Sync</span>
        </button>
      </div>

      {status && (
        <div
          className={`rounded-lg px-3 py-1.5 text-[11px] ${
            status.ok
              ? 'bg-[#ECFDF5] text-[#15803D] dark:bg-[#052E16]/45 dark:text-[#4ADE80]'
              : 'bg-[#FEF2F2] text-[#B91C1C] dark:bg-[#450A0A]/45 dark:text-[#F87171]'
          }`}
        >
          {status.text}
        </div>
      )}
    </div>
  );
};
