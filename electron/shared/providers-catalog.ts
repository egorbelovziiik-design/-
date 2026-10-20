import type { AIProviderConfig } from './types';

/**
 * WinCode AI — provider catalog.
 * Real, publicly documented API endpoints. All "openai-compatible" providers
 * speak the OpenAI Chat Completions wire format (streaming + tool calling).
 */
export type ProviderGroup = 'cloud' | 'local' | 'aggregator';

export interface ProviderPreset {
  id: string;
  name: string;
  kind: AIProviderConfig['kind'];
  baseUrl: string;
  defaultModel: string;
  models: string[];
  description: string;
  keyUrl: string;
  group: ProviderGroup;
}

export const PROVIDER_CATALOG: ProviderPreset[] = [
  /* ------------------------------ Cloud APIs ------------------------------ */
  {
    id: 'openai',
    name: 'OpenAI',
    kind: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'o4-mini', 'gpt-4-turbo'],
    description: 'GPT-4o, GPT-4.1, o-series — flagship models with tool calling.',
    keyUrl: 'https://platform.openai.com/api-keys',
    group: 'cloud',
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    kind: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-sonnet-4-5',
    models: ['claude-sonnet-4-5', 'claude-opus-4-1', 'claude-haiku-4-5', 'claude-3-7-sonnet-latest', 'claude-3-5-haiku-latest'],
    description: 'Claude Sonnet / Opus / Haiku — excellent for code and long context.',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    group: 'cloud',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    kind: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.0-flash',
    models: ['gemini-2.0-flash', 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-1.5-pro'],
    description: 'Gemini 2.x — huge context, fast multimodal models.',
    keyUrl: 'https://aistudio.google.com/apikey',
    group: 'cloud',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    kind: 'openai-compatible',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    description: 'DeepSeek V3 chat & R1 reasoner — top price/performance for code.',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    group: 'cloud',
  },
  {
    id: 'xai',
    name: 'xAI Grok',
    kind: 'openai-compatible',
    baseUrl: 'https://api.x.ai/v1',
    defaultModel: 'grok-3',
    models: ['grok-3', 'grok-3-mini', 'grok-2-latest', 'grok-code-fast'],
    description: 'Grok 3 / Grok Code — fast reasoning and coding models.',
    keyUrl: 'https://console.x.ai',
    group: 'cloud',
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    kind: 'openai-compatible',
    baseUrl: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-large-latest',
    models: ['mistral-large-latest', 'codestral-latest', 'mistral-medium-latest', 'devstral-small', 'ministral-8b-latest'],
    description: 'Mistral Large & Codestral — European models, strong code generation.',
    keyUrl: 'https://console.mistral.ai/api-keys',
    group: 'cloud',
  },
  {
    id: 'groq',
    name: 'Groq',
    kind: 'openai-compatible',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    models: ['llama-3.3-70b-versatile', 'deepseek-r1-distill-llama-70b', 'qwen-2.5-coder-32b', 'gemma2-9b-it'],
    description: 'LPU inference — the fastest streaming tokens available.',
    keyUrl: 'https://console.groq.com/keys',
    group: 'cloud',
  },
  {
    id: 'moonshot',
    name: 'Moonshot Kimi',
    kind: 'openai-compatible',
    baseUrl: 'https://api.moonshot.ai/v1',
    defaultModel: 'kimi-latest',
    models: ['kimi-latest', 'kimi-k2-0711-preview', 'moonshot-v1-128k', 'moonshot-v1-32k'],
    description: 'Kimi K2 — 1T-parameter open model, excellent agentic coding.',
    keyUrl: 'https://platform.moonshot.ai/console/api-keys',
    group: 'cloud',
  },
  {
    id: 'zhipu',
    name: 'Zhipu GLM',
    kind: 'openai-compatible',
    baseUrl: 'https://api.z.ai/api/paas/v4',
    defaultModel: 'glm-4.6',
    models: ['glm-4.6', 'glm-4.5', 'glm-4-plus', 'glm-4-air', 'codegeex-4'],
    description: 'GLM-4.x family — strong coding and reasoning models.',
    keyUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
    group: 'cloud',
  },
  {
    id: 'qwen',
    name: 'Alibaba Qwen',
    kind: 'openai-compatible',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-max',
    models: ['qwen-max', 'qwen-plus', 'qwen2.5-coder-32b-instruct', 'qwen2.5-coder-14b-instruct', 'qwq-plus'],
    description: 'Qwen Max / Coder — top open-weights coding models via DashScope.',
    keyUrl: 'https://bailian.console.aliyun.com/?apiKey=1',
    group: 'cloud',
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    kind: 'openai-compatible',
    baseUrl: 'https://api.minimax.io/v1',
    defaultModel: 'MiniMax-M2',
    models: ['MiniMax-M2', 'MiniMax-Text-01', 'abab6.5s-chat'],
    description: 'MiniMax M2 — efficient long-context agentic model.',
    keyUrl: 'https://platform.minimax.io/user-center/basic-information/interface-key',
    group: 'cloud',
  },
  {
    id: 'cohere',
    name: 'Cohere',
    kind: 'openai-compatible',
    baseUrl: 'https://api.cohere.com/compatibility/v1',
    defaultModel: 'command-r-plus',
    models: ['command-r-plus', 'command-a', 'command-r7b-12-2024'],
    description: 'Command R+ / Command A — enterprise-grade RAG and tools.',
    keyUrl: 'https://dashboard.cohere.com/api-keys',
    group: 'cloud',
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    kind: 'openai-compatible',
    baseUrl: 'https://api.perplexity.ai',
    defaultModel: 'sonar-pro',
    models: ['sonar-pro', 'sonar', 'sonar-reasoning-pro'],
    description: 'Sonar — answers grounded in live web search.',
    keyUrl: 'https://www.perplexity.ai/settings/api',
    group: 'cloud',
  },
  {
    id: 'together',
    name: 'Together AI',
    kind: 'openai-compatible',
    baseUrl: 'https://api.together.xyz/v1',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    models: [
      'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      'Qwen/Qwen2.5-Coder-32B-Instruct',
      'deepseek-ai/DeepSeek-V3',
      'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo',
    ],
    description: 'Hosted open models: Llama, Qwen Coder, DeepSeek and more.',
    keyUrl: 'https://api.together.ai/settings/api-keys',
    group: 'cloud',
  },
  {
    id: 'fireworks',
    name: 'Fireworks AI',
    kind: 'openai-compatible',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    defaultModel: 'accounts/fireworks/models/deepseek-v3',
    models: [
      'accounts/fireworks/models/deepseek-v3',
      'accounts/fireworks/models/deepseek-r1',
      'accounts/fireworks/models/qwen2p5-coder-32b-instruct',
    ],
    description: 'Fast open-model inference with function calling.',
    keyUrl: 'https://fireworks.ai/account/api-keys',
    group: 'cloud',
  },
  {
    id: 'nvidia-nim',
    name: 'NVIDIA NIM',
    kind: 'openai-compatible',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    defaultModel: 'meta/llama-3.3-70b-instruct',
    models: ['meta/llama-3.3-70b-instruct', 'deepseek-ai/deepseek-r1', 'qwen/qwen2.5-coder-32b-instruct', 'mistralai/codestral-22b-instruct-v0.1'],
    description: 'NVIDIA-hosted optimized model endpoints.',
    keyUrl: 'https://build.nvidia.com/',
    group: 'cloud',
  },
  {
    id: 'huggingface',
    name: 'Hugging Face',
    kind: 'openai-compatible',
    baseUrl: 'https://api-inference.huggingface.co/v1',
    defaultModel: 'Qwen/Qwen2.5-Coder-32B-Instruct',
    models: ['Qwen/Qwen2.5-Coder-32B-Instruct', 'deepseek-ai/DeepSeek-V3', 'meta-llama/Llama-3.3-70B-Instruct', 'mistralai/Mistral-Small-24B-Instruct-2501'],
    description: 'Inference Providers — thousands of open models behind one API.',
    keyUrl: 'https://huggingface.co/settings/tokens',
    group: 'cloud',
  },
  {
    id: 'github-models',
    name: 'GitHub Models',
    kind: 'openai-compatible',
    baseUrl: 'https://models.inference.ai.azure.com',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini', 'DeepSeek-V3', 'DeepSeek-R1', 'Phi-4', 'Llama-3.3-70B-Instruct'],
    description: 'Model catalog from GitHub — use a GitHub Personal Access Token as the key.',
    keyUrl: 'https://github.com/settings/personal-access-tokens',
    group: 'cloud',
  },
  {
    id: 'azure-openai',
    name: 'Azure OpenAI (custom endpoint)',
    kind: 'openai-compatible',
    baseUrl: 'https://YOUR-RESOURCE.openai.azure.com/openai/deployments/YOUR-DEPLOYMENT',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4', 'gpt-4o-mini'],
    description: 'Set Base URL to your Azure resource deployment URL and use the API key from Azure Portal.',
    keyUrl: 'https://portal.azure.com/',
    group: 'cloud',
  },

  /* --------------------------- Aggregators --------------------------- */
  {
    id: 'openrouter',
    name: 'OpenRouter',
    kind: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-sonnet-4.5',
    models: [
      'anthropic/claude-sonnet-4.5',
      'openai/gpt-4o',
      'deepseek/deepseek-chat',
      'google/gemini-2.5-pro',
      'qwen/qwen-2.5-coder-32b-instruct',
      'meta-llama/llama-3.3-70b-instruct',
    ],
    description: 'One key, 300+ models — smart routing and fallbacks.',
    keyUrl: 'https://openrouter.ai/keys',
    group: 'aggregator',
  },

  /* ------------------------------ Local ------------------------------ */
  {
    id: 'ollama',
    name: 'Ollama (local)',
    kind: 'ollama',
    baseUrl: 'http://127.0.0.1:11434/v1',
    defaultModel: 'qwen2.5-coder:14b',
    models: ['qwen2.5-coder:14b', 'qwen2.5-coder:32b', 'deepseek-coder-v2:16b', 'llama3.1:8b', 'codellama:13b', 'mistral:7b', 'gemma2:9b'],
    description: 'Run models fully offline. No API key needed.',
    keyUrl: 'https://ollama.com/download',
    group: 'local',
  },
  {
    id: 'lmstudio',
    name: 'LM Studio (local)',
    kind: 'lmstudio',
    baseUrl: 'http://127.0.0.1:1234/v1',
    defaultModel: 'local-model',
    models: ['local-model', 'qwen2.5-coder-7b-instruct', 'deepseek-r1-distill-qwen-14b', 'phi-4'],
    description: 'LM Studio local server. No API key needed.',
    keyUrl: 'https://lmstudio.ai/',
    group: 'local',
  },
  {
    id: 'custom',
    name: 'Custom OpenAI-compatible',
    kind: 'custom',
    baseUrl: 'http://127.0.0.1:8080/v1',
    defaultModel: 'custom-model',
    models: ['custom-model'],
    description: 'Any OpenAI-compatible endpoint (vLLM, llama.cpp server, text-generation-webui, your own gateway).',
    keyUrl: '',
    group: 'local',
  },
];

