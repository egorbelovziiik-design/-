/**
 * Universal AI provider layer.
 * Talks to real model APIs only — no fake/mock responses.
 *
 * Supported:
 *  - OpenAI-compatible chat completions (OpenAI, OpenRouter, Ollama, LM Studio, custom)
 *  - Anthropic Messages API (Claude)
 *  - Google Gemini (streamGenerateContent)
 * All support streaming (SSE) and tool calling where the upstream API supports it.
 */
import type { AIProviderConfig, AIMessage, AIToolCall } from '../../shared/types';

export interface StreamHandlers {
  onTextDelta: (delta: string) => void;
  onToolCalls?: (calls: AIToolCall[]) => void;
  onDone: (info: { finishReason: string; usage?: unknown }) => void;
  onError: (err: Error) => void;
}

export interface ChatRequestOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: AIToolDefinition[];
  signal?: AbortSignal;
}

export interface AIToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON schema
}

export interface ProviderAuth {
  provider: AIProviderConfig;
  apiKey: string;
}

export class AICancelledError extends Error {
  constructor() {
    super('Request cancelled');
    this.name = 'AICancelledError';
  }
}

function headersJson(extra: Record<string, string> = {}): Record<string, string> {
  return { 'Content-Type': 'application/json', ...extra };
}

function convertMessages(messages: AIMessage[]) {
  return messages.map((m) => ({
    role: m.role,
    content: m.content,
    ...(m.toolCalls?.length ? { tool_calls: m.toolCalls.map((t) => ({ id: t.id, type: 'function', function: { name: t.name, arguments: t.arguments } })) } : {}),
    ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
    ...(m.name && m.role === 'tool' ? { name: m.name } : {}),
  }));
}

async function* sseLines(res: Response, signal?: AbortSignal): AsyncGenerator<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      if (signal?.aborted) {
        await reader.cancel().catch(() => undefined);
        throw new AICancelledError();
      }
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).replace(/\r$/, '');
        buffer = buffer.slice(idx + 1);
        if (line) yield line;
      }
    }
    if (buffer.trim()) yield buffer.trim();
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* noop */
    }
  }
}

function parseSseData(line: string): string | null {
  if (line.startsWith('data:')) return line.slice(5).trim();
  return null;
}

/* ============================ OpenAI-compatible ============================ */

