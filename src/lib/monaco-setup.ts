import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
import type { WinCodeSettings } from '@shared/types';

declare global {
  interface Window {
    MonacoEnvironment?: monaco.Environment;
  }
}

let initialized = false;

export function setupMonaco() {
  if (initialized) return monaco;
  initialized = true;

  window.MonacoEnvironment = {
    getWorker(_workerId: string, label: string) {
      if (label === 'json') return new JsonWorker();
      if (label === 'css' || label === 'scss' || label === 'less') return new CssWorker();
      if (label === 'html' || label === 'handlebars' || label === 'razor') return new HtmlWorker();
      if (label === 'typescript' || label === 'javascript') return new TsWorker();
      return new EditorWorker();
    },
  };

  // Java / Kotlin-ish language definitions on top of the built-in ones
  if (!monaco.languages.getLanguages().some((l) => l.id === 'kotlin')) {
    monaco.languages.register({ id: 'kotlin' });
    monaco.languages.setMonarchTokensProvider('kotlin', {
      keywords: ['package', 'import', 'class', 'object', 'interface', 'fun', 'val', 'var', 'if', 'else', 'when', 'for', 'while', 'return', 'in', 'is', 'as', 'this', 'super', 'null', 'true', 'false', 'override', 'private', 'public', 'internal', 'protected', 'data', 'sealed', 'enum', 'companion', 'suspend', 'by', 'lazy', 'const', 'open', 'abstract'],
      typeKeywords: ['Int', 'Long', 'Double', 'Float', 'String', 'Boolean', 'Unit', 'Any', 'List', 'Map', 'Set'],
      tokenizer: {
        root: [
          [/\/\/.*$/, 'comment'],
          [/\/\*/, 'comment', '@comment'],
          [/"([^"\\]|\\.)*$/, 'string.invalid'],
          [/"/, 'string', '@string'],
          [/\d+\.\d+/, 'number'],
          [/\d+/, 'number'],
          [/[{}()[\]]/, '@brackets'],
          [/[<>]=?|==|!=|\+\+|--|&&|\|\||[+\-*/%=!]/, 'operator'],
          [/[a-zA-Z_]\w*/, { cases: { '@keywords': 'keyword', '@typeKeywords': 'type', '@default': 'identifier' } }],
        ],
        comment: [
          [/[^/*]+/, 'comment'],
          [/\*\//, 'comment', '@pop'],
          [/[/*]/, 'comment'],
        ],
        string: [
          [/[^\\"]+/, 'string'],
          [/\\./, 'string.escape'],
          [/"/, 'string', '@pop'],
        ],
      },
    } as monaco.languages.IMonarchLanguage);
  }

  // Custom premium themes
  monaco.editor.defineTheme('wincode-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6b6b80', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'c084fc' },
      { token: 'string', foreground: 'a5f3a1' },
      { token: 'number', foreground: 'fbbf24' },
      { token: 'type', foreground: '7dd3fc' },
      { token: 'function', foreground: 'e879f9' },
    ],
    colors: {
      'editor.background': '#0D0D14',
      'editor.foreground': '#E5E7EB',
      'editor.lineHighlightBackground': '#16162280',
      'editor.selectionBackground': '#9333EA55',
      'editorCursor.foreground': '#A855F7',
      'editorLineNumber.foreground': '#3f3f55',
      'editorLineNumber.activeForeground': '#A855F7',
      'editorWidget.background': '#11111B',
      'editorSuggestWidget.background': '#11111B',
      'editorSuggestWidget.selectedBackground': '#9333EA44',
    },
  });

  monaco.editor.defineTheme('wincode-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '8888aa', fontStyle: 'italic' },
      { token: 'keyword', foreground: '7c3aed' },
    ],
    colors: {
      'editor.background': '#ffffff',
      'editorCursor.foreground': '#7c3aed',
    },
  });

  return monaco;
}

export function themeFor(settings: WinCodeSettings | null): string {
  if (!settings) return 'wincode-dark';
  return settings.appearance.theme === 'light' ? 'wincode-light' : 'wincode-dark';
}

export interface InlineSuggestionProvider {
  (prefix: string, suffix: string, language: string, filePath: string): Promise<string>;
}

/** Registers the AI ghost-text (inline completion) provider. */
export function registerInlineAI(provider: InlineSuggestionProvider) {
  monaco.languages.registerInlineCompletionsProvider('*', {
    provideInlineCompletions: async (model, position) => {
      const value = model.getValue();
      const offset = model.getOffsetAt(position);
      const prefix = value.slice(Math.max(0, offset - 4000), offset);
      const suffix = value.slice(offset, offset + 800);
      try {
        const text = await provider(prefix, suffix, model.getLanguageId(), model.uri.path);
        if (!text) return { items: [] };
        return {
          items: [
            {
              insertText: text,
              range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
            },
          ],
        };
      } catch {
        return { items: [] };
      }
    },
    freeInlineCompletions: () => undefined,
  });
}

export function setModelMarkers(problems: { file: string; line: number; column: number; severity: 'error' | 'warning' | 'info'; message: string; source: string }[], modelPath: string) {
  const markers = problems
    .filter((p) => p.file.replace(/\\/g, '/').endsWith(modelPath.replace(/^\//, '')) || modelPath.includes(p.file.replace(/\\/g, '/')))
    .map((p) => ({
      severity:
        p.severity === 'error' ? monaco.MarkerSeverity.Error : p.severity === 'warning' ? monaco.MarkerSeverity.Warning : monaco.MarkerSeverity.Info,
      message: `${p.message} (${p.source})`,
      startLineNumber: p.line,
      startColumn: p.column || 1,
      endLineNumber: p.line,
      endColumn: (p.column || 1) + 120,
    }));
  const model = monaco.editor.getModels().find((m) => m.uri.path === modelPath);
  if (model) monaco.editor.setModelMarkers(model, 'wincode-build', markers);
}

export { monaco };
