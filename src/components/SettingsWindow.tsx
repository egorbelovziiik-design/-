import { useState, useEffect } from 'react';
import {
  X,
  Palette,
  Code2,
  Sparkles,
  Pickaxe,
  Coffee,
  Terminal,
  GitBranch,
  Puzzle,
  Keyboard,
  Cpu,
  Shield,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  Plus,
} from 'lucide-react';
import { useApp } from '../state/store';
import type { AIProviderConfig, WinCodeSettings } from '@shared/types';
import { PROVIDER_CATALOG, GROUP_LABELS, findPreset, guessProviderByKey } from '@shared/providers-catalog';

const sections = [
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'editor', label: 'Editor', icon: Code2 },
  { id: 'ai', label: 'AI Providers', icon: Sparkles },
  { id: 'minecraft', label: 'Minecraft', icon: Pickaxe },
  { id: 'java', label: 'Java & Gradle', icon: Coffee },
  { id: 'terminal', label: 'Terminal', icon: Terminal },
  { id: 'git', label: 'Git', icon: GitBranch },
  { id: 'plugins', label: 'Plugins', icon: Puzzle },
  { id: 'keybindings', label: 'Keybindings', icon: Keyboard },
  { id: 'performance', label: 'Performance', icon: Cpu },
  { id: 'privacy', label: 'Privacy', icon: Shield },
  { id: 'updates', label: 'Updates', icon: RefreshCw },
];