async function streamOpenAI(auth: ProviderAuth, messages: AIMessage[], handlers: StreamHandlers, opts: ChatRequestOptions) {
  const model = opts.model ?? auth.provider.model;
  const body: Record<string, unknown> = {
    model,
    messages: convertMessages(messages),
    temperature: opts.temperature ?? auth.provider.temperature,
    stream: true,
  };
  if (opts.maxTokens) body.max_tokens = opts.maxTokens;
  if (opts.tools?.length) {
    body.tools = opts.tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
    body.tool_choice = 'auto';
  }

  const url = auth.provider.baseUrl.replace(/\/$/, '') + '/chat/completions';
  const headers = headersJson();
  // Ollama / LM Studio tolerate empty keys; OpenAI & friends require them.
  if (auth.apiKey) headers.Authorization = `Bearer ${auth.apiKey}`;

  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: opts.signal });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${auth.provider.name} API error ${res.status}: ${text.slice(0, 600)}`);
  }

  const toolAcc = new Map<number, { id: string; name: string; args: string }>();
  let finishReason = 'stop';

  for await (const line of sseLines(res, opts.signal)) {
    const data = parseSseData(line);
    if (data === null) continue;
    if (data === '[DONE]') break;
    let json: any;
    try {
      json = JSON.parse(data);
    } catch {
      continue;
    }
    const choice = json.choices?.[0];
    if (!choice) continue;
    const delta = choice.delta ?? {};
    if (typeof delta.content === 'string' && delta.content) {
      handlers.onTextDelta(delta.content);
    }
    if (Array.isArray(delta.tool_calls)) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index ?? 0;
        const cur = toolAcc.get(idx) ?? { id: tc.id ?? `call_${idx}`, name: '', args: '' };
        if (tc.id) cur.id = tc.id;
        if (tc.function?.name) cur.name += tc.function.name;
        if (tc.function?.arguments) cur.args += tc.function.arguments;
        toolAcc.set(idx, cur);
      }
    }
    if (choice.finish_reason) finishReason = choice.finish_reason;
  }

  if (toolAcc.size > 0) {
    handlers.onToolCalls?.([...toolAcc.values()].map((t) => ({ id: t.id, name: t.name, arguments: t.args || '{}' })));
    finishReason = finishReason === 'stop' ? 'tool_calls' : finishReason;
  }
  handlers.onDone({ finishReason });
}

/* ============================ Anthropic ============================ */

async function streamAnthropic(auth: ProviderAuth, messages: AIMessage[], handlers: StreamHandlers, opts: ChatRequestOptions) {
  const model = opts.model ?? auth.provider.model;
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const rest = messages.filter((m) => m.role !== 'system');

  const anthropicMessages = rest.map((m) => {
    if (m.role === 'assistant') {
      const content: any[] = [];
      if (m.content) content.push({ type: 'text', text: m.content });
      for (const tc of m.toolCalls ?? []) {
        let args: unknown = {};
        try {
          args = JSON.parse(tc.arguments || '{}');
        } catch {
          args = {};
        }
        content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: args });
      }
      return { role: 'assistant', content: content.length ? content : [{ type: 'text', text: '' }] };
    }
    if (m.role === 'tool') {
      return {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: m.toolCallId, content: m.content || '(empty)' }],
      };
    }
    return { role: 'user', content: m.content };
  });

  // Merge consecutive user messages (tool_result + user text)
  const merged: any[] = [];
  for (const msg of anthropicMessages) {
    const last = merged[merged.length - 1];
    if (last && last.role === 'user' && msg.role === 'user' && Array.isArray(last.content) && Array.isArray(msg.content)) {
      last.content.push(...msg.content);
    } else if (last && last.role === 'user' && msg.role === 'user') {
      last.content = [
        ...(typeof last.content === 'string' ? [{ type: 'text', text: last.content }] : last.content),
        ...(typeof msg.content === 'string' ? [{ type: 'text', text: msg.content }] : msg.content),
      ];
    } else {
      merged.push({ ...msg });
    }
  }

  const body: Record<string, unknown> = {
    model,
    max_tokens: opts.maxTokens ?? 8192,
    messages: merged,
    stream: true,
  };
  if (system) body.system = system;
  if (opts.temperature !== undefined) body.temperature = opts.temperature;
  if (opts.tools?.length) {
    body.tools = opts.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }));
  }

  const res = await fetch(auth.provider.baseUrl.replace(/\/$/, '') + '/messages', {
    method: 'POST',
    headers: headersJson({
      'x-api-key': auth.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    }),
    body: JSON.stringify(body),
    signal: opts.signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${auth.provider.name} API error ${res.status}: ${text.slice(0, 600)}`);
  }

  const toolAcc = new Map<string, { id: string; name: string; args: string }>();
  let currentToolId = '';
  let finishReason = 'end_turn';

  for await (const line of sseLines(res, opts.signal)) {
    const data = parseSseData(line);
    if (data === null) continue;
    let json: any;
    try {
      json = JSON.parse(data);
    } catch {
      continue;
    }
    switch (json.type) {
      case 'content_block_start':
        if (json.content_block?.type === 'tool_use') {
          currentToolId = json.content_block.id;
          toolAcc.set(currentToolId, { id: currentToolId, name: json.content_block.name ?? '', args: '' });
        }
        break;
      case 'content_block_delta':
        if (json.delta?.type === 'text_delta' && json.delta.text) handlers.onTextDelta(json.delta.text);
        if (json.delta?.type === 'input_json_delta' && json.delta.partial_json) {
          const acc = toolAcc.get(currentToolId);
          if (acc) acc.args += json.delta.partial_json;
        }
        break;
      case 'message_delta':
        if (json.delta?.stop_reason) finishReason = json.delta.stop_reason;
        break;
      case 'error':
        handlers.onError(new Error(json.error?.message ?? 'Anthropic stream error'));
        return;
      default:
        break;
    }
  }

  if (toolAcc.size > 0) {
    handlers.onToolCalls?.([...toolAcc.values()].map((t) => ({ id: t.id, name: t.name, arguments: t.args || '{}' })));
    finishReason = 'tool_calls';
  }
  handlers.onDone({ finishReason });
}

/* ============================ Gemini ============================ */

