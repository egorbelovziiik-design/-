export interface FileNode {
  name: string
  path: string
  isDir: boolean
  children?: FileNode[]
}

export type ProviderId = 'openai' | 'anthropic' | 'gemini' | 'openrouter' | 'ollama' | 'lmstudio' | 'custom'

export interface AiProviderConfig {
  provider: ProviderId
  model: string
  baseUrl: string
  apiKey: string
  temperature: number
  maxTokens: number
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type AiMode = 'ASK' | 'EDIT' | 'AGENT' | 'PLAN' | 'DEBUG' | 'AUTOPILOT'

export interface ProposedFile {
  path: string
  content: string
  exists: boolean
}

export interface MinecraftProjectOptions {
  type: 'fabric-mod' | 'fabric-client' | 'forge-mod' | 'neoforge-mod' | 'plugin' | 'launcher'
  name: string
  modId: string
  packageName: string
  parentDir: string
  mcVersion: string
}

export interface McAccount {
  id: string
  type: 'offline' | 'microsoft'
  username: string
  uuid: string
  accessToken?: string
  expiresAt?: number
}

export interface RunResult {
  code: number
  output: string
}

export const PROVIDERS: Record<ProviderId, { label: string; baseUrl: string; models: string[]; needsKey: boolean }> = {
  openai: { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', models: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'], needsKey: true },
  anthropic: { label: 'Anthropic Claude', baseUrl: 'https://api.anthropic.com', models: ['claude-sonnet-4-5', 'claude-3-7-sonnet-latest', 'claude-3-5-haiku-latest'], needsKey: true },
  gemini: { label: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', models: ['gemini-2.0-flash', 'gemini-2.5-pro', 'gemini-1.5-flash'], needsKey: true },
  openrouter: { label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', models: ['anthropic/claude-sonnet-4.5', 'openai/gpt-4o', 'deepseek/deepseek-chat', 'google/gemini-2.0-flash-001'], needsKey: true },
  ollama: { label: 'Ollama (локально)', baseUrl: 'http://127.0.0.1:11434/v1', models: ['qwen2.5-coder:14b', 'qwen2.5-coder:7b', 'deepseek-coder-v2', 'llama3.1:8b'], needsKey: false },
  lmstudio: { label: 'LM Studio (локально)', baseUrl: 'http://127.0.0.1:1234/v1', models: ['local-model'], needsKey: false },
  custom: { label: 'OpenAI-compatible (свой URL)', baseUrl: 'http://127.0.0.1:8080/v1', models: ['model'], needsKey: false }
}

export function langFromPath(p: string): string {
  const ext = p.split('.').pop()?.toLowerCase() || ''
  const name = p.split(/[\\/]/).pop()?.toLowerCase() || ''
  if (name === 'dockerfile') return 'dockerfile'
  const map: Record<string, string> = {
    java: 'java', kt: 'kotlin', kts: 'kotlin', py: 'python', js: 'javascript', jsx: 'javascript',
    ts: 'typescript', tsx: 'typescript', html: 'html', htm: 'html', css: 'css', scss: 'scss',
    json: 'json', json5: 'json', xml: 'xml', yml: 'yaml', yaml: 'yaml', c: 'c', h: 'cpp',
    cpp: 'cpp', cc: 'cpp', cs: 'csharp', rs: 'rust', go: 'go', sql: 'sql', gradle: 'java',
    md: 'markdown', sh: 'shell', bat: 'bat', ps1: 'powershell', properties: 'ini', toml: 'ini',
    lua: 'lua', php: 'php', rb: 'ruby', swift: 'swift', glsl: 'glsl', fsh: 'glsl', vsh: 'glsl'
  }
  return map[ext] || 'plaintext'
}

export function offlineUuid(username: string): string {
  // Minecraft offline UUID: name-based MD5 (version 3), like Java UUID.nameUUIDFromBytes("OfflinePlayer:"+name)
  // Реализация MD5 минимальная — используем SubtleCrypto нельзя (нет MD5), поэтому MD5 реализован в main процессе через Node crypto.
  // Здесь только форматирование, фактический UUID считает main (api.minecraftOfflineUuid).
  return username
}
