import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

let done = false

export function setupMonaco() {
  if (done) return
  done = true
  ;(self as any).MonacoEnvironment = {
    getWorker(_id: string, label: string) {
      if (label === 'json') return new jsonWorker()
      if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker()
      if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker()
      if (label === 'typescript' || label === 'javascript') return new tsWorker()
      return new editorWorker()
    }
  }

  monaco.editor.defineTheme('wincode-dark', {
    base: 'vs-dark', inherit: true,
    rules: [
      { token: 'comment', foreground: '6B6B85', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'C084FC' },
      { token: 'string', foreground: 'A5D6A7' },
      { token: 'number', foreground: 'F9A8D4' },
      { token: 'type', foreground: '93C5FD' },
      { token: 'identifier', foreground: 'E5E7EB' },
      { token: 'annotation', foreground: 'FDE68A' },
      { token: 'tag', foreground: 'C084FC' },
      { token: 'attribute.name', foreground: '93C5FD' },
      { token: 'attribute.value', foreground: 'A5D6A7' }
    ],
    colors: {
      'editor.background': '#0D0D14',
      'editor.foreground': '#E5E7EB',
      'editor.lineHighlightBackground': '#15152288',
      'editorLineNumber.foreground': '#4B4B63',
      'editorLineNumber.activeForeground': '#A855F7',
      'editorCursor.foreground': '#A855F7',
      'editor.selectionBackground': '#9333EA44',
      'editor.inactiveSelectionBackground': '#9333EA22',
      'editorIndentGuide.background1': '#1C1C2C',
      'editorIndentGuide.activeBackground1': '#9333EA66',
      'editorWidget.background': '#13131F',
      'editorWidget.border': '#26263D',
      'editorSuggestWidget.selectedBackground': '#9333EA33',
      'editorHoverWidget.background': '#13131F',
      'minimap.background': '#0B0B1200',
      'scrollbarSlider.background': '#2A2A3F88',
      'scrollbarSlider.hoverBackground': '#9333EA88'
    }
  })

  monaco.editor.defineTheme('wincode-midnight', {
    base: 'vs-dark', inherit: true,
    rules: [
      { token: 'comment', foreground: '5B6B8C', fontStyle: 'italic' },
      { token: 'keyword', foreground: '7DD3FC' },
      { token: 'string', foreground: 'A5D6A7' },
      { token: 'number', foreground: 'F0ABFC' },
      { token: 'type', foreground: 'FDE68A' }
    ],
    colors: {
      'editor.background': '#070B16',
      'editor.lineHighlightBackground': '#0D152688',
      'editorCursor.foreground': '#38BDF8',
      'editor.selectionBackground': '#0369A144',
      'editorLineNumber.activeForeground': '#38BDF8'
    }
  })

  monaco.editor.defineTheme('wincode-light', {
    base: 'vs', inherit: true,
    rules: [{ token: 'keyword', foreground: '7C3AED' }],
    colors: { 'editor.background': '#FAFAFC', 'editorCursor.foreground': '#9333EA', 'editor.selectionBackground': '#9333EA2E' }
  })

  // Better defaults for TS/JS IntelliSense inside Monaco's built-in worker
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    allowJs: true, jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs
  })
  monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ESNext, allowJs: true
  })
}

export { monaco }
