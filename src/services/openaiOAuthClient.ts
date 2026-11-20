import {
  createOpenAIOAuthTransport,
  deriveAccountId,
  deriveChatGptAccountIsFedRamp,
  type OpenAIOAuthSession,
  parseJwtClaims,
} from '@openai-oauth/core';
import { createSessionStore, getSession, logout as clearWebSession } from '@openai-oauth/web';
import { ChatGPTAccountSummary, ChatGPTOAuthSettings } from '../types/harness';

export const sharedOAuthSessionStore = createSessionStore();

export const DEFAULT_LOCAL_OAUTH_PROXY = 'http://127.0.0.1:10531/v1';

export const codexOAuthTransport = createOpenAIOAuthTransport({
  auth: () => getSession({ sessionStore: sharedOAuthSessionStore }),
});

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

export function extractAccountSummaryFromSession(
  session: OpenAIOAuthSession | null
): ChatGPTAccountSummary | null {
  if (!session) return null;

  const idClaims = parseJwtClaims(session.idToken) ?? {};
  const accessClaims = parseJwtClaims(session.accessToken) ?? {};

  const email =
    (typeof idClaims.email === 'string' && idClaims.email) ||
    (typeof accessClaims.email === 'string' && accessClaims.email) ||
    undefined;

  const name =
    (typeof idClaims.name === 'string' && idClaims.name) ||
    (typeof accessClaims.name === 'string' && accessClaims.name) ||
    undefined;

  const idAuth = isRecord(idClaims['https://api.openai.com/auth'])
    ? idClaims['https://api.openai.com/auth']
    : undefined;
  const accessAuth = isRecord(accessClaims['https://api.openai.com/auth'])
    ? accessClaims['https://api.openai.com/auth']
    : undefined;

  const rawPlan =
    (idAuth && typeof idAuth.chatgpt_plan_type === 'string' && idAuth.chatgpt_plan_type) ||
    (accessAuth &&
      typeof accessAuth.chatgpt_plan_type === 'string' &&
      accessAuth.chatgpt_plan_type) ||
    undefined;

  return {
    accountId: session.accountId,
    email,
    name,
    plan: rawPlan,
    expiresAt: session.expiresAt,
  };
}

export async function readStoredChatGPTSession(): Promise<{
  session: OpenAIOAuthSession | null;
  summary: ChatGPTAccountSummary | null;
}> {
  try {
    const session = await getSession({
      sessionStore: sharedOAuthSessionStore,
      refresh: false,
    });
    return {
      session,
      summary: extractAccountSummaryFromSession(session),
    };
  } catch {
    return { session: null, summary: null };
  }
}

export async function signOutChatGPTSession(): Promise<void> {
  await clearWebSession({ sessionStore: sharedOAuthSessionStore });
}

export async function importCodexAuthJson(rawInput: string): Promise<{
  session: OpenAIOAuthSession;
  summary: ChatGPTAccountSummary | null;
}> {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    throw new Error('Paste the JSON contents of ~/.codex/auth.json first.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error('Invalid JSON format. Copy the entire contents of ~/.codex/auth.json.');
  }

  if (!isRecord(parsed)) {
    throw new Error('Expected a JSON object from auth.json.');
  }

  const tokensObj = isRecord(parsed.tokens) ? parsed.tokens : parsed;

  const accessToken =
    (typeof tokensObj.access_token === 'string' && tokensObj.access_token) ||
    (typeof tokensObj.accessToken === 'string' && tokensObj.accessToken) ||
    undefined;

  if (!accessToken) {
    throw new Error('Could not find "access_token" (or "tokens.access_token") in the JSON.');
  }

  const idToken =
    (typeof tokensObj.id_token === 'string' && tokensObj.id_token) ||
    (typeof tokensObj.idToken === 'string' && tokensObj.idToken) ||
    undefined;

  const refreshToken =
    (typeof tokensObj.refresh_token === 'string' && tokensObj.refresh_token) ||
    (typeof tokensObj.refreshToken === 'string' && tokensObj.refreshToken) ||
    undefined;

  const accountId =
    (typeof tokensObj.account_id === 'string' && tokensObj.account_id) ||
    (typeof tokensObj.accountId === 'string' && tokensObj.accountId) ||
    deriveAccountId(idToken) ||
    deriveAccountId(accessToken);

  if (!accountId) {
    throw new Error('Could not determine ChatGPT account_id from auth.json tokens.');
  }

  const accessClaims = parseJwtClaims(accessToken);
  const expSeconds =
    accessClaims && typeof accessClaims.exp === 'number' ? accessClaims.exp : undefined;

  const session: OpenAIOAuthSession = {
    accessToken,
    accountId,
    idToken,
    refreshToken,
    isFedRamp:
      deriveChatGptAccountIsFedRamp(idToken) || deriveChatGptAccountIsFedRamp(accessToken),
    expiresAt: expSeconds ? new Date(expSeconds * 1000).toISOString() : undefined,
    lastRefresh:
      typeof parsed.last_refresh === 'string' ? parsed.last_refresh : new Date().toISOString(),
  };

  await sharedOAuthSessionStore.set(session);
  return {
    session,
    summary: extractAccountSummaryFromSession(session),
  };
}