export default function SettingsWindow() {
  const open = useApp((s) => s.settingsOpen);
  const section = useApp((s) => s.settingsSection);
  const setOverlay = useApp((s) => s.setOverlay);
  const settings = useApp((s) => s.settings);
  const setSettings = useApp((s) => s.setSettings);
  const notify = useApp((s) => s.notify);

  if (!open || !settings) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={() => setOverlay('settings', false)}>
      <div
        className="flex h-[620px] w-[940px] max-w-[95vw] overflow-hidden rounded-2xl border shadow-panel animate-fade-in"
        style={{ background: 'var(--wc-panel)', borderColor: 'var(--wc-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-[210px] shrink-0 overflow-y-auto p-3" style={{ borderRight: '1px solid var(--wc-border)' }}>
          <div className="mb-3 px-2 text-[13px] font-semibold">Settings</div>
          {sections.map((s) => (
            <button
              key={s.id}
              className="mb-0.5 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11.5px] transition-colors"
              style={{
                background: section === s.id ? 'var(--wc-active)' : 'transparent',
                color: section === s.id ? 'var(--wc-neon)' : 'var(--wc-muted)',
              }}
              onClick={() => useApp.setState({ settingsSection: s.id })}
            >
              <s.icon size={13} /> {s.label}
            </button>
          ))}
        </div>

        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between px-5 pt-4">
            <div className="text-[15px] font-semibold">{sections.find((s) => s.id === section)?.label}</div>
            <button className="rounded-lg p-1.5 hover:bg-white/10" onClick={() => setOverlay('settings', false)}>
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {section === 'appearance' && <AppearanceSection settings={settings} setSettings={setSettings} />}
            {section === 'editor' && <EditorSection settings={settings} setSettings={setSettings} />}
            {section === 'ai' && <AISection settings={settings} notify={notify} />}
            {section === 'minecraft' && <MinecraftSection settings={settings} setSettings={setSettings} />}
            {section === 'java' && <JavaSection settings={settings} setSettings={setSettings} />}
            {section === 'terminal' && <TerminalSection settings={settings} setSettings={setSettings} />}
            {section === 'git' && <GitSection settings={settings} setSettings={setSettings} />}
            {section === 'plugins' && <div className="text-[11.5px]" style={{ color: 'var(--wc-muted)' }}>Open the Plugins view in the left activity bar to manage plugins.</div>}
            {section === 'keybindings' && <KeybindingsSection settings={settings} />}
            {section === 'performance' && <PerformanceSection settings={settings} setSettings={setSettings} />}
            {section === 'privacy' && <PrivacySection settings={settings} setSettings={setSettings} />}
            {section === 'updates' && <UpdatesSection />}
          </div>
          <div className="flex items-center justify-between px-5 pb-4 pt-2">
            <button
              className="wc-btn text-[11px]"
              onClick={async () => {
                await window.wincode.settingsReset();
                await useApp.getState().boot();
                notify('info', 'Settings reset to defaults');
              }}
            >
              Reset to defaults
            </button>
            <button className="wc-btn wc-btn-primary px-5 text-[12px]" onClick={() => setOverlay('settings', false)}>
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-3.5 flex items-center justify-between gap-4">
      <div className="flex-1">
        <div className="text-[11.5px] font-medium">{label}</div>
        {hint && <div className="text-[10px]" style={{ color: 'var(--wc-muted)' }}>{hint}</div>}
      </div>
      <div className="w-[240px] shrink-0">{children}</div>
    </div>
  );
}

function AppearanceSection({ settings, setSettings }: { settings: WinCodeSettings; setSettings: (p: Partial<WinCodeSettings>) => void }) {
  return (
    <div>
      <Row label="Theme" hint="Color scheme of the whole IDE">
        <select
          className="wc-input w-full"
          value={settings.appearance.theme}
          onChange={(e) => setSettings({ appearance: { ...settings.appearance, theme: e.target.value as WinCodeSettings['appearance']['theme'] } })}
        >
          <option value="aurora-dark">Aurora Dark (default)</option>
          <option value="midnight">Midnight</option>
          <option value="dracula">Dracula</option>
          <option value="synthwave">Synthwave</option>
          <option value="solarized">Solarized Dark</option>
          <option value="light">Light</option>
        </select>
      </Row>
      <Row label="Editor font">
        <input
          className="wc-input w-full"
          value={settings.appearance.editorFont}
          onChange={(e) => setSettings({ appearance: { ...settings.appearance, editorFont: e.target.value } })}
        />
      </Row>
      <Row label="Font size">
        <input
          type="number"
          min={10}
          max={28}
          className="wc-input w-full"
          value={settings.appearance.editorFontSize}
          onChange={(e) => setSettings({ appearance: { ...settings.appearance, editorFontSize: Number(e.target.value) } })}
        />
      </Row>
      <Row label="Font ligatures">
        <Toggle value={settings.appearance.editorLigatures} onChange={(v) => setSettings({ appearance: { ...settings.appearance, editorLigatures: v } })} />
      </Row>
      <Row label="Minimap">
        <Toggle value={settings.appearance.minimap} onChange={(v) => setSettings({ appearance: { ...settings.appearance, minimap: v } })} />
      </Row>
      <Row label="Smooth animations">
        <Toggle value={settings.appearance.smoothAnimations} onChange={(v) => setSettings({ appearance: { ...settings.appearance, smoothAnimations: v } })} />
      </Row>
      <Row label="Status bar">
        <Toggle value={settings.appearance.statusBarVisible} onChange={(v) => setSettings({ appearance: { ...settings.appearance, statusBarVisible: v } })} />
      </Row>
    </div>
  );
}

function EditorSection({ settings, setSettings }: { settings: WinCodeSettings; setSettings: (p: Partial<WinCodeSettings>) => void }) {
  return (
    <div>
      <Row label="Tab size">
        <select className="wc-input w-full" value={settings.editor.tabSize} onChange={(e) => setSettings({ editor: { ...settings.editor, tabSize: Number(e.target.value) } })}>
          {[2, 4, 8].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </Row>
      <Row label="Insert spaces">
        <Toggle value={settings.editor.insertSpaces} onChange={(v) => setSettings({ editor: { ...settings.editor, insertSpaces: v } })} />
      </Row>
      <Row label="Word wrap">
        <select className="wc-input w-full" value={settings.editor.wordWrap} onChange={(e) => setSettings({ editor: { ...settings.editor, wordWrap: e.target.value as WinCodeSettings['editor']['wordWrap'] } })}>
          <option value="off">Off</option>
          <option value="on">On</option>
          <option value="bounded">Bounded</option>
        </select>
      </Row>
      <Row label="Auto save">
        <select className="wc-input w-full" value={settings.editor.autoSave} onChange={(e) => setSettings({ editor: { ...settings.editor, autoSave: e.target.value as WinCodeSettings['editor']['autoSave'] } })}>
          <option value="off">Off</option>
          <option value="afterDelay">After delay</option>
          <option value="onFocusChange">On focus change</option>
        </select>
      </Row>
      <Row label="Auto save delay (ms)">
        <input type="number" className="wc-input w-full" value={settings.editor.autoSaveDelayMs} onChange={(e) => setSettings({ editor: { ...settings.editor, autoSaveDelayMs: Number(e.target.value) } })} />
      </Row>
      <Row label="Format on save">
        <Toggle value={settings.editor.formatOnSave} onChange={(v) => setSettings({ editor: { ...settings.editor, formatOnSave: v } })} />
      </Row>
      <Row label="Line numbers">
        <select className="wc-input w-full" value={settings.editor.lineNumbers} onChange={(e) => setSettings({ editor: { ...settings.editor, lineNumbers: e.target.value as WinCodeSettings['editor']['lineNumbers'] } })}>
          <option value="on">On</option>
          <option value="off">Off</option>
          <option value="relative">Relative</option>
        </select>
      </Row>
      <Row label="Bracket pair colorization">
        <Toggle value={settings.editor.bracketPairs} onChange={(v) => setSettings({ editor: { ...settings.editor, bracketPairs: v } })} />
      </Row>
    </div>
  );
}

function AISection({ settings, notify }: { settings: WinCodeSettings; notify: (k: 'info' | 'success' | 'warning' | 'error', m: string, d?: string) => void }) {
  const [providers, setProviders] = useState<AIProviderConfig[]>([]);
  const [activeId, setActiveId] = useState(settings.ai.activeProviderId);
  const [keyInput, setKeyInput] = useState('');
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; latencyMs: number } | null>(null);
  const [testing, setTesting] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [customOpen, setCustomOpen] = useState(false);
  const [customForm, setCustomForm] = useState({ name: '', baseUrl: '', model: '' });

  const refresh = async () => {
    const list = (await window.wincode.aiListProviders()) as unknown as AIProviderConfig[];
    setProviders(list);
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = providers.find((p) => p.id === activeId);
  const activePreset = active ? findPreset(active.id) : undefined;
  const q = query.toLowerCase();
  const shownPresets = PROVIDER_CATALOG.filter(
    (p) => !q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.models.some((m) => m.toLowerCase().includes(q)),
  );

  const setActive = async (id: string) => {
    setActiveId(id);
    setTestResult(null);
    setModels([]);
    setKeyInput('');
    await useApp.getState().setSettings({ ai: { ...settings.ai, activeProviderId: id } });
    await refresh();
  };

  return (
    <div className="flex h-full min-h-0 gap-4">
      {/* ---------- provider library ---------- */}
      <div className="flex w-[290px] shrink-0 flex-col">
        <div className="mb-2 text-[11px] font-semibold">
          Provider library
          <span className="ml-1.5 text-[10px] font-normal" style={{ color: 'var(--wc-muted)' }}>
            {PROVIDER_CATALOG.length} available
          </span>
        </div>
        <input className="wc-input mb-2 w-full text-[11px]" placeholder="Search providers or models…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {(['cloud', 'aggregator', 'local'] as const).map((group) => {
            const items = shownPresets.filter((p) => p.group === group);
            if (!items.length) return null;
            return (
              <div key={group} className="mb-3">
                <div className="mb-1 text-[9.5px] font-semibold uppercase tracking-wider" style={{ color: 'var(--wc-muted)' }}>
                  {GROUP_LABELS[group]}
                </div>
                {items.map((preset) => {
                  const conf = providers.find((p) => p.id === preset.id);
                  const isActive = preset.id === activeId;
                  return (
                    <button
                      key={preset.id}
                      className="mb-1 w-full rounded-lg border p-2 text-left transition-colors"
                      style={{
                        borderColor: isActive ? 'var(--wc-accent)' : 'var(--wc-border)',
                        background: isActive ? 'var(--wc-active)' : 'var(--wc-editor)',
                      }}
                      onClick={() => setActive(preset.id)}
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: conf?.hasApiKey || preset.kind === 'ollama' || preset.kind === 'lmstudio' ? '#22C55E' : 'var(--wc-muted)' }}
                        />
                        <span className="text-[11px] font-medium">{preset.name}</span>
                        <span className="ml-auto rounded px-1 text-[8.5px]" style={{ background: 'var(--wc-active)', color: 'var(--wc-neon)' }}>
                          {preset.kind}
                        </span>
                      </div>
                      <div className="mt-0.5 line-clamp-2 text-[9px] leading-snug" style={{ color: 'var(--wc-muted)' }}>
                        {preset.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* ---------- configuration ---------- */}
      <div className="min-w-0 flex-1 overflow-y-auto">
        {active ? (
          <>
            <div className="mb-3 flex items-center gap-2">
              <div className="text-[13px] font-semibold">{active.name}</div>
              <span className="rounded px-1.5 py-0.5 text-[9px]" style={{ background: 'var(--wc-active)', color: 'var(--wc-neon)' }}>
                {active.kind}
              </span>
              {activePreset?.keyUrl && (
                <button
                  className="ml-auto text-[10px] underline"
                  style={{ color: 'var(--wc-neon)' }}
                  onClick={() => void window.wincode.showMessage({ title: 'Get API key', message: `Open in browser:\n${activePreset.keyUrl}`, buttons: ['OK'] })}
                >
                  Get API key →
                </button>
              )}
            </div>

            <Row label="Base URL">
              <input
                className="wc-input w-full font-mono text-[10px]"
                value={active.baseUrl}
                onChange={async (e) => {
                  await window.wincode.aiUpdateProvider(active.id, { baseUrl: e.target.value });
                  await refresh();
                }}
              />
            </Row>

            <Row label="Model" hint={activePreset ? `Quick pick · ${activePreset.models.length} known models` : 'Any model id'}>
              <div className="space-y-1.5">
                <select
                  className="wc-input w-full text-[10.5px]"
                  value={active.model}
                  onChange={async (e) => {
                    await window.wincode.aiUpdateProvider(active.id, { model: e.target.value });
                    await refresh();
                  }}
                >
                  {[active.model, ...(activePreset?.models ?? []).filter((m) => m !== active.model)].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <input
                  className="wc-input w-full font-mono text-[10px]"
                  placeholder="…or type a custom model id"
                  onBlur={async (e) => {
                    if (e.target.value.trim()) {
                      await window.wincode.aiUpdateProvider(active.id, { model: e.target.value.trim() });
                      e.target.value = '';
                      await refresh();
                    }
                  }}
                />
              </div>
            </Row>

            <Row label="Temperature" hint="0 = deterministic, 1 = creative">
              <input
                type="number"
                step={0.1}
                min={0}
                max={2}
                className="wc-input w-full"
                value={active.temperature}
                onChange={async (e) => {
                  await window.wincode.aiUpdateProvider(active.id, { temperature: Number(e.target.value) });
                }}
              />
            </Row>

            <Row
              label="API key"
              hint={
                active.hasApiKey
                  ? 'Saved securely (encrypted via OS keychain)'
                  : keyInput && guessProviderByKey(keyInput)
                    ? `Looks like a ${findPreset(guessProviderByKey(keyInput)!)?.name ?? 'known'} key`
                    : 'Stored encrypted with Electron safeStorage'
              }
            >
              <div className="flex gap-1.5">
                <input
                  type="password"
                  className="wc-input flex-1"
                  placeholder={active.hasApiKey ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022 (saved)' : 'Paste API key…'}
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                />
                <button
                  className="wc-btn text-[10.5px]"
                  onClick={async () => {
                    if (!keyInput.trim()) return;
                    await window.wincode.aiSetKey(active.id, keyInput.trim());
                    setKeyInput('');
                    await refresh();
                    notify('success', 'API key saved securely');
                  }}
                >
                  Save
                </button>
              </div>
            </Row>

            <div className="mb-4 flex items-center gap-2">
              <button
                className="wc-btn text-[11px]"
                disabled={testing}
                onClick={async () => {
                  setTesting(true);
                  setTestResult(null);
                  try {
                    const res = await window.wincode.aiTestProvider(active.id);
                    setTestResult(res);
                    if (res.models?.length) setModels(res.models);
                  } catch (err) {
                    setTestResult({ ok: false, message: (err as Error).message, latencyMs: 0 });
                  } finally {
                    setTesting(false);
                  }
                }}
              >
                {testing ? <Loader2 size={11} className="spin" /> : <Eye size={11} />} Test connection
              </button>
              {testResult && (
                <div className="flex items-center gap-1.5 text-[10px]" style={{ color: testResult.ok ? '#22C55E' : '#EF4444' }}>
                  {testResult.ok ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                  {testResult.message} ({testResult.latencyMs} ms)
                </div>
              )}
            </div>

            {models.length > 0 && (
              <div className="mb-4">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--wc-muted)' }}>
                  Models reported by the API ({models.length})
                </div>
                <div className="flex max-h-[110px] flex-wrap gap-1 overflow-y-auto rounded-lg border p-2" style={{ borderColor: 'var(--wc-border)' }}>
                  {models.slice(0, 60).map((m) => (
                    <button
                      key={m}
                      className="rounded-full border px-2 py-0.5 text-[9px]"
                      style={{ borderColor: active.model === m ? 'var(--wc-accent)' : 'var(--wc-border)', color: 'var(--wc-text)' }}
                      onClick={async () => {
                        await window.wincode.aiUpdateProvider(active.id, { model: m });
                        await refresh();
                      }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="my-2 h-px" style={{ background: 'var(--wc-border)' }} />
            <Row label="Inline AI completion" hint="Ghost-text suggestions in the editor (Tab accepts)">
              <Toggle value={settings.ai.inlineCompletion} onChange={async (v) => await useApp.getState().setSettings({ ai: { ...settings.ai, inlineCompletion: v } })} />
            </Row>
            <Row label="Auto-approve safe agent tools" hint="File reads/searches run without prompts">
              <Toggle value={settings.ai.agentAutoApproveSafe} onChange={async (v) => await useApp.getState().setSettings({ ai: { ...settings.ai, agentAutoApproveSafe: v } })} />
            </Row>
          </>
        ) : (
          <div className="text-[11px]" style={{ color: 'var(--wc-muted)' }}>
            Select a provider on the left.
          </div>
        )}

        {/* custom provider */}
        <div className="mt-3 h-px" style={{ background: 'var(--wc-border)' }} />
        <button className="wc-btn mt-3 text-[11px]" onClick={() => setCustomOpen(!customOpen)}>
          <Plus size={11} /> Add custom provider
        </button>
        {customOpen && (
          <div className="mt-2 space-y-2 rounded-lg border p-3" style={{ borderColor: 'var(--wc-border)', background: 'var(--wc-editor)' }}>
            <input className="wc-input w-full text-[11px]" placeholder="Provider name" value={customForm.name} onChange={(e) => setCustomForm({ ...customForm, name: e.target.value })} />
            <input className="wc-input w-full font-mono text-[10px]" placeholder="Base URL — https://api.example.com/v1" value={customForm.baseUrl} onChange={(e) => setCustomForm({ ...customForm, baseUrl: e.target.value })} />
            <input className="wc-input w-full font-mono text-[10px]" placeholder="Default model id" value={customForm.model} onChange={(e) => setCustomForm({ ...customForm, model: e.target.value })} />
            <button
              className="wc-btn wc-btn-primary w-full justify-center text-[11px]"
              disabled={!customForm.name.trim() || !customForm.baseUrl.trim()}
              onClick={async () => {
                const id = 'custom-' + customForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString(36);
                await window.wincode.aiAddProvider({
                  id,
                  name: customForm.name.trim(),
                  kind: 'custom',
                  baseUrl: customForm.baseUrl.trim(),
                  model: customForm.model.trim() || 'custom-model',
                  hasApiKey: false,
                  temperature: 0.4,
                  maxContextTokens: 128000,
                  enabled: true,
                });
                setCustomOpen(false);
                setCustomForm({ name: '', baseUrl: '', model: '' });
                await refresh();
                await setActive(id);
                notify('success', 'Custom provider added');
              }}
            >
              Add provider
            </button>
          </div>
        )}

        <div className="mt-3 rounded-lg border p-3 text-[10px] leading-relaxed" style={{ borderColor: 'var(--wc-border)', background: 'var(--wc-editor)', color: 'var(--wc-muted)' }}>
          Requests go directly from the app to the selected provider API — no intermediate servers. Streaming and tool
          calling are supported wherever the provider API supports them. Keys are encrypted with the OS credential
          vault (DPAPI on Windows).
        </div>
      </div>
    </div>
  );
}

function MinecraftSection({ settings, setSettings }: { settings: WinCodeSettings; setSettings: (p: Partial<WinCodeSettings>) => void }) {
  return (
    <div>
      <Row label="Default Minecraft version">
        <input className="wc-input w-full" value={settings.minecraft.defaultMinecraftVersion} onChange={(e) => setSettings({ minecraft: { ...settings.minecraft, defaultMinecraftVersion: e.target.value } })} />
      </Row>
      <Row label="Default mod loader">
        <select className="wc-input w-full" value={settings.minecraft.defaultLoader} onChange={(e) => setSettings({ minecraft: { ...settings.minecraft, defaultLoader: e.target.value as WinCodeSettings['minecraft']['defaultLoader'] } })}>
          <option value="fabric">Fabric</option>
          <option value="forge">Forge</option>
          <option value="neoforge">NeoForge</option>
          <option value="quilt">Quilt</option>
        </select>
      </Row>
      <Row label="Default Java version">
        <select className="wc-input w-full" value={settings.minecraft.defaultJavaVersion} onChange={(e) => setSettings({ minecraft: { ...settings.minecraft, defaultJavaVersion: e.target.value } })}>
          <option value="8">Java 8 (legacy)</option>
          <option value="17">Java 17</option>
          <option value="21">Java 21</option>
        </select>
      </Row>
      <div className="rounded-lg border p-3 text-[10.5px]" style={{ borderColor: 'var(--wc-border)', background: 'var(--wc-editor)', color: 'var(--wc-muted)' }}>
        The Minecraft Development Center generates projects with verified version combinations (Fabric Loom,
        ForgeGradle, NeoForge ModDevGradle) — incompatible library mixes are prevented by the built-in compatibility
        matrix.
      </div>
    </div>
  );
}

function JavaSection({ settings, setSettings }: { settings: WinCodeSettings; setSettings: (p: Partial<WinCodeSettings>) => void }) {
  return (
    <div>
      <Row label="Gradle JVM arguments">
        <input className="wc-input w-full font-mono text-[11px]" value={settings.minecraft.gradleJvmArgs} onChange={(e) => setSettings({ minecraft: { ...settings.minecraft, gradleJvmArgs: e.target.value } })} />
      </Row>
      <div className="rounded-lg border p-3 text-[10.5px] leading-relaxed" style={{ borderColor: 'var(--wc-border)', background: 'var(--wc-editor)', color: 'var(--wc-muted)' }}>
        Java language support uses Monaco's built-in Java service plus the project's Gradle/Maven build for full
        compilation diagnostics. To enable a full Language Server (Eclipse JDT LS), install it and point the plugin
        manager to its launcher — diagnostics from the build are shown in the Problems panel regardless.
      </div>
    </div>
  );
}

function TerminalSection({ settings, setSettings }: { settings: WinCodeSettings; setSettings: (p: Partial<WinCodeSettings>) => void }) {
  return (
    <div>
      <Row label="Windows shell">
        <input className="wc-input w-full font-mono text-[11px]" value={settings.terminal.shellWindows} onChange={(e) => setSettings({ terminal: { ...settings.terminal, shellWindows: e.target.value } })} />
      </Row>
      <Row label="Terminal font size">
        <input type="number" className="wc-input w-full" value={settings.terminal.fontSize} onChange={(e) => setSettings({ terminal: { ...settings.terminal, fontSize: Number(e.target.value) } })} />
      </Row>
      <Row label="Scrollback lines">
        <input type="number" className="wc-input w-full" value={settings.terminal.scrollback} onChange={(e) => setSettings({ terminal: { ...settings.terminal, scrollback: Number(e.target.value) } })} />
      </Row>
    </div>
  );
}

function GitSection({ settings, setSettings }: { settings: WinCodeSettings; setSettings: (p: Partial<WinCodeSettings>) => void }) {
  return (
    <div>
      <Row label="User name">
        <input className="wc-input w-full" value={settings.git.userName} onChange={(e) => setSettings({ git: { ...settings.git, userName: e.target.value } })} />
      </Row>
      <Row label="User email">
        <input className="wc-input w-full" value={settings.git.userEmail} onChange={(e) => setSettings({ git: { ...settings.git, userEmail: e.target.value } })} />
      </Row>
      <Row label="Auto fetch">
        <Toggle value={settings.git.autoFetch} onChange={(v) => setSettings({ git: { ...settings.git, autoFetch: v } })} />
      </Row>
    </div>
  );
}

function KeybindingsSection({ settings }: { settings: WinCodeSettings }) {
  return (
    <div>
      {Object.entries(settings.keybindings).map(([action, key]) => (
        <div key={action} className="mb-1.5 flex items-center justify-between rounded-lg border px-3 py-2" style={{ borderColor: 'var(--wc-border)' }}>
          <span className="text-[11px]">{action}</span>
          <kbd className="rounded px-2 py-0.5 font-mono text-[10px]" style={{ background: 'var(--wc-active)', color: 'var(--wc-neon)' }}>
            {key}
          </kbd>
        </div>
      ))}
    </div>
  );
}

function PerformanceSection({ settings, setSettings }: { settings: WinCodeSettings; setSettings: (p: Partial<WinCodeSettings>) => void }) {
  return (
    <div>
      <Row label="Index large files" hint="Improves AI context, uses more memory">
        <Toggle value={settings.performance.indexLargeFiles} onChange={(v) => setSettings({ performance: { ...settings.performance, indexLargeFiles: v } })} />
      </Row>
      <Row label="Max indexed file size (KB)">
        <input type="number" className="wc-input w-full" value={settings.performance.maxFileSizeKb} onChange={(e) => setSettings({ performance: { ...settings.performance, maxFileSizeKb: Number(e.target.value) } })} />
      </Row>
      <Row label="Lazy file tree loading">
        <Toggle value={settings.performance.lazyTree} onChange={(v) => setSettings({ performance: { ...settings.performance, lazyTree: v } })} />
      </Row>
    </div>
  );
}

function PrivacySection({ settings, setSettings }: { settings: WinCodeSettings; setSettings: (p: Partial<WinCodeSettings>) => void }) {
  return (
    <div>
      <Row label="Send code context to AI" hint="When off, only your messages are sent">
        <Toggle value={settings.privacy.sendCodeToAI} onChange={(v) => setSettings({ privacy: { ...settings.privacy, sendCodeToAI: v } })} />
      </Row>
      <Row label="Anonymous usage statistics">
        <Toggle value={settings.privacy.anonymousStats} onChange={(v) => setSettings({ privacy: { ...settings.privacy, anonymousStats: v } })} />
      </Row>
      <div className="rounded-lg border p-3 text-[10.5px] leading-relaxed" style={{ borderColor: 'var(--wc-border)', background: 'var(--wc-editor)', color: 'var(--wc-muted)' }}>
        API keys are encrypted with the operating system credential vault (Electron safeStorage / DPAPI on Windows) and
        never leave the app except in Authorization headers sent directly to the selected AI provider.
      </div>
    </div>
  );
}

function UpdatesSection() {
  const [info, setInfo] = useState<{ current: string; latest: string; upToDate: boolean } | null>(null);
  useEffect(() => {
    void window.wincode.updateCheck().then(setInfo);
  }, []);
  return (
    <div>
      {info ? (
        <div className="rounded-lg border p-4 text-[11.5px]" style={{ borderColor: 'var(--wc-border)', background: 'var(--wc-editor)' }}>
          Current version: <b>{info.current}</b>
          <br />
          {info.upToDate ? (
            <span style={{ color: '#22C55E' }}>✓ You are up to date.</span>
          ) : (
            <span style={{ color: '#F59E0B' }}>Update available: {info.latest}</span>
          )}
        </div>
      ) : (
        <Loader2 size={14} className="spin" />
      )}
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      className="relative h-5 w-10 rounded-full transition-colors"
      style={{ background: value ? 'var(--wc-accent)' : 'var(--wc-border)' }}
      onClick={() => onChange(!value)}
    >
      <span
        className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all"
        style={{ left: value ? 22 : 2 }}
      />
    </button>
  );
}
