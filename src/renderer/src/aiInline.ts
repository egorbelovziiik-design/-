import { monaco } from './monacoSetup'
import { useStore } from './store'

let registered = false
let debounce: ReturnType<typeof setTimeout> | null = null

/**
 * AI Inline Completion (ghost text). Tab — accept, Esc — dismiss (native Monaco behaviour).
 * Sends the code around the cursor to the *real* configured model. Disabled when offline/no key.
 */
export function registerAiInline() {
  if (registered) return
  registered = true
  monaco.languages.registerInlineCompletionsProvider('*', {
    provideInlineCompletions(model, position, _ctx, token) {
      const { settings, ai } = useStore.getState()
      if (!settings.aiInline) return { items: [] }
      if (ai.provider !== 'ollama' && ai.provider !== 'lmstudio' && ai.provider !== 'custom' && !ai.apiKey) return { items: [] }
      return new Promise(resolve => {
        if (debounce) clearTimeout(debounce)
        debounce = setTimeout(async () => {
          if (token.isCancellationRequested) return resolve({ items: [] })
          try {
            const before = model.getValueInRange(new monaco.Range(Math.max(1, position.lineNumber - 60), 1, position.lineNumber, position.column))
            const after = model.getValueInRange(new monaco.Range(position.lineNumber, position.column, Math.min(model.getLineCount(), position.lineNumber + 15), 1))
            const prompt = `You are a code completion engine. Continue the code at the cursor. Output ONLY the raw code completion (no explanations, no markdown fences), maximum 6 lines.\nLanguage: ${model.getLanguageId()}\n<pre>\n${before}<CURSOR>${after}\n</pre>`
            const text: string = await window.api.ai.complete({ ...ai, temperature: 0.15, maxTokens: 192 }, prompt)
            const clean = (text || '').replace(/^```\w*\n?/, '').replace(/```$/, '').split('\n').slice(0, 6).join('\n')
            if (!clean.trim() || token.isCancellationRequested) return resolve({ items: [] })
            resolve({ items: [{ insertText: clean, range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column) }] })
          } catch { resolve({ items: [] }) }
        }, 650)
      })
    },
    freeInlineCompletions() {}
  })
}
