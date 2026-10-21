import React, { useEffect, useState } from 'react'
import { X, Palette, Type, Brain, Gamepad2, Coffee, TerminalSquare, Shield, RefreshCw, Check } from 'lucide-react'
import { useStore } from '../store'
import { PROVIDERS, type ProviderId } from '@shared/types'

const SECTIONS = [
  { id: 'appearance', label: 'Внешний вид', icon: Palette },
  { id: 'editor', label: 'Редактор', icon: Type },
  { id: 'ai', label: 'AI (WinCode Intelligence)', icon: Brain },
  { id: 'minecraft', label: 'Minecraft и Аккаунты', icon: Gamepad2 },
  { id: 'java', label: 'Java / Gradle', icon: Coffee },
  { id: 'terminal', label: 'Терминал', icon: TerminalSquare },
  { id: 'privacy', label: 'Приватность и обновления', icon: Shield }
] as const

const inp = 'w-full bg-[#14141F] border border-(--color-border) rounded-lg px-2.5 py-1.5 text-[13px] outline-none focus:border-(--color-accent2)'
const lbl = 'text-[12px] text-(--color-muted) block mb-1'
const row = 'mb-4'

export default function SettingsModal() {
  const { set, settings, setSettings, ai, setAi, log } = useStore()
  const [sec, setSec] = useState<string>('appearance')
  const [models, setModels] = useState<string[]>([])
  const [testResult, setTestResult] = useState('')
  const [info, setInfo] = useState<any>(null)

  useEffect(() => { window.api.info().then(setInfo).catch(() => {}) }, [])

  async function fetchModels() {
    try {
      const m: string[] = await window.api.ai.models(ai)
      setModels(m)
      setTestResult(`✓ Подключено. Доступно моделей: ${m.length}`)
    } catch (e: any) { setTestResult(`✗ ${e.message}`) }
  }

  async function testChat() {
    setTestResult('Проверка…')
    try {
      const r: string = await window.api.ai.complete({ ...ai, maxTokens: 64 }, 'Reply with exactly: WinCode AI connected')
      setTestResult(`✓ Модель ответила: ${r.trim().slice(0, 120)}`)
    } catch (e: any) { setTestResult(`✗ ${e.message}`) }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-6" onClick={() => set({ showSettings: false })}>
      <div className="bg-(--color-panel) border border-(--color-border) rounded-2xl w-[880px] max-w-full h-[640px] max-h-full flex overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="w-56 border-r border-(--color-border) p-2 space-y-0.5 shrink-0">
          <div className="px-2 py-2 font-semibold text-[14px]">Настройки</div>
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setSec(s.id)} className={`flex items-center gap-2 w-full text-left px-2.5 py-1.5 rounded-lg text-[12.5px] ${sec === s.id ? 'bg-(--color-selected) text-white' : 'text-[#C9CAD6] hover:bg-(--color-hover)'}`}><s.icon size={14} className="text-(--color-accent2)" />{s.label}</button>
          ))}
          <div className="px-2 pt-4 text-[11px] text-(--color-muted) leading-relaxed">WinCode AI v{info?.version || '1.0.0'}<br />{info?.platform || ''}<br />Настройки сохраняются автоматически.</div>
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center px-5 h-12 border-b border-(--color-border)">
            <span className="font-medium">{SECTIONS.find(s => s.id === sec)?.label}</span>
            <div className="flex-1" />
            <button className="p-1.5 rounded hover:bg-(--color-hover)" onClick={() => set({ showSettings: false })}><X size={16} /></button>
          </div>
          <div className="flex-1 overflow-auto p-5">
            {sec === 'appearance' && (<>
              <div className={row}><span className={lbl}>Тема оформления</span>
                <div className="flex gap-2">
                  {([['wincode-dark', 'Premium Dark (фиолетовая)'], ['wincode-midnight', 'Midnight Blue'], ['wincode-light', 'Light']] as const).map(([id, name]) => (
                    <button key={id} onClick={() => setSettings({ theme: id })} className={`px-3 py-2 rounded-lg border text-[12.5px] ${settings.theme === id ? 'border-(--color-accent2) bg-(--color-selected)' : 'border-(--color-border) hover:border-(--color-accent)'}`}>{name}</button>
                  ))}
                </div></div>
              <div className={row}><span className={lbl}>Шрифт редактора</span><input className={inp} value={settings.fontFamily} onChange={e => setSettings({ fontFamily: e.target.value })} /></div>
              <div className={row}><span className={lbl}>Размер шрифта: {settings.fontSize}px</span>
                <input type="range" min={10} max={24} value={settings.fontSize} onChange={e => setSettings({ fontSize: Number(e.target.value) })} className="w-64 accent-purple-500" /></div>
            </>)}

            {sec === 'editor' && (<>
              {([['autoSave', 'Автосохранение файлов (каждые 2.5 с)'], ['minimap', 'Minimap'], ['wordWrap', 'Перенос строк'], ['aiInline', 'AI Inline Completion (ghost-text, Tab — принять)']] as const).map(([k, name]) => (
                <label key={k} className="flex items-center gap-2 mb-3 text-[13px] cursor-pointer">
                  <input type="checkbox" checked={(settings as any)[k]} onChange={e => setSettings({ [k]: e.target.checked })} className="accent-purple-500 w-4 h-4" /> {name}
                </label>
              ))}
              <div className={row}><span className={lbl}>Размер табуляции</span>
                <select className={inp + ' w-32'} value={settings.tabSize} onChange={e => setSettings({ tabSize: Number(e.target.value) })}>{[2, 4, 8].map(n => <option key={n} value={n}>{n}</option>)}</select></div>
              <div className="text-[12px] text-(--color-muted) leading-relaxed border border-(--color-border) rounded-lg p-3">
                Горячие клавиши: Ctrl+S — сохранить · Ctrl+Shift+F — форматировать · Ctrl+H — найти/заменить · Ctrl+P — быстрый файл · Ctrl+Shift+P — палитра команд · Ctrl+` — терминал · Ctrl+J — нижняя панель · Ctrl+B — боковая панель · Ctrl+K — AI по выделенному · F2 — переименовать символ (Monaco) · F12 — к определению (для TS/JSON встроено; для Java — через сборку/JDT LS).
              </div>
            </>)}

            {sec === 'ai' && (<>
              <div className={row}><span className={lbl}>Провайдер</span>
                <select className={inp} value={ai.provider} onChange={e => setAi({ provider: e.target.value as ProviderId })}>
                  {Object.entries(PROVIDERS).map(([id, p]) => <option key={id} value={id}>{p.label}</option>)}
                </select></div>
              <div className={row}><span className={lbl}>Модель (можно ввести свою)</span>
                <input className={inp} value={ai.model} onChange={e => setAi({ model: e.target.value })} list="wc-models" />
                <datalist id="wc-models">{[...PROVIDERS[ai.provider].models, ...models].map(m => <option key={m} value={m} />)}</datalist></div>
              <div className={row}><span className={lbl}>Base URL</span><input className={inp} value={ai.baseUrl} onChange={e => setAi({ baseUrl: e.target.value })} /></div>
              <div className={row}><span className={lbl}>API Key (хранится зашифрованно через Windows DPAPI / safeStorage)</span>
                <input type="password" className={inp} value={ai.apiKey} onChange={e => setAi({ apiKey: e.target.value })} placeholder={PROVIDERS[ai.provider].needsKey ? 'sk-…' : 'Не требуется для локальных моделей'} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className={row}><span className={lbl}>Temperature: {ai.temperature}</span>
                  <input type="range" min={0} max={1.5} step={0.05} value={ai.temperature} onChange={e => setAi({ temperature: Number(e.target.value) })} className="w-full accent-purple-500" /></div>
                <div className={row}><span className={lbl}>Max Tokens</span>
                  <input type="number" className={inp} value={ai.maxTokens} onChange={e => setAi({ maxTokens: Number(e.target.value) })} /></div>
              </div>
              <div className="flex gap-2">
                <button onClick={fetchModels} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-(--color-hover) hover:bg-(--color-selected) text-[12.5px]"><RefreshCw size={13} /> Загрузить модели с сервера</button>
                <button onClick={testChat} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-(--color-accent) text-white text-[12.5px]"><Check size={13} /> Проверить подключение</button>
              </div>
              {testResult && <div className={`mt-3 text-[12.5px] rounded-lg p-2.5 border ${testResult.startsWith('✓') ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-red-500/40 bg-red-500/10'}`}>{testResult}</div>}
              <div className="text-[11.5px] text-(--color-muted) mt-3 leading-relaxed">Локально без интернета: установите Ollama (ollama pull qwen2.5-coder:14b) или LM Studio — WinCode AI подключится к 127.0.0.1. Streaming поддерживается для всех провайдеров.</div>
            </>)}

            {sec === 'minecraft' && (<>
              <div className={row}><span className={lbl}>Azure AD client_id (для Microsoft Login)</span>
                <input className={inp} value={settings.azureClientId} onChange={e => setSettings({ azureClientId: e.target.value })} placeholder="00000000-0000-0000-0000-000000000000" />
                <div className="text-[11.5px] text-(--color-muted) mt-1.5 leading-relaxed">Как получить (бесплатно, 2 минуты): portal.azure.com → Microsoft Entra ID → App registrations → New registration → «Personal Microsoft accounts» → в Authentication включите «Allow public client flows» → API permissions → добавьте XboxLive.signin. Вставьте Application (client) ID сюда.</div></div>
              <div className={row}><span className={lbl}>RAM по умолчанию для лаунчера (MB): {settings.launcherRam}</span>
                <input type="range" min={1024} max={16384} step={512} value={settings.launcherRam} onChange={e => setSettings({ launcherRam: Number(e.target.value) })} className="w-72 accent-purple-500" /></div>
              <div className="text-[12px] text-(--color-muted) leading-relaxed border border-(--color-border) rounded-lg p-3">Аккаунты управляются на панели «Minecraft Accounts» слева. Токены Microsoft не сохраняются в открытом виде на диск лаунчером IDE; генерируемые проекты-лаунчеры должны хранить refresh-токены в защищённом хранилище ОС.</div>
            </>)}

            {sec === 'java' && (<>
              <div className={row}><span className={lbl}>JAVA_HOME (JDK 21 для Minecraft 1.21+)</span><input className={inp} value={settings.javaHome} onChange={e => setSettings({ javaHome: e.target.value })} placeholder="C:\Program Files\Java\jdk-21" /></div>
              <div className={row}><span className={lbl}>Eclipse JDT LS — путь к org.eclipse.equinox.launcher_*.jar</span><input className={inp} value={settings.jdtPath} onChange={e => setSettings({ jdtPath: e.target.value })} placeholder="C:\jdtls\plugins\org.eclipse.equinox.launcher_1.6.900.v2024.jar" /></div>
              <div className="flex gap-2 mb-3">
                <button className="px-3 py-1.5 rounded-lg bg-(--color-accent) text-white text-[12.5px]" onClick={async () => {
                  const root = useStore.getState().projectRoot
                  try { await window.api.ls.startJava(settings.jdtPath, root || ''); log('Eclipse JDT LS: процесс запущен (лог — в Выводе). Мост LSP↔Monaco в разработке; диагностика Java — через сборку Gradle.', 'sys') } catch (e: any) { log(`JDT LS: ${e.message}`, 'err') }
                }}>Запустить JDT LS</button>
                <button className="px-3 py-1.5 rounded-lg bg-(--color-hover) text-[12.5px]" onClick={() => window.api.ls.stop('java')}>Остановить</button>
                <button className="px-3 py-1.5 rounded-lg bg-(--color-hover) text-[12.5px]" onClick={async () => {
                  const r = await window.api.proc.exec(settings.javaHome ? `"${settings.javaHome}/bin/java" -version` : 'java -version', '')
                  log(`java -version:\n${r.output}`, 'sys'); useStore.getState().set({ showBottom: true, bottomTab: 'output' })
                }}>Проверить java -version</button>
              </div>
              <div className="text-[12px] text-(--color-muted) leading-relaxed">Скачать JDT LS: download.eclipse.org/jdtls/snapshots. Gradle Wrapper WinCode AI скачивает в проекты автоматически; системный Gradle не обязателен.</div>
            </>)}

            {sec === 'terminal' && (<>
              <div className={row}><span className={lbl}>Оболочка по умолчанию (Windows)</span>
                <select className={inp + ' w-56'} value={settings.defaultShell} onChange={e => setSettings({ defaultShell: e.target.value as any })}>
                  <option value="powershell">PowerShell</option><option value="cmd">CMD</option>
                </select>
                <div className="text-[11.5px] text-(--color-muted) mt-1.5">Применится к новым вкладкам терминала. Git для Windows обеспечит команду git, Node.js — npm, Python — python в PATH.</div></div>
            </>)}

            {sec === 'privacy' && (<>
              <div className="text-[13px] leading-relaxed space-y-3">
                <p>🔒 <strong>Ключи API</strong> шифруются Electron safeStorage (Windows DPAPI) и отправляются только на выбранный вами endpoint провайдера.</p>
                <p>🧠 <strong>AI Project Memory</strong> (.wincode/index.json) хранится локально в папке проекта; содержимое файлов уходит модели только как контекст ваших запросов.</p>
                <p>🔄 <strong>Обновления:</strong> сборки публикуются через GitHub Actions/Releases репозитория проекта; автообновление подключается через electron-updater при публикации релизов.</p>
                <p>📁 Данные приложения: <span className="font-mono text-[12px]">{info?.userData || '%APPDATA%\\wincode-ai'}</span></p>
              </div>
            </>)}
          </div>
        </div>
      </div>
    </div>
  )
}