async function streamGemini(auth: ProviderAuth, messages: AIMessage[], handlers: StreamHandlers, opts: ChatRequestOptions) {
  const model = opts.model ?? auth.provider.model;
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');

  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'user',
          parts: [{ functionResponse: { name: m.name ?? 'tool', response: { result: m.content } } }],
        };
      }
      const parts: any[] = [];
      if (m.content) parts.push({ text: m.content });
      for (const tc of m.toolCalls ?? []) {
        let args: unknown = {};
        try {
          args = JSON.parse(tc.arguments || '{}');
        } catch {
          args = {};
        }
        parts.push({ functionCall: { name: tc.name, args } });
      }
      return { role: m.role === 'assistant' ? 'model' : 'user', parts: parts.length ? parts : [{ text: '' }] };
    });

  const body: Record<string, unknown> = {
    contents,
    generationConfig: { temperature: opts.temperature ?? auth.provider.temperature },
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  if (opts.tools?.length) {
    body.tools = [
      {
        functionDeclarations: opts.tools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        })),
      },
    ];
  }

  const url =
    auth.provider.baseUrl.replace(/\/$/, '') +
    `/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(auth.apiKey)}`;
  const res = await fetch(url, { method: 'POST', headers: headersJson(), body: JSON.stringify(body), signal: opts.signal });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${auth.provider.name} API error ${res.status}: ${text.slice(0, 600)}`);
  }

  const toolAcc = new Map<number, AIToolCall>();
  let finishReason = 'STOP';

  for await (const line of sseLines(res, opts.signal)) {
    const data = parseSseData(line);
    if (data === null) continue;
    let json: any;
    try {
      json = JSON.parse(data);
    } catch {
      continue;
    }
    const cand = json.candidates?.[0];
    if (!cand) continue;
    for (const part of cand.content?.parts ?? []) {
      if (typeof part.text === 'string' && part.text) handlers.onTextDelta(part.text);
      if (part.functionCall) {
        const idx = toolAcc.size;
        toolAcc.set(idx, {
          id: `call_${idx}_${Date.now()}`,
          name: part.functionCall.name,
          arguments: JSON.stringify(part.functionCall.args ?? {}),
        });
      }
    }
    if (cand.finishReason) finishReason = cand.finishReason;
  }

  if (toolAcc.size > 0) {
    handlers.onToolCalls?.([...toolAcc.values()]);
    finishReason = 'TOOL_CALLS';
  }
  handlers.onDone({ finishReason });
}

/* ============================ Public API ============================ */

export async function streamChat(auth: ProviderAuth, messages: AIMessage[], handlers: StreamHandlers, opts: ChatRequestOptions = {}): Promise<void> {
  if (!auth.provider) throw new Error('No AI provider configured');
  const kind = auth.provider.kind;
  try {
    if (kind === 'anthropic') {
      if (!auth.apiKey) throw new Error(`API key required for ${auth.provider.name}. Set it in Settings → AI.`);
      await streamAnthropic(auth, messages, handlers, opts);
    } else if (kind === 'gemini') {
      if (!auth.apiKey) throw new Error(`API key required for ${auth.provider.name}. Set it in Settings → AI.`);
      await streamGemini(auth, messages, handlers, opts);
    } else {
      // openai / openrouter / ollama / lmstudio / custom
      if (kind === 'openai' && !auth.apiKey) {
        throw new Error(`API key required for ${auth.provider.name}. Set it in Settings → AI.`);
      }
      await streamOpenAI(auth, messages, handlers, opts);
    }
  } catch (err) {
    if (err instanceof AICancelledError || (err as Error).name === 'AbortError') {
      handlers.onError(new AICancelledError());
      return;
    }
    handlers.onError(err as Error);
  }
}

/** Non-streaming convenience wrapper — used for quick checks and inline completion. */
export async function chatOnce(auth: ProviderAuth, messages: AIMessage[], opts: ChatRequestOptions = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    let acc = '';
    streamChat(
      auth,
      messages,
      {
        onTextDelta: (d) => (acc += d),
        onDone: () => resolve(acc),
        onError: (e) => reject(e),
      },
      opts,
    );
  });
}

export async function testProvider(auth: ProviderAuth): Promise<{ ok: boolean; latencyMs: number; message: string; models?: string[] }> {
  const started = Date.now();
  try {
    // Prefer listing models where supported (OpenAI-compatible endpoints).
    const base = auth.provider.baseUrl.replace(/\/$/, '');
    if (auth.provider.kind !== 'anthropic' && auth.provider.kind !== 'gemini') {
      const res = await fetch(base + '/models', {
        headers: auth.apiKey ? { Authorization: `Bearer ${auth.apiKey}` } : {},
        signal: AbortSignal.timeout(12000),
      });
      if (res.ok) {
        const data = (await res.json()) as { data?: { id: string }[] };
        const models = (data.data ?? []).map((m) => m.id).slice(0, 40);
        const text = await chatOnce(auth, [{ role: 'user', content: 'Reply with the single word: ready' }], { maxTokens: 16 });
        return { ok: true, latencyMs: Date.now() - started, message: `Connected. Reply: ${text.slice(0, 40)}`, models };
      }
      if (res.status === 401 || res.status === 403) {
        return { ok: false, latencyMs: Date.now() - started, message: `Authentication failed (${res.status})` };
      }
    }
    const text = await chatOnce(auth, [{ role: 'user', content: 'Reply with the single word: ready' }], { maxTokens: 16 });
    return { ok: true, latencyMs: Date.now() - started, message: `Connected. Reply: ${text.slice(0, 40)}` };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - started, message: (err as Error).message };
  }
}
