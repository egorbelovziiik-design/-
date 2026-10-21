import type { AiProviderConfig, ChatMessage } from '../shared/types'

/**
 * Real AI provider integrations.
 * - OpenAI / OpenRouter / Ollama / LM Studio / custom  -> OpenAI-compatible /chat/completions (SSE streaming)
 * - Anthropic -> /v1/messages (SSE streaming)
 * - Gemini -> generateContent / streamGenerateContent (SSE)
 * No mock responses: if the endpoint is unreachable or the key is wrong, the real error is returned.
 */

export async function* streamChat(cfg: AiProviderConfig, messages: ChatMessage[], signal: AbortSignal): AsyncGenerator<string> {
  if (cfg.provider === 'anthropic') yield* streamAnthropic(cfg, messages, signal)
  else if (cfg.provider === 'gemini') yield* streamGemini(cfg, messages, signal)
  else yield* streamOpenAi(cfg, messages, signal)
}

async function* sseLines(res: Response): AsyncGenerator<string> {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let idx
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim()
      buf = buf.slice(idx + 1)
      if (line.startsWith('data:')) yield line.slice(5).trim()
    }
  }
}

async function* streamOpenAi(cfg: AiProviderConfig, messages: ChatMessage[], signal: AbortSignal): AsyncGenerator<string> {
  const base = (cfg.baseUrl || '').replace(/\/$/, '')
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
      ...(cfg.provider === 'openrouter' ? { 'HTTP-Referer': 'https://wincode.ai', 'X-Title': 'WinCode AI' } : {})
    },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      temperature: cfg.temperature,
      max_tokens: cfg.maxTokens || undefined,
      stream: true
    })
  })
  if (!res.ok || !res.body) throw new Error(`AI API ${res.status}: ${(await res.text()).slice(0, 600)}`)
  for await (const data of sseLines(res)) {
    if (data === '[DONE]') break
    try {
      const json = JSON.parse(data)
      const delta = json.choices?.[0]?.delta?.content || json.choices?.[0]?.message?.content || ''
      if (delta) yield delta
    } catch { /* partial chunk */ }
  }
}

async function* streamAnthropic(cfg: AiProviderConfig, messages: ChatMessage[], signal: AbortSignal): AsyncGenerator<string> {
  const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n')
  const msgs = messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content }))
  const res = await fetch(`${(cfg.baseUrl || 'https://api.anthropic.com').replace(/\/$/, '')}/v1/messages`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: cfg.model,
      system: system || undefined,
      messages: msgs,
      max_tokens: cfg.maxTokens || 4096,
      temperature: cfg.temperature,
      stream: true
    })
  })
  if (!res.ok || !res.body) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 600)}`)
  for await (const data of sseLines(res)) {
    try {
      const json = JSON.parse(data)
      if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') yield json.delta.text
      if (json.type === 'error') throw new Error(json.error?.message || 'Anthropic error')
    } catch (e: any) {
      if (e?.message && !String(e.message).includes('JSON')) throw e
    }
  }
}

async function* streamGemini(cfg: AiProviderConfig, messages: ChatMessage[], signal: AbortSignal): AsyncGenerator<string> {
  const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n')
  const contents = messages.filter(m => m.role !== 'system').map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }))
  const url = `${(cfg.baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '')}/models/${cfg.model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(cfg.apiKey)}`
  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      generationConfig: { temperature: cfg.temperature, maxOutputTokens: cfg.maxTokens || 8192 }
    })
  })
  if (!res.ok || !res.body) throw new Error(`Gemini API ${res.status}: ${(await res.text()).slice(0, 600)}`)
  for await (const data of sseLines(res)) {
    try {
      const json = JSON.parse(data)
      const text = json.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || ''
      if (text) yield text
    } catch { /* partial */ }
  }
}

/** Non-streaming short completion (used for inline ghost text in the editor). */
export async function completeOnce(cfg: AiProviderConfig, messages: ChatMessage[], signal: AbortSignal): Promise<string> {
  let out = ''
  for await (const chunk of streamChat({ ...cfg, maxTokens: Math.min(cfg.maxTokens || 256, 256) }, messages, signal)) {
    out += chunk
    if (out.length > 2000) break
  }
  return out
}

/** Lists models from an OpenAI-compatible endpoint (Ollama / LM Studio / OpenRouter...). */
export async function listModels(cfg: AiProviderConfig): Promise<string[]> {
  if (cfg.provider === 'anthropic') return PROVIDER_DEFAULTS.anthropic
  if (cfg.provider === 'gemini') {
    const res = await fetch(`${(cfg.baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '')}/models?key=${encodeURIComponent(cfg.apiKey)}`)
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`)
    const json: any = await res.json()
    return (json.models || []).map((m: any) => String(m.name).replace('models/', '')).filter(Boolean)
  }
  const res = await fetch(`${(cfg.baseUrl || '').replace(/\/$/, '')}/models`, {
    headers: cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}
  })
  if (!res.ok) throw new Error(`Models ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const json: any = await res.json()
  return (json.data || json.models || []).map((m: any) => m.id || m.name).filter(Boolean)
}

const PROVIDER_DEFAULTS = { anthropic: ['claude-sonnet-4-5', 'claude-3-7-sonnet-latest', 'claude-3-5-haiku-latest'] }