function filterTextCapableModels(ids: string[]): string[] {
  const unique = Array.from(new Set(ids.filter((id) => typeof id === 'string' && id.trim())));
  const textModels = unique.filter(
    (id) => !id.includes('image') && !id.includes('embedding') && !id.includes('tts')
  );
  return textModels.length > 0 ? textModels : unique;
}

export async function discoverChatGPTOAuthModels(
  settings: ChatGPTOAuthSettings
): Promise<string[]> {
  if (settings.mode === 'local-proxy') {
    const base = (settings.proxyUrl.trim() || DEFAULT_LOCAL_OAUTH_PROXY).replace(/\/$/, '');
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (settings.proxyToken.trim()) {
      headers.Authorization = `Bearer ${settings.proxyToken.trim()}`;
    } else {
      headers.Authorization = 'Bearer openai-oauth';
    }

    let res: Response;
    try {
      res = await fetch(`${base}/models`, { headers });
    } catch {
      throw new Error(
        `Could not connect to ${base}. Run "npx openai-oauth@latest" in your terminal (with CORS enabled for ${window.location.origin} if required).`
      );
    }

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(
        `Local proxy returned HTTP ${res.status}${txt ? `: ${txt.slice(0, 120)}` : ''}`
      );
    }

    const payload = await res.json();
    const list: string[] = Array.isArray(payload?.data)
      ? payload.data.map((m: { id?: string }) => m.id || '').filter(Boolean)
      : Array.isArray(payload?.models)
      ? payload.models.map((m: { slug?: string; id?: string }) => m.slug || m.id || '').filter(Boolean)
      : [];

    const filtered = filterTextCapableModels(list);
    if (filtered.length === 0) {
      throw new Error('Connected to proxy, but /models returned no models.');
    }
    return filtered;
  }

  // Browser session mode (@openai-oauth/web + @openai-oauth/core)
  const session = await getSession({ sessionStore: sharedOAuthSessionStore });
  if (!session) {
    throw new Error('Not signed in with ChatGPT yet. Complete sign-in first.');
  }

  let res: Response;
  try {
    res = await codexOAuthTransport.request('/v1/models');
  } catch {
    throw new Error(
      'Browser blocked direct request to chatgpt.com/backend-api/codex (CORS). Install the "Sign in with ChatGPT" browser extension or switch to the Local CLI Proxy ("npx openai-oauth@latest").'
    );
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    const msg =
      errBody?.error?.message || `Codex /models returned HTTP ${res.status}.`;
    throw new Error(msg);
  }

  const payload = await res.json();
  const ids: string[] = Array.isArray(payload?.data)
    ? payload.data.map((m: { id?: string }) => m.id || '').filter(Boolean)
    : [];

  return filterTextCapableModels(ids);
}

export function extractResponsesOutputText(payload: unknown): string {
  if (!isRecord(payload)) return '';

  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  if (Array.isArray(payload.output)) {
    const chunks: string[] = [];
    for (const item of payload.output) {
      if (!isRecord(item)) continue;
      if (typeof item.text === 'string') {
        chunks.push(item.text);
      }
      if (Array.isArray(item.content)) {
        for (const part of item.content) {
          if (!isRecord(part)) continue;
          if (
            (part.type === 'output_text' || part.type === 'text' || !part.type) &&
            typeof part.text === 'string'
          ) {
            chunks.push(part.text);
          }
        }
      }
    }
    if (chunks.length > 0) {
      return chunks.join('\n').trim();
    }
  }

  // Fallback if a proxy returned OpenAI chat.completions format
  if (Array.isArray(payload.choices) && isRecord(payload.choices[0])) {
    const message = payload.choices[0].message;
    if (isRecord(message) && typeof message.content === 'string') {
      return message.content.trim();
    }
  }

  return '';
}