export function presetToConfig(preset: ProviderPreset): AIProviderConfig {
  return {
    id: preset.id,
    name: preset.name,
    kind: preset.kind,
    baseUrl: preset.baseUrl,
    model: preset.defaultModel,
    hasApiKey: false,
    temperature: 0.4,
    maxContextTokens: 128000,
    enabled: true,
  };
}

export function findPreset(id: string): ProviderPreset | undefined {
  return PROVIDER_CATALOG.find((p) => p.id === id);
}

export const GROUP_LABELS: Record<ProviderGroup, string> = {
  cloud: 'Cloud APIs',
  aggregator: 'Aggregators',
  local: 'Local & self-hosted',
};

/** Heuristic: which provider does this key probably belong to? (UI hint only) */
export function guessProviderByKey(key: string): string | null {
  const k = key.trim();
  if (!k) return null;
  if (k.startsWith('sk-ant-')) return 'claude';
  if (k.startsWith('sk-or-')) return 'openrouter';
  if (k.startsWith('gsk_')) return 'groq';
  if (k.startsWith('xai-')) return 'xai';
  if (k.startsWith('sk-')) return 'openai';
  if (k.startsWith('nvapi-')) return 'nvidia-nim';
  if (k.startsWith('hf_')) return 'huggingface';
  if (k.startsWith('github_pat_') || k.startsWith('ghp_')) return 'github-models';
  return null;
}