async function parseResponsesHttpReply(res: Response): Promise<string> {
  const contentType = res.headers.get('content-type') || '';
  const rawBody = await res.text();

  if (contentType.includes('text/event-stream') || rawBody.includes('event: response.')) {
    // Parse SSE stream lines for output_text deltas or completed response
    const deltas: string[] = [];
    let completedObj: unknown = null;
    for (const line of rawBody.split(/\r?\n/)) {
      if (!line.startsWith('data:')) continue;
      const dataStr = line.slice(5).trim();
      if (!dataStr || dataStr === '[DONE]') continue;
      try {
        const evt = JSON.parse(dataStr);
        if (evt?.type === 'response.output_text.delta' && typeof evt.delta === 'string') {
          deltas.push(evt.delta);
        } else if (evt?.type === 'response.completed' && evt.response) {
          completedObj = evt.response;
        } else if (evt?.response?.output) {
          completedObj = evt.response;
        }
      } catch {
        // ignore partial SSE line
      }
    }
    if (completedObj) {
      const extracted = extractResponsesOutputText(completedObj);
      if (extracted) return extracted;
    }
    if (deltas.length > 0) return deltas.join('').trim();
  }

  const parsed = JSON.parse(rawBody);
  return extractResponsesOutputText(parsed);
}

export async function runChatGPTOAuthInference(params: {
  instructions: string;
  userPrompt: string;
  settings: ChatGPTOAuthSettings;
}): Promise<{ text: string; modelUsed: string }> {
  const { instructions, userPrompt, settings } = params;

  // Determine model slug dynamically from account catalog when set to auto
  let model =
    settings.preferredModel && settings.preferredModel !== 'auto'
      ? settings.preferredModel.trim()
      : settings.discoveredModels[0] || '';

  if (!model) {
    try {
      const models = await discoverChatGPTOAuthModels(settings);
      model = models[0] || 'gpt-5.4-mini';
    } catch {
      model = 'gpt-5.4-mini';
    }
  }

  if (settings.mode === 'local-proxy') {
    const base = (settings.proxyUrl.trim() || DEFAULT_LOCAL_OAUTH_PROXY).replace(/\/$/, '');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.proxyToken.trim() || 'openai-oauth'}`,
    };

    let res: Response;
    try {
      res = await fetch(`${base}/responses`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          instructions,
          input: userPrompt,
          store: false,
        }),
      });
    } catch {
      throw new Error(
        `Could not reach local OpenAI OAuth proxy at ${base}. Make sure "npx openai-oauth@latest" is running.`
      );
    }

    if (res.status === 404) {
      // Fallback to /chat/completions if custom OpenAI-compatible proxy only serves chat/completions
      const chatRes = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: instructions },
            { role: 'user', content: userPrompt },
          ],
        }),
      });
      if (!chatRes.ok) {
        const errTxt = await chatRes.text().catch(() => '');
        throw new Error(`Local proxy error (${chatRes.status}): ${errTxt.slice(0, 160)}`);
      }
      const text = await parseResponsesHttpReply(chatRes);
      return { text, modelUsed: model };
    }

    if (!res.ok) {
      const errTxt = await res.text().catch(() => '');
      throw new Error(`OpenAI OAuth proxy returned ${res.status}: ${errTxt.slice(0, 180)}`);
    }

    const text = await parseResponsesHttpReply(res);
    if (!text) {
      throw new Error('OpenAI OAuth proxy returned an empty response.');
    }
    return { text, modelUsed: model };
  }

  // Browser OAuth / Codex Imported Session via @openai-oauth/core transport
  const session = await getSession({ sessionStore: sharedOAuthSessionStore });
  if (!session) {
    throw new Error(
      'No active ChatGPT OAuth session found. Open Engine Settings and click "Sign in with ChatGPT" (or connect a local npx openai-oauth proxy).'
    );
  }

  let res: Response;
  try {
    res = await codexOAuthTransport.request('/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        instructions,
        input: userPrompt,
      }),
    });
  } catch {
    throw new Error(
      'Direct browser request to Codex backend was blocked by CORS. Make sure the "Sign in with ChatGPT" Chrome/Firefox extension is enabled, or switch ChatGPT OAuth to Local CLI Proxy ("npx openai-oauth@latest").'
    );
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    let detail = errText.slice(0, 180);
    try {
      const parsedErr = JSON.parse(errText);
      detail = parsedErr?.detail || parsedErr?.error?.message || detail;
    } catch {
      // keep raw slice
    }
    throw new Error(`ChatGPT Codex OAuth returned HTTP ${res.status}: ${detail}`);
  }

  const text = await parseResponsesHttpReply(res);
  if (!text) {
    throw new Error('ChatGPT Codex OAuth returned an empty response body.');
  }

  return { text, modelUsed: model };
}
